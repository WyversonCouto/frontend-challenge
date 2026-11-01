import { delay, http, HttpResponse, type HttpResponseResolver } from 'msw'
import { z } from 'zod'
import { cmpEth } from '@/lib/eth'
import type {
  ApiErrorBody,
  ApiErrorCode,
  Nft,
  NftPage,
  NftSort,
  SocketEvent,
  User,
} from '@/lib/types'
import { bus } from './bus'
import {
  avatarFor,
  buildQuote,
  commit,
  couponStatus,
  createOrder,
  db,
  findNft,
  hashPassword,
  initDb,
  nextId,
  publicOrder,
  resetDb,
  SESSION_TTL_MS,
  settleIfDue,
  settleOrder,
  touchNft,
  type DbUser,
} from './db'
import { getScenario, latencyFor, loadScenario, once, SCENARIOS, setScenario, type ScenarioName } from './scenarios'

const api = (path: string) => `*/api${path}`

/* ------------------------------------------------------------------ */
/* Respostas e erros                                                   */
/* ------------------------------------------------------------------ */

const STATUS: Record<ApiErrorCode, number> = {
  validation: 422,
  unauthorized: 401,
  session_expired: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  email_taken: 409,
  coupon_invalid: 422,
  coupon_expired: 422,
  price_changed: 409,
  sold_out: 409,
  idempotency_conflict: 409,
  transient: 503,
  payment_declined: 402,
  wallet_refused: 422,
}

function fail(code: ApiErrorCode, message: string, extra: Partial<ApiErrorBody> = {}) {
  const body: ApiErrorBody = { code, message, ...extra }
  return HttpResponse.json(body, { status: STATUS[code] })
}

function validationFail(error: z.ZodError) {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) fields[String(issue.path[0] ?? 'form')] ??= issue.message
  return fail('validation', 'Revise os campos destacados.', { fields })
}

/* ------------------------------------------------------------------ */
/* Autenticação                                                        */
/* ------------------------------------------------------------------ */

const publicUser = (u: DbUser): User => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  avatarUrl: u.avatarUrl,
})

export function userForToken(token?: string | null): DbUser | null {
  if (!token) return null
  const session = db().sessions[token]
  if (!session || session.expiresAt < Date.now()) return null
  return db().users.find((u) => u.id === session.userId) ?? null
}

function bearer(request: Request) {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
}

type Authed = { user: DbUser; token: string }

