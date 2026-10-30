import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * Um socket por sessão. Reutilizar a instância entre usuários vazaria eventos,
 * então o logout chama closeSocket() e o login abre outro com o novo token.
 */
export function openSocket(token: string): Socket {
  closeSocket()
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
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
}

export const currentSocket = () => socket
