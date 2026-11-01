import { expect, test } from '@playwright/test'
import { ANA, BRUNO, login } from './helpers'

test('3. cadastro, conflito de e-mail, login, logout e sessão após refresh', async ({ page }) => {
  // conflito de cadastro (e-mail da Ana)
  await page.goto('/cadastro')
  await page.locator('#username').fill('ana.copia')
  await page.locator('#email').fill(ANA.email)
  await page.locator('#password').fill('Kurio@1234')
  await page.locator('#confirmPassword').fill('Kurio@1234')
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page.getByText('Este e-mail já está em uso.')).toBeVisible()

  // cadastro novo
  await page.locator('#email').fill(`novo${Date.now()}@kurio.test`)
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

  // sessão sobrevive ao refresh
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()

  // logout
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible()
})

test('login com senha errada mostra erro e validação de formulário', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
  await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true')

  await page.locator('#email').fill(ANA.email)
  await page.locator('#password').fill('errada')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
})

test('rota privada leva ao login e volta ao fluxo anterior', async ({ page }) => {
  await page.goto('/perfil')
  await expect(page).toHaveURL(/\/login\?.*redirect/)
  await page.locator('#email').fill(ANA.email)
  await page.locator('#password').fill(ANA.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/perfil$/)
})

test('3b. sessão expirada: avisa, leva ao login e preserva o contexto', async ({ page }) => {
  await page.goto('/login?scenario=session_expired')
  await page.locator('#email').fill(ANA.email)
  await page.locator('#password').fill(ANA.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Sua sessão expirou')).toBeVisible()
  await expect(page).toHaveURL(/expired=true/)
  await expect(page).toHaveURL(/redirect=/)
})

test('3c. troca de usuário não vaza dados privados', async ({ page }) => {
  await login(page, ANA)
  await page.goto('/carteiras')
  await expect(page.locator('#primary-displayName')).toHaveValue('Ana Souza')
  await page.getByRole('button', { name: 'Sair' }).first().click()

  await login(page, BRUNO)
  await page.goto('/carteiras')
  await expect(page.locator('#primary-displayName')).toHaveValue('')
})
