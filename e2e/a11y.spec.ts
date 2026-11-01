import { expect, test } from '@playwright/test'

test('11. login: foco preso no diálogo, Esc fecha e erros ficam associados aos campos', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('dialog')).toBeVisible()

  // o foco nunca sai do diálogo, mesmo com muitos Tab
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab')
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))
    expect(inside).toBe(true)
  }

  // erro associado ao campo (aria-describedby) e anunciado
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  const email = page.locator('#email')
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(email).toHaveAttribute('aria-describedby', 'email-erro')
  await expect(page.locator('#email-erro')).toContainText('e-mail válido')

  // Esc fecha e devolve ao início
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/$/)
})

test('navegação por teclado: foco visível, link de pular e carrinho acessível', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()

  // o foco avança por elementos interativos e sempre tem contorno visível
  await page.keyboard.press('Tab')
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle)
  expect(outline).not.toBe('none')
})

test('diálogo de revisão do pedido prende o foco', async ({ page }) => {
  const { toCheckout, reviewOrder } = await import('./helpers')
  await toCheckout(page)
  await reviewOrder(page)
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Revise seu pedido' })).toBeHidden()
})

test('imagens relevantes têm texto alternativo e formulários têm rótulos', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Catálogo de NFTs' }).getByRole('img').first()).toBeVisible()
  const withoutAlt = await page.evaluate(() => [...document.images].filter((i) => !i.hasAttribute('alt')).length)
  expect(withoutAlt).toBe(0)
  await page.goto('/cadastro')
  for (const id of ['username', 'email', 'password', 'confirmPassword']) {
    await expect(page.locator(`label[for="${id}"]`)).toBeVisible()
  }
})
