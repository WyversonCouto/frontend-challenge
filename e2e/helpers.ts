import { expect, type Page } from '@playwright/test'

export const ANA = { email: 'ana@kurio.test', password: 'Kurio@123' }
export const BRUNO = { email: 'bruno@kurio.test', password: 'Kurio@123' }

export async function login(page: Page, user = ANA) {
  await page.goto('/login')
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
}

/** Chama o controle do ambiente simulado a partir da própria página (o MSW intercepta no navegador). */
export async function mock(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ([p, b]) => {
      const res = await fetch(p as string, { method: 'POST', body: b ? JSON.stringify(b) : undefined })
      return res.json()
    },
    [path, body] as const,
  )
}

export const setScenario = (page: Page, name: string) => mock(page, '/__mock/scenario', { name })

export async function ordersCount(page: Page) {
  return page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('kurio:session') ?? '{}') as { token?: string }
    const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${session.token}` } })
    return ((await res.json()) as { orders: unknown[] }).orders.length
  })
}

/** Visitante: abre o NFT e clica em comprar (no desktop é "Comprar", no mobile "Comprar NFT"). */
export async function buy(page: Page, nftId = 'nft-001') {
  await page.goto(`/nft/${nftId}`)
  await page.getByRole('button', { name: /^Comprar/ }).first().click()
  await expect(page).toHaveURL(/\/carrinho/)
}

/** Usuário logado, com um item no carrinho, na tela de pagamento. */
export async function toCheckout(page: Page, nftId = 'nft-001') {
  await login(page)
  await buy(page, nftId)
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/pagamento/)
}

/** Conecta a carteira e abre a revisão final. */
export async function reviewOrder(page: Page) {
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Conectada', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('dialog', { name: 'Revise seu pedido' })).toBeVisible()
}

export const receipt = (page: Page) => page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })

/** Espera fontes e imagens para que as capturas visuais sejam estáveis. */
export async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = () => r(null) }))))
  })
}
