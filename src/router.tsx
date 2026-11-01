import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect } from '@tanstack/react-router'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { LiveRegion } from '@/components/LiveRegion'
import { setExpiredHandler } from '@/features/auth/actions'
import { getSession } from '@/features/auth/session'
import { AuthPage, validateAuthSearch } from '@/routes/auth'
import { CartPage } from '@/routes/cart'
import { CheckoutPage } from '@/routes/checkout'
import { HomePage, validateHomeSearch } from '@/routes/home'
import { NftDetailPage } from '@/routes/nft'
import { OrderPage } from '@/routes/order'
import { ProfilePage } from '@/routes/profile'
import { WalletsPage } from '@/routes/wallets'

const rootRoute = createRootRoute({
  component: () => (
    <div className="flex min-h-screen flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-accent focus:px-3 focus:py-1 focus:text-bg">
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <LiveRegion />
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl text-accent">Página não encontrada</h1>
      <p className="mt-2 text-muted">O endereço não existe ou foi movido.</p>
      <Link to="/" className="mt-4 inline-block text-accent underline">
        Voltar ao início
      </Link>
    </div>
  ),
})

/** Rotas privadas: sem sessão, vai ao login e volta para cá depois. */
const requireAuth = ({ location }: { location: { href: string } }) => {
  if (!getSession()) throw redirect({ to: '/login', search: { redirect: location.href } })
}

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', validateSearch: validateHomeSearch, component: HomePage })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', validateSearch: validateAuthSearch, component: () => <AuthPage mode="login" /> })
const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cadastro', validateSearch: validateAuthSearch, component: () => <AuthPage mode="register" /> })

const screen = <P extends string>(path: P, component: () => React.JSX.Element, guarded = false) =>
  createRoute({ getParentRoute: () => rootRoute, path, beforeLoad: guarded ? requireAuth : undefined, component })

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  screen('/nft/$id', NftDetailPage),
  screen('/carrinho', CartPage),
  screen('/pagamento', CheckoutPage, true),
  screen('/pedido/$id', OrderPage, true),
  screen('/perfil', ProfilePage, true),
  screen('/carteiras', WalletsPage, true),
])

export const router = createRouter({ routeTree, defaultPreload: 'intent' })

// Sessão expirada em qualquer chamada: leva ao login e preserva a rota atual para retomar.
setExpiredHandler(() => {
  void router.navigate({ to: '/login', search: { redirect: router.state.location.href, expired: true } })
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
