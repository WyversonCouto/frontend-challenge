import { useState } from 'react'
import { AccountLayout } from '@/components/AccountLayout'
import { Skeleton } from '@/components/ui'
import { useWallets } from '@/features/wallets/api'
import { WalletForm } from '@/features/wallets/WalletForm'

export function WalletsPage() {
  const { data, isPending, isError, refetch } = useWallets()
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [copyPrimary, setCopyPrimary] = useState(false)
  const primary = data?.find((w) => w.kind === 'primary')
  const secondary = data?.find((w) => w.kind === 'secondary')
  const showSecondary = Boolean(secondary) || addingSecondary

  return (
    <AccountLayout title="Carteiras">
      {isPending ? (
        <div aria-busy="true" aria-label="Carregando carteiras" className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError ? (
        <p role="alert" className="text-[11px] text-danger">
          Não foi possível carregar suas carteiras.{' '}
          <button type="button" className="underline" onClick={() => void refetch()}>Tentar novamente</button>
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-bold text-ink">Carteira principal</h2>
          </div>
          <p className="mb-3 text-[10px] text-muted">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          {/* key: ao salvar, o formulário recarrega com o que a API devolveu */}
          <WalletForm key={primary?.id ?? 'new-primary'} kind="primary" wallet={primary} />

          <div className="mt-8 border-t border-border pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xs font-bold text-ink">Carteira secundária</h2>
              {!showSecondary && primary && (
                <span className="flex items-center gap-3 text-[11px] text-muted">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={copyPrimary} onChange={(e) => setCopyPrimary(e.target.checked)} className="accent-[var(--color-accent)]" />
                    Igual à carteira principal
                  </label>
                  <button type="button" className="text-accent underline" onClick={() => setAddingSecondary(true)}>Adicionar</button>
                </span>
              )}
              {!showSecondary && !primary && (
                <span className="text-[10px] text-muted">Cadastre a carteira principal primeiro.</span>
              )}
            </div>
            {showSecondary ? (
              <div className="mt-3">
                <WalletForm key={secondary?.id ?? `new-secondary-${copyPrimary}`} kind="secondary" wallet={secondary} preset={copyPrimary && primary ? { ...primary, address: '', nickname: '', ens: '' } : undefined} />
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-muted">Você ainda não adicionou uma carteira secundária.</p>
            )}
          </div>
        </>
      )}
    </AccountLayout>
  )
}
