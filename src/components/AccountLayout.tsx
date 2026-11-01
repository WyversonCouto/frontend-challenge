import type { ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { logout } from '@/features/auth/actions'
import { StubLink } from './ui'

const item = 'flex items-center gap-2 border-l-2 px-3 py-2 text-[11px]'

/** Menu "Meu perfil": só Dados do perfil e Carteiras fazem parte do escopo. */
export function AccountLayout({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto grid max-w-[1000px] gap-6 px-4 py-6 sm:px-8 md:grid-cols-[170px_1fr]">
      <nav aria-label="Meu perfil" className="h-fit rounded-sm bg-surface py-2">
        <p className="px-3 pb-2 text-xs font-bold text-ink">Meu perfil</p>
        <ul className="flex flex-wrap md:block">
          <li>
            <Link to="/perfil" className={`${item} text-muted hover:text-ink`} activeProps={{ className: `${item} border-accent text-accent`, 'aria-current': 'page' }} inactiveProps={{ className: `${item} border-transparent text-muted hover:text-ink` }}>
              Dados do perfil
            </Link>
          </li>
          <li>
            <Link to="/carteiras" className={item} activeProps={{ className: `${item} border-accent text-accent`, 'aria-current': 'page' }} inactiveProps={{ className: `${item} border-transparent text-muted hover:text-ink` }}>
              Carteiras
            </Link>
          </li>
          {['Atividade', 'Lista de interesse', 'Ofertas', 'Arquivos baixados', 'Suporte'].map((l) => (
            <li key={l}>
              <StubLink className={`${item} border-transparent text-muted hover:text-ink`}>{l}</StubLink>
            </li>
          ))}
          <li className="w-full border-t border-border">
            <button type="button" onClick={() => void logout().then(() => navigate({ to: '/' }))} className={`${item} w-full border-transparent text-accent`}>
              Sair
            </button>
          </li>
        </ul>
      </nav>
      <section aria-labelledby="conta-titulo">
        <h1 id="conta-titulo" className="mb-4 text-xs font-bold text-ink">{title}</h1>
        {children}
      </section>
    </div>
  )
}
