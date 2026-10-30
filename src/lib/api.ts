import axios, { AxiosError } from 'axios'
import type { ApiErrorBody } from './types'

/** Erro normalizado: a UI nunca lida com AxiosError diretamente. */
export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody | null
  /** true quando não houve resposta (queda de conexão, timeout). */
  readonly network: boolean

  constructor(message: string, status: number, body: ApiErrorBody | null, network = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.network = network
  }

  get code() {
    return this.body?.code
  }
  get fields() {
    return this.body?.fields ?? {}
  }
  /** Vale tentar de novo sem risco de efeito colateral duplicado. */
  get retryable() {
    return this.network || this.status >= 500 || this.status === 429
  }
}

type TokenAccessor = { get: () => string | null; onExpired: () => void }
let tokens: TokenAccessor = { get: () => null, onExpired: () => {} }

/** A camada de auth registra aqui como ler o token e o que fazer ao expirar. */
export function configureAuth(accessor: TokenAccessor) {
  tokens = accessor
}

export const http = axios.create({
  baseURL: '/api',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = tokens.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiErrorBody>) => {
    if (axios.isCancel(error)) throw error
    if (!error.response) {
      const timeout = error.code === 'ECONNABORTED'
      throw new ApiError(
        timeout ? 'A requisição demorou demais.' : 'Sem conexão com o servidor.',
        0,
        null,
        true,
      )
    }
    const body = error.response.data ?? null
    const apiError = new ApiError(body?.message ?? 'Algo deu errado.', error.response.status, body)
    if (body?.code === 'session_expired') tokens.onExpired()
    throw apiError
  },
)
