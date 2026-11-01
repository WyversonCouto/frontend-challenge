import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AccountLayout } from '@/components/AccountLayout'
import { FormField, inputClass } from '@/components/FormField'
import { Button, Icon } from '@/components/ui'
import { getSession, setSession, useSession } from '@/features/auth/session'
import { ApiError, http } from '@/lib/api'
import { announce } from '@/lib/announce'
import type { User } from '@/lib/types'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type Errors = Record<string, string | undefined>

/** Reduz a imagem no navegador: o avatar vira um data URL pequeno, sem upload real. */
function resizeImage(file: File, size = 192): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas'))
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('imagem'))
    }
    img.src = url
  })
}

function PasswordField({ id, label, value, onChange, error, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; autoComplete: string }) {
  const [shown, setShown] = useState(false)
  return (
    <FormField id={id} label={label} error={error}>
      <div className="relative">
        <input id={id} type={shown ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-erro` : undefined} className={`${inputClass(error)} pr-9`} />
        <button type="button" aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={shown} onClick={() => setShown((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
          <Icon name={shown ? 'eye-off' : 'eye'} />
        </button>
      </div>
    </FormField>
  )
}

export function ProfilePage() {
  const session = useSession()
  const user = session!.user
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(user.name)
  const [username, setUsername] = useState(user.username)
  const [email, setEmail] = useState(user.email)
  const [avatar, setAvatar] = useState<string | null>(user.avatarUrl)
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Errors>({})

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await http.patch<User>('/profile', { name: name.trim(), username: username.trim(), email: email.trim(), avatarDataUrl: avatar })
      const current = getSession()
      if (current) setSession({ ...current, user: data })
      if (pw.currentPassword || pw.newPassword || pw.confirmPassword) await http.post('/profile/password', pw)
    },
    onSuccess: () => {
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setErrors({})
      announce('Alterações salvas.')
    },
    onError: (e) => {
      if (e instanceof ApiError) setErrors({ ...e.fields, form: Object.keys(e.fields).length ? undefined : e.network ? 'Sem conexão. Tente novamente.' : e.message })
      else setErrors({ form: 'Não foi possível salvar.' })
    },
  })

  function submit() {
    const f: Errors = {}
    if (name.trim().length < 2) f.name = 'Informe seu nome.'
    if (username.trim().length < 3) f.username = 'Use ao menos 3 caracteres.'
    if (!EMAIL.test(email.trim())) f.email = 'Informe um e-mail válido.'
    const changingPassword = pw.currentPassword || pw.newPassword || pw.confirmPassword
    if (changingPassword) {
      if (!pw.currentPassword) f.currentPassword = 'Informe a senha atual.'
      if (pw.newPassword.length < 8) f.newPassword = 'Use ao menos 8 caracteres.'
      else if (!/[A-Z]/.test(pw.newPassword)) f.newPassword = 'Inclua uma letra maiúscula.'
      else if (!/\d/.test(pw.newPassword)) f.newPassword = 'Inclua um número.'
      if (pw.confirmPassword !== pw.newPassword) f.confirmPassword = 'As senhas não coincidem.'
    }
    setErrors(f)
    if (Object.keys(f).length) announce('Revise os campos destacados.')
    else save.mutate()
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, type = 'text') => (
    <FormField id={id} label={label} required error={errors[id]}>
      <input id={id} type={type} value={value} onChange={(e) => { set(e.target.value); setErrors((s) => ({ ...s, [id]: undefined })) }} aria-invalid={errors[id] ? true : undefined} aria-describedby={errors[id] ? `${id}-erro` : undefined} className={inputClass(errors[id])} />
    </FormField>
  )

  return (
    <AccountLayout title="Perfil do colecionador">
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit() }} aria-busy={save.isPending} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {field('name', 'Nome de exibição', name, setName)}
          {field('username', 'Nome de usuário', username, setUsername)}
          {field('email', 'E-mail', email, setEmail, 'email')}
          <div>
            <p className="mb-1 text-[11px] text-ink">Avatar</p>
            <div className="flex items-center gap-3">
              {avatar ? <img src={avatar} alt="Seu avatar" width={40} height={40} className="h-10 w-10 rounded-full object-cover" /> : <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-accent"><Icon name="user" /></span>}
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" aria-label="Escolher imagem de avatar" onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try { setAvatar(await resizeImage(file)); announce('Avatar atualizado. Salve para confirmar.') } catch { announce('Não foi possível ler essa imagem.') }
              }} />
              <Button variant="outline" className="px-3 py-1" onClick={() => fileRef.current?.click()}>Alterar</Button>
              <button type="button" className="text-[11px] text-muted underline" onClick={() => setAvatar(null)}>Remover</button>
            </div>
            {errors.avatarDataUrl && <p className="mt-1 text-[11px] text-danger">{errors.avatarDataUrl}</p>}
          </div>
        </div>

        <h2 className="pt-3 text-xs font-bold text-ink">Alterar senha</h2>
        <div className="grid max-w-[420px] gap-3">
          <PasswordField id="currentPassword" label="Senha atual" autoComplete="current-password" value={pw.currentPassword} onChange={(v) => setPw((s) => ({ ...s, currentPassword: v }))} error={errors.currentPassword} />
          <PasswordField id="newPassword" label="Nova senha" autoComplete="new-password" value={pw.newPassword} onChange={(v) => setPw((s) => ({ ...s, newPassword: v }))} error={errors.newPassword} />
          <PasswordField id="confirmPassword" label="Confirmar nova senha" autoComplete="new-password" value={pw.confirmPassword} onChange={(v) => setPw((s) => ({ ...s, confirmPassword: v }))} error={errors.confirmPassword} />
        </div>
        {errors.form && <p role="alert" className="text-[11px] text-danger">{errors.form}</p>}
        <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>
      </form>
    </AccountLayout>
  )
}
