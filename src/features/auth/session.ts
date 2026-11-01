import { useSyncExternalStore } from 'react'
import type { User } from '@/lib/types'

/**
 * Sessão no cliente. Guarda só o token emitido pela API e o usuário; senha nunca é guardada.
 * Sobrevive a refresh (localStorage); expira junto com o token.
 */
export interface Session {
  user: User
  token: string
  expiresAt: number
}

const KEY = 'kurio:session'
const listeners = new Set<() => void>()

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    return s.expiresAt > Date.now() ? s : null
  } catch {
    return null
  }
}

let current: Session | null = read()

export const getSession = () => current

export function setSession(next: Session | null) {
  current = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage indisponível: a sessão vale só até o refresh */
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useSession = () => useSyncExternalStore(subscribe, getSession, getSession)
