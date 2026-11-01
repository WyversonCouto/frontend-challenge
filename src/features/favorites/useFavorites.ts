import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/api'
import { announce } from '@/lib/announce'
import { useSession } from '../auth/session'

/** Favoritos persistem por usuário; a UI muda na hora e volta atrás se a API falhar. */
export function useFavorites() {
  const session = useSession()
  const qc = useQueryClient()
  const userId = session?.user.id
  const key = ['user', userId, 'favorites'] as const

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => http.get<{ nftIds: string[] }>('/favorites', { signal }).then((r) => r.data.nftIds),
    enabled: Boolean(userId),
  })

  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => (on ? http.put(`/favorites/${id}`) : http.delete(`/favorites/${id}`)),
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<string[]>(key)
      qc.setQueryData<string[]>(key, (old = []) => (on ? [...new Set([...old, id])] : old.filter((x) => x !== id)))
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(key, ctx?.previous)
      announce('Não foi possível atualizar os favoritos. Seu estado anterior foi restaurado.')
    },
    onSuccess: (_d, { on }) => announce(on ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.'),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  return { ids: query.data ?? [], isFavorite: (id: string) => (query.data ?? []).includes(id), toggle: toggle.mutate, pending: toggle.isPending, signedIn: Boolean(userId) }
}
