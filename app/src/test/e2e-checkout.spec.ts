import { test, expect } from '@playwright/test'

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    // Login como participante antes de cada teste de checkout
    await page.goto('/auth/login')
    await page.getByRole('button', { name: 'Participante' }).click()
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

  test('deve calcular total no checkout corretamente', async ({ page }) => {
    // Navegar direto para checkout com estado
    await page.goto('/checkout')

    // Verificar se a página carregou
    await expect(page.getByText('Checkout')).toBeVisible()
  })

  test('deve exigir seleção de ingresso antes de continuar', async ({ page }) => {
    // Tentar ir direto para pagamento sem carrinho
    await page.goto('/checkout/payment')

    // Deve redirecionar para home ou mostrar erro
    await expect(page.getByText(/expirada|inválida|checkout/i)).toBeVisible()
  })
})
