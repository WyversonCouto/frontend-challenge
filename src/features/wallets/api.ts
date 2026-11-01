import { useQuery } from '@tanstack/react-query'
import { http } from '@/lib/api'
import type { Wallet } from '@/lib/types'
import { useSession } from '../auth/session'

export const walletsKey = (userId?: string) => ['user', userId, 'wallets'] as const

export function useWallets() {
  const session = useSession()
  return useQuery({
    queryKey: walletsKey(session?.user.id),
    queryFn: ({ signal }) => http.get<{ wallets: Wallet[] }>('/wallets', { signal }).then((r) => r.data.wallets),
    enabled: Boolean(session),
  })
}

export const shortAddress = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)
