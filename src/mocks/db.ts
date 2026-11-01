import { addEth, cmpEth, fromWei, mulEthInt, pctEth, subEth, sumEth, toWei } from '@/lib/eth'
import type {
  Cart,
  CartItem,
  NetworkName,
  Nft,
  Order,
  Quote,
  User,
  Wallet,
} from '@/lib/types'
import { bus } from './bus'
import { getScenario } from './scenarios'

const STORAGE_KEY = 'kurio:mock:db:v2'
export const NETWORK_FEE = '0.016'
export const SESSION_TTL_MS = 30 * 60 * 1000
export const ORDER_SETTLE_MS = 2500

/* ------------------------------------------------------------------ */
/* Tipos internos do servidor simulado                                 */
/* ------------------------------------------------------------------ */

export interface DbUser extends User {
  salt: string
  passwordHash: string
}

export interface DbOrder extends Order {
  userId: string
  settleAt: number
  willDecline: boolean
}

interface Db {
  nfts: Nft[]
  users: DbUser[]
  sessions: Record<string, { userId: string; expiresAt: number }>
  favorites: Record<string, string[]>
  carts: Record<string, Cart>
  wallets: Record<string, Wallet[]>
  orders: DbOrder[]
  idempotency: Record<string, { hash: string; orderId: string }>
  counters: { event: number; quote: number; order: number; id: number }
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Senhas nunca ficam em claro: hash SHA-256 com salt por usuário (simulação). */
export async function hashPassword(password: string, salt: string) {
  return sha256(`${salt}:${password}`)
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Substituição de asset: o Figma usa ilustrações próprias, que não vêm no enunciado.
 * Aqui cada NFT recebe uma arte SVG determinística (data URI), sem rede e sem licença.
 */
function art(seed: number, variant = 0): string {
  const rnd = mulberry32(seed * 31 + variant * 7)
  const hue = Math.floor(rnd() * 360)
  const fur = `hsl(${(hue + 20) % 360} 45% 38%)`
  const hat = `hsl(${(hue + 140) % 360} 35% 52%)`
  const bg = `hsl(${hue} 30% 82%)`
  const glasses = rnd() > 0.5
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="${bg}"/><ellipse cx="120" cy="230" rx="90" ry="60" fill="${hat}"/><circle cx="120" cy="115" r="62" fill="${fur}"/><circle cx="62" cy="118" r="16" fill="${fur}"/><circle cx="178" cy="118" r="16" fill="${fur}"/><ellipse cx="120" cy="140" rx="34" ry="26" fill="hsl(${hue} 40% 78%)"/>${
    glasses
      ? `<rect x="78" y="94" width="34" height="22" rx="8" fill="#1d1410"/><rect x="128" y="94" width="34" height="22" rx="8" fill="#1d1410"/>`
      : `<circle cx="95" cy="104" r="7" fill="#1d1410"/><circle cx="145" cy="104" r="7" fill="#1d1410"/>`
  }<rect x="105" y="146" width="30" height="5" rx="2.5" fill="#1d1410"/><path d="M62 70 Q120 20 178 70 Z" fill="${hat}"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function avatarFor(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return art(h % 1000, 3)
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  'Arte digital',
  'Fotografia',
  'Música',
  'Arte 3D',
  'Colecionáveis',
  'Generativa',
  'Jogos',
  'Assinaturas',
  'Utilidade',
]
const NETWORKS: NetworkName[] = ['Ethereum', 'Polygon', 'Solana']

// Nomes e preços vistos no layout; o restante do catálogo é gerado de forma determinística.
const FIGMA_NFTS: Array<[string, string]> = [
  ['Emerald Ape #042', '1.19'],
  ['Sage Nomad #009', '1.64'],
  ['Neon Vessel #032', '1.99'],
  ['Cosmic Bloom #118', '1.29'],
  ['Violet Nomad #074', '1.39'],
  ['Ivory Baron #088', '1.79'],
  ['Golden Beat #207', '0.99'],
  ['Golden Frequency #071', '0.69'],
  ['Golden Signal #168', '0.39'],
]

const ADJ = ['Amber', 'Jade', 'Onyx', 'Lunar', 'Solar', 'Coral', 'Cobalt', 'Velvet', 'Rustic', 'Misty']
const NOUN = ['Ape', 'Drifter', 'Echo', 'Relic', 'Voyager', 'Sentinel', 'Totem', 'Oracle', 'Warden', 'Muse']

function seedNfts(): Nft[] {
  const rnd = mulberry32(42)
  const out: Nft[] = []
  const total = 58
  for (let i = 0; i < total; i++) {
    const fixed = FIGMA_NFTS[i]
    const num = String(Math.floor(rnd() * 900) + 100)
    const name = fixed ? fixed[0] : `${ADJ[i % ADJ.length]} ${NOUN[(i * 3) % NOUN.length]} #${num}`
    const price = fixed ? fixed[1] : (0.2 + Math.floor(rnd() * 380) / 100).toFixed(2)
    const editionsTotal = i % 7 === 3 ? 1 : 5 + Math.floor(rnd() * 20)
    // Dois itens esgotados e um com poucas unidades, para exercitar limites.
    const available = i === 20 || i === 33 ? 0 : i === 5 ? 2 : Math.max(1, Math.floor(editionsTotal * rnd()))
    out.push({
      id: `nft-${String(i + 1).padStart(3, '0')}`,
      name,
      collection: i % 3 === 0 ? 'Kurio Apes' : i % 3 === 1 ? 'Nomad Club' : 'Signal Series',
      category: CATEGORIES[i % CATEGORIES.length],
      network: NETWORKS[i % NETWORKS.length],
      price,
      editionsTotal,
      editionsAvailable: Math.min(available, editionsTotal),
      imageUrl: art(i + 1),
      gallery: [art(i + 1), art(i + 1, 1), art(i + 1, 2), art(i + 1, 3)],
      rating: 4 + Math.round(rnd() * 10) / 10,
      reviews: 20 + Math.floor(rnd() * 120),
      description:
        'Um colecionável digital finalizado à mão da coleção Kurio Edições, verificado na Ethereum, com arte desdobrável e acesso a lançamentos exclusivos para colecionadores.',
      tokenId: `#${String(1000 + i * 17)}`,
      attributes: ['Óculos', 'Esmeralda', 'Ouro'],
      createdAt: new Date(Date.UTC(2026, 9, 1) - i * 86_400_000).toISOString(),
      version: 1,
    })
  }
  return out
}

export const SEED_CREDENTIALS = [
  { email: 'ana@kurio.test', password: 'Kurio@123' },
  { email: 'bruno@kurio.test', password: 'Kurio@123' },
]

async function seedDb(): Promise<Db> {
  const mk = async (id: string, name: string, username: string, email: string, password: string) => {
    const salt = `salt-${id}`
    return {
      id,
      name,
      username,
      email,
      avatarUrl: null,
      salt,
      passwordHash: await hashPassword(password, salt),
    } satisfies DbUser
  }
  const ana = await mk('user-ana', 'Ana Souza', 'ana.souza', 'ana@kurio.test', 'Kurio@123')
  const bruno = await mk('user-bruno', 'Bruno Lima', 'bruno.lima', 'bruno@kurio.test', 'Kurio@123')
  return {
    nfts: seedNfts(),
    users: [ana, bruno],
    sessions: {},
    favorites: { [ana.id]: ['nft-001'], [bruno.id]: [] },
    carts: { [ana.id]: { items: [] }, [bruno.id]: { items: [] } },
    wallets: {
      [ana.id]: [
        {
          id: 'wallet-ana-1',
          kind: 'primary',
          displayName: 'Ana Souza',
          nickname: 'Principal',
          network: 'Ethereum',
          profileName: 'ana.souza',
          address: '0xA91F4c2d8b0E73aF5C19d6E2b7A03f48c1D9E82C',
          type: 'MetaMask',
          referralCode: 'KURIO-ANA',
          email: 'ana@kurio.test',
          ens: 'ana.eth',
        },
        {
          // Esta carteira sempre recusa a conexão: cenário determinístico de recusa.
          id: 'wallet-ana-2',
          kind: 'secondary',
          displayName: 'Ana Souza',
          nickname: 'Reserva',
          network: 'Polygon',
          profileName: 'ana.reserva',
          address: '0x3aB1F9c2D0e4A7b6C58d19E7f20a4B6c9D13e5F8',
          type: 'Coinbase Wallet',
          referralCode: 'KURIO-ANA',
          email: 'ana@kurio.test',
          ens: 'nova.kurio.eth',
        },
      ],
      [bruno.id]: [],
    },
    orders: [],
    idempotency: {},
    counters: { event: 0, quote: 0, order: 0, id: 100 },
  }
}

/* ------------------------------------------------------------------ */
/* Armazenamento                                                       */
/* ------------------------------------------------------------------ */

let state: Db

export function db(): Db {
  if (!state) throw new Error('db não inicializado: chame initDb() antes de iniciar o worker')
  return state
}

export async function initDb() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw) {
      state = JSON.parse(raw) as Db
      resumePendingOrders()
      return
    }
  } catch {
    /* JSON inválido ou storage bloqueado: recomeça do cenário conhecido */
  }
  state = await seedDb()
  commit()
}

