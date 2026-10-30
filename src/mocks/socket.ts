import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { bus, type MockConnection } from './bus'
import { userForToken } from './handlers'

/**
 * Transporte: WebSocket interceptado pelo MSW (ws.link) com o protocolo Engine.IO v4
 * decodificado por @mswjs/socket.io-binding. O app usa o socket.io-client real.
 *
 * Limitações do ambiente de mocks (documentadas também no ARCHITECTURE.md):
 *  - só o transporte "websocket" (sem long-polling nem upgrade);
 *  - sem rooms/namespaces/broadcast nativos: o roteamento por usuário está em bus.ts;
 *  - o aperto de mão (handshake) é aprovado pelo binding; o token de auth é lido
 *    do pacote CONNECT ("40{...}") para vincular a conexão ao usuário.
 */
// Padrões com caminho fixo não casam com a URL do Engine.IO (que leva ?EIO=4&...),
// então o link é um curinga e o filtro por caminho fica dentro do handler.
const socketServer = ws.link('*')

export const socketHandlers = [
  socketServer.addEventListener('connection', (connection) => {
    // Qualquer outro WebSocket (ex.: HMR do Vite em desenvolvimento) segue para o servidor real.
    if (!connection.client.url.pathname.startsWith('/socket.io')) {
      connection.server.connect()
      return
    }
    const io = toSocketIo(connection)
    const conn: MockConnection = {
      userId: null,
      send: (event, payload) => io.client.emit(event, payload),
      close: () => connection.client.close(),
    }
    bus.add(conn)

    connection.client.addEventListener('message', (event) => {
      const data = event.data
      if (typeof data !== 'string' || !data.startsWith('40')) return
      try {
        const auth = JSON.parse(data.slice(2) || '{}') as { token?: string }
        conn.userId = userForToken(auth.token)?.id ?? null
      } catch {
        conn.userId = null
      }
    })
    connection.client.addEventListener('close', () => bus.remove(conn))
  }),
]
