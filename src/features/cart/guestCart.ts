import { useSyncExternalStore } from 'react'
import type { Cart } from '@/lib/types'

/** Carrinho do visitante: vive no navegador e é mesclado à conta ao autenticar. */
const KEY = 'kurio:cart:guest'
const listeners = new Set<() => void>()
const EMPTY: Cart = { items: [] }

function read(): Cart {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Cart) : EMPTY
  } catch {
    return EMPTY
  }
}

let current = read()
export const getGuestCart = () => current

export function setGuestCart(next: Cart) {
  current = next.items.length || next.coupon ? next : EMPTY
  try {
    if (current === EMPTY) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* sem persistência: vale até o refresh */
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useGuestCart = () => useSyncExternalStore(subscribe, getGuestCart, getGuestCart)
