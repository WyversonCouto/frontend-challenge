import { http } from '@/lib/api'
import type { Cart, CartItem, Quote } from '@/lib/types'

export const cartKey = (userId: string) => ['user', userId, 'cart'] as const

export const fetchCart = (signal?: AbortSignal) => http.get<Cart>('/cart', { signal }).then((r) => r.data)

export const fetchQuote = (items: CartItem[], coupon?: string, signal?: AbortSignal) =>
  http.post<Quote>('/quote', { items, coupon }, { signal }).then((r) => r.data)

export const quoteKey = (items: CartItem[], coupon?: string) =>
  ['quote', items.map((i) => `${i.nftId}:${i.quantity}`).join(','), coupon ?? ''] as const
