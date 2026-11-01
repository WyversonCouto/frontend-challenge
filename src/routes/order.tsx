import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useSession } from '@/features/auth/session'
import { Button, Skeleton } from '@/components/ui'
import { ApiError, http } from '@/lib/api'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import type { Order } from '@/lib/types'

const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`

function Envelope() {
  return (
    <svg viewBox="0 0 48 48" className="mx-auto h-12 w-12 text-accent" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M8 20 24 8l16 12v18H8V20Z" />
      <path d="m8 20 16 11 16-11" />
      <path d="M16 12h16v10H16z" />
    </svg>
  )
}

export function OrderPage() {
  const { id } = useParams({ from: '/pedido/$id' })
  const session = useSession()

  const { data: order, error, isPending, refetch } = useQuery({
    queryKey: ['user', session?.user.id, 'order', id],
    queryFn: ({ signal }) => http.get<Order>(`/orders/${id}`, { signal }).then((r) => r.data),
    // O Socket.IO atualiza na hora; este polling cobre queda de conexão enquanto o pedido está pendente.
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 3000 : false),
    refetchOnReconnect: true,
  })

  const card = 'mx-auto my-8 w-[420px] max-w-[94vw] border-b-4 border-accent bg-surface px-5 py-6'

  if (isPending) {
    return (
      <div className={card} aria-busy="true" aria-label="Carregando pedido">
        <Skeleton className="mx-auto h-12 w-12" />
        <Skeleton className="mx-auto mt-4 h-4 w-2/3" />
        <Skeleton className="mt-6 h-24 w-full" />
      </div>
    )
  }

  if (error || !order) {
    const status = error instanceof ApiError ? error.status : 0
    return (
      <div role="alert" className={`${card} text-center`}>
        <h1 className="text-sm font-bold text-accent">{status === 404 || status === 403 ? 'Pedido não encontrado' : 'Não foi possível carregar o pedido'}</h1>
        <p className="mt-2 text-[11px] text-muted">{status === 403 ? 'Este pedido pertence a outra conta.' : status === 404 ? 'Verifique o endereço ou volte ao início.' : 'Verifique sua conexão e tente de novo.'}</p>
        <div className="mt-4 flex justify-center gap-2">
          {status !== 404 && status !== 403 && <Button onClick={() => void refetch()}>Tentar novamente</Button>}
          <Link to="/" className="rounded-sm border border-accent px-4 py-2 text-xs font-bold uppercase text-accent">Início</Link>
        </div>
      </div>
    )
  }

  const date = new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  // Pendente e recusado não mostram a confirmação: só um pedido confirmado vira recibo.
  if (order.status === 'pending') {
    return (
      <div className={`${card} text-center`} role="status" aria-live="polite">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent motion-reduce:animate-none" aria-hidden="true" />
        <h1 className="mt-4 text-sm font-bold text-ink">Processando sua transação…</h1>
        <p className="mt-2 text-[11px] text-muted">Pedido {order.id}. Você pode recarregar a página ou perder a conexão: o estado é recuperado automaticamente.</p>
        <p className="mt-3 text-[10px] text-muted">Transação {short(order.txHash)} · Rede {order.network}</p>
      </div>
    )
  }

  if (order.status === 'declined') {
    return (
      <div role="alert" className={`${card} text-center`}>
        <h1 className="text-sm font-bold text-danger">Pagamento recusado</h1>
        <p className="mt-2 text-[11px] text-muted">{order.declineReason ?? 'A transação não foi confirmada.'} Seus itens continuam no carrinho e nada foi cobrado.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link to="/carrinho" className="rounded-sm bg-accent px-4 py-2 text-xs font-bold uppercase text-bg">Voltar ao carrinho</Link>
          <Link to="/" className="rounded-sm border border-accent px-4 py-2 text-xs font-bold uppercase text-accent">Início</Link>
        </div>
      </div>
    )
  }

  return (
    <article className={card} aria-labelledby="pedido-titulo">
      <Link to="/" aria-label="Fechar" className="float-right text-accent">×</Link>
      <Envelope />
      <h1 id="pedido-titulo" className="mt-3 text-center text-xs text-accent">Seus NFTs agora estão na sua carteira</h1>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-border py-3 text-[10px] sm:grid-cols-4">
        <div><dt className="font-bold text-accent">ID da transação</dt><dd className="text-ink">{short(order.txHash)}</dd></div>
        <div><dt className="font-bold text-accent">Data</dt><dd className="text-ink">{date}</dd></div>
        <div><dt className="font-bold text-accent">Total</dt><dd className="text-ink">{formatEth(order.total, 3, 3)}</dd></div>
        <div><dt className="font-bold text-accent">Carteira</dt><dd className="text-ink">{order.walletType}</dd></div>
      </dl>

      <h2 className="mt-4 text-[11px] font-bold text-ink">Detalhes da transação</h2>
      <table className="mt-2 w-full text-left text-[11px]">
        <thead className="text-ink">
          <tr><th className="pb-2 font-bold">NFTs</th><th className="pb-2 text-center font-bold">Edições</th><th className="pb-2 text-right font-bold">Subtotal</th></tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.nftId}>
              <td className="py-1">
                <div className="flex items-center gap-2">
                  <img src={l.imageUrl} alt={`Arte do NFT ${l.name}`} width={36} height={36} className="h-9 w-9 rounded-md object-cover" />
                  <div><p className="font-bold text-ink">{l.name}</p><p className="text-[10px] text-muted">ID do token: {l.tokenId}</p></div>
                </div>
              </td>
              <td className="text-center text-muted">(x {l.quantity})</td>
              <td className="text-right font-bold text-accent">{formatEth(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-[11px]">
          {order.coupon && <tr><td colSpan={2} className="pt-2 text-right text-muted">Desconto ({order.coupon})</td><td className="pt-2 text-right text-ink">(-) {formatEth(order.discount)}</td></tr>}
          <tr><td colSpan={2} className="pt-2 text-right text-muted">Taxa de rede</td><td className="pt-2 text-right text-ink">{formatEth(order.networkFee, 3, 3)}</td></tr>
          <tr><td colSpan={2} className="text-right font-bold text-ink">Total</td><td className="text-right font-bold text-accent">{formatEth(order.total, 3, 3)}</td></tr>
        </tfoot>
      </table>

      <p className="mt-4 text-center text-[10px] text-muted">Transação confirmada na {order.network} (simulada). A propriedade foi transferida para a sua carteira conectada e registrada na rede.</p>
      <div className="mt-4 text-center">
        <Button onClick={() => announce('O link do explorador é simulado nesta demonstração.')}>Ver no Etherscan</Button>
      </div>
    </article>
  )
}
