import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FormField, inputClass } from '@/components/FormField'
import { Button } from '@/components/ui'
import { ApiError, http } from '@/lib/api'
import { announce } from '@/lib/announce'
import type { NetworkName, Wallet, WalletInput } from '@/lib/types'
import { useSession } from '../auth/session'
import { walletsKey } from './api'

const NETWORKS: NetworkName[] = ['Ethereum', 'Polygon', 'Solana']
const TYPES: Wallet['type'][] = ['MetaMask', 'WalletConnect', 'Coinbase Wallet']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Values {
  displayName: string
  nickname: string
  network: string
  profileName: string
  address: string
  linkedRef: string
  type: string
  referralCode: string
  email: string
  ensLabel: string
}

const fromWallet = (w?: Partial<Wallet>): Values => ({
  displayName: w?.displayName ?? '',
  nickname: w?.nickname ?? '',
  network: w?.network ?? '',
  profileName: w?.profileName ?? '',
  address: w?.address ?? '',
  linkedRef: w?.linkedRef ?? '',
  type: w?.type ?? '',
  referralCode: w?.referralCode ?? '',
  email: w?.email ?? '',
  ensLabel: (w?.ens ?? '').replace(/\.eth$/i, ''),
})

function validate(v: Values) {
  const e: Partial<Record<keyof Values, string>> = {}
  if (v.displayName.trim().length < 2) e.displayName = 'Informe o nome de exibição.'
  if (v.nickname.trim().length < 2) e.nickname = 'Informe o apelido da carteira.'
  if (!v.network) e.network = 'Selecione uma rede.'
  if (v.profileName.trim().length < 2) e.profileName = 'Informe o nome do perfil.'
  if (!/^0x[a-fA-F0-9]{40}$/.test(v.address.trim())) e.address = 'Endereço inválido (0x + 40 caracteres).'
  if (!v.type) e.type = 'Selecione o tipo de carteira.'
  if (v.referralCode.trim().length < 2) e.referralCode = 'Informe o código de indicação.'
  if (!EMAIL.test(v.email.trim())) e.email = 'Informe um e-mail válido.'
  if (!/^[a-z0-9-]{3,}(\.[a-z0-9-]+)*$/i.test(v.ensLabel.trim())) e.ensLabel = 'Use ao menos 3 letras, números ou hífens.'
  return e
}

export function WalletForm({ kind, wallet, preset, onSaved }: { kind: 'primary' | 'secondary'; wallet?: Wallet; preset?: Partial<Wallet>; onSaved?: () => void }) {
  const qc = useQueryClient()
  const session = useSession()
  const [values, setValues] = useState<Values>(fromWallet(wallet ?? preset))
  const [errors, setErrors] = useState<Partial<Record<keyof Values | 'form', string>>>({})
  const prefix = `${kind}-`

  const set = (k: keyof Values) => (v: string) => {
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined, form: undefined }))
  }

  const save = useMutation({
    mutationFn: async () => {
      const body: WalletInput = {
        kind,
        displayName: values.displayName.trim(),
        nickname: values.nickname.trim(),
        network: values.network as NetworkName,
        profileName: values.profileName.trim(),
        address: values.address.trim(),
        type: values.type as Wallet['type'],
        referralCode: values.referralCode.trim(),
        email: values.email.trim(),
        ens: `${values.ensLabel.trim()}.eth`,
        linkedRef: values.linkedRef.trim() || undefined,
      }
      if (wallet) await http.put(`/wallets/${wallet.id}`, body)
      else await http.post('/wallets', body)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: walletsKey(session?.user.id) })
      announce('Carteira salva.')
      onSaved?.()
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        const f = { ...e.fields } as Record<string, string>
        if (f.ens) f.ensLabel = f.ens
        setErrors({ ...f, form: Object.keys(f).length ? undefined : e.network ? 'Sem conexão. Tente novamente.' : e.message })
      } else setErrors({ form: 'Não foi possível salvar a carteira.' })
    },
  })

  const text = (k: keyof Values, label: string, opts: { required?: boolean; placeholder?: string } = {}) => (
    <FormField id={prefix + k} label={label} required={opts.required ?? true} error={errors[k]}>
      <input id={prefix + k} value={values[k]} placeholder={opts.placeholder} onChange={(e) => set(k)(e.target.value)} aria-invalid={errors[k] ? true : undefined} aria-describedby={errors[k] ? `${prefix + k}-erro` : undefined} className={inputClass(errors[k])} />
    </FormField>
  )
  const select = (k: 'network' | 'type', label: string, placeholder: string, options: string[]) => (
    <FormField id={prefix + k} label={label} required error={errors[k]}>
      <select id={prefix + k} value={values[k]} onChange={(e) => set(k)(e.target.value)} aria-invalid={errors[k] ? true : undefined} aria-describedby={errors[k] ? `${prefix + k}-erro` : undefined} className={inputClass(errors[k])}>
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
    </FormField>
  )

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); const f = validate(values); setErrors(f); if (Object.keys(f).length) announce('Revise os campos destacados.'); else save.mutate() }} aria-busy={save.isPending}>
      <div className="grid gap-3 sm:grid-cols-2">
        {text('displayName', 'Nome de exibição')}
        {text('nickname', 'Apelido da carteira')}
        {select('network', 'Rede', 'Selecione uma rede', NETWORKS)}
        {text('profileName', 'Nome do perfil')}
        {text('address', 'Endereço da carteira', { placeholder: 'Endereço 0x da carteira' })}
        {text('linkedRef', 'ENS ou carteira secundária (opcional)', { required: false, placeholder: 'ENS ou carteira secundária (opcional)' })}
        {select('type', 'Tipo de carteira', 'Selecione uma carteira', TYPES)}
        {text('referralCode', 'Código de indicação')}
        {text('email', 'E-mail')}
        <FormField id={`${prefix}ensLabel`} label="Nome ENS" required error={errors.ensLabel}>
          <div className="flex">
            <span className="flex items-center rounded-l-sm border border-r-0 border-border bg-surface px-2 text-xs text-muted">.eth</span>
            <input id={`${prefix}ensLabel`} value={values.ensLabel} onChange={(e) => set('ensLabel')(e.target.value)} aria-invalid={errors.ensLabel ? true : undefined} aria-describedby={errors.ensLabel ? `${prefix}ensLabel-erro` : undefined} className={`${inputClass(errors.ensLabel)} rounded-l-none`} />
          </div>
        </FormField>
      </div>
      {errors.form && <p role="alert" className="mt-3 text-[11px] text-danger">{errors.form}</p>}
      <Button type="submit" className="mt-4" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar carteira'}</Button>
    </form>
  )
}
