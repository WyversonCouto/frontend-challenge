import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { queryClient } from '@/lib/query'
import { restoreSession } from '@/features/auth/actions'
import { router } from '@/router'

/**
 * A camada de mocks é ativada por configuração (VITE_ENABLE_MOCKS, padrão: ligada)
 * e também existe no build de demonstração/produção publicado.
 */
async function enableMocks() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'false') return
  const [{ worker }, { prepareMocks }] = await Promise.all([import('@/mocks/browser'), import('@/mocks/handlers')])
  await prepareMocks()
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}

enableMocks()
  .then(() => restoreSession())
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>,
    )
  })
