import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useSession } from '@/features/auth/session'
import { cartKey, fetchQuote, quoteKey } from '@/features/cart/api'
import { useCart, useQuote } from '@/features/cart/useCart'
import { shortAddress, useWallets } from '@/features/wallets/api'
import { FormField, inputClass } from '@/components/FormField'
import { Breadcrumb } from '@/components/parts'
import { SummaryRows } from '@/components/Summary'
import { Button, Skeleton } from '@/components/ui'
import { ApiError, http } from '@/lib/api'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import type { CreateOrderInput, NetworkName, Order, Quote, Wallet } from '@/lib/types'

const DRAFT = 'kurio:checkout-draft'
const INTENT = 'kurio:order-intent'
const NETWORKS: NetworkName[] = ['Ethereum', 'Polygon', 'Solana']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Draft {
  walletId?: string
  network?: NetworkName
  displayName?: string
  email?: string
  note?: string
}
type Conn = 'idle' | 'connecting' | 'connected' | 'refused'

const readJson = <T,>(key: string): T | undefined => {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}
const writeJson = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sem storage: o rascunho vale até o refresh */
  }
}

/**
 * Chave de idempotência: a mesma intenção de compra (mesmo conteúdo) sempre reutiliza a chave,
 * então repetir o envio após timeout recupera o mesmo pedido em vez de criar outro.
 */
function intentKey(payload: CreateOrderInput) {
  const hash = JSON.stringify(payload)
  const saved = readJson<{ hash: string; key: string }>(INTENT)
  if (saved?.hash === hash) return saved.key
  const key = crypto.randomUUID()
  writeJson(INTENT, { hash, key })
  return key
}