export async function resetDb() {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  state = await seedDb()
  commit()
}

export function commit() {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* sem persistência: o estado vive apenas em memória */
  }
}

export function nextId(prefix: string) {
  return `${prefix}-${++db().counters.id}`
}

/* ------------------------------------------------------------------ */
/* NFTs e eventos                                                      */
/* ------------------------------------------------------------------ */

export function findNft(id: string) {
  return db().nfts.find((n) => n.id === id)
}

/** Altera preço/estoque, sobe a versão e publica nft.updated pelo Socket.IO. */
export function touchNft(id: string, patch: Partial<Pick<Nft, 'price' | 'editionsAvailable'>>) {
  const nft = findNft(id)
  if (!nft) return undefined
  Object.assign(nft, patch)
  nft.version += 1
  commit()
  bus.publish('nft.updated', {
    eventId: `evt-${++db().counters.event}`,
    resource: 'nft',
    id: nft.id,
    version: nft.version,
    price: nft.price,
    editionsAvailable: nft.editionsAvailable,
  })
  return nft
}

/* ------------------------------------------------------------------ */
/* Cotação                                                             */
/* ------------------------------------------------------------------ */

export function couponStatus(code?: string): { status: Quote['couponStatus']; bps: number } {
  if (!code) return { status: 'none', bps: 0 }
  const c = code.trim().toUpperCase()
  if (c === 'KURIO10') return { status: 'applied', bps: 1000 }
  if (c === 'LANCAMENTO5') return { status: 'applied', bps: 500 }
  if (c === 'EXPIRADO') return { status: 'expired', bps: 0 }
  return { status: 'invalid', bps: 0 }
}

