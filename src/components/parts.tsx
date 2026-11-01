import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { fetchNfts, nftKeys } from '@/features/nfts/api'
import { formatEth } from '@/lib/eth'
import { Skeleton } from './ui'

export function Breadcrumb({ trail }: { trail: Array<{ label: string; to?: '/' | '/carrinho' }> }) {
  return (
    <nav aria-label="Você está em" className="mb-4 text-[11px] text-ink">
      <ol className="flex flex-wrap items-center gap-1">
        {trail.map((t, i) => (
          <li key={t.label} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">/</span>}
            {t.to ? (
              <Link to={t.to} className="hover:text-accent">
                {t.label}
              </Link>
            ) : (
              <span aria-current="page">{t.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function Stepper({ value, max, onChange, label, disabled }: { value: number; max: number; onChange: (v: number) => void; label: string; disabled?: boolean }) {
  const btn = 'flex h-5 w-5 items-center justify-center rounded-full bg-accent text-sm font-bold leading-none text-bg disabled:opacity-40'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-2">
      <button type="button" className={btn} aria-label="Diminuir quantidade" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span aria-live="polite" className="min-w-4 text-center text-xs text-ink">
        {value}
      </span>
      <button type="button" className={btn} aria-label="Aumentar quantidade" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}

/** Faixa horizontal de NFTs ("Mais desta coleção", "Colecionadores também viram"). */
export function NftStrip({ title, query, excludeId }: { title: string; query?: string; excludeId?: string }) {
  const params = { q: query, pageSize: 8, sort: 'recent' as const }
  const { data, isPending } = useQuery({ queryKey: nftKeys.list(params), queryFn: ({ signal }) => fetchNfts(params, signal) })
  const items = (data?.items ?? []).filter((n) => n.id !== excludeId).slice(0, 5)
  return (
    <section aria-label={title} className="mt-10">
      <h2 className="mb-3 border-b border-border pb-1 text-xs font-bold text-accent">{title}</h2>
      <ul className="flex snap-x gap-3 overflow-x-auto pb-2">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} aria-hidden="true" className="w-[150px] shrink-0">
                <Skeleton className="h-[168px] w-full" />
                <Skeleton className="mt-2 h-3 w-2/3" />
              </li>
            ))
          : items.map((n) => (
              <li key={n.id} className="w-[150px] shrink-0 snap-start rounded-sm bg-surface p-2">
                <Link to="/nft/$id" params={{ id: n.id }}>
                  <img src={n.imageUrl} alt={`Arte do NFT ${n.name}`} width={134} height={134} loading="lazy" className="aspect-square w-full rounded-md object-cover" />
                  <p className="mt-2 truncate text-[11px] text-ink">{n.name}</p>
                  <p className="text-[11px] font-bold text-accent">{formatEth(n.price)}</p>
                </Link>
              </li>
            ))}
      </ul>
    </section>
  )
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-accent" role="img" aria-label={`Nota ${rating.toFixed(1)} de 5`}>
      {'★'.repeat(Math.round(rating))}
      <span className="text-border">{'★'.repeat(5 - Math.round(rating))}</span>
    </span>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="text-xs font-bold text-ink">{title}</h3>
      <div className="mt-1 text-[11px] text-muted">{children}</div>
    </section>
  )
}
