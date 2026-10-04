import { test, expect, type Page } from '@playwright/test'

// V9a: no primeiro acesso, uma camada por vez (cookies → aviso da Política → balão do Evo).
// Entra no painel do produtor com a conta demo (como e2e-producer.spec.ts), sem nada no armazenamento.
const BALAO = /Oi! Sou o Evo/

async function camadasVisiveis(page: Page) {
  const cookies = await page.getByRole('button', { name: /Rejeitar opcionais/ }).isVisible()
  const politica = await page.getByText(/Atualizamos a nossa/).isVisible()
  const balao = await page.getByRole('button', { name: BALAO }).isVisible()
  return { cookies, politica, balao, total: [cookies, politica, balao].filter(Boolean).length }
}
const cookiesGa = async (page: Page) => (await page.context().cookies()).filter((c) => c.name.startsWith('_ga'))

test.describe('V9a — uma camada por vez no primeiro acesso', () => {
  test('cookies → Política → balão do Evo, nunca duas juntas, sem _ga antes de aceitar', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByRole('button', { name: 'Produtor' }).click()
    await page.getByPlaceholder('seu@email.com').fill('produtor@aura.teste')
    await page.getByPlaceholder('Sua senha').fill('senha123')
    await page.getByRole('button', { name: /Entrar como Produtor/ }).click()
    await expect(page).toHaveURL(/.*\/producer\/dashboard/)

    // 1) sem decisão: só os cookies, mesmo passado o tempo do balão (2 s)
    await expect(page.getByRole('button', { name: /Rejeitar opcionais/ })).toBeVisible()
    await page.waitForTimeout(2600)
    expect(await camadasVisiveis(page)).toMatchObject({ cookies: true, politica: false, balao: false })
    expect(await cookiesGa(page)).toEqual([])

    // 2) aceitar: some o aviso de cookies e abre só a Política
    await page.getByRole('button', { name: /Aceitar todos/ }).click()
    await expect(page.getByText(/Atualizamos a nossa/)).toBeVisible()
    await page.waitForTimeout(2600)
    expect(await camadasVisiveis(page)).toMatchObject({ cookies: false, politica: true, balao: false })

    // 3) fechar a Política: só então o balão do Evo (~2 s depois)
    await page.getByRole('button', { name: 'Fechar aviso da Política de Privacidade' }).click()
    expect(await camadasVisiveis(page)).toMatchObject({ cookies: false, politica: false, balao: false })
    await expect(page.getByRole('button', { name: BALAO })).toBeVisible({ timeout: 4000 })
    expect((await camadasVisiveis(page)).total).toBe(1)
  })

  test('rejeitar opcionais também libera a Política e não grava _ga', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByRole('button', { name: 'Produtor' }).click()
    await page.getByPlaceholder('seu@email.com').fill('produtor@aura.teste')
    await page.getByPlaceholder('Sua senha').fill('senha123')
    await page.getByRole('button', { name: /Entrar como Produtor/ }).click()
    await expect(page).toHaveURL(/.*\/producer\/dashboard/)
    await page.getByRole('button', { name: /Rejeitar opcionais/ }).click()
    await expect(page.getByText(/Atualizamos a nossa/)).toBeVisible()
    expect((await camadasVisiveis(page)).total).toBe(1)
    expect(await cookiesGa(page)).toEqual([])
  })
})
