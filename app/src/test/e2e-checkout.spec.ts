import { test, expect } from '@playwright/test'

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    // Login como participante antes de cada teste de checkout
    await page.goto('/auth/login')
    await page.getByRole('button', { name: 'Participante', exact: true }).click() // sem exact casa também "Entrar como Participante"
    await page.getByPlaceholder('seu@email.com').fill('user@aura.teste')
    await page.getByPlaceholder('Sua senha').fill('senha123')
    await page.getByRole('button', { name: /Entrar como Participante/ }).click()
    await expect(page).toHaveURL(/.*\/app\/hub/)
  })

  test('deve navegar do evento para o checkout', async ({ page }) => {
    // evento de demonstração (só em desenvolvimento)
    await page.goto('/event/evt-001')
    await expect(page.getByRole('heading', { level: 1, name: /Festival de Verão/ })).toBeVisible()

    await page.getByRole('button', { name: 'Adicionar ao Carrinho' }).first().click()
    await page.getByRole('button', { name: 'Finalizar' }).click()
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toHaveCount(0)
  })

  test('/checkout sem carrinho mostra o aviso de carrinho vazio', async ({ page }) => {
    // Sem estado nem carrinho pendente: tela "Seu carrinho está vazio" (PR 2A), não a Home
    await page.goto('/checkout')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('/checkout/payment sem pedido volta para a Home com aviso', async ({ page }) => {
    await page.goto('/checkout/payment')
    await expect(page.getByText('Sessão de pagamento expirada ou inválida.').first()).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })
})
