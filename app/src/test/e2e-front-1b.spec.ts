import { test, expect, type Page } from '@playwright/test'

// PR 1B: o objeto `user` do useAuth é memoizado; sem isso o Perfil entrava em laço infinito e as telas com
// FeatureGuard refaziam a consulta de planos sem parar. Contas de demonstração (só em desenvolvimento).
async function entrar(page: Page, aba: string, email: string, botao: RegExp) {
  await page.goto('/auth/login')
  await page.getByRole('button', { name: aba, exact: true }).first().click()
  await page.getByPlaceholder('seu@email.com').fill(email)
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: botao }).first().click()
  await page.waitForURL(u => !u.toString().includes('/auth/login'))
}

test('Perfil do participante abre sem "Maximum update depth"', async ({ page }) => {
  const erros: string[] = []
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()) })
  await entrar(page, 'Participante', 'user@aura.teste', /Entrar como Participante/)
  await page.goto('/app/profile')
  await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible()
  await page.waitForTimeout(1500)
  expect(erros.filter(e => e.includes('Maximum update depth'))).toHaveLength(0)
})

test('telas com FeatureGuard ficam ociosas (sem consulta de planos em laço)', async ({ page }) => {
  await entrar(page, 'Produtor', 'produtor@aura.teste', /Entrar como Produtor/)
  for (const rota of ['/producer/crm', '/producer/banners']) {
    await page.goto(rota, { waitUntil: 'networkidle', timeout: 15000 })
    await expect(page.getByText(/Funcionalidade Exclusiva|Fazer Upgrade/).first()).toBeVisible()
  }
})
