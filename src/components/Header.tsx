import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { logout } from '@/features/auth/actions'
import { useSession } from '@/features/auth/session'
import { useCart } from '@/features/cart/useCart'
import { buttonClass, Icon, StubLink } from './ui'

const navClass = 'border-b border-transparent pb-1 text-muted hover:text-ink'

export function Header() {
  const session = useSession()
  const { count } = useCart()
  const navigate = useNavigate()
  const [searching, setSearching] = useState(false)

  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-8">
        <Link to="/" className="text-sm font-bold tracking-[0.25em] text-ink">
          KURIO
        </Link>

        <nav aria-label="Principal" className="order-3 flex w-full gap-5 text-xs sm:order-none sm:w-auto sm:flex-1 sm:justify-center">
          <Link to="/" activeOptions={{ exact: true }} className={navClass} activeProps={{ className: 'border-b border-accent pb-1 text-accent', 'aria-current': 'page' }}>
            Início
          </Link>
          <Link to="/" hash="catalogo" className={navClass}>
            Mercado
          </Link>
          <StubLink className={navClass}>Criadores</StubLink>
          <StubLink className={navClass}>Aprender</StubLink>
        </nav>

        <div className="ml-auto flex items-center gap-3 sm:ml-0">
          {searching ? (
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault()
                const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
                setSearching(false)
                navigate({ to: '/', search: { q: q || undefined } })
              }}
            >
              <label htmlFor="header-search" className="sr-only">
                Buscar NFTs
              </label>
              <input
                id="header-search"
                name="q"
                autoFocus
                placeholder="Buscar NFTs"
                onBlur={() => setSearching(false)}
                className="w-40 rounded-sm border border-border bg-surface px-2 py-1 text-xs text-ink placeholder:text-muted"
              />
            </form>
          ) : (
            <button type="button" aria-label="Buscar NFTs" onClick={() => setSearching(true)} className="text-ink hover:text-accent">
              <Icon name="search" />
            </button>
          )}
          <Link to="/carrinho" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} className="relative text-ink hover:text-accent">
            <Icon name="cart" />
            {count > 0 && (
              <span aria-hidden="true" className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-bg">
                {count}
              </span>
            )}
          </Link>
          {session ? (
            <>
              <Link to="/perfil" className="text-xs text-ink hover:text-accent">
                {session.user.name.split(' ')[0]}
              </Link>
              <button type="button" onClick={() => void logout().then(() => navigate({ to: '/' }))} className={buttonClass('outline', 'px-3 py-1')}>
                Sair
              </button>
            </>
          ) : (
            <Link to="/login" className={buttonClass('outline', 'px-3 py-1')}>
              <Icon name="user" className="h-3 w-3" /> Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
