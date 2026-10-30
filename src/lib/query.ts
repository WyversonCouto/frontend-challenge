import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

/**
 * Política de cache e retries (documentada no ARCHITECTURE.md):
 *  - staleTime 30s: navegar entre telas não refaz a busca à toa;
 *  - retry só para falhas transitórias de leitura (rede, 5xx), até 2 vezes, com backoff;
 *  - mutations não repetem sozinhas: pedidos usam chave de idempotência e retry manual;
 *  - refetchOnReconnect: ao voltar a conexão, o que está na tela é reconciliado com a API.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (count, error) => error instanceof ApiError && error.retryable && count < 2,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
    },
    mutations: { retry: false },
  },
})
