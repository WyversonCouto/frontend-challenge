import { expect, test } from '@playwright/test'
import { buy, login } from './helpers'

test('5. carrinho: quantidades, cupom, remoção e persistência após refresh', async ({ page }) => {
  await buy(page, 'nft-001')
  await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()

  await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await expect(page.getByText('2.38 ETH').first()).toBeVisible()

  // cupom inválido, expirado e válido
  await page.locator('#cupom').fill('XYZ')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Este cupom não existe.').first()).toBeVisible()
  await page.locator('#cupom').fill('EXPIRADO')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Este cupom expirou.').first()).toBeVisible()
  await page.locator('#cupom').fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('aplicado')).toBeVisible()
  // 2 x 1.19 = 2.38; desconto 10% = 0.238; taxa 0.016; total 2.158
  await expect(page.getByText('(-) 0.238 ETH')).toBeVisible()
  await expect(page.getByText('2.158 ETH', { exact: true })).toBeVisible()

  // persiste após refresh
  await page.reload()
  await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()
  await expect(page.getByText('2.158 ETH', { exact: true })).toBeVisible()

  // remover
  await page.getByRole('button', { name: 'Remover Emerald Ape #042' }).click()
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
})

test('5b. itens do visitante são preservados ao autenticar', async ({ page }) => {
  await buy(page, 'nft-001')
  await login(page)
  await page.goto('/carrinho')
  await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()
  const guest = await page.evaluate(() => localStorage.getItem('kurio:cart:guest'))
  expect(guest).toBeNull()
  // e continua depois de um refresh (agora vem da API)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()
})
