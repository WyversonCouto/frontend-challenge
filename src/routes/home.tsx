import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useSession } from '@/features/auth/session'
import { useCart } from '@/features/cart/useCart'
import { Icon, StubLink } from '@/components/ui'
import { Filters } from '@/features/nfts/Filters'
import { fetchNft, fetchNfts, nftKeys } from '@/features/nfts/api'
import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { Pagination } from '@/components/Pagination'
import { Button, Skeleton } from '@/components/ui'
import { ApiError } from '@/lib/api'
import type { NetworkName, NftListParams, NftSort } from '@/lib/types'

export interface HomeSearch {
  q?: string
  category?: string
  network?: NetworkName
  minPrice?: string
  maxPrice?: string
  sort?: NftSort
  tab?: 'new' | 'trending'
  page?: number
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const dec = (v: unknown) => (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? v : undefined)
const oneOf = <T extends string>(v: unknown, list: readonly T[]) => (list.includes(v as T) ? (v as T) : undefined)

/** Toda a busca vive na URL: sobrevive a refresh, link compartilhado e botão voltar. */
export function validateHomeSearch(s: Record<string, unknown>): HomeSearch {
  const page = Number(s.page)
  return {
    q: str(s.q),
    category: str(s.category),
    network: oneOf(s.network, ['Ethereum', 'Polygon', 'Solana'] as const),
    minPrice: dec(s.minPrice),
    maxPrice: dec(s.maxPrice),
    sort: oneOf(s.sort, ['recent', 'price_asc', 'price_desc', 'name'] as const),
    tab: oneOf(s.tab, ['new', 'trending'] as const),
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  }
}

const PAGE_SIZE = 9
const SORTS: Array<[NftSort, string]> = [
  ['recent', 'Listados recentemente'],
  ['price_asc', 'Menor preço'],
  ['price_desc', 'Maior preço'],
  ['name', 'Nome (A–Z)'],
]
const TABS: Array<[HomeSearch['tab'], string]> = [
  [undefined, 'Todos os NFTs'],
  ['new', 'Novos lançamentos'],
  ['trending', 'Em alta'],
]

function Hero() {
  const featured = useQuery({ queryKey: nftKeys.detail('nft-001'), queryFn: ({ signal }) => fetchNft('nft-001', signal) })
  return (
    <section aria-labelledby="hero-title" className="mx-auto grid max-w-[1200px] items-center gap-8 px-4 py-10 sm:px-8 md:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="mb-3 text-[11px] text-muted">Bem-vindo à Kurio</p>
        <h1 id="hero-title" className="text-3xl font-bold leading-tight text-ink sm:text-4xl">
          SEJA DONO DO FUTURO
          <br />
          DA ARTE DIGITAL
        </h1>
        <p className="mt-4 max-w-md text-[11px] text-muted">
          Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura do amanhã.
        </p>
        <a href="#catalogo" className="mt-6 inline-block rounded-sm bg-accent px-4 py-2 text-[11px] font-bold text-bg hover:bg-accent-strong">
          EXPLORAR
        </a>
      </div>
      <div className="mx-auto w-full max-w-[420px] aspect-square overflow-hidden rounded-md bg-surface">
        {featured.data ? <img src={featured.data.imageUrl} alt={`Destaque: ${featured.data.name}`} width={420} height={420} className="h-full w-full object-cover" /> : <Skeleton className="h-full w-full" />}
      </div>
    </section>
  )
}

/** Imagens das seções editoriais vêm do mesmo catálogo (cache compartilhado com as faixas). */
function useShowcase() {
  const params = { pageSize: 8, sort: 'recent' as const }
  return useQuery({ queryKey: nftKeys.list(params), queryFn: ({ signal }) => fetchNfts(params, signal) }).data?.items ?? []
}

function FeaturedPanel() {
  const nft = useShowcase()[3]
  return (
    <aside aria-label="NFT em destaque" className="mt-4 hidden rounded-sm bg-surface-2 p-3 text-center lg:block">
      <p className="text-xs font-bold text-accent">NFT EM DESTAQUE</p>
      <p className="mb-2 text-[11px] font-bold text-ink">OFERTA LIMITADA</p>
      {nft ? (
        <Link to="/nft/$id" params={{ id: nft.id }}>
          <img src={nft.imageUrl} alt={`Destaque: ${nft.name}`} width={180} height={180} loading="lazy" className="aspect-square w-full rounded-md object-cover" />
        </Link>
      ) : (
        <Skeleton className="aspect-square w-full" />
      )}
    </aside>
  )
}

function Editorial() {
  const items = useShowcase()
  const promos = [
    { img: items[0], title: 'Lançamentos gênesis de edição limitada', text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.' },
    { img: items[5], title: 'Arte digital selecionada e muito mais', text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a época.' },
  ]
  const posts = [
    ['12 de setembro', 'Leitura de 6 min', 'Como funciona a propriedade de NFTs', 'Aprenda a colecionar, negociar e verificar ativos digitais.'],
    ['13 de setembro', 'Leitura de 2 min', '10 artistas digitais para acompanhar', 'Conheça criadores que moldam a cultura digital.'],
    ['15 de setembro', 'Leitura de 3 min', 'Raridade, atributos e procedência', 'Entenda raridade, procedência, direitos autorais e utilidade.'],
    ['15 de setembro', 'Leitura de 2 min', 'Como proteger sua carteira', 'Proteja sua carteira, seus ativos e sua identidade.'],
  ]
  return (
    <div className="mx-auto mt-12 max-w-[1200px] px-4 sm:px-8">
      <div className="grid gap-4 md:grid-cols-2">
        {promos.map((p) => (
          <article key={p.title} className="grid grid-cols-[110px_1fr] items-center gap-3 rounded-sm bg-surface sm:grid-cols-[150px_1fr]">
            {p.img ? <img src={p.img.imageUrl} alt="" width={150} height={150} loading="lazy" className="h-full w-full rounded-l-sm object-cover" /> : <Skeleton className="h-[150px] w-full" />}
            <div className="py-4 pr-4 text-right">
              <h3 className="text-xs font-bold text-ink">{p.title}</h3>
              <p className="mt-1 text-[10px] text-muted">{p.text}</p>
              <StubLink className="mt-2 inline-block rounded-sm bg-accent px-3 py-1 text-[10px] font-bold text-bg">Explorar →</StubLink>
            </div>
          </article>
        ))}
      </div>

      <section aria-labelledby="diario" className="mt-12">
        <h2 id="diario" className="text-center text-base font-bold text-ink">Diário da Cunhagem</h2>
        <p className="mb-4 text-center text-[10px] text-muted">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {posts.map(([date, read, title, text], i) => (
            <li key={title} className="overflow-hidden rounded-sm bg-surface">
              {items[i + 1] ? <img src={items[i + 1].imageUrl} alt="" width={200} height={130} loading="lazy" className="h-[130px] w-full object-cover" /> : <Skeleton className="h-[130px] w-full" />}
              <div className="p-3">
                <p className="text-[9px] text-muted">{date} | {read}</p>
                <h3 className="mt-1 text-[11px] font-bold text-ink">{title}</h3>
                <p className="mt-1 text-[10px] text-muted">{text}</p>
                <StubLink className="mt-2 inline-block text-[10px] text-accent">Ler mais →</StubLink>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** Navegação inferior do layout mobile. */
function MobileNav() {
  const session = useSession()
  const { count } = useCart()
  const cls = 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted'
  return (
    <nav aria-label="Atalhos" className="fixed inset-x-3 bottom-3 z-30 flex rounded-full border border-border bg-surface md:hidden">
      <Link to="/" className={cls} activeProps={{ className: `${cls} text-accent` }} activeOptions={{ exact: true }}>
        <Icon name="search" /> Explorar
      </Link>
      <Link to="/carrinho" className={cls}>
        <Icon name="cart" /> Carrinho{count > 0 ? ` (${count})` : ''}
      </Link>
      <Link to={session ? '/perfil' : '/login'} className={cls}>
        <Icon name="user" /> {session ? 'Perfil' : 'Entrar'}
      </Link>
    </nav>
  )
}

export function HomePage() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })

  const params: NftListParams = { ...search, page: search.page ?? 1, pageSize: PAGE_SIZE }
  const query = useQuery({
    queryKey: nftKeys.list(params),
    queryFn: ({ signal }) => fetchNfts(params, signal),
    // Mantém a página anterior visível enquanto a nova carrega (sem piscar nem deslocar o layout).
    placeholderData: keepPreviousData,
  })

  /** Mudar qualquer filtro reinicia a paginação. */
  const patch = (next: Partial<HomeSearch>, keepPage = false) =>
    navigate({ search: (prev) => ({ ...prev, ...next, page: keepPage ? next.page : undefined }) })

  const hasFilters = Boolean(search.q || search.category || search.network || search.minPrice || search.maxPrice || search.tab)
  const data = query.data
  const refetchingInBackground = query.isFetching && !query.isPending

  return (
    <>
      <Hero />
      <div id="catalogo" className="mx-auto grid max-w-[1200px] scroll-mt-4 gap-6 px-4 sm:px-8 lg:grid-cols-[210px_1fr]">
        <div>
        <Filters
          key={`${search.minPrice}-${search.maxPrice}`}
          facets={data?.facets}
          category={search.category}
          network={search.network}
          minPrice={search.minPrice}
          maxPrice={search.maxPrice}
          onCategory={(category) => patch({ category })}
          onNetwork={(network) => patch({ network })}
          onPrice={(minPrice, maxPrice) => patch({ minPrice, maxPrice })}
        />
        <FeaturedPanel />
        </div>

        <section aria-labelledby="catalogo-titulo">
          <h2 id="catalogo-titulo" className="sr-only">
            Catálogo de NFTs
          </h2>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div role="tablist" aria-label="Seleção" className="flex flex-wrap gap-4">
              {TABS.map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={search.tab === value}
                  onClick={() => patch({ tab: value })}
                  className={`border-b pb-1 ${search.tab === value ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-muted">
              Ordenar por:
              <select value={search.sort ?? 'recent'} onChange={(e) => patch({ sort: e.target.value as NftSort })} className="rounded-sm border border-border bg-surface px-2 py-1 text-ink">
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(search.q || hasFilters) && (
            <p className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
              {search.q && <span>Resultados para “{search.q}”</span>}
              <button type="button" className="text-accent underline" onClick={() => navigate({ search: {} })}>
                Limpar filtros
              </button>
            </p>
          )}

          {query.isError && !data ? (
            <div role="alert" className="rounded-sm border border-danger/50 bg-surface p-6 text-center">
              <p className="text-danger">{query.error instanceof ApiError ? query.error.message : 'Não foi possível carregar o catálogo.'}</p>
              <Button className="mt-4" onClick={() => void query.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : query.isPending ? (
            <ul aria-busy="true" aria-label="Carregando NFTs" className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {Array.from({ length: PAGE_SIZE }, (_, i) => (
                <NftCardSkeleton key={i} />
              ))}
            </ul>
          ) : data && data.items.length === 0 ? (
            <div className="rounded-sm bg-surface p-10 text-center">
              <p className="text-ink">Nenhum NFT encontrado.</p>
              <p className="mt-1 text-muted">Ajuste a busca ou remova alguns filtros.</p>
              {hasFilters && (
                <Button variant="outline" className="mt-4" onClick={() => navigate({ search: {} })}>
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            data && (
              <>
                {query.isError && (
                  <p role="alert" className="mb-3 text-[11px] text-danger">
                    Não foi possível atualizar. Exibindo os últimos resultados.{' '}
                    <button type="button" className="underline" onClick={() => void query.refetch()}>
                      Tentar novamente
                    </button>
                  </p>
                )}
                <ul aria-busy={refetchingInBackground} className={`grid grid-cols-2 gap-3 transition-opacity md:grid-cols-3 ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
                  {data.items.map((nft) => (
                    <NftCard key={nft.id} nft={nft} />
                  ))}
                </ul>
                <p className="mt-3 text-center text-[11px] text-muted">
                  {data.total} {data.total === 1 ? 'resultado' : 'resultados'}
                </p>
                <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => patch({ page }, true)} />
              </>
            )
          )}
        </section>
      </div>
      <Editorial />
      <MobileNav />
      <div className="h-16 md:hidden" aria-hidden="true" />
    </>
  )
}
