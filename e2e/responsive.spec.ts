import { expect, test } from '@playwright/test'
import { buy } from './helpers'

/** Sem overflow horizontal em 390, 768 e 1440 px (os três projetos do Playwright). */
const routes = ['/', '/nft/nft-001', '/login', '/cadastro']

for (const route of routes) {
  test(`sem rolagem horizontal em ${route}`, async ({ page }) => {
    await page.goto(route)
    await expect(page.getByRole('main')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test('sem rolagem horizontal no carrinho', async ({ page }) => {
  await buy(page, 'nft-001')
  await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
