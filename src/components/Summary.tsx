import { formatEth } from '@/lib/eth'
import type { Quote } from '@/lib/types'
import { Skeleton } from './ui'

/** Resumo de valores: sempre os números que vieram da cotação da API. */
export function SummaryRows({ quote }: { quote?: Quote }) {
  if (!quote) {
    return (
      <div aria-busy="true" aria-label="Carregando resumo" className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    )
  }
  const row = 'flex items-baseline justify-between text-xs text-ink'
  return (
    <dl className="space-y-2">
      <div className={row}>
        <dt>Subtotal</dt>
        <dd>{formatEth(quote.subtotal)}</dd>
      </div>
      <div className={row}>
        <dt>Desconto do lançamento</dt>
        <dd>(-) {formatEth(quote.discount)}</dd>
      </div>
      <div className={row}>
        <dt>Taxa de rede</dt>
        <dd className="text-right">
          {formatEth(quote.networkFee, 3, 3)}
          <span className="block text-[10px] text-accent">Taxa estimada</span>
        </dd>
      </div>
      <div className="flex items-baseline justify-between border-t border-border pt-2 text-sm font-bold">
        <dt className="text-ink">Total</dt>
        <dd className="text-accent">{formatEth(quote.total, 3, 3)}</dd>
      </div>
    </dl>
  )
}
