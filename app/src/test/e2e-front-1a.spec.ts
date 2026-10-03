import { test, expect } from '@playwright/test'

// PR 1A: cabeçalho "Eventos" abre o catálogo; barra "Finalizar" continua clicável com o aviso de cookies aberto.
test.describe('Front 1A — navegação e barra do carrinho', () => {
  test('"Eventos" do cabeçalho abre /events', async ({ page }) => {
    await page.goto('/')
    const menu = page.getByRole('button', { name: 'Menu' })
    if (await menu.isVisible()) await menu.click() // celular: o menu fica atrás do botão
    await page.getByRole('link', { name: 'Eventos' }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/events$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Explorar' })).toBeVisible()
  })

  test('barra "Finalizar" é clicável com o aviso de cookies aberto', async ({ page }) => {
    // evento real do banco de produção (criado em maio, sem aprovação; visível pelo slug)
    await page.goto('/event/noite-eletro-2025')
    await expect(page.getByRole('button', { name: /Rejeitar opcionais/ })).toBeVisible()
    await page.getByRole('button', { name: /^Adicionar um / }).first().click()
    // sem force: se o aviso cobrir a barra, o clique falha por interceptação
    await page.getByRole('button', { name: /^Finalizar/ }).click({ timeout: 5000 })
    await expect(page).toHaveURL(/\/checkout/)
  })
})
