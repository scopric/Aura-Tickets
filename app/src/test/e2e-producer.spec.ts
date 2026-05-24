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

    await expect(page.getByText('Eventos')).toBeVisible()
    await expect(page.getByText('Festival de Verão 2025')).toBeVisible()
  })

  test('deve editar um evento existente', async ({ page }) => {
    await page.goto('/producer/events')

    // Clicar no ícone de editar do primeiro evento
    const editButton = page.locator('table tbody tr:first-child a[title="Editar"]').first()
    await editButton.click()

    // Verificar que entrou na página de edição
    await expect(page.getByText('Editar Evento')).toBeVisible()

    // Alterar título
    const titleInput = page.getByPlaceholder('Ex: Noite Eletro 2025')
    await titleInput.fill('Festival de Verão 2025 - Editado')

    // Avançar até a revisão e salvar
    await page.getByRole('button', { name: 'Próximo' }).click()
    await page.getByRole('button', { name: 'Próximo' }).click()
    await page.getByRole('button', { name: 'Próximo' }).click()
    await page.getByRole('button', { name: 'Salvar Alterações' }).click()

    // Verificar redirecionamento
    await expect(page).toHaveURL(/.*\/producer\/events/)
  })

  test('deve acessar configurações do produtor', async ({ page }) => {
    await page.goto('/producer/settings')

    await expect(page.getByText('Configuracoes')).toBeVisible()
    await expect(page.getByText('Perfil')).toBeVisible()

    // Testar navegação entre abas
    await page.getByRole('button', { name: 'Pagamento' }).click()
    await expect(page.getByText('Dados Bancarios')).toBeVisible()

    await page.getByRole('button', { name: 'Notificacoes' }).click()
    await expect(page.getByText('Notificacoes')).toBeVisible()
  })
})
