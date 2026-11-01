import { expect, test } from '@playwright/test'
import { buy, login, settle } from './helpers'

/**
 * Regressão visual de início, detalhe, carrinho e pagamento.
 * As baselines são versionadas em e2e/visual.spec.ts-snapshots/. Para criá-las ou atualizá-las:
 *   npm run test:e2e:update
 * Os dados são estáveis: fixtures determinísticas, artes SVG e fonte local.
 */
const shot = { fullPage: true, animations: 'disabled' as const, maxDiffPixelRatio: 0.02 }

test('visual: início', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Catálogo de NFTs' }).getByRole('link').first()).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('inicio.png', shot)
})

test('visual: detalhe do NFT', async ({ page }) => {
  await page.goto('/nft/nft-001')
  await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('detalhe.png', shot)
})

test('visual: carrinho', async ({ page }) => {
  await buy(page, 'nft-001')
  await expect(page.getByText('1.19 ETH').first()).toBeVisible()
  await settle(page)
  await expect(page).toHaveScreenshot('carrinho.png', shot)
})

test('visual: pagamento', async ({ page }) => {
  await login(page)
  await buy(page, 'nft-001')
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' }).first()).toBeVisible()
  await expect(page.locator('#address')).not.toHaveValue('')
  await settle(page)
  await expect(page).toHaveScreenshot('pagamento.png', shot)
})
