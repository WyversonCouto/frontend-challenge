import { expect, test } from '@playwright/test'
import { BRUNO, login, logout } from './helpers'

test('4. favoritos persistem para o usuário autenticado', async ({ page }) => {
  await login(page)
  await page.goto('/nft/nft-003')
  const fav = page.getByRole('button', { name: /^Favorit/ })
  await fav.click()
  await expect(fav).toHaveAttribute('aria-pressed', 'true')
  // espera a API confirmar antes de recarregar (senão o refresh aborta a requisição)
  await expect(page.getByText('Adicionado aos favoritos.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: /^Favorit/ })).toHaveAttribute('aria-pressed', 'true')
})

test('4b. falha na mutation restaura o estado anterior', async ({ page }) => {
  await login(page)
  await page.goto('/nft/nft-003?scenario=favorites_fail')
  const fav = page.getByRole('button', { name: /^Favorit/ })
  await expect(fav).toHaveAttribute('aria-pressed', 'false')
  await fav.click()
  await expect(page.getByText(/Não foi possível atualizar os favoritos/)).toBeVisible()
  await expect(fav).toHaveAttribute('aria-pressed', 'false')

  // recuperação: sem a falha, a mesma ação funciona
  await page.evaluate(() => fetch('/__mock/scenario', { method: 'POST', body: JSON.stringify({ name: 'default' }) }))
  await fav.click()
  await expect(fav).toHaveAttribute('aria-pressed', 'true')
})

test('favoritos de um usuário não aparecem para outro', async ({ page }) => {
  await login(page)
  await page.goto('/nft/nft-003')
  await page.getByRole('button', { name: /^Favorit/ }).click()
  await expect(page.getByText('Adicionado aos favoritos.')).toBeVisible()
  await logout(page)
  await login(page, BRUNO)
  await page.goto('/nft/nft-003')
  await expect(page.getByRole('button', { name: /^Favorit/ })).toHaveAttribute('aria-pressed', 'false')
})

test('visitante é levado ao login ao favoritar', async ({ page }) => {
  await page.goto('/nft/nft-003')
  await page.getByRole('button', { name: /^Favorit/ }).click()
  await expect(page).toHaveURL(/\/login/)
})
