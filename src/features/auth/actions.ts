import { configureAuth, http } from '@/lib/api'
import { queryClient } from '@/lib/query'
import type { SessionResponse } from '@/lib/types'
import { closeRealtime, openRealtime } from '../realtime'
import { getSession, setSession } from './session'

let onExpiredNavigate: (() => void) | null = null

/** O router registra aqui como levar o usuário ao login preservando a rota atual. */
export function setExpiredHandler(fn: () => void) {
  onExpiredNavigate = fn
}

configureAuth({
  get: () => getSession()?.token ?? null,
  onExpired: () => {
    if (!getSession()) return
    endSession()
    onExpiredNavigate?.()
  },
})

/** Troca de usuário: cache privado e subscriptions anteriores não podem vazar. */
export function startSession(s: SessionResponse) {
  closeRealtime()
  queryClient.clear()
  setSession({ user: s.user, token: s.token, expiresAt: s.expiresAt })
  void openRealtime(s.token)
}

export function endSession() {
  closeRealtime()
  setSession(null)
  queryClient.clear()
  void openRealtime(null)
}

export async function login(input: { email: string; password: string }) {
  const { data } = await http.post<SessionResponse>('/auth/login', input)
  startSession(data)
  return data
}

export async function register(input: {
  name: string
  username: string
  email: string
  password: string
  confirmPassword: string
}) {
  const { data } = await http.post<SessionResponse>('/auth/register', input)
  startSession(data)
  return data
}

export async function logout() {
  try {
    await http.post('/auth/logout')
  } catch {
    /* mesmo sem resposta, a sessão local é encerrada */
  }
  endSession()
}

/** Chamado no boot: valida o token guardado e abre o socket. */
export async function restoreSession() {
  const s = getSession()
  void openRealtime(s?.token ?? null)
  if (!s) return
  try {
    const { data } = await http.get<SessionResponse>('/auth/session')
    setSession({ user: data.user, token: data.token, expiresAt: data.expiresAt })
  } catch {
    /* 401 já aciona onExpired; falha de rede mantém a sessão local */
  }
}
