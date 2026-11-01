import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { announce } from '@/lib/announce'

type Variant = 'primary' | 'outline' | 'ghost'

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50'
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-bg hover:bg-accent-strong',
  outline: 'border border-accent text-accent hover:bg-accent/10',
  ghost: 'text-muted hover:text-ink',
}

export function buttonClass(variant: Variant = 'primary', extra = '') {
  return `${base} ${variants[variant]} ${extra}`
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />
}

/**
 * <dialog>.showModal() deixa o Tab sair para a barra do navegador depois do último elemento.
 * Este handler faz o foco dar a volta dentro do diálogo (Tab no último vai ao primeiro e vice-versa).
 */
export function trapTab(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Tab') return
  const root = e.currentTarget
  const items = [
    ...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
  ].filter((el) => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === root)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

/** Ação fora do escopo: nunca aparenta sucesso funcional, só informa. */
export function StubLink({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <a
      href="#"
      className={className}
      onClick={(e) => {
        e.preventDefault()
        announce('Esta página não faz parte desta demonstração.')
      }}
    >
      {children}
    </a>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />
}

export function Icon({ name, className = 'h-4 w-4' }: { name: 'search' | 'cart' | 'user' | 'heart' | 'eye' | 'eye-off' | 'close'; className?: string }) {
  const paths: Record<string, string> = {
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4',
    cart: 'M3 4h2l2.2 10.4a1 1 0 0 0 1 .8h8.4a1 1 0 0 0 1-.8L19 8H6.2M9 19.5h.01M17 19.5h.01',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
    eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    'eye-off': 'M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.5 7.6A16.6 16.6 0 0 0 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.8-.7',
    close: 'M6 6l12 12M18 6 6 18',
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
