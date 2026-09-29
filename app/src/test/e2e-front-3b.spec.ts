import { test, expect, type Page } from '@playwright/test'

// PR 3B: participante sem dado de exemplo nem botão falso. Favoritos saem até existir tabela (Decisão 21).
// Conta de demonstração (só em desenvolvimento), como no e2e-front-1b.
async function entrarParticipante(page: Page) {
  await page.goto('/auth/login')
  await page.getByRole('button', { name: 'Participante', exact: true }).first().click()
  await page.getByPlaceholder('seu@email.com').fill('user@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar como Participante/ }).first().click()
  await page.waitForURL(u => !u.toString().includes('/auth/login'))
}

test.beforeEach(async ({ page }) => {
  await entrarParticipante(page)
})

test('Perfil sem "Plano Gratuito" nem nota 4.8 fixos', async ({ page }) => {
  await page.goto('/app/profile')
  await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible()
  await expect(page.getByText('Plano Gratuito')).toHaveCount(0)
  await expect(page.getByText('4.8', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Alterar' })).toHaveAttribute('href', '/auth/forgot')
})

test('Hub e menu lateral sem "Favoritos"', async ({ page }) => {
  await page.goto('/app/hub')
  await expect(page.getByRole('link', { name: 'Início' }).first()).toBeVisible()
  await expect(page.getByText('Favoritos')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Favoritos' })).toHaveCount(0)
})

test('/app/favorites não é mais rota (cai no 404)', async ({ page }) => {
  await page.goto('/app/favorites')
  await expect(page.getByRole('heading', { name: 'Pagina nao encontrada' })).toBeVisible()
})