/** Retorna o usuário ou a resposta de erro 401. Aplica o cenário de sessão expirada. */
function authenticate(request: Request): Authed | Response {
  const token = bearer(request)
  if (!token) return fail('unauthorized', 'Entre na sua conta para continuar.')
  if (getScenario() === 'session_expired' && once('expire')) {
    delete db().sessions[token]
    commit()
    return fail('session_expired', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  const user = userForToken(token)
  if (!user) return fail('session_expired', 'Sua sessão expirou. Entre novamente para continuar.')
  return { user, token }
}

const isResponse = (v: Authed | Response): v is Response => v instanceof Response

function openSession(user: DbUser) {
  const token = `tok_${crypto.randomUUID()}`
  const expiresAt = Date.now() + SESSION_TTL_MS
  db().sessions[token] = { userId: user.id, expiresAt }
  commit()
  return { user: publicUser(user), token, expiresAt }
}

const passwordRule = z
  .string()
  .min(8, 'Use ao menos 8 caracteres.')
  .regex(/[A-Z]/, 'Inclua uma letra maiúscula.')
  .regex(/\d/, 'Inclua um número.')

/* ------------------------------------------------------------------ */
/* Cenários: latência, queda de conexão e falhas                       */
/* ------------------------------------------------------------------ */

/**
 * Envolve todo handler REST. É a única camada que conhece os cenários de rede;
 * componentes, hooks e o cliente Axios não têm caminhos alternativos.
 */
function scenario(resolver: HttpResponseResolver): HttpResponseResolver {
  return async (info) => {
    const url = new URL(info.request.url)
    const path = url.pathname + url.search
    const sc = getScenario()

    if (sc === 'offline') {
      await delay(300)
      return HttpResponse.error()
    }
    await delay(latencyFor(path))

    const isNftList = /\/api\/nfts$/.test(url.pathname)
    if (sc === 'server_error' && isNftList) return fail('transient', 'O servidor não respondeu. Tente novamente.')
    if (sc === 'flaky' && isNftList && once(`flaky:${url.search}`)) {
      return fail('transient', 'Falha temporária. Tente novamente.')
    }
    if (sc === 'favorites_fail' && url.pathname.includes('/api/favorites') && info.request.method !== 'GET') {
      return fail('transient', 'Não foi possível atualizar os favoritos.')
    }
    return resolver(info)
  }
}

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

function listNfts(params: URLSearchParams): NftPage {
  const q = params.get('q')?.trim().toLowerCase()
  const category = params.get('category')
  const network = params.get('network')
  const min = params.get('minPrice')
  const max = params.get('maxPrice')
  const tab = params.get('tab')
  const sort = (params.get('sort') ?? (tab === 'trending' ? 'trending' : 'recent')) as NftSort | 'trending'
  const pageSize = Math.min(Math.max(Number(params.get('pageSize')) || 9, 1), 48)
  const requested = Math.max(Number(params.get('page')) || 1, 1)

  let items: Nft[] = getScenario() === 'empty' ? [] : [...db().nfts]
  const base = items
  if (q) items = items.filter((n) => `${n.name} ${n.collection}`.toLowerCase().includes(q))
  if (category) items = items.filter((n) => n.category === category)
  if (network) items = items.filter((n) => n.network === network)
  if (min) items = items.filter((n) => cmpEth(n.price, min) >= 0)
  if (max) items = items.filter((n) => cmpEth(n.price, max) <= 0)
  if (tab === 'new') {
    const cutoff = [...db().nfts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[11]?.createdAt ?? ''
    items = items.filter((n) => n.createdAt >= cutoff)
  }

  const sorters: Record<NftSort | 'trending', (a: Nft, b: Nft) => number> = {
    trending: (a, b) => b.reviews - a.reviews,
    recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
    price_asc: (a, b) => cmpEth(a.price, b.price),
    price_desc: (a, b) => cmpEth(b.price, a.price),
    name: (a, b) => a.name.localeCompare(b.name),
  }
  items.sort(sorters[sort] ?? sorters.recent)

  const total = items.length
  const totalPages = Math.max(Math.ceil(total / pageSize), 1)
  const page = Math.min(requested, totalPages)
  const count = (key: 'category' | 'network') =>
    base.reduce<Record<string, number>>((acc, n) => ({ ...acc, [n[key]]: (acc[n[key]] ?? 0) + 1 }), {})

  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    totalPages,
    facets: { categories: count('category'), networks: count('network') },
  }
}

/* ------------------------------------------------------------------ */
/* Schemas de entrada                                                  */
/* ------------------------------------------------------------------ */

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome.'),
    username: z.string().trim().min(3, 'Use ao menos 3 caracteres.'),
    email: z.email('Informe um e-mail válido.'),
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem.',
  })

const loginSchema = z.object({ email: z.email('Informe um e-mail válido.'), password: z.string().min(1, 'Informe a senha.') })

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.'),
  username: z.string().trim().min(3, 'Use ao menos 3 caracteres.'),
  email: z.email('Informe um e-mail válido.'),
  avatarDataUrl: z.string().startsWith('data:image/').max(400_000, 'Imagem muito grande.').nullable().optional(),
})

