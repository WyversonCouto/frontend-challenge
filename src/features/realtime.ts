import { queryClient } from '@/lib/query'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { closeSocket, openSocket } from '@/lib/socket'
import type { Nft, NftPage, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/lib/types'
import { getSession } from './auth/session'

/**
 * Regras do tempo real (também em ARCHITECTURE.md):
 *  - cada evento tem eventId estável e version: duplicata (eventId já visto) é ignorada;
 *  - evento com version <= à do cache é antigo e não regride o estado;
 *  - order.updated só vale se userId for o da sessão atual;
 *  - ao reconectar, tudo que está ativo é reconciliado com a API REST (invalidate);
 *  - trocar de usuário fecha o socket anterior e limpa o conjunto de eventos vistos.
 */
const seen = new Set<string>()

export async function openRealtime(token: string | null) {
  seen.clear()
  const socket = await openSocket(token)
  if (!socket) return // substituída por uma abertura/fechamento mais recente
  socket.on('nft.updated', applyNftEvent)
  socket.on('order.updated', applyOrderEvent)
  socket.io.on('reconnect', () => {
    queryClient.invalidateQueries()
  })
}

export function closeRealtime() {
  seen.clear()
  closeSocket()
}

function applyNftEvent(e: NftUpdatedEvent) {
  if (e.resource !== 'nft' || seen.has(e.eventId)) return
  seen.add(e.eventId)

  let changed = false
  let name = ''
  const patch = (n: Nft): Nft => {
    if (n.id !== e.id || e.version <= n.version) return n
    changed = true
    name = n.name
    return { ...n, price: e.price, editionsAvailable: e.editionsAvailable, version: e.version }
  }

  queryClient.setQueryData<Nft>(['nft', e.id], (old) => (old ? patch(old) : old))
  queryClient.setQueriesData<NftPage>({ queryKey: ['nfts'] }, (old) => (old ? { ...old, items: old.items.map(patch) } : old))
  // O resumo do carrinho e do checkout vem da cotação: refaz para refletir preço/estoque novos.
  queryClient.invalidateQueries({ queryKey: ['quote'] })

  if (changed) announce(`${name || 'Um NFT'} agora custa ${formatEth(e.price)} (${e.editionsAvailable} disponíveis).`)
}

function applyOrderEvent(e: OrderUpdatedEvent) {
  if (e.resource !== 'order' || seen.has(e.eventId)) return
  if (e.userId !== getSession()?.user.id) return
  seen.add(e.eventId)
  queryClient.setQueryData<Order>(['user', e.userId, 'order', e.id], (old) =>
    old && e.version > old.version ? { ...old, status: e.status, version: e.version } : old,
  )
  queryClient.invalidateQueries({ queryKey: ['user', e.userId, 'order', e.id] })
  queryClient.invalidateQueries({ queryKey: ['user', e.userId, 'cart'] })
  announce(e.status === 'confirmed' ? 'Seu pedido foi confirmado.' : e.status === 'declined' ? 'Seu pedido foi recusado.' : 'Pedido atualizado.')
}
