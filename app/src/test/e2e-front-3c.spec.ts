import { test, expect, type Page } from '@playwright/test'

// PR 3C: produtor honesto, sem dado de exemplo nem botão falso. Conta de demonstração (só em desenvolvimento).
async function entrarProdutor(page: Page) {
  await page.goto('/auth/login')
  await page.getByRole('button', { name: 'Produtor', exact: true }).first().click()
  await page.getByPlaceholder('seu@email.com').fill('produtor@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar como Produtor/ }).first().click()
  await page.waitForURL(u => !u.toString().includes('/auth/login'))
}

test('Calculadora de Mesas começa vazia, sem mesas de exemplo', async ({ page }) => {
  await entrarProdutor(page)
  await page.goto('/producer/tables')
  await expect(page.getByText('Nenhuma mesa ainda')).toBeVisible()
  // o nome da mesa de exemplo ficava no value de um <input>, que getByText não enxerga
  await expect(page.locator('input[value^="Mesa Premium"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Salvar \(em breve\)/ })).toBeDisabled()
})

test('App do Organizador sem nota nem recursos inventados', async ({ page }) => {
  await entrarProdutor(page)
  await page.goto('/producer/app')
  await expect(page.getByRole('heading', { name: 'App do Organizador' })).toBeVisible()
  await expect(page.getByText(/4\.9 estrelas|Funciona offline|Notificacoes Push/i)).toHaveCount(0)
})

test('Home sem "Ver Demo" e sem números inventados (10K+, 500K+, 98%)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Começar Agora/ }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Ver Demo/ })).toHaveCount(0)
  await expect(page.getByText(/^(10K\+|500K\+|98%)$/)).toHaveCount(0)
})
