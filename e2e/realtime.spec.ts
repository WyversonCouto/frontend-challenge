import { expect, test } from '@playwright/test'
import { buy, login, mock, ordersCount, receipt, reviewOrder, toCheckout } from './helpers'

test('9. preço alterado via Socket.IO com o item no carrinho: avisa e atualiza o resumo', async ({ page }) => {
  await buy(page, 'nft-001')
  // espera a cotação do carrinho carregar (1.19 + taxa 0.016). Só "1.19 ETH" não serve: o mesmo
  // texto aparece na faixa "Colecionadores também viram", que pode carregar antes do resumo.
  await expect(page.getByText('1.206 ETH', { exact: true })).toBeVisible()
  await mock(page, '/__mock/nfts/nft-001', { price: '3.50' })
  await expect(page.getByText(/o preço mudou de 1\.19 ETH para 3\.50 ETH/)).toBeVisible()
  // 3.50 + taxa 0.016 = 3.516
  await expect(page.getByText('3.516 ETH', { exact: true })).toBeVisible()
})

test('9b. mudança de preço em tempo real durante o checkout atualiza o resumo e o pedido sai pelo valor novo', async ({ page }) => {
  await toCheckout(page)
  await mock(page, '/__mock/nfts/nft-001', { price: '2.00' })
  await expect(page.getByText(/agora custa 2\.00 ETH/)).toBeVisible()
  // 2.00 + taxa 0.016
  await expect(page.getByText('2.016 ETH', { exact: true }).first()).toBeVisible()
  await reviewOrder(page)
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(receipt(page)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('2.016 ETH').first()).toBeVisible()
  expect(await ordersCount(page)).toBe(1)
})

test('10. eventos duplicados ou antigos não regridem o estado', async ({ page }) => {
  await page.goto('/nft/nft-002')
  await expect(page.getByText('1.64 ETH').first()).toBeVisible()

  // versão antiga (1 <= versão atual) é ignorada
  await mock(page, '/__mock/socket/emit', { event: 'nft.updated', payload: { eventId: 'old-1', resource: 'nft', id: 'nft-002', version: 1, price: '0.01', editionsAvailable: 5 } })
  await page.waitForTimeout(600)
  await expect(page.getByText('0.01 ETH')).toHaveCount(0)

  // versão nova é aplicada
  await mock(page, '/__mock/socket/emit', { event: 'nft.updated', payload: { eventId: 'new-1', resource: 'nft', id: 'nft-002', version: 5, price: '2.22', editionsAvailable: 5 } })
  await expect(page.getByText('2.22 ETH').first()).toBeVisible()

  // o mesmo eventId reenviado (duplicata) não reaplica, mesmo com payload diferente
  await mock(page, '/__mock/socket/emit', { event: 'nft.updated', payload: { eventId: 'new-1', resource: 'nft', id: 'nft-002', version: 6, price: '9.99', editionsAvailable: 5 } })
  await page.waitForTimeout(600)
  await expect(page.getByText('9.99 ETH')).toHaveCount(0)
  await expect(page.getByText('2.22 ETH').first()).toBeVisible()
})

test('10b. desconexão com pedido pendente: o estado é recuperado sem criar outra compra', async ({ page }) => {
  await toCheckout(page)
  await reviewOrder(page)
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page.getByText('Processando sua transação')).toBeVisible()

  await mock(page, '/__mock/socket/disconnect')
  await page.reload()
  await expect(receipt(page)).toBeVisible({ timeout: 20_000 })
  expect(await ordersCount(page)).toBe(1)
})

test('o pedido de um usuário não atualiza a tela de outro', async ({ page }) => {
  await login(page)
  // evento de pedido de outro usuário, entregue à força: o cliente confere o userId e ignora
  await mock(page, '/__mock/socket/emit', { event: 'order.updated', payload: { eventId: 'x-9', resource: 'order', id: 'ord-00001', version: 9, status: 'confirmed', userId: 'user-bruno' } })
  await page.waitForTimeout(500)
  await expect(page.getByText('Seu pedido foi confirmado.')).toHaveCount(0)
})
