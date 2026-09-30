import { test, expect } from '@playwright/test'

// Regra de senha do Supabase avisada no passo 1 do cadastro (não só na recusa do servidor). Nada é enviado ao servidor.
test('cadastro: passo 1 barra senha fraca e senhas diferentes, e avança com senha válida', async ({ page }) => {
  await page.goto('/auth/register')
  await page.getByRole('button', { name: /Rejeitar opcionais/ }).click().catch(() => {})
  await expect(page.locator('#password-hint')).toContainText('8 caracteres')
  const textos = page.locator('input[type="text"]')
  await textos.nth(0).fill('Teste')
  await textos.nth(1).fill('Evokaa')
  await page.locator('input[type="email"]').fill('teste-e2e@example.com')
  const senhas = page.locator('input[type="password"]')
  await expect(senhas).toHaveCount(2)

  await senhas.nth(0).fill('Evokaa2026ç') // acento não vale como símbolo para o Supabase
  await senhas.nth(1).fill('Evokaa2026ç')
  await senhas.nth(1).press('Enter') // envia o formulário; no celular os toasts cobrem o botão
  await expect(page.getByText(/Passo 1 de 2/i)).toBeVisible()
  await expect(page.locator('#password-hint')).toContainText('símbolo')

  await senhas.nth(0).fill('Evokaa2026!')
  await senhas.nth(1).fill('Evokaa2026?')
  await senhas.nth(1).press('Enter') // envia o formulário; no celular os toasts cobrem o botão
  await expect(page.getByText('As senhas não conferem')).toBeVisible()

  await senhas.nth(1).fill('Evokaa2026!')
  await senhas.nth(1).press('Enter') // envia o formulário; no celular os toasts cobrem o botão
  await expect(page.getByText(/Passo 2 de 2/i)).toBeVisible()
})
