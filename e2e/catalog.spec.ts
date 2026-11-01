import { expect, test } from '@playwright/test'
import { setScenario } from './helpers'

const cards = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Catálogo de NFTs' }).getByRole('link', { name: /Arte do NFT/ })

test('1. busca, filtros combinados, ordenação e paginação ficam na URL e sobrevivem a refresh e histórico', async ({ page }) => {
  await page.goto('/')
  await expect(cards(page)).toHaveCount(9)

  // paginação + refresh
  await page.getByRole('button', { name: 'Página 2' }).click()
  await expect(page).toHaveURL(/page=2/)
  await page.reload()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

  // mudar filtro reinicia a paginação; voltar restaura a página 2
  await page.getByRole('button', { name: /^Polygon/ }).click()
  await expect(page).toHaveURL(/network=Polygon/)
  await expect(page).not.toHaveURL(/page=/)
  await page.goBack()
  await expect(page).toHaveURL(/page=2/)

  // filtros combináveis
  await page.getByRole('button', { name: /^Arte digital/ }).click()
  await expect(page).toHaveURL(/category=Arte(\+|%20)digital/)
  await page.getByRole('button', { name: /^Ethereum/ }).click()
  await expect(page).toHaveURL(/network=Ethereum/)
  await expect(page).toHaveURL(/category=/)
})

test('1b. ordenação por preço reflete na URL e na lista', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ordenar por:').selectOption('price_asc')
  await expect(page).toHaveURL(/sort=price_asc/)
  const region = page.getByRole('region', { name: 'Catálogo de NFTs' })
  await expect(cards(page)).toHaveCount(9)
  const prices = (await region.getByText(/^\d+\.\d+ ETH$/).allTextContents()).map((t) => parseFloat(t))
  expect(prices.length).toBeGreaterThan(1)
  expect(prices).toEqual([...prices].sort((a, b) => a - b))
})

test('1c. busca pela URL e resultado vazio', async ({ page }) => {
  await page.goto('/?q=Emerald')
  await expect(cards(page).first()).toBeVisible()
  await expect(page.getByText(/Resultados para/)).toBeVisible()
  await page.goto('/?q=nada-que-exista-aqui')
  await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
  await page.getByRole('button', { name: 'Limpar filtros' }).first().click()
  await expect(cards(page)).toHaveCount(9)
})

test('12. skeletons durante carregamento lento, falha com feedback e recuperação por nova tentativa', async ({ page }) => {
  await page.goto('/?scenario=slow')
  await expect(page.getByLabel('Carregando NFTs')).toBeVisible()
  await expect(page.locator('.skeleton').first()).toBeVisible()
  await expect(cards(page)).toHaveCount(9, { timeout: 15_000 })

  await setScenario(page, 'server_error')
  await page.goto('/?q=Ape')
  await expect(page.getByRole('alert').filter({ hasText: 'O servidor não respondeu' })).toBeVisible({ timeout: 15_000 })

  await setScenario(page, 'default')
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(cards(page).first()).toBeVisible()
})

test('respostas fora de ordem: a tela mostra a consulta mais recente', async ({ page }) => {
  await page.goto('/?scenario=out_of_order')
  await expect(cards(page).first()).toBeVisible({ timeout: 15_000 })
  // 1ª busca (lenta) é de "Arte digital"; a 2ª (rápida) é de "Música". A tela deve terminar em "Música".
  await page.getByRole('button', { name: /^Arte digital/ }).click()
  await page.getByRole('button', { name: /^Música/ }).click()
  await page.waitForTimeout(2500)
  await expect(page).toHaveURL(/category=M/)
  const categoryOfResults = await page.getByRole('button', { name: /^Música/ }).getAttribute('aria-pressed')
  expect(categoryOfResults).toBe('true')
  await expect(cards(page).first()).toBeVisible()
})
