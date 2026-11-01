import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/api'
import { fetchNft, nftKeys } from '../nfts/api'
import type { Cart } from '@/lib/types'
import { useSession } from '../auth/session'
import { cartKey, fetchCart, fetchQuote, quoteKey } from './api'
import { getGuestCart, setGuestCart, useGuestCart } from './guestCart'

export class CartError extends Error {}

/**
 * Carrinho unificado. Visitante: estado local. Autenticado: API (fonte da verdade),
 * com atualização otimista e rollback em falha.
 */
export function useCart() {
  const session = useSession()
  const guest = useGuestCart()
  const qc = useQueryClient()
  const userId = session?.user.id

  const server = useQuery({
    queryKey: userId ? cartKey(userId) : ['user', 'anon', 'cart'],
    queryFn: ({ signal }) => fetchCart(signal),
    enabled: Boolean(userId),
  })

  const cart: Cart = userId ? (server.data ?? { items: [] }) : guest
  const count = cart.items.reduce((n, i) => n + i.quantity, 0)

  /** Aplica a mudança no cache de imediato; se a API falhar, volta ao estado anterior. */
  async function optimistic(change: (c: Cart) => Cart, request: () => Promise<unknown>) {
    if (!userId) {
      setGuestCart(change(getGuestCart()))
      return
    }
    const key = cartKey(userId)
    await qc.cancelQueries({ queryKey: key })
    const prev = qc.getQueryData<Cart>(key)
    qc.setQueryData<Cart>(key, (old) => change(old ?? { items: [] }))
    try {
      await request()
    } catch (e) {
      qc.setQueryData(key, prev)
      throw e
    } finally {
      void qc.invalidateQueries({ queryKey: key })
    }
  }

  /** O limite vem do estoque atual do NFT, para visitante e para usuário. */
  async function limitFor(nftId: string) {
    const nft = await qc.fetchQuery({ queryKey: nftKeys.detail(nftId), queryFn: ({ signal }) => fetchNft(nftId, signal), staleTime: 0 })
    return nft.editionsAvailable
  }

  return {
    cart,
    count,
    isLoading: Boolean(userId) && server.isPending,
    isError: server.isError,
    refetch: server.refetch,

    async add(nftId: string, quantity = 1) {
      const current = cart.items.find((i) => i.nftId === nftId)?.quantity ?? 0
      const max = await limitFor(nftId)
      if (current + quantity > max) throw new CartError(max === 0 ? 'Este NFT está esgotado.' : `Só há ${max} edição(ões) disponível(is).`)
      await optimistic(
        (c) => ({ ...c, items: c.items.some((i) => i.nftId === nftId) ? c.items.map((i) => (i.nftId === nftId ? { ...i, quantity: i.quantity + quantity } : i)) : [...c.items, { nftId, quantity }] }),
        () => http.post('/cart/items', { nftId, quantity }),
      )
    },

    async setQuantity(nftId: string, quantity: number) {
      if (quantity < 1) return
      const max = await limitFor(nftId)
      if (quantity > max) throw new CartError(`Só há ${max} edição(ões) disponível(is).`)
      await optimistic(
        (c) => ({ ...c, items: c.items.map((i) => (i.nftId === nftId ? { ...i, quantity } : i)) }),
        () => http.patch(`/cart/items/${nftId}`, { quantity }),
      )
    },

    async remove(nftId: string) {
      await optimistic(
        (c) => ({ ...c, items: c.items.filter((i) => i.nftId !== nftId) }),
        () => http.delete(`/cart/items/${nftId}`),
      )
    },

    /** Valida pela cotação (a API é a referência) e só então guarda o cupom. */
    async applyCoupon(code: string) {
      const trimmed = code.trim()
      if (!trimmed) throw new CartError('Informe o código do cupom.')
      const probe = await fetchQuote(cart.items, trimmed)
      if (probe.couponStatus === 'invalid') throw new CartError('Este cupom não existe.')
      if (probe.couponStatus === 'expired') throw new CartError('Este cupom expirou.')
      await optimistic(
        (c) => ({ ...c, coupon: trimmed.toUpperCase() }),
        () => http.put('/cart/coupon', { code: trimmed }),
      )
    },

    async removeCoupon() {
      await optimistic(
        ({ coupon: _c, ...rest }) => rest,
        () => http.delete('/cart/coupon'),
      )
    },
  }
}

/** Cotação do carrinho: preço, desconto, taxa e disponibilidade vêm sempre da API. */
export function useQuote(cart: Cart) {
  return useQuery({
    queryKey: quoteKey(cart.items, cart.coupon),
    queryFn: ({ signal }) => fetchQuote(cart.items, cart.coupon, signal),
    enabled: cart.items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

/** Ao autenticar, os itens do visitante passam para a conta (respeitando o estoque). */
export async function mergeGuestCart() {
  const guest = getGuestCart()
  if (!guest.items.length && !guest.coupon) return
  await http.post('/cart/merge', { items: guest.items, coupon: guest.coupon })
  setGuestCart({ items: [] })
}
