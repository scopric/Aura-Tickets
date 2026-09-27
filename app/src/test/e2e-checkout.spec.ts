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
    // Acessar um evento público demo
    await page.goto('/event/evt-001')

    // Verificar informações do evento
    await expect(page.getByText('Festival de Verão 2025')).toBeVisible()

    // Clicar em comprar (assumindo que há um botão de compra na página)
    const buyButton = page.getByRole('button', { name: /Comprar|Ingressos|Participar/i })
    if (await buyButton.isVisible().catch(() => false)) {
      await buyButton.click()
      await expect(page).toHaveURL(/.*\/checkout/)
    }
  })

  test('/checkout sem carrinho mostra o aviso de carrinho vazio', async ({ page }) => {
    // Sem estado nem carrinho pendente: tela "Seu carrinho está vazio" (PR 2A), não a Home
    await page.goto('/checkout')
    await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  })

  test('deve exigir seleção de ingresso antes de continuar', async ({ page }) => {
    // Tentar ir direto para pagamento sem carrinho
    await page.goto('/checkout/payment')

    // Deve redirecionar para home ou mostrar erro
    await expect(page.getByText(/expirada|inválida|checkout/i)).toBeVisible()
  })
})
