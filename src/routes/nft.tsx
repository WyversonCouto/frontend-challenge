import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useRouter } from '@tanstack/react-router'
import { useCart } from '@/features/cart/useCart'
import { useFavorites } from '@/features/favorites/useFavorites'
import { fetchNft, nftKeys } from '@/features/nfts/api'
import { Breadcrumb, NftStrip, Section, Stars, Stepper } from '@/components/parts'
import { Button, Icon, Skeleton } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { announce } from '@/lib/announce'
import { formatEth, mulEthInt } from '@/lib/eth'

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando NFT" className="grid gap-6 md:grid-cols-[74px_minmax(0,330px)_1fr]">
      <div className="hidden gap-2 md:grid">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[66px] w-[66px]" />)}</div>
      <Skeleton className="aspect-square w-full" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-8 w-1/2" />
      </div>
    </div>
  )
}

export function NftDetailPage() {
  const { id } = useParams({ from: '/nft/$id' })
  const navigate = useNavigate()
  const router = useRouter()
  const cart = useCart()
  const favorites = useFavorites()
  const [active, setActive] = useState(0)
  const [qty, setQty] = useState(1)
  const [tab, setTab] = useState<'detalhes' | 'avaliacoes'>('detalhes')
  const [busy, setBusy] = useState(false)

  const { data: nft, isPending, error, refetch } = useQuery({ queryKey: nftKeys.detail(id), queryFn: ({ signal }) => fetchNft(id, signal) })

  if (isPending) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-8">
        <DetailSkeleton />
      </div>
    )
  }

  if (error || !nft) {
    const missing = error instanceof ApiError && error.status === 404
    return (
      <div role="alert" className="mx-auto max-w-[600px] px-4 py-16 text-center">
        <h1 className="text-xl text-accent">{missing ? 'NFT não encontrado' : 'Não foi possível carregar este NFT'}</h1>
        <p className="mt-2 text-muted">{missing ? 'Este NFT não existe ou foi removido.' : 'Verifique sua conexão e tente de novo.'}</p>
        <div className="mt-6 flex justify-center gap-3">
          {!missing && <Button onClick={() => void refetch()}>Tentar novamente</Button>}
          <Link to="/" className="rounded-sm border border-accent px-4 py-2 text-xs font-bold uppercase text-accent">
            Ver catálogo
          </Link>
        </div>
      </div>
    )
  }

  const soldOut = nft.editionsAvailable <= 0
  const inCart = cart.cart.items.find((i) => i.nftId === nft.id)?.quantity ?? 0
  const room = Math.max(nft.editionsAvailable - inCart, 0)
  const quantity = Math.min(qty, Math.max(room, 1))
  const liked = favorites.isFavorite(nft.id)

  async function add(goToCart: boolean) {
    if (busy) return
    setBusy(true)
    try {
      await cart.add(nft!.id, quantity)
      announce(`${nft!.name} adicionado ao carrinho.`)
      if (goToCart) await navigate({ to: '/carrinho' })
    } catch (e) {
      announce(e instanceof Error ? e.message : 'Não foi possível adicionar ao carrinho.')
    } finally {
      setBusy(false)
    }
  }

  function like() {
    if (!favorites.signedIn) {
      void navigate({ to: '/login', search: { redirect: router.state.location.href } })
      return
    }
    favorites.toggle({ id: nft!.id, on: !liked })
  }

  const edition = `1/${nft.editionsTotal}`

  return (
    <div className="mx-auto max-w-[1000px] px-0 pb-28 pt-0 md:px-8 md:pb-10 md:pt-6">
      <div className="hidden md:block">
        <Breadcrumb trail={[{ label: 'Início', to: '/' }, { label: 'Mercado' }]} />
      </div>

      <div className="grid gap-6 md:grid-cols-[74px_minmax(0,330px)_1fr]">
        {/* Miniaturas (desktop) */}
        <ul className="hidden gap-2 md:grid md:content-start" aria-label="Galeria">
          {nft.gallery.map((src, i) => (
            <li key={i}>
              <button type="button" aria-label={`Ver imagem ${i + 1}`} aria-pressed={active === i} onClick={() => setActive(i)} className={`overflow-hidden rounded-md border ${active === i ? 'border-accent' : 'border-border'}`}>
                <img src={src} alt="" width={66} height={66} className="h-[66px] w-[66px] object-cover" />
              </button>
            </li>
          ))}
        </ul>

        {/* Imagem principal (no mobile ocupa a largura toda, com voltar e favorito) */}
        <div className="relative rounded-none bg-surface md:rounded-sm md:p-3">
          <img src={nft.gallery[active]} alt={`Arte do NFT ${nft.name}, imagem ${active + 1} de ${nft.gallery.length}`} width={330} height={330} className="aspect-square w-full object-cover md:rounded-md" />
          <button type="button" onClick={() => router.history.back()} aria-label="Voltar" className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-bg/70 text-ink md:hidden">
            ‹
          </button>
          <button type="button" aria-label={liked ? 'Remover dos favoritos' : 'Favoritar'} aria-pressed={liked} onClick={like} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-bg/70 text-ink md:hidden">
            <Icon name="heart" className={`h-4 w-4 ${liked ? 'fill-accent text-accent' : ''}`} />
          </button>
        </div>

        {/* Informações */}
        <div className="-mt-6 rounded-t-3xl bg-surface px-5 pb-6 pt-5 md:mt-0 md:rounded-none md:bg-transparent md:p-0">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-base font-bold text-ink md:text-lg">{nft.name}</h1>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-accent md:hidden">★ {nft.rating.toFixed(1)}({nft.reviews})</span>
          </div>
          <p className="mt-1 hidden text-lg font-bold text-accent md:block">{formatEth(nft.price)}</p>
          <p className="mt-1 hidden items-center gap-2 border-b border-border pb-2 text-[11px] text-ink md:flex">
            <Stars rating={nft.rating} /> {nft.reviews} avaliações de colecionadores
          </p>

          <h2 className="mt-3 hidden text-xs font-bold text-ink md:block">Sobre este NFT:</h2>
          <p className="mt-2 text-[11px] text-muted md:mt-1">
            Um colecionável digital {edition} finalizado à mão da coleção {nft.collection}, verificado na {nft.network}, com arte desbloqueável e acesso para colecionadores.
          </p>

          <div className="mt-3">
            <h2 className="text-xs font-bold text-ink">Edição:</h2>
            <ul className="mt-1 flex flex-wrap gap-2 text-[10px]" aria-label="Edição">
              <li className="rounded-full border border-accent px-2 py-0.5 text-ink" aria-current="true">
                {edition}
              </li>
              <li className={`rounded-full border border-border px-2 py-0.5 ${soldOut ? 'text-danger' : 'text-muted'}`}>{soldOut ? 'ESGOTADA' : 'ABERTA'}</li>
              <li className="px-1 py-0.5 text-muted">{nft.editionsAvailable} disponíveis</li>
            </ul>
          </div>

          {/* Compra (desktop) */}
          <div className="mt-4 hidden flex-wrap items-center gap-3 md:flex">
            <Stepper value={quantity} max={Math.max(room, 1)} onChange={setQty} label="Quantidade" disabled={soldOut || room === 0} />
            <Button disabled={soldOut || room === 0 || busy} onClick={() => void add(true)}>
              Comprar
            </Button>
            <Button variant="outline" aria-pressed={liked} onClick={like}>
              <Icon name="heart" className={`h-3 w-3 ${liked ? 'fill-accent' : ''}`} /> {liked ? 'Favoritado' : 'Favoritar'}
            </Button>
          </div>
          {!soldOut && room === 0 && <p className="mt-2 text-[11px] text-accent">Você já tem todas as edições disponíveis no carrinho.</p>}
          {quantity >= room && room > 1 && <p className="mt-2 text-[11px] text-muted">Limite de edições disponíveis atingido.</p>}

          <dl className="mt-4 space-y-1 text-[11px] text-muted">
            <div><dt className="inline">ID do token: </dt><dd className="inline">{nft.tokenId}</dd></div>
            <div><dt className="inline">Coleção: </dt><dd className="inline">{nft.collection}</dd></div>
            <div><dt className="inline">Atributos: </dt><dd className="inline">{nft.attributes.join(', ')}</dd></div>
          </dl>
          <p className="mt-2 hidden items-center gap-2 text-[11px] font-bold text-ink md:flex">
            Compartilhar este NFT:
            {['in', '✉', 't'].map((s) => (
              <button key={s} type="button" aria-label="Compartilhar" onClick={() => announce('O compartilhamento não está disponível nesta demonstração.')} className="font-normal text-muted hover:text-accent">
                {s}
              </button>
            ))}
          </p>
        </div>
      </div>

      {/* Abas (desktop e mobile, em coluna única) */}
      <div className="mt-8 px-4 md:px-0">
        <div role="tablist" aria-label="Informações" className="flex gap-5 border-b border-border text-xs">
          {([['detalhes', 'Detalhes do NFT'], ['avaliacoes', `Avaliações de colecionadores (${nft.reviews})`]] as const).map(([key, label]) => (
            <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)} className={`-mb-px border-b pb-2 ${tab === key ? 'border-accent font-bold text-accent' : 'border-transparent text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="pt-3 text-[11px] leading-relaxed text-muted">
          {tab === 'detalhes' ? (
            <>
              <p>{nft.name} é uma obra digital {edition} finalizada à mão da coleção {nft.collection}. Cada atributo fica armazenado nos metadados do token e verificado na {nft.network}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.</p>
              <p className="mt-3">A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.</p>
              <Section title="Rede:">Cunhado na {nft.network} com procedência imutável e metadados armazenados no IPFS.</Section>
              <Section title="Contrato:">Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</Section>
              <Section title="Direitos autorais:">0x7A42…19E8 · Contrato inteligente ERC-721 verificado.</Section>
            </>
          ) : (
            <p>As avaliações dos colecionadores não estão disponíveis nesta demonstração.</p>
          )}
        </div>
        <NftStrip title="Mais desta coleção" query={nft.collection} excludeId={nft.id} />
      </div>

      {/* Barra de compra (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg px-4 py-3 md:hidden">
        <div className="mb-2 flex items-center justify-between text-xs text-ink">
          <span className="flex items-center gap-2">
            Qtd. <Stepper value={quantity} max={Math.max(room, 1)} onChange={setQty} label="Quantidade" disabled={soldOut || room === 0} />
          </span>
          <span className="font-bold text-accent">{formatEth(mulEthInt(nft.price, quantity))}</span>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 rounded-full py-3" disabled={soldOut || room === 0 || busy} onClick={() => void add(true)}>
            {soldOut ? 'Esgotado' : 'Comprar NFT'}
          </Button>
          <Button variant="outline" className="rounded-full px-3" aria-label="Adicionar ao carrinho" disabled={soldOut || room === 0 || busy} onClick={() => void add(false)}>
            <Icon name="cart" />
          </Button>
        </div>
      </div>
    </div>
  )
}
