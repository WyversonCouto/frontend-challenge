import { createRootRoute, createRoute, createRouter, Link, Outlet } from '@tanstack/react-router'

/**
 * Esqueleto das rotas. As telas entram uma a uma nos próximos passos;
 * as rotas privadas ganham o guard (beforeLoad) junto com a camada de sessão.
 */
function Placeholder({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl text-accent">{title}</h1>
      <p className="text-muted">Tela em construção.</p>
    </main>
  )
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <header className="flex items-center gap-6 border-b border-border px-8 py-4">
        <Link to="/" className="text-lg tracking-wide text-ink">
          KURIO
        </Link>
        <nav aria-label="Principal" className="flex gap-4 text-muted">
          <Link to="/" activeProps={{ className: 'text-accent' }}>
            Início
          </Link>
          <Link to="/carrinho" activeProps={{ className: 'text-accent' }}>
            Carrinho
          </Link>
        </nav>
      </header>
      <Outlet />
    </>
  ),
  notFoundComponent: () => <Placeholder title="Página não encontrada" />,
})

const route = <P extends string>(path: P, title: string) =>
  createRoute({ getParentRoute: () => rootRoute, path, component: () => <Placeholder title={title} /> })

const routeTree = rootRoute.addChildren([
  route('/', 'Início'),
  route('/nft/$id', 'Detalhes do NFT'),
  route('/carrinho', 'Carrinho de NFTs'),
  route('/pagamento', 'Pagamento'),
  route('/pedido/$id', 'Confirmação de pedido'),
  route('/login', 'Entrar'),
  route('/cadastro', 'Criar conta'),
  route('/perfil', 'Perfil do colecionador'),
  route('/carteiras', 'Carteiras'),
])

export const router = createRouter({ routeTree, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
