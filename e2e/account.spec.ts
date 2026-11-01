import { expect, test } from '@playwright/test'
import { BRUNO, login } from './helpers'

test('8. perfil: validação, edição, avatar e senha, com persistência após refresh', async ({ page }) => {
  await login(page)
  await page.goto('/perfil')

  // validação
  await page.locator('#name').fill('')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Informe seu nome.')).toBeVisible()

  // edição persiste
  await page.locator('#name').fill('Ana Paula Souza')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Alterações salvas.')).toBeVisible()
  await page.reload()
  await expect(page.locator('#name')).toHaveValue('Ana Paula Souza')

  // avatar (imagem enviada pelo usuário)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  await page.getByLabel('Escolher imagem de avatar').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()

  // senha: atual incorreta e confirmação divergente
  await page.locator('#currentPassword').fill('errada123')
  await page.locator('#newPassword').fill('Nova@12345')
  await page.locator('#confirmPassword').fill('Diferente@1')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('As senhas não coincidem.')).toBeVisible()
  await page.locator('#confirmPassword').fill('Nova@12345')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Senha atual incorreta.')).toBeVisible()

  // senha correta
  await page.locator('#currentPassword').fill('Kurio@123')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Alterações salvas.')).toBeVisible()
})

test('8b. carteiras: validação, cadastro das carteiras principal e secundária e persistência', async ({ page }) => {
  await login(page, BRUNO)
  await page.goto('/carteiras')
  await expect(page.getByText('Você ainda não adicionou uma carteira secundária.')).toBeVisible()

  // erros de validação
  await page.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(page.getByText('Endereço inválido (0x + 40 caracteres).')).toBeVisible()

  // cadastro da principal
  await page.locator('#primary-displayName').fill('Bruno Lima')
  await page.locator('#primary-nickname').fill('Principal')
  await page.locator('#primary-network').selectOption('Ethereum')
  await page.locator('#primary-profileName').fill('bruno.lima')
  await page.locator('#primary-address').fill('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')
  await page.locator('#primary-type').selectOption('MetaMask')
  await page.locator('#primary-referralCode').fill('KURIO-BRUNO')
  await page.locator('#primary-email').fill('bruno@kurio.test')
  await page.locator('#primary-ensLabel').fill('bruno')
  await page.getByRole('button', { name: 'Salvar carteira' }).click()
  await expect(page.getByText('Carteira salva.')).toBeVisible()
  await page.reload()
  await expect(page.locator('#primary-address')).toHaveValue('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')

  // endereço repetido na secundária gera conflito retornado pela API
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await page.locator('#secondary-displayName').fill('Bruno Lima')
  await page.locator('#secondary-nickname').fill('Reserva')
  await page.locator('#secondary-network').selectOption('Polygon')
  await page.locator('#secondary-profileName').fill('bruno.reserva')
  await page.locator('#secondary-address').fill('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')
  await page.locator('#secondary-type').selectOption('WalletConnect')
  await page.locator('#secondary-referralCode').fill('KURIO-BRUNO')
  await page.locator('#secondary-email').fill('bruno@kurio.test')
  await page.locator('#secondary-ensLabel').fill('bruno-reserva')
  await page.getByRole('button', { name: 'Salvar carteira' }).last().click()
  await expect(page.getByText('Endereço já cadastrado.')).toBeVisible()
})
