import { test, expect } from '@playwright/test'

test.describe('Autenticação', () => {
  test('deve fazer login como produtor e acessar dashboard', async ({ page }) => {
    await page.goto('/auth/login')

    // Selecionar perfil Produtor
    await page.getByRole('button', { name: 'Produtor' }).click()

    // Preencher credenciais demo
    await page.getByPlaceholder('seu@email.com').fill('produtor@aura.teste')
    await page.getByPlaceholder('Sua senha').fill('senha123')

    // Clicar em entrar
    await page.getByRole('button', { name: /Entrar como Produtor/ }).click()

    // Verificar redirecionamento para dashboard
    await expect(page).toHaveURL(/.*\/producer\/dashboard/)
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible()
  })

  test('deve fazer login como participante e acessar hub', async ({ page }) => {
    await page.goto('/auth/login')

    // Selecionar perfil Participante
    await page.getByRole('button', { name: 'Participante' }).click()

    // Preencher credenciais demo
    await page.getByPlaceholder('seu@email.com').fill('user@aura.teste')
    await page.getByPlaceholder('Sua senha').fill('senha123')

    // Clicar em entrar
    await page.getByRole('button', { name: /Entrar como Participante/ }).click()

    // Verificar redirecionamento para hub
    await expect(page).toHaveURL(/.*\/app\/hub/)
  })

  test('deve exibir erro com credenciais inválidas', async ({ page }) => {
    await page.goto('/auth/login')

    await page.getByPlaceholder('seu@email.com').fill('invalido@email.com')
    await page.getByPlaceholder('Sua senha').fill('senhaerrada')
    await page.getByRole('button', { name: /Entrar/ }).click()

    // Verificar mensagem de erro
    await expect(page.getByText('E-mail ou senha incorretos')).toBeVisible()
  })

  test('deve acessar página de recuperação de senha', async ({ page }) => {
    await page.goto('/auth/login')

    await page.getByRole('link', { name: 'Esqueci a senha' }).click()

    await expect(page).toHaveURL(/.*\/auth\/forgot/)
    await expect(page.getByText('Recuperar senha')).toBeVisible()
  })

  test('deve enviar link de recuperação de senha', async ({ page }) => {
    await page.goto('/auth/forgot')

    await page.getByPlaceholder('seu@email.com').fill('teste@exemplo.com')
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click()

    // Verificar estado de sucesso
    await expect(page.getByText('E-mail enviado!')).toBeVisible()
  })
})