export function CheckoutPage() {
  const session = useSession()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const cart = useCart()
  const quoteQuery = useQuote(cart.cart)
  const wallets = useWallets()
  const reviewRef = useRef<HTMLDialogElement>(null)

  const draft = useMemo(() => readJson<Draft>(DRAFT) ?? {}, [])
  const [walletId, setWalletId] = useState(draft.walletId)
  const [network, setNetwork] = useState<NetworkName | undefined>(draft.network)
  const [displayName, setDisplayName] = useState(draft.displayName ?? '')
  const [email, setEmail] = useState(draft.email ?? '')
  const [note, setNote] = useState(draft.note ?? '')
  const [conn, setConn] = useState<Record<string, Conn>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [review, setReview] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [sendError, setSendError] = useState<{ message: string; retry: boolean }>()

  const list = wallets.data ?? []
  const wallet: Wallet | undefined = list.find((w) => w.id === walletId) ?? list.find((w) => w.kind === 'primary') ?? list[0]
  const quote = quoteQuery.data
  const lines = quote?.lines ?? []

  // Pedido pendente de uma tentativa anterior (refresh, queda de conexão): o usuário o recupera aqui.
  const pending = useQuery({
    queryKey: ['user', session?.user.id, 'orders'],
    queryFn: ({ signal }) => http.get<{ orders: Order[] }>('/orders', { signal }).then((r) => r.data.orders),
    enabled: Boolean(session),
  })
  const pendingOrder = pending.data?.find((o) => o.status === 'pending')

  // Preenche com os dados da carteira escolhida, sem sobrescrever o que o usuário já digitou.
  useEffect(() => {
    if (!wallet) return
    setWalletId((id) => id ?? wallet.id)
    setNetwork((n) => n ?? wallet.network)
    setDisplayName((v) => v || wallet.displayName)
    setEmail((v) => v || wallet.email)
  }, [wallet])

  useEffect(() => {
    writeJson(DRAFT, { walletId, network, displayName, email, note } satisfies Draft)
  }, [walletId, network, displayName, email, note])

  useEffect(() => {
    const d = reviewRef.current
    if (!d) return
    if (review && !d.open) d.showModal()
    if (!review && d.open) d.close()
  }, [review])

  const connect = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'connect' | 'disconnect' }) => {
      setConn((c) => ({ ...c, [id]: action === 'connect' ? 'connecting' : c[id] }))
      await http.post(`/wallets/${id}/connection`, { action })
      return action
    },
    onSuccess: (action, { id }) => {
      setConn((c) => ({ ...c, [id]: action === 'connect' ? 'connected' : 'idle' }))
      announce(action === 'connect' ? 'Carteira conectada.' : 'Carteira desconectada.')
    },
    onError: (e, { id }) => {
      setConn((c) => ({ ...c, [id]: 'refused' }))
      announce(e instanceof ApiError ? e.message : 'Não foi possível conectar a carteira.')
    },
  })

  const payload: CreateOrderInput | undefined =
    wallet && quote && network
      ? { items: cart.cart.items, coupon: cart.cart.coupon, walletId: wallet.id, network, buyer: { displayName: displayName.trim(), email: email.trim(), note: note.trim() || undefined }, expectedTotal: quote.total, expectedFingerprint: quote.fingerprint }
      : undefined

  const send = useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const key = intentKey(input)
      const { data } = await http.post<Order>('/orders', input, { headers: { 'Idempotency-Key': key } })
      return data
    },
    onSuccess: (order) => {
      sessionStorage.removeItem(INTENT)
      sessionStorage.removeItem(DRAFT)
      qc.setQueryData(['user', session?.user.id, 'order', order.id], order)
      void qc.invalidateQueries({ queryKey: cartKey(session?.user.id ?? '') })
      void qc.invalidateQueries({ queryKey: ['user', session?.user.id, 'orders'] })
      setReview(false)
      void navigate({ to: '/pedido/$id', params: { id: order.id } })
    },
    onError: (e) => {
      setReview(false)
      if (e instanceof ApiError && (e.code === 'price_changed' || e.code === 'sold_out') && e.body?.quote) {
        // A cotação nova substitui a que o usuário viu: ele precisa confirmar de novo.
        qc.setQueryData<Quote>(quoteKey(cart.cart.items, cart.cart.coupon), e.body.quote)
        setNotice(e.code === 'sold_out' ? 'Uma edição acabou enquanto você finalizava. Revise o carrinho.' : 'Os valores mudaram. Revise o resumo e confirme de novo.')
        setSendError(undefined)
        return
      }
      if (e instanceof ApiError && e.network) {
        setSendError({ message: 'Não recebemos a resposta do servidor. Seu pedido pode já ter sido criado; tentar de novo não gera outra compra.', retry: true })
        return
      }
      setSendError({ message: e instanceof ApiError ? e.message : 'Não foi possível enviar o pedido.', retry: false })
    },
  })

  function validate() {
    const e: Record<string, string> = {}
    if (!wallet) e.wallet = 'Cadastre e selecione uma carteira.'
    if (displayName.trim().length < 2) e.displayName = 'Informe o nome de exibição.'
    if (!EMAIL.test(email.trim())) e.email = 'Informe um e-mail válido.'
    if (note.length > 280) e.note = 'Use no máximo 280 caracteres.'
    if (!network) e.network = 'Selecione uma rede.'
    if (wallet && (!wallet.referralCode || !wallet.profileName || !wallet.ens)) e.wallet = 'Complete os dados desta carteira em Carteiras.'
    if (wallet && conn[wallet.id] !== 'connected') e.wallet = 'Conecte a carteira para continuar.'
    if (lines.some((l) => !l.ok)) e.items = 'Há itens indisponíveis no carrinho.'
    return e
  }

  async function confirm() {
    setSendError(undefined)
    setNotice(undefined)
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) {
      announce('Revise os campos destacados.')
      return
    }
    // Revalida preço, estoque, cupom e taxa antes de pedir a confirmação final.
    try {
      const fresh = await qc.fetchQuery({ queryKey: [...quoteKey(cart.cart.items, cart.cart.coupon), 'fresh'], queryFn: ({ signal }) => fetchQuote(cart.cart.items, cart.cart.coupon, signal), staleTime: 0 })
      if (quote && fresh.fingerprint !== quote.fingerprint) {
        qc.setQueryData<Quote>(quoteKey(cart.cart.items, cart.cart.coupon), fresh)
        setNotice('Os valores mudaram. Revise o resumo e confirme de novo.')
        announce('Os valores do pedido mudaram. Revise e confirme de novo.')
        return
      }
      if (fresh.lines.some((l) => !l.ok)) {
        qc.setQueryData<Quote>(quoteKey(cart.cart.items, cart.cart.coupon), fresh)
        setNotice('Uma edição ficou indisponível. Revise o carrinho.')
        return
      }
    } catch {
      setSendError({ message: 'Não foi possível validar os valores agora. Tente novamente.', retry: false })
      return
    }
    setReview(true)
  }

  const empty = !cart.isLoading && cart.cart.items.length === 0

  if (empty && !pendingOrder) {
    return (
      <div className="mx-auto max-w-[600px] px-4 py-16 text-center">
        <h1 className="text-lg text-accent">Seu carrinho está vazio</h1>
        <p className="mt-2 text-muted">Adicione NFTs ao carrinho para finalizar uma compra.</p>
        <Link to="/" className="mt-6 inline-block rounded-sm bg-accent px-4 py-2 text-xs font-bold uppercase text-bg">
          Explorar NFTs
        </Link>
      </div>
    )
  }

  const connState = wallet ? (conn[wallet.id] ?? 'idle') : 'idle'
  const ro = (id: string, label: string, value: string, required = true, hint?: string) => (
    <FormField id={id} label={label} required={required} hint={hint}>
      <input id={id} readOnly value={value} className={inputClass(undefined, true)} />
    </FormField>
  )

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-8">
      <div className="hidden md:block">
        <Breadcrumb trail={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Pagamento' }]} />
      </div>
      <h1 className="mb-4 text-center text-base font-bold text-ink md:sr-only">Pagamento com carteira</h1>

      {pendingOrder && (
        <p role="status" className="mb-4 rounded-sm border border-accent bg-surface-2 p-3 text-[11px] text-ink">
          Você tem um pedido em processamento.{' '}
          <Link to="/pedido/$id" params={{ id: pendingOrder.id }} className="font-bold text-accent underline">
            Acompanhar pedido
          </Link>
        </p>
      )}
      {notice && (
        <p role="alert" className="mb-4 rounded-sm border border-accent bg-surface-2 p-3 text-[11px] text-ink">
          {notice}
        </p>
      )}
      {sendError && (
        <div role="alert" className="mb-4 rounded-sm border border-danger bg-surface-2 p-3 text-[11px] text-ink">
          <p>{sendError.message}</p>
          {sendError.retry && payload && (
            <Button className="mt-2 px-3 py-1" disabled={send.isPending} onClick={() => send.mutate(payload)}>
              Tentar de novo
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_330px]">
        <form noValidate onSubmit={(e) => { e.preventDefault(); void confirm() }} aria-label="Perfil do colecionador" className="space-y-3">
          <h2 className="text-xs font-bold text-ink">Perfil do colecionador</h2>

          {wallets.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : list.length === 0 ? (
            <p role="alert" className="rounded-sm border border-border bg-surface p-4 text-[11px] text-ink">
              Você ainda não tem carteira cadastrada.{' '}
              <Link to="/carteiras" className="font-bold text-accent underline">
                Cadastrar carteira
              </Link>
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="displayName" label="Nome de exibição" required error={errors.displayName}>
                  <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-invalid={errors.displayName ? true : undefined} aria-describedby={errors.displayName ? 'displayName-erro' : undefined} className={inputClass(errors.displayName)} />
                </FormField>
                {ro('username', 'Nome de usuário', session?.user.username ?? '')}
                <FormField id="network" label="Rede" required error={errors.network}>
                  <select id="network" value={network ?? ''} onChange={(e) => setNetwork(e.target.value as NetworkName)} aria-invalid={errors.network ? true : undefined} aria-describedby={errors.network ? 'network-erro' : undefined} className={inputClass(errors.network)}>
                    <option value="" disabled>Selecione uma rede</option>
                    {NETWORKS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </FormField>
                {ro('profileName', 'Nome do perfil', wallet?.profileName ?? '')}
                {ro('address', 'Endereço da carteira', wallet?.address ?? '')}
                {ro('linkedRef', 'ENS ou carteira secundária (opcional)', wallet?.linkedRef ?? '', false)}
                {ro('walletType', 'Tipo de carteira', wallet?.type ?? '')}
                {ro('referral', 'Código de indicação', wallet?.referralCode ?? '')}
                <FormField id="email" label="E-mail" required error={errors.email}>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? 'email-erro' : undefined} className={inputClass(errors.email)} />
                </FormField>
                {ro('ens', 'Nome ENS', wallet?.ens ?? '')}
              </div>
              <p className="text-[10px] text-muted">
                Os dados da carteira vêm do cadastro.{' '}
                <Link to="/carteiras" className="text-accent underline">Editar em Carteiras</Link>
              </p>
              {list.length > 1 && (
                <button type="button" className="text-[11px] text-accent underline" onClick={() => { const other = list.find((w) => w.id !== wallet?.id); if (other) { setWalletId(other.id); setNetwork(other.network) } }}>
                  Usar outra carteira?
                </button>
              )}
              <FormField id="note" label="Observação do colecionador (opcional)" error={errors.note}>
                <textarea id="note" rows={5} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass(errors.note)} />
              </FormField>
            </>
          )}
        </form>

        <aside aria-label="Resumo do pedido">
          <h2 className="text-xs font-bold text-ink">Seus NFTs</h2>
          <ul className="mt-2 space-y-2">
            {!quote
              ? Array.from({ length: 2 }, (_, i) => <li key={i} aria-hidden="true"><Skeleton className="h-[52px] w-full" /></li>)
              : lines.map((l) => (
                  <li key={l.nftId} className="flex items-center gap-3 rounded-sm bg-surface p-2">
                    <img src={l.imageUrl} alt={`Arte do NFT ${l.name}`} width={36} height={36} className="h-9 w-9 rounded-md object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-ink">{l.name}</p>
                      <p className="text-[10px] text-muted">ID do token: {l.tokenId}</p>
                      {!l.ok && <p role="alert" className="text-[10px] text-danger">Indisponível</p>}
                    </div>
                    <span className="text-[10px] text-muted">(x {l.quantity})</span>
                    <span className="text-xs font-bold text-accent">{formatEth(l.lineTotal)}</span>
                  </li>
                ))}
          </ul>
          {errors.items && <p role="alert" className="mt-2 text-[11px] text-danger">{errors.items}</p>}
          <p className="mt-3 text-[11px] text-muted">
            Tem um código promocional? <Link to="/carrinho" className="text-accent underline">Aplique aqui</Link>
          </p>
          <div className="mt-3"><SummaryRows quote={quote} /></div>

          <fieldset className="mt-5">
            <legend className="mb-2 w-full text-center text-xs font-bold text-ink">Carteira e rede</legend>
            <div className="space-y-2">
              {list.map((w) => (
                <label key={w.id} className={`flex cursor-pointer items-start gap-3 rounded-sm border bg-surface p-3 text-xs ${w.id === wallet?.id ? 'border-accent' : 'border-border'}`}>
                  <input type="radio" name="wallet" checked={w.id === wallet?.id} onChange={() => { setWalletId(w.id); setNetwork(w.network) }} className="mt-0.5 accent-[var(--color-accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink">{w.nickname} · {w.type}</span>
                    <span className="block text-[10px] text-muted">{shortAddress(w.address)} · Rede {w.network}</span>
                    {(conn[w.id] ?? 'idle') === 'refused' && <span role="alert" className="block text-[10px] text-danger">A carteira recusou a conexão.</span>}
                    {conn[w.id] === 'connected' && <span className="block text-[10px] text-ok">Conectada</span>}
                  </span>
                </label>
              ))}
            </div>
            {wallet && (
              <div className="mt-2 flex gap-2">
                {connState === 'connected' ? (
                  <Button variant="outline" className="px-3 py-1" disabled={connect.isPending} onClick={() => connect.mutate({ id: wallet.id, action: 'disconnect' })}>Desconectar</Button>
                ) : (
                  <Button variant="outline" className="px-3 py-1" disabled={connState === 'connecting'} onClick={() => connect.mutate({ id: wallet.id, action: 'connect' })}>
                    {connState === 'connecting' ? 'Conectando…' : connState === 'refused' ? 'Tentar conectar de novo' : 'Conectar carteira'}
                  </Button>
                )}
              </div>
            )}
            {errors.wallet && <p role="alert" className="mt-2 text-[11px] text-danger">{errors.wallet}</p>}
          </fieldset>

          <Button className="mt-4 w-full py-2.5" disabled={!quote || send.isPending || list.length === 0} onClick={() => void confirm()}>
            Confirmar compra
          </Button>
        </aside>
      </div>

      {/* Revisão final antes do envio */}
      <dialog ref={reviewRef} aria-labelledby="revisao-titulo" onClose={() => setReview(false)} className="m-auto w-[420px] max-w-[92vw] border-b-4 border-accent bg-surface p-6 text-ink backdrop:bg-black/70">
        <h2 id="revisao-titulo" className="text-sm font-bold">Revise seu pedido</h2>
        <dl className="mt-4 space-y-2 text-xs">
          <div className="flex justify-between"><dt className="text-muted">Itens</dt><dd>{cart.count}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Carteira</dt><dd>{wallet?.nickname} · {wallet ? shortAddress(wallet.address) : ''}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Rede</dt><dd>{network}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 font-bold"><dt>Total</dt><dd className="text-accent">{quote ? formatEth(quote.total, 3, 3) : ''}</dd></div>
        </dl>
        <p className="mt-3 text-[10px] text-muted">Ao enviar, o valor é conferido de novo. Se algo mudar, você precisará confirmar outra vez.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setReview(false)} disabled={send.isPending}>Voltar e editar</Button>
          <Button disabled={send.isPending || !payload} onClick={() => payload && send.mutate(payload)}>
            {send.isPending ? 'Enviando…' : 'Enviar pedido'}
          </Button>
        </div>
      </dialog>
    </div>
  )
}
