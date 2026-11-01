import { expect, test } from '@playwright/test'
import { login, ordersCount, receipt, reviewOrder, toCheckout } from './helpers'

const send = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Enviar pedido' })

test('6. compra completa: catálogo → detalhe → carrinho → pagamento → recibo confirmado', async ({ page }) => {
  await login(page)
  await page.goto('/')
  await page.getByRole('region', { name: 'Catálogo de NFTs' }).getByRole('link', { name: /Arte do NFT/ }).first().click()
  await expect(page).toHaveURL(/\/nft\//)
  await page.getByRole('button', { name: /^Comprar/ }).first().click()
  await expect(page).toHaveURL(/\/carrinho/)
  await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/pagamento/)
  await reviewOrder(page)
  await send(page).click()

  // enquanto o pedido está pendente, a confirmação NÃO aparece
  await expect(page).toHaveURL(/\/pedido\//)
  await expect(page.getByText('Processando sua transação')).toBeVisible()
  await expect(receipt(page)).toBeHidden()
  await expect(receipt(page)).toBeVisible({ timeout: 15_000 })

  // só o que foi comprado sai do carrinho
  await page.goto('/carrinho')
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
})

test('7a. carteira que recusa a conexão impede a compra', async ({ page }) => {
  await toCheckout(page)
  await page.getByRole('radio', { name: /Reserva/ }).check()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('A carteira recusou a conexão.').first()).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByText('Conecte a carteira para continuar.')).toBeVisible()
})

test('7b. pagamento recusado: sem recibo e itens preservados', async ({ page }) => {
  await page.goto('/?scenario=payment_declined')
  await toCheckout(page)
  await reviewOrder(page)
  await send(page).click()
  await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 15_000 })
  await expect(receipt(page)).toBeHidden()
  await page.goto('/carrinho')
  await expect(page.getByRole('link', { name: 'Emerald Ape #042' })).toBeVisible()
})

test('7c. clique repetido não cria pedido duplicado', async ({ page }) => {
  await toCheckout(page)
  await reviewOrder(page)
  await send(page).dblclick()
  await expect(receipt(page)).toBeVisible({ timeout: 15_000 })
  expect(await ordersCount(page)).toBe(1)
})

test('7d. timeout após criar o pedido: recuperação pela mesma chave de idempotência', async ({ page }) => {
  await page.goto('/?scenario=order_timeout')
  await toCheckout(page)
  await reviewOrder(page)
  await send(page).click()
  await expect(page.getByText(/Não recebemos a resposta do servidor/)).toBeVisible()
  await page.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(receipt(page)).toBeVisible({ timeout: 15_000 })
  expect(await ordersCount(page)).toBe(1)
})

test('revalidação: preço alterado durante a compra exige nova confirmação', async ({ page }) => {
  await page.goto('/?scenario=price_changed_at_checkout')
  await toCheckout(page)
  await reviewOrder(page)
  await send(page).click()
  await expect(page.getByText(/Os valores mudaram/).first()).toBeVisible()
  await expect(receipt(page)).toBeHidden()
  await expect(page).toHaveURL(/\/pagamento/)
  expect(await ordersCount(page)).toBe(0)

  // com os valores novos o usuário confirma outra vez: 1.29 + taxa 0.016
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await send(page).click()
  await expect(receipt(page)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('1.306 ETH').first()).toBeVisible()
})

test('edição esgotada durante a compra bloqueia o pedido', async ({ page }) => {
  await page.goto('/?scenario=sold_out_at_checkout')
  await toCheckout(page)
  await reviewOrder(page)
  await send(page).click()
  await expect(page.getByText(/edição acabou|indisponível/i).first()).toBeVisible()
  await expect(receipt(page)).toBeHidden()
  expect(await ordersCount(page)).toBe(0)
})

test('compra sem carrinho mostra estado vazio', async ({ page }) => {
  await login(page)
  await page.goto('/pagamento')
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
})
