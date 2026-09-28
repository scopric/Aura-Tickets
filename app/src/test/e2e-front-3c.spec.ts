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
  await expect(page.getByText('Premium')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Salvar \(em breve\)/ })).toBeDisabled()
})

test('Afiliados não mostra "Há 2h" inventado', async ({ page }) => {
  await entrarProdutor(page)
  await page.goto('/producer/afiliados', { waitUntil: 'networkidle', timeout: 15000 })
  await expect(page.getByText(/Afiliados|Fazer Upgrade|Funcionalidade Exclusiva/).first()).toBeVisible()
  await expect(page.getByText('Há 2h')).toHaveCount(0)
})

test('Home não tem link "Ver Demo"', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Começar Agora/ }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Ver Demo/ })).toHaveCount(0)
})
