import { test, expect } from '@playwright/test'

test.describe('Fluxo do Produtor', () => {
  test.beforeEach(async ({ page }) => {
    // Login como produtor
    await page.goto('/auth/login')
    await page.getByRole('button', { name: 'Produtor' }).click()
    await page.getByPlaceholder('seu@email.com').fill('produtor@aura.teste')
    await page.getByPlaceholder('Sua senha').fill('senha123')
    await page.getByRole('button', { name: /Entrar como Produtor/ }).click()
    await expect(page).toHaveURL(/.*\/producer\/dashboard/)
  })

  test('deve acessar lista de eventos', async ({ page }) => {
    await page.goto('/producer/events')

    await expect(page.getByRole('heading', { name: 'Meus eventos' })).toBeVisible()
    await expect(page.getByText('Festival de Verão 2025')).toBeVisible()
  })

  test('deve acessar configurações do produtor', async ({ page }) => {
    // Com a conta demo (401) a tela mostra "Não foi possível carregar as configurações" e não abre as abas
    test.skip(true, 'conta demo não lê o banco; rodar com E2E_PRODUCER_* real')
    await page.goto('/producer/settings')

    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Perfil público' })).toBeVisible()

    // Testar navegação entre abas
    await page.getByRole('button', { name: 'Pagamento', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Dados bancários' })).toBeVisible()

    // exact: o sino do topo se chama "Notificações (0 não lidas)"
    await page.getByRole('button', { name: 'Notificações', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Notificações' })).toBeVisible()
  })
})