function fingerprintOf(parts: string[]) {
  let h = 5381
  for (const ch of parts.join('|')) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0
  return h.toString(36)
}

export function buildQuote(items: CartItem[], coupon?: string): Quote {
  const lines = items.flatMap((item) => {
    const nft = findNft(item.nftId)
    if (!nft) return []
    return [
      {
        nftId: nft.id,
        name: nft.name,
        imageUrl: nft.imageUrl,
        editionLabel: `${Math.min(item.quantity, nft.editionsTotal)}/${nft.editionsTotal}`,
        tokenId: nft.tokenId,
        quantity: item.quantity,
        unitPrice: nft.price,
        lineTotal: mulEthInt(nft.price, item.quantity),
        available: nft.editionsAvailable,
        ok: nft.editionsAvailable >= item.quantity && item.quantity > 0,
        nftVersion: nft.version,
      },
    ]
  })
  const subtotal = sumEth(lines.map((l) => l.lineTotal))
  const { status, bps } = couponStatus(coupon)
  const discount = status === 'applied' ? pctEth(subtotal, bps) : '0'
  const networkFee = lines.length ? NETWORK_FEE : '0'
  const total = addEth(subEth(subtotal, discount), networkFee)
  return {
    quoteId: `quote-${++db().counters.quote}`,
    lines,
    subtotal,
    discount,
    networkFee,
    total,
    coupon: coupon?.trim() || undefined,
    couponStatus: status,
    fingerprint: fingerprintOf([
      ...lines.map((l) => `${l.nftId}:${l.quantity}:${l.unitPrice}:${l.available}`),
      discount,
      networkFee,
      status,
    ]),
  }
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function publicOrder(o: DbOrder): Order {
  const { userId: _u, settleAt: _s, willDecline: _w, ...order } = o
  return order
}

export function scheduleSettle(orderId: string) {
  const order = db().orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'pending') return
  const wait = Math.max(0, order.settleAt - Date.now())
  clearTimeout(timers.get(orderId))
  timers.set(
    orderId,
    setTimeout(() => settleOrder(orderId), wait),
  )
}

