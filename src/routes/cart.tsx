import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useCart, useQuote } from '@/features/cart/useCart'
import { useSession } from '@/features/auth/session'
import { Breadcrumb, NftStrip, Stepper } from '@/components/parts'
import { SummaryRows } from '@/components/Summary'
import { Button, Icon, Skeleton } from '@/components/ui'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import type { Quote } from '@/lib/types'

/** Compara a cotação nova com a anterior e descreve o que mudou (preço ou estoque). */
function diffQuotes(prev: Quote, next: Quote): string[] {
  const out: string[] = []
  for (const line of next.lines) {
    const before = prev.lines.find((l) => l.nftId === line.nftId)
    if (!before) continue
    if (before.unitPrice !== line.unitPrice) out.push(`${line.name}: o preço mudou de ${formatEth(before.unitPrice)} para ${formatEth(line.unitPrice)}.`)
    if (before.available !== line.available && !line.ok) out.push(`${line.name}: restam ${line.available} edição(ões) disponível(is).`)
  }
  return out
}

export function CartPage() {
  const cart = useCart()
  const session = useSession()
  const navigate = useNavigate()
  const quote = useQuote(cart.cart)
  const [coupon, setCoupon] = useState('')
  const [couponError, setCouponError] = useState<string>()
  const [changes, setChanges] = useState<string[]>([])
  const previous = useRef<Quote | undefined>(undefined)

  // Alterações de preço/estoque (por evento em tempo real ou nova cotação) viram aviso visível.
  useEffect(() => {
    const next = quote.data
    if (!next || quote.isPlaceholderData) return
    if (previous.current && previous.current.fingerprint !== next.fingerprint) {
      const found = diffQuotes(previous.current, next)
      if (found.length) setChanges(found)
    }
    previous.current = next
  }, [quote.data, quote.isPlaceholderData])

  const q = quote.data
  const lines = q?.lines ?? []
  const blocked = !q || quote.isPlaceholderData || lines.some((l) => !l.ok) || lines.length !== cart.cart.items.length

  async function run(action: () => Promise<void>) {
    try {
      await action()
    } catch (e) {
      announce(e instanceof Error ? e.message : 'Não foi possível atualizar o carrinho.')
    }
  }

  async function applyCoupon() {
    setCouponError(undefined)
    try {
      await cart.applyCoupon(coupon)
      setCoupon('')
      announce('Cupom aplicado.')
    } catch (e) {
      setCouponError(e instanceof Error ? e.message : 'Cupom inválido.')
    }
  }

  function checkout() {
    if (!session) void navigate({ to: '/login', search: { redirect: '/pagamento' } })
    else void navigate({ to: '/pagamento' })
  }

  const empty = !cart.isLoading && cart.cart.items.length === 0

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-8">
      <div className="hidden md:block">
        <Breadcrumb trail={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Carrinho' }]} />
      </div>
      <h1 className="mb-4 text-center text-base font-bold text-ink md:sr-only">Carrinho de NFTs</h1>

      {changes.length > 0 && (
        <div role="status" className="mb-4 rounded-sm border border-accent bg-surface-2 p-3 text-[11px] text-ink">
          <p className="font-bold text-accent">O carrinho foi atualizado:</p>
          <ul className="mt-1 list-disc pl-4">
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button type="button" className="mt-2 underline" onClick={() => setChanges([])}>
            Entendi
          </button>
        </div>
      )}

      {empty ? (
        <div className="rounded-sm bg-surface p-10 text-center">
          <p className="text-ink">Seu carrinho está vazio.</p>
          <Link to="/" className="mt-4 inline-block rounded-sm bg-accent px-4 py-2 text-xs font-bold uppercase text-bg">
            Explorar NFTs
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <section aria-label="Itens do carrinho">
            <div className="hidden grid-cols-[1fr_80px_90px_70px_24px] gap-2 px-3 pb-2 text-[11px] font-bold text-ink md:grid" aria-hidden="true">
              <span>NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
              <span />
            </div>
            <ul className="space-y-2">
              {cart.isLoading || (cart.cart.items.length > 0 && !q)
                ? Array.from({ length: Math.max(cart.cart.items.length, 2) }, (_, i) => (
                    <li key={i} aria-hidden="true">
                      <Skeleton className="h-[60px] w-full" />
                    </li>
                  ))
                : lines.map((l) => {
                    const item = cart.cart.items.find((i) => i.nftId === l.nftId)
                    return (
                      <li key={l.nftId} className={`grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-sm bg-surface p-3 md:grid-cols-[1fr_80px_90px_70px_24px] md:gap-2 md:py-2 ${l.ok ? '' : 'border border-danger'}`}>
                        <div className="contents md:flex md:items-center md:gap-3">
                          <img src={l.imageUrl} alt={`Arte do NFT ${l.name}`} width={40} height={40} className="h-14 w-14 rounded-md object-cover md:h-9 md:w-9" />
                          <div className="min-w-0">
                            <Link to="/nft/$id" params={{ id: l.nftId }} className="block truncate text-xs font-bold text-ink hover:text-accent">
                              {l.name}
                            </Link>
                            <p className="text-[10px] text-muted">
                              <span className="md:hidden">Edição: {l.editionLabel}</span>
                              <span className="hidden md:inline">ID do token: {l.tokenId}</span>
                            </p>
                            {!l.ok && <p role="alert" className="text-[10px] text-danger">{l.available === 0 ? 'Esgotado. Remova este item.' : `Restam ${l.available}. Reduza a quantidade.`}</p>}
                            <p className="mt-1 text-xs font-bold text-accent md:hidden">{formatEth(l.unitPrice)}</p>
                          </div>
                        </div>
                        <span className="hidden text-xs text-ink md:block">{formatEth(l.unitPrice)}</span>
                        <div className="justify-self-end md:justify-self-start">
                          <Stepper value={item?.quantity ?? l.quantity} max={Math.max(l.available, item?.quantity ?? 1)} label={`Quantidade de ${l.name}`} onChange={(v) => void run(() => cart.setQuantity(l.nftId, v))} />
                        </div>
                        <span className="hidden text-xs font-bold text-accent md:block">{formatEth(l.lineTotal)}</span>
                        <button type="button" aria-label={`Remover ${l.name}`} onClick={() => void run(async () => { await cart.remove(l.nftId); announce(`${l.name} removido do carrinho.`) })} className="hidden text-muted hover:text-danger md:block">
                          <Icon name="close" className="h-3 w-3" />
                        </button>
                      </li>
                    )
                  })}
            </ul>
            {lines.length > 0 && (
              <ul className="mt-2 space-y-1 md:hidden">
                {lines.map((l) => (
                  <li key={l.nftId}>
                    <button type="button" onClick={() => void run(() => cart.remove(l.nftId))} className="text-[11px] text-muted underline">
                      Remover {l.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside aria-label="Resumo da carteira" className="h-fit rounded-sm bg-surface p-4">
            <h2 className="border-b border-border pb-2 text-xs font-bold text-ink">Resumo da carteira</h2>

            <div className="mt-3">
              <label htmlFor="cupom" className="text-[11px] font-bold text-ink">
                Código promocional
              </label>
              {cart.cart.coupon && q?.couponStatus === 'applied' ? (
                <p className="mt-1 flex items-center justify-between text-[11px] text-ink">
                  <span>
                    Cupom <strong className="text-accent">{cart.cart.coupon}</strong> aplicado
                  </span>
                  <button type="button" className="underline" onClick={() => void run(async () => { await cart.removeCoupon(); announce('Cupom removido.') })}>
                    Remover
                  </button>
                </p>
              ) : (
                <>
                  <div className="mt-1 flex">
                    <input id="cupom" value={coupon} onChange={(e) => { setCoupon(e.target.value); setCouponError(undefined) }} placeholder="Digite o código promocional..." aria-invalid={couponError ? true : undefined} aria-describedby={couponError ? 'cupom-erro' : undefined} className={`min-w-0 flex-1 rounded-l-sm border bg-bg px-2 py-1.5 text-[11px] text-ink placeholder:text-muted ${couponError ? 'border-danger' : 'border-border'}`} />
                    <button type="button" onClick={() => void applyCoupon()} className="rounded-r-sm bg-accent px-3 text-[11px] font-bold text-bg">
                      Aplicar
                    </button>
                  </div>
                  {couponError && (
                    <p id="cupom-erro" role="alert" className="mt-1 text-[11px] text-danger">
                      {couponError}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="mt-4">
              {quote.isError && !q ? (
                <p role="alert" className="text-[11px] text-danger">
                  Não foi possível calcular o resumo.{' '}
                  <button type="button" className="underline" onClick={() => void quote.refetch()}>
                    Tentar novamente
                  </button>
                </p>
              ) : (
                <SummaryRows quote={cart.cart.items.length ? q : undefined} />
              )}
            </div>

            <Button className="mt-4 w-full py-2.5" disabled={blocked} onClick={checkout}>
              Conectar e finalizar
            </Button>
            {blocked && lines.some((l) => !l.ok) && <p className="mt-2 text-center text-[10px] text-danger">Corrija os itens indisponíveis para continuar.</p>}
            <Link to="/" className="mt-3 block text-center text-[11px] text-accent underline">
              Continuar explorando
            </Link>
          </aside>
        </div>
      )}

      <NftStrip title="Colecionadores também viram" />
    </div>
  )
}
