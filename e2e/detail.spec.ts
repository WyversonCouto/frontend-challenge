import { expect, test } from '@playwright/test'

test('2. acesso direto ao detalhe e tratamento de NFT inexistente', async ({ page }) => {
  await page.goto('/nft/nft-001')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await expect(page.getByText('ID do token:')).toBeVisible()

  await page.goto('/nft/nao-existe')
  await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver catálogo' })).toBeVisible()
})

test('limite de quantidade respeita a disponibilidade da edição', async ({ page }) => {
  // nft-006 tem 2 edições disponíveis nas fixtures.
  await page.goto('/nft/nft-006')
  const plus = page.getByRole('button', { name: 'Aumentar quantidade' })
  await plus.click()
  await expect(plus).toBeDisabled()
})

test('edição esgotada desabilita a compra', async ({ page }) => {
  // nft-021 está esgotado nas fixtures.
  await page.goto('/nft/nft-021')
  await expect(page.getByText('ESGOTADA')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Comprar/ }).first()).toBeDisabled()
})
