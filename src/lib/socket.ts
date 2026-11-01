import type { Socket } from 'socket.io-client'

let socket: Socket | null = null
let generation = 0

/**
 * O socket.io-client guarda o WebSocket global no momento em que o módulo é carregado.
 * Se ele carregasse junto com o resto do app, guardaria o WebSocket nativo antes de o MSW
 * instalar a interceptação, e a conexão iria para a rede real. Por isso o import é dinâmico:
 * só acontece depois de o worker do MSW ter iniciado (veja main.tsx).
 *
 * Um socket por sessão: reutilizar a instância entre usuários vazaria eventos, então o logout
 * chama closeSocket() e o login abre outro com o novo token.
 */
export async function openSocket(token: string | null): Promise<Socket | null> {
  closeSocket()
  const mine = ++generation
  const { io } = await import('socket.io-client')
  // Se outra abertura ou um fechamento aconteceu enquanto o módulo carregava, esta ficou obsoleta.
  if (mine !== generation) return null
  socket = io(window.location.origin, {
    path: '/socket.io/',
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  })
  return socket
}

export function closeSocket() {
  generation += 1
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
}

export const currentSocket = () => socket
