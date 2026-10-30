import type { SocketEvent } from '@/lib/types'

/**
 * Registro das conexões Socket.IO abertas no servidor simulado.
 * REST e eventos compartilham o mesmo estado: quem altera o db chama o bus.
 */
export interface MockConnection {
  userId: string | null
  send: (event: string, payload: SocketEvent) => void
  close: () => void
}

const connections = new Set<MockConnection>()

export const bus = {
  add: (c: MockConnection) => connections.add(c),
  remove: (c: MockConnection) => connections.delete(c),
  size: () => connections.size,

  /** nft.updated vai para todos; order.updated só para o dono do pedido. */
  publish(event: 'nft.updated' | 'order.updated', payload: SocketEvent) {
    for (const c of connections) {
      if (payload.resource === 'order' && c.userId !== payload.userId) continue
      c.send(event, payload)
    }
  },

  /** Entrega o payload exatamente como recebido (duplicatas, eventos antigos). */
  publishRaw(event: string, payload: SocketEvent) {
    for (const c of connections) c.send(event, payload)
  },

  disconnectAll() {
    for (const c of [...connections]) c.close()
  },
}
