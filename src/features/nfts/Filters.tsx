import { useState } from 'react'
import type { NetworkName, NftPage } from '@/lib/types'
import { Button } from '@/components/ui'

const MAX = 5

interface Props {
  facets?: NftPage['facets']
  category?: string
  network?: NetworkName
  minPrice?: string
  maxPrice?: string
  onCategory: (c?: string) => void
  onNetwork: (n?: NetworkName) => void
  onPrice: (min?: string, max?: string) => void
}

const fmt = (v: number) => v.toFixed(2).replace('.', ',')

export function Filters({ facets, category, network, minPrice, maxPrice, onCategory, onNetwork, onPrice }: Props) {
  const [min, setMin] = useState(Number(minPrice ?? 0))
  const [max, setMax] = useState(Number(maxPrice ?? MAX))
  const row = (active: boolean) =>
    `flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-[11px] hover:text-accent ${active ? 'text-accent' : 'text-muted'}`

  return (
    <aside aria-label="Filtros" className="rounded-sm bg-surface p-4 text-xs">
      <h2 className="mb-2 font-bold text-ink">Coleções</h2>
      <ul>
        {Object.entries(facets?.categories ?? {}).map(([name, count]) => (
          <li key={name}>
            <button type="button" aria-pressed={category === name} className={row(category === name)} onClick={() => onCategory(category === name ? undefined : name)}>
              <span>{name}</span>
              <span>({count})</span>
            </button>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 mt-5 font-bold text-ink">Faixa de preço</h2>
      <div className="space-y-2">
        <label className="block text-[11px] text-muted">
          Mínimo
          <input type="range" min={0} max={MAX} step={0.05} value={min} onChange={(e) => setMin(Math.min(Number(e.target.value), max))} className="w-full accent-[var(--color-accent)]" />
        </label>
        <label className="block text-[11px] text-muted">
          Máximo
          <input type="range" min={0} max={MAX} step={0.05} value={max} onChange={(e) => setMax(Math.max(Number(e.target.value), min))} className="w-full accent-[var(--color-accent)]" />
        </label>
        <p className="text-[11px] text-muted">
          Preço: {fmt(min)} – {fmt(max)} ETH
        </p>
        <Button className="px-3 py-1 text-[10px]" onClick={() => onPrice(min > 0 ? min.toFixed(2) : undefined, max < MAX ? max.toFixed(2) : undefined)}>
          Aplicar
        </Button>
      </div>

      <h2 className="mb-2 mt-5 font-bold text-ink">Rede</h2>
      <ul>
        {Object.entries(facets?.networks ?? {}).map(([name, count]) => (
          <li key={name}>
            <button type="button" aria-pressed={network === name} className={row(network === name)} onClick={() => onNetwork(network === name ? undefined : (name as NetworkName))}>
              <span>{name}</span>
              <span>({count})</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
