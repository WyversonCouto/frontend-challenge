import { Link } from '@tanstack/react-router'
import { formatEth } from '@/lib/eth'
import type { Nft } from '@/lib/types'
import { Skeleton } from './ui'

export function NftCard({ nft }: { nft: Nft }) {
  const soldOut = nft.editionsAvailable <= 0
  return (
    <li className="group relative rounded-sm bg-surface p-2">
      <Link to="/nft/$id" params={{ id: nft.id }} className="block">
        <div className="relative aspect-square overflow-hidden rounded-sm bg-surface-2">
          <img src={nft.imageUrl} alt={`Arte do NFT ${nft.name}`} width={240} height={240} loading="lazy" className="h-full w-full object-cover" />
          {nft.editionsTotal === 1 && <span className="absolute left-0 top-2 bg-accent px-2 py-0.5 text-[10px] font-bold text-bg">RARO</span>}
          {soldOut && <span className="absolute inset-x-0 bottom-0 bg-bg/80 py-1 text-center text-[10px] font-bold uppercase text-danger">Esgotado</span>}
        </div>
        <h3 className="mt-2 truncate text-[11px] text-ink">{nft.name}</h3>
        <p className="text-xs font-bold text-accent">{formatEth(nft.price)}</p>
      </Link>
    </li>
  )
}

/** Mesmas dimensões do card real: o carregamento não desloca o layout (CLS). */
export function NftCardSkeleton() {
  return (
    <li className="rounded-sm bg-surface p-2" aria-hidden="true">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="mt-2 h-[14px] w-3/4" />
      <Skeleton className="mt-1 h-[16px] w-1/3" />
    </li>
  )
}
