import type { Eth } from './eth'

export type NetworkName = 'Ethereum' | 'Polygon' | 'Solana'

export interface User {
  id: string
  name: string
  username: string
  email: string
  avatarUrl: string | null
}

export interface SessionResponse {
  user: User
  token: string
  expiresAt: number
}

export type ApiErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'session_expired'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'email_taken'
  | 'coupon_invalid'
  | 'coupon_expired'
  | 'price_changed'
  | 'sold_out'
  | 'idempotency_conflict'
  | 'transient'
  | 'payment_declined'
  | 'wallet_refused'

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  fields?: Record<string, string>
  /** Presente em price_changed/sold_out: a cotação atualizada. */
  quote?: Quote
}

export interface Nft {
  id: string
  name: string
  collection: string
  category: string
  network: NetworkName
  price: Eth
  editionsTotal: number
  editionsAvailable: number
  imageUrl: string
  gallery: string[]
  rating: number
  reviews: number
  description: string
  tokenId: string
  attributes: string[]
  createdAt: string
  /** Incrementa a cada alteração de preço/estoque. Usado para ordenar eventos. */
  version: number
}

export type NftSort = 'recent' | 'price_asc' | 'price_desc' | 'name'

export interface NftListParams {
  q?: string
  category?: string
  network?: NetworkName
  minPrice?: Eth
  maxPrice?: Eth
  sort?: NftSort
  tab?: 'new' | 'trending'
  page?: number
  pageSize?: number
}

export interface NftPage {
  items: Nft[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  facets: { categories: Record<string, number>; networks: Record<string, number> }
}

export interface CartItem {
  nftId: string
  quantity: number
}

export interface Cart {
  items: CartItem[]
  coupon?: string
}

export interface QuoteLine {
  nftId: string
  name: string
  imageUrl: string
  editionLabel: string
  tokenId: string
  quantity: number
  unitPrice: Eth
  lineTotal: Eth
  available: number
  ok: boolean
  nftVersion: number
}

export interface Quote {
  quoteId: string
  lines: QuoteLine[]
  subtotal: Eth
  discount: Eth
  networkFee: Eth
  total: Eth
  coupon?: string
  couponStatus: 'none' | 'applied' | 'invalid' | 'expired'
  /** Muda quando preço, estoque, cupom ou taxa mudam. */
  fingerprint: string
}

export interface Wallet {
  id: string
  kind: 'primary' | 'secondary'
  displayName: string
  nickname: string
  network: NetworkName
  address: string
  type: 'MetaMask' | 'WalletConnect' | 'Coinbase Wallet'
  profileName: string
  referralCode: string
  email: string
  /** Nome ENS completo, ex.: nova.kurio.eth */
  ens: string
  /** ENS ou carteira secundária (opcional no Figma). */
  linkedRef?: string
}

export type WalletInput = Omit<Wallet, 'id'>

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface OrderLine {
  nftId: string
  name: string
  imageUrl: string
  editionLabel: string
  tokenId: string
  quantity: number
  unitPrice: Eth
  lineTotal: Eth
}

export interface Order {
  id: string
  status: OrderStatus
  /** Incrementa a cada mudança de estado. */
  version: number
  createdAt: string
  txHash: string
  network: NetworkName
  walletId: string
  walletAddress: string
  walletType: string
  /** Snapshot imutável do que foi comprado. */
  lines: OrderLine[]
  subtotal: Eth
  discount: Eth
  networkFee: Eth
  total: Eth
  coupon?: string
  declineReason?: string
}

export interface CreateOrderInput {
  items: CartItem[]
  coupon?: string
  walletId: string
  network: NetworkName
  buyer: { displayName: string; email: string; note?: string }
  /** Total e fingerprint que o usuário viu e aceitou. */
  expectedTotal: Eth
  expectedFingerprint: string
}

export interface UpdateProfileInput {
  name: string
  username: string
  email: string
  avatarDataUrl?: string | null
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

/* ---------- Eventos Socket.IO ---------- */

export interface NftUpdatedEvent {
  eventId: string
  resource: 'nft'
  id: string
  version: number
  price: Eth
  editionsAvailable: number
}

export interface OrderUpdatedEvent {
  eventId: string
  resource: 'order'
  id: string
  version: number
  status: OrderStatus
  /** O servidor só entrega ao dono; o cliente confere de novo. */
  userId: string
}

export type SocketEvent = NftUpdatedEvent | OrderUpdatedEvent