function resumePendingOrders() {
  for (const o of state.orders) if (o.status === 'pending') scheduleSettle(o.id)
}

/**
 * Estado terminal (confirmado/recusado). Idempotente: chamar duas vezes não reaplica efeitos.
 */
export function settleOrder(orderId: string) {
  const order = db().orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'pending') return order
  timers.delete(orderId)

  if (order.willDecline) {
    order.status = 'declined'
    order.declineReason = 'Pagamento recusado pela rede (simulação).'
    for (const line of order.lines) {
      const nft = findNft(line.nftId)
      if (nft) touchNft(nft.id, { editionsAvailable: nft.editionsAvailable + line.quantity })
    }
  } else {
    order.status = 'confirmed'
    // Remove do carrinho só o que foi comprado, na quantidade comprada.
    const cart = db().carts[order.userId]
    if (cart) {
      cart.items = cart.items
        .map((it) => {
          const bought = order.lines.find((l) => l.nftId === it.nftId)?.quantity ?? 0
          return { ...it, quantity: it.quantity - bought }
        })
        .filter((it) => it.quantity > 0)
    }
  }
  order.version += 1
  commit()
  bus.publish('order.updated', {
    eventId: `evt-${++db().counters.event}`,
    resource: 'order',
    id: order.id,
    version: order.version,
    status: order.status,
    userId: order.userId,
  })
  return order
}

export function createOrder(args: {
  userId: string
  quote: Quote
  wallet: Wallet
  network: NetworkName
}): DbOrder {
  const { userId, quote, wallet, network } = args
  const n = ++db().counters.order
  const order: DbOrder = {
    id: `ord-${String(n).padStart(5, '0')}`,
    status: 'pending',
    version: 1,
    createdAt: new Date().toISOString(),
    txHash: `0x${(n * 7919).toString(16).padStart(8, '0')}${'ab12cd34'.repeat(7)}`.slice(0, 66),
    network,
    walletId: wallet.id,
    walletAddress: wallet.address,
    walletType: wallet.type,
    lines: quote.lines.map((l) => ({
      nftId: l.nftId,
      name: l.name,
      imageUrl: l.imageUrl,
      editionLabel: l.editionLabel,
      tokenId: l.tokenId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    subtotal: quote.subtotal,
    discount: quote.discount,
    networkFee: quote.networkFee,
    total: quote.total,
    coupon: quote.coupon,
    userId,
    settleAt: Date.now() + ORDER_SETTLE_MS,
    willDecline: getScenario() === 'payment_declined',
  }
  // Reserva o estoque enquanto o pedido está pendente.
  for (const line of order.lines) {
    const nft = findNft(line.nftId)
    if (nft) touchNft(nft.id, { editionsAvailable: nft.editionsAvailable - line.quantity })
  }
  db().orders.push(order)
  commit()
  scheduleSettle(order.id)
  return order
}

/** Garante que pedidos vencidos sejam resolvidos mesmo se a aba estava fechada. */
export function settleIfDue(order: DbOrder) {
  if (order.status === 'pending' && Date.now() >= order.settleAt) settleOrder(order.id)
}

/* ------------------------------------------------------------------ */
/* Helpers de comparação usados nos handlers                           */
/* ------------------------------------------------------------------ */

export { cmpEth, fromWei, toWei }
