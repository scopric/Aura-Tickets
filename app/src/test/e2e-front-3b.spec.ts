import { test, expect, type Page } from '@playwright/test'

// PR 3B: participante sem dado de exemplo nem botão falso. Favoritos voltaram na VF (Decisão 143): a tela chama "Salvos" e abre pela Conta.
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

test('Hub e menu lateral não têm item "Favoritos": a tela é "Salvos", pela Conta', async ({ page }) => {
  await page.goto('/app/hub')
  await expect(page.getByRole('link', { name: 'Início' }).first()).toBeVisible()
  await expect(page.getByText('Favoritos')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Favoritos' })).toHaveCount(0)
})

test('Conta leva aos Salvos (/app/salvos); /app/favorites continua sem rota (404)', async ({ page }) => {
  await page.goto('/app/profile')
  await page.getByRole('link', { name: 'Eventos salvos' }).click()
  await expect(page).toHaveURL(/\/app\/salvos$/)
  await expect(page.getByRole('heading', { name: 'Salvos', level: 1 })).toBeVisible()
  await page.goto('/app/favorites')
  await expect(page.getByRole('heading', { name: 'Pagina nao encontrada' })).toBeVisible()
})