const passwordSchema = z
  .object({ currentPassword: z.string().min(1, 'Informe a senha atual.'), newPassword: passwordRule, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem.' })

const walletSchema = z.object({
  kind: z.enum(['primary', 'secondary']),
  displayName: z.string().trim().min(2, 'Informe o nome de exibição.'),
  nickname: z.string().trim().min(2, 'Informe o apelido.'),
  network: z.enum(['Ethereum', 'Polygon', 'Solana']),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço inválido (0x + 40 caracteres).'),
  type: z.enum(['MetaMask', 'WalletConnect', 'Coinbase Wallet']),
  profileName: z.string().trim().min(2, 'Informe o nome do perfil.'),
  referralCode: z.string().trim().min(2, 'Informe o código de indicação.'),
  email: z.email('Informe um e-mail válido.'),
  ens: z.string().trim().regex(/^[a-z0-9-]{3,}(\.[a-z0-9-]+)*\.eth$/i, 'Use o formato nome.eth.'),
  linkedRef: z.string().trim().optional(),
})

const itemsSchema = z.array(z.object({ nftId: z.string(), quantity: z.number().int().min(1).max(99) })).max(50)

const orderSchema = z.object({
  items: itemsSchema.min(1, 'O carrinho está vazio.'),
  coupon: z.string().optional(),
  walletId: z.string().min(1, 'Selecione uma carteira.'),
  network: z.enum(['Ethereum', 'Polygon', 'Solana']),
  buyer: z.object({
    displayName: z.string().trim().min(2, 'Informe o nome de exibição.'),
    email: z.email('Informe um e-mail válido.'),
    note: z.string().max(280).optional(),
  }),
  expectedTotal: z.string(),
  expectedFingerprint: z.string(),
})

async function body<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T> | Response> {
  const json = await request.json().catch(() => ({}))
  const parsed = schema.safeParse(json)
  return parsed.success ? parsed.data : validationFail(parsed.error)
}
const bad = (v: unknown): v is Response => v instanceof Response

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

export const restHandlers = [
  /* ---------- Sessão e conta ---------- */
  http.post(
    api('/auth/register'),
    scenario(async ({ request }) => {
      const data = await body(request, registerSchema)
      if (bad(data)) return data
      if (db().users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
        return fail('email_taken', 'Este e-mail já tem uma conta.', { fields: { email: 'Este e-mail já está em uso.' } })
      }
      if (db().users.some((u) => u.username.toLowerCase() === data.username.toLowerCase())) {
        return fail('conflict', 'Este nome de usuário já existe.', { fields: { username: 'Escolha outro nome de usuário.' } })
      }
      const id = nextId('user')
      const salt = `salt-${id}`
      const user: DbUser = {
        id,
        name: data.name,
        username: data.username,
        email: data.email,
        avatarUrl: avatarFor(data.name),
        salt,
        passwordHash: await hashPassword(data.password, salt),
      }
      db().users.push(user)
      db().favorites[id] = []
      db().carts[id] = { items: [] }
      db().wallets[id] = []
      return HttpResponse.json(openSession(user), { status: 201 })
    }),
  ),

  http.post(
    api('/auth/login'),
    scenario(async ({ request }) => {
      const data = await body(request, loginSchema)
      if (bad(data)) return data
      const user = db().users.find((u) => u.email.toLowerCase() === data.email.toLowerCase())
      const ok = user && (await hashPassword(data.password, user.salt)) === user.passwordHash
      if (!user || !ok) return fail('unauthorized', 'E-mail ou senha incorretos.')
      return HttpResponse.json(openSession(user))
    }),
  ),

  http.get(
    api('/auth/session'),
    scenario(({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const s = db().sessions[auth.token]
      return HttpResponse.json({ user: publicUser(auth.user), token: auth.token, expiresAt: s.expiresAt })
    }),
  ),

  http.post(
    api('/auth/logout'),
    scenario(({ request }) => {
      const token = bearer(request)
      if (token) delete db().sessions[token]
      commit()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  /* ---------- NFTs ---------- */
  http.get(
    api('/nfts'),
    scenario(({ request }) => HttpResponse.json(listNfts(new URL(request.url).searchParams))),
  ),

  http.get(
    api('/nfts/:id'),
    scenario(({ params }) => {
      const nft = findNft(String(params.id))
      return nft ? HttpResponse.json(nft) : fail('not_found', 'Este NFT não existe ou foi removido.')
    }),
  ),

  /* ---------- Favoritos ---------- */
  http.get(
    api('/favorites'),
    scenario(({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      return HttpResponse.json({ nftIds: db().favorites[auth.user.id] ?? [] })
    }),
  ),
  http.put(
    api('/favorites/:nftId'),
    scenario(({ request, params }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      if (!findNft(String(params.nftId))) return fail('not_found', 'Este NFT não existe.')
      const list = (db().favorites[auth.user.id] ??= [])
      if (!list.includes(String(params.nftId))) list.push(String(params.nftId))
      commit()
      return HttpResponse.json({ nftIds: list })
    }),
  ),
  http.delete(
    api('/favorites/:nftId'),
    scenario(({ request, params }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      db().favorites[auth.user.id] = (db().favorites[auth.user.id] ?? []).filter((id) => id !== params.nftId)
      commit()
      return HttpResponse.json({ nftIds: db().favorites[auth.user.id] })
    }),
  ),

  /* ---------- Carrinho (usuário autenticado) ---------- */
  http.get(
    api('/cart'),
    scenario(({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      return HttpResponse.json(db().carts[auth.user.id] ?? { items: [] })
    }),
  ),
  http.post(
    api('/cart/items'),
    scenario(async ({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const data = await body(request, z.object({ nftId: z.string(), quantity: z.number().int().min(1).max(99) }))
      if (bad(data)) return data
      const nft = findNft(data.nftId)
      if (!nft) return fail('not_found', 'Este NFT não existe.')
      const cart = (db().carts[auth.user.id] ??= { items: [] })
      const current = cart.items.find((i) => i.nftId === data.nftId)
      const wanted = (current?.quantity ?? 0) + data.quantity
      if (wanted > nft.editionsAvailable) {
        return fail('sold_out', `Só há ${nft.editionsAvailable} edição(ões) disponível(is).`, {
          fields: { quantity: `Máximo de ${nft.editionsAvailable}.` },
        })
      }
      if (current) current.quantity = wanted
      else cart.items.push({ nftId: data.nftId, quantity: data.quantity })
      commit()
      return HttpResponse.json(cart)
    }),
  ),
  http.patch(
    api('/cart/items/:nftId'),
    scenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const data = await body(request, z.object({ quantity: z.number().int().min(1).max(99) }))
      if (bad(data)) return data
      const nft = findNft(String(params.nftId))
      const cart = (db().carts[auth.user.id] ??= { items: [] })
      const item = cart.items.find((i) => i.nftId === params.nftId)
      if (!nft || !item) return fail('not_found', 'Este item não está no carrinho.')
      if (data.quantity > nft.editionsAvailable) {
        return fail('sold_out', `Só há ${nft.editionsAvailable} edição(ões) disponível(is).`, {
          fields: { quantity: `Máximo de ${nft.editionsAvailable}.` },
        })
      }
      item.quantity = data.quantity
      commit()
      return HttpResponse.json(cart)
    }),
  ),
  http.delete(
    api('/cart/items/:nftId'),
    scenario(({ request, params }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const cart = (db().carts[auth.user.id] ??= { items: [] })
      cart.items = cart.items.filter((i) => i.nftId !== params.nftId)
      commit()
      return HttpResponse.json(cart)
    }),
  ),
  /** Mescla o carrinho de visitante ao autenticar, respeitando o estoque. */
  http.post(
    api('/cart/merge'),
    scenario(async ({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const data = await body(request, z.object({ items: itemsSchema, coupon: z.string().optional() }))
      if (bad(data)) return data
      const cart = (db().carts[auth.user.id] ??= { items: [] })
      for (const incoming of data.items) {
        const nft = findNft(incoming.nftId)
        if (!nft) continue
        const current = cart.items.find((i) => i.nftId === incoming.nftId)
        const quantity = Math.min((current?.quantity ?? 0) + incoming.quantity, nft.editionsAvailable)
        if (quantity <= 0) continue
        if (current) current.quantity = quantity
        else cart.items.push({ nftId: incoming.nftId, quantity })
      }
      if (data.coupon && !cart.coupon) cart.coupon = data.coupon
      commit()
      return HttpResponse.json(cart)
    }),
  ),
  http.put(
    api('/cart/coupon'),
    scenario(async ({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const data = await body(request, z.object({ code: z.string().trim().min(1, 'Informe o código.') }))
      if (bad(data)) return data
      const { status } = couponStatus(data.code)
      if (status === 'invalid') return fail('coupon_invalid', 'Este cupom não existe.', { fields: { code: 'Cupom inválido.' } })
      if (status === 'expired') return fail('coupon_expired', 'Este cupom expirou.', { fields: { code: 'Cupom expirado.' } })
      const cart = (db().carts[auth.user.id] ??= { items: [] })
      cart.coupon = data.code.trim().toUpperCase()
      commit()
      return HttpResponse.json(cart)
    }),
  ),
  http.delete(
    api('/cart/coupon'),
    scenario(({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const cart = (db().carts[auth.user.id] ??= { items: [] })
      delete cart.coupon
      commit()
      return HttpResponse.json(cart)
    }),
  ),

  /* ---------- Cotação (pública: o visitante também vê o resumo) ---------- */
  http.post(
    api('/quote'),
    scenario(async ({ request }) => {
      const data = await body(request, z.object({ items: itemsSchema, coupon: z.string().optional() }))
      if (bad(data)) return data
      return HttpResponse.json(buildQuote(data.items, data.coupon))
    }),
  ),

  /* ---------- Pedidos ---------- */
  http.post(
    api('/orders'),
    scenario(async ({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const key = request.headers.get('idempotency-key')
      if (!key) return fail('validation', 'Falta a chave de idempotência.', { fields: { 'Idempotency-Key': 'Obrigatória.' } })

      const raw = await request.text()
      let json: unknown
      try {
        json = JSON.parse(raw)
      } catch {
        json = {}
      }
      const parsed = orderSchema.safeParse(json)
      if (!parsed.success) return validationFail(parsed.error)
      const input = parsed.data

      // Mesma chave + mesmo conteúdo = mesmo pedido. Mesma chave + outro conteúdo = conflito.
      const idKey = `${auth.user.id}:${key}`
      const known = db().idempotency[idKey]
      // Define "o mesmo pedido": itens, cupom, carteira, rede e comprador. Os valores esperados
      // mudam com preço e estoque, então não entram: repetir o envio recupera o mesmo pedido.
      const hash = JSON.stringify({ items: input.items, coupon: input.coupon, walletId: input.walletId, network: input.network, buyer: input.buyer })
      if (known) {
        if (known.hash !== hash) {
          return fail('idempotency_conflict', 'Esta chave já foi usada com outro conteúdo.')
        }
        const existing = db().orders.find((o) => o.id === known.orderId)!
        settleIfDue(existing)
        return HttpResponse.json(publicOrder(existing), { status: 200 })
      }

      const sc = getScenario()
      if (sc === 'price_changed_at_checkout' && once('price')) {
        const first = findNft(input.items[0].nftId)
        if (first) touchNft(first.id, { price: (Number(first.price) + 0.1).toFixed(2) })
      }
      if (sc === 'sold_out_at_checkout' && once('sold')) {
        const first = findNft(input.items[0].nftId)
        if (first) touchNft(first.id, { editionsAvailable: 0 })
      }

      const quote = buildQuote(input.items, input.coupon)
      if (quote.lines.length !== input.items.length || quote.lines.some((l) => !l.ok)) {
        return fail('sold_out', 'Alguma edição acabou. Revise o carrinho.', { quote })
      }
      if (quote.fingerprint !== input.expectedFingerprint || cmpEth(quote.total, input.expectedTotal) !== 0) {
        return fail('price_changed', 'Os valores mudaram. Revise e confirme de novo.', { quote })
      }
      const wallet = (db().wallets[auth.user.id] ?? []).find((w) => w.id === input.walletId)
      if (!wallet) return fail('validation', 'Selecione uma carteira cadastrada.', { fields: { walletId: 'Carteira inválida.' } })

      const order = createOrder({ userId: auth.user.id, quote, wallet, network: input.network })
      db().idempotency[idKey] = { hash, orderId: order.id }
      commit()

      // O pedido já existe, mas a resposta se perde. O cliente recupera pela mesma chave.
      if (sc === 'order_timeout' && once('timeout')) {
        await delay(400)
        return HttpResponse.error()
      }
      return HttpResponse.json(publicOrder(order), { status: 201 })
    }),
  ),
  http.get(
    api('/orders'),
    scenario(({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const mine = db().orders.filter((o) => o.userId === auth.user.id)
      mine.forEach(settleIfDue)
      return HttpResponse.json({ orders: mine.map(publicOrder).reverse() })
    }),
  ),
  http.get(
    api('/orders/:id'),
    scenario(({ request, params }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const order = db().orders.find((o) => o.id === params.id)
      if (!order) return fail('not_found', 'Pedido não encontrado.')
      if (order.userId !== auth.user.id) return fail('forbidden', 'Você não tem acesso a este pedido.')
      settleIfDue(order)
      return HttpResponse.json(publicOrder(order))
    }),
  ),

  /* ---------- Perfil ---------- */
  http.get(
    api('/profile'),
    scenario(({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      return HttpResponse.json(publicUser(auth.user))
    }),
  ),
  http.patch(
    api('/profile'),
    scenario(async ({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const data = await body(request, profileSchema)
      if (bad(data)) return data
      if (db().users.some((u) => u.id !== auth.user.id && u.email.toLowerCase() === data.email.toLowerCase())) {
        return fail('email_taken', 'Este e-mail já tem uma conta.', { fields: { email: 'Este e-mail já está em uso.' } })
      }
      if (db().users.some((u) => u.id !== auth.user.id && u.username.toLowerCase() === data.username.toLowerCase())) {
        return fail('conflict', 'Este nome de usuário já existe.', { fields: { username: 'Escolha outro nome de usuário.' } })
      }
      auth.user.name = data.name
      auth.user.username = data.username
      auth.user.email = data.email
      if (data.avatarDataUrl !== undefined) auth.user.avatarUrl = data.avatarDataUrl
      commit()
      return HttpResponse.json(publicUser(auth.user))
    }),
  ),
  http.post(
    api('/profile/password'),
    scenario(async ({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const data = await body(request, passwordSchema)
      if (bad(data)) return data
      if ((await hashPassword(data.currentPassword, auth.user.salt)) !== auth.user.passwordHash) {
        return fail('validation', 'A senha atual está incorreta.', { fields: { currentPassword: 'Senha atual incorreta.' } })
      }
      auth.user.passwordHash = await hashPassword(data.newPassword, auth.user.salt)
      commit()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  /* ---------- Carteiras ---------- */
  http.get(
    api('/wallets'),
    scenario(({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      return HttpResponse.json({ wallets: db().wallets[auth.user.id] ?? [] })
    }),
  ),
  http.post(
    api('/wallets'),
    scenario(async ({ request }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const data = await body(request, walletSchema)
      if (bad(data)) return data
      const list = (db().wallets[auth.user.id] ??= [])
      if (list.some((w) => w.kind === data.kind)) {
        return fail('conflict', `Você já tem uma carteira ${data.kind === 'primary' ? 'principal' : 'secundária'}.`, {
          fields: { kind: 'Edite a carteira existente.' },
        })
      }
      if (list.some((w) => w.address.toLowerCase() === data.address.toLowerCase())) {
        return fail('conflict', 'Este endereço já está cadastrado.', { fields: { address: 'Endereço já cadastrado.' } })
      }
      const wallet = { ...data, id: nextId('wallet') }
      list.push(wallet)
      commit()
      return HttpResponse.json(wallet, { status: 201 })
    }),
  ),
  http.put(
    api('/wallets/:id'),
    scenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const data = await body(request, walletSchema)
      if (bad(data)) return data
      const list = db().wallets[auth.user.id] ?? []
      const wallet = list.find((w) => w.id === params.id)
      if (!wallet) return fail('not_found', 'Carteira não encontrada.')
      if (list.some((w) => w.id !== wallet.id && w.address.toLowerCase() === data.address.toLowerCase())) {
        return fail('conflict', 'Este endereço já está cadastrado.', { fields: { address: 'Endereço já cadastrado.' } })
      }
      Object.assign(wallet, data)
      commit()
      return HttpResponse.json(wallet)
    }),
  ),
  /** Simula conexão, recusa e desconexão. A Coinbase Wallet das fixtures sempre recusa. */
  http.post(
    api('/wallets/:id/connection'),
    scenario(async ({ request, params }) => {
      const auth = authenticate(request)
      if (isResponse(auth)) return auth
      const data = await body(request, z.object({ action: z.enum(['connect', 'disconnect']) }))
      if (bad(data)) return data
      const wallet = (db().wallets[auth.user.id] ?? []).find((w) => w.id === params.id)
      if (!wallet) return fail('not_found', 'Carteira não encontrada.')
      if (data.action === 'connect' && wallet.type === 'Coinbase Wallet') {
        await delay(600)
        return fail('wallet_refused', 'A carteira recusou a conexão.')
      }
      await delay(400)
      return HttpResponse.json({ walletId: wallet.id, connected: data.action === 'connect' })
    }),
  ),
]

/* ------------------------------------------------------------------ */
/* Controle do ambiente simulado (demo e testes)                       */
/* Estes endpoints NÃO passam pelo wrapper de cenários.                */
/* ------------------------------------------------------------------ */

const ctrl = (path: string) => `*/__mock${path}`

export const controlHandlers = [
  http.get(ctrl('/state'), () =>
    HttpResponse.json({ scenario: getScenario(), scenarios: SCENARIOS, sockets: bus.size() }),
  ),
  http.post(ctrl('/reset'), async () => {
    await resetDb()
    setScenario('default')
    return HttpResponse.json({ ok: true })
  }),
  http.post(ctrl('/scenario'), async ({ request }) => {
    const { name } = (await request.json()) as { name: ScenarioName }
    if (!(SCENARIOS as readonly string[]).includes(name)) return fail('validation', 'Cenário desconhecido.')
    setScenario(name)
    return HttpResponse.json({ scenario: name })
  }),
  /** Altera preço/estoque; o evento nft.updated sai pelo Socket.IO. */
  http.post(ctrl('/nfts/:id'), async ({ request, params }) => {
    const patch = (await request.json()) as { price?: string; editionsAvailable?: number }
    const nft = touchNft(String(params.id), patch)
    return nft ? HttpResponse.json(nft) : fail('not_found', 'NFT não encontrado.')
  }),
  /** Entrega um evento exatamente como recebido: duplicata, versão antiga, outro usuário. */
  http.post(ctrl('/socket/emit'), async ({ request }) => {
    const { event, payload } = (await request.json()) as { event: string; payload: SocketEvent }
    bus.publishRaw(event, payload)
    return HttpResponse.json({ delivered: bus.size() })
  }),
  /** Derruba todas as conexões para exercitar reconexão e reconciliação. */
  http.post(ctrl('/socket/disconnect'), () => {
    bus.disconnectAll()
    return HttpResponse.json({ ok: true })
  }),
  /** Força a resolução imediata de um pedido pendente. */
  http.post(ctrl('/orders/:id/settle'), async ({ params }) => {
    const order = settleOrder(String(params.id))
    return order ? HttpResponse.json(publicOrder(order)) : fail('not_found', 'Pedido não encontrado.')
  }),
]

export async function prepareMocks() {
  await initDb()
  loadScenario()
}
