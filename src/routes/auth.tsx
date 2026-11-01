import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { login, register } from '@/features/auth/actions'
import { mergeGuestCart } from '@/features/cart/useCart'
import { ApiError } from '@/lib/api'
import { announce } from '@/lib/announce'
import { Button, Icon } from '@/components/ui'

type Mode = 'login' | 'register'
type Values = Record<'username' | 'email' | 'password' | 'confirmPassword', string>
type Errors = Partial<Record<keyof Values | 'form', string>>

export interface AuthSearch {
  redirect?: string
  expired?: boolean
}

/** Só aceita retorno para caminhos internos (evita open redirect). */
export function safeRedirect(path?: string) {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/'
}

export function validateAuthSearch(s: Record<string, unknown>): AuthSearch {
  return {
    redirect: typeof s.redirect === 'string' ? safeRedirect(s.redirect) : undefined,
    expired: s.expired === true || s.expired === 'true' ? true : undefined,
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(mode: Mode, v: Values): Errors {
  const e: Errors = {}
  if (!EMAIL.test(v.email)) e.email = 'Informe um e-mail válido.'
  if (mode === 'login') {
    if (!v.password) e.password = 'Informe a senha.'
    return e
  }
  if (v.username.trim().length < 3) e.username = 'Use ao menos 3 caracteres.'
  if (v.password.length < 8) e.password = 'Use ao menos 8 caracteres.'
  else if (!/[A-Z]/.test(v.password)) e.password = 'Inclua uma letra maiúscula.'
  else if (!/\d/.test(v.password)) e.password = 'Inclua um número.'
  if (v.confirmPassword !== v.password) e.confirmPassword = 'As senhas não coincidem.'
  return e
}

function Field({
  id,
  label,
  error,
  type = 'text',
  autoComplete,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  error?: string
  type?: string
  autoComplete?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [shown, setShown] = useState(false)
  const isPassword = type === 'password'
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={isPassword && shown ? 'text' : type}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-erro` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-sm border bg-bg px-3 py-2 pr-9 text-xs text-ink placeholder:text-muted ${error ? 'border-danger' : 'border-border'}`}
        />
        {isPassword && (
          <button type="button" aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={shown} onClick={() => setShown((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
            <Icon name={shown ? 'eye-off' : 'eye'} />
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-erro`} className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function AuthPage({ mode }: { mode: Mode }) {
  const { redirect, expired } = useSearch({ strict: false }) as AuthSearch
  const navigate = useNavigate()
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [values, setValues] = useState<Values>({ username: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Errors>({})

  // <dialog> nativo com showModal(): o navegador prende o foco e fecha com Esc.
  // Sem cleanup de propósito: ao sair da rota o elemento é removido do DOM e some do topo
  // sozinho. Chamar close() ali dispara um evento "close" assíncrono que, no StrictMode
  // (que monta o componente duas vezes em dev), mandava o usuário de volta para o início.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const set = (key: keyof Values) => (v: string) => {
    setValues((s) => ({ ...s, [key]: v }))
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }))
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'login') await login({ email: values.email, password: values.password })
      else await register({ name: values.username, username: values.username, email: values.email, password: values.password, confirmPassword: values.confirmPassword })
      // Os itens do visitante passam para a conta; falha aqui não impede o login.
      await mergeGuestCart().catch(() => announce('Não foi possível mesclar seu carrinho de visitante.'))
    },
    onSuccess: () => {
      announce(mode === 'login' ? 'Você entrou na sua conta.' : 'Conta criada. Bem-vindo à Kurio!')
      router.history.push(safeRedirect(redirect))
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const fields = error.fields as Errors
        setErrors({ ...fields, form: Object.keys(fields).length ? undefined : error.network ? 'Sem conexão. Verifique sua internet e tente de novo.' : error.message })
      } else setErrors({ form: 'Algo deu errado. Tente novamente.' })
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const found = validate(mode, values)
    setErrors(found)
    if (Object.keys(found).length === 0) mutation.mutate()
  }

  const title = mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'
  const switchTab = 'px-1 pb-1 text-sm'

  return (
    <>
      {/* Fundo da página (o Figma mostra o modal sobre a vitrine). */}
      <section aria-hidden="true" className="mx-auto max-w-[1200px] px-4 py-16 sm:px-8">
        <h1 className="text-4xl font-bold text-ink">SEJA DONO DO FUTURO DA ARTE DIGITAL</h1>
      </section>

      <dialog
        ref={dialogRef}
        aria-labelledby="auth-title"
        onClose={(e) => {
          // Só reage a um fechamento real (Esc ou botão fechar).
          if (!e.currentTarget.open) void navigate({ to: '/' })
        }}
        className="m-auto w-[500px] max-w-[92vw] border-b-4 border-accent bg-surface p-0 text-ink backdrop:bg-black/70 max-sm:fixed max-sm:inset-0 max-sm:h-full max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:border-b-0 max-sm:bg-bg"
      >
        <div className="relative px-6 pb-8 pt-6 sm:px-10">
          <button type="button" aria-label="Fechar" onClick={() => dialogRef.current?.close()} className="absolute right-3 top-3 text-muted hover:text-ink max-sm:hidden">
            <Icon name="close" />
          </button>

          <p className="mb-6 hidden text-center text-lg font-bold tracking-[0.3em] max-sm:block max-sm:mt-12">KURIO</p>

          <div className="mb-2 flex items-center justify-center gap-3 max-sm:hidden" role="group" aria-label="Acesso">
            <Link to="/login" search={(p: AuthSearch) => p} replace className={`${switchTab} ${mode === 'login' ? 'border-b border-accent text-accent' : 'text-muted'}`} aria-current={mode === 'login' ? 'page' : undefined}>
              Entrar
            </Link>
            <span aria-hidden="true" className="text-border">|</span>
            <Link to="/cadastro" search={(p: AuthSearch) => p} replace className={`${switchTab} ${mode === 'register' ? 'border-b border-accent text-accent' : 'text-muted'}`} aria-current={mode === 'register' ? 'page' : undefined}>
              Criar conta
            </Link>
          </div>

          <h2 id="auth-title" className="mb-1 text-center text-base text-ink sm:sr-only">
            {title}
          </h2>
          <p className="mb-5 text-center text-[11px] text-muted">
            {mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
          </p>

          {expired && (
            <p role="alert" className="mb-4 rounded-sm border border-accent bg-surface-2 p-3 text-[11px] text-ink">
              Sua sessão expirou. Entre novamente para continuar de onde parou.
            </p>
          )}

          <form noValidate onSubmit={onSubmit} className="space-y-3" aria-busy={mutation.isPending}>
            {mode === 'register' && <Field id="username" label="Nome de usuário" autoComplete="username" value={values.username} onChange={set('username')} error={errors.username} />}
            <Field id="email" label="E-mail" type="email" autoComplete="email" placeholder="contato@email.com" value={values.email} onChange={set('email')} error={errors.email} />
            <Field id="password" label="Senha" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={values.password} onChange={set('password')} error={errors.password} />
            {mode === 'register' && <Field id="confirmPassword" label="Confirmar senha" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} />}

            {errors.form && (
              <p role="alert" className="text-[11px] text-danger">
                {errors.form}
              </p>
            )}

            {mode === 'login' && (
              <p className="text-right text-[11px]">
                <button type="button" className="text-accent underline" onClick={() => announce('A recuperação de senha não está disponível nesta demonstração.')}>
                  Esqueceu a senha?
                </button>
              </p>
            )}

            <Button type="submit" className="w-full py-2.5" disabled={mutation.isPending}>
              {mutation.isPending ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[11px] text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-border" /> {mode === 'login' ? 'Ou continue com' : 'Ou continue com'} <span className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            {['Continuar com Google', 'Continuar com Facebook'].map((label) => (
              <button key={label} type="button" aria-disabled="true" title="Indisponível nesta demonstração" onClick={() => announce('Login social não está disponível nesta demonstração.')} className="w-full rounded-sm border border-border px-3 py-2 text-[11px] text-muted">
                {label}
              </button>
            ))}
          </div>

          <p className="mt-5 text-center text-[11px] text-muted sm:hidden">
            {mode === 'login' ? (
              <>
                Novo na Kurio?{' '}
                <Link to="/cadastro" search={(p: AuthSearch) => p} replace className="text-accent underline">
                  Crie uma conta
                </Link>
              </>
            ) : (
              <>
                Já tem uma conta?{' '}
                <Link to="/login" search={(p: AuthSearch) => p} replace className="text-accent underline">
                  Entre
                </Link>
              </>
            )}
          </p>
        </div>
      </dialog>
    </>
  )
}
