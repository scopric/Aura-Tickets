import { test, expect, type Page } from '@playwright/test'

// Admin (alpha). Roda contra PW_ALPHA_URL (padrão alpha.localhost:3000; no worktree admin, alpha.localhost:3004).
// Parte 1 usa a conta demo (só existe no navegador, em DEV; toda chamada ao banco dá 401): serve para
// garantir que a tela mostra o erro real em vez de dados inventados.
// Parte 2 usa a conta real de admin de testes, com e-mail e senha em app/.env.local (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).
const ALPHA = process.env.PW_ALPHA_URL || 'http://alpha.localhost:3000'
const ROTAS = ['/admin/dashboard', '/admin/users', '/admin/producers', '/admin/events', '/admin/finance', '/admin/analytics',
  '/admin/tickets', '/admin/newsletter', '/admin/team', '/admin/feedback', '/admin/support', '/admin/settings']
const FICTICIOS = ['Joao Silva', 'Pulse Entretenimento', 'modo de demonstração']

async function login(page: Page, email: string, senha: string) {
  await page.goto(`${ALPHA}/auth/login`)
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto(`${ALPHA}/auth/login`)
  await page.getByPlaceholder('seu@email.com').fill(email)
  await page.getByPlaceholder('Sua senha').fill(senha)
  await page.getByRole('button', { name: /Entrar/ }).first().click()
  await page.waitForURL(u => !u.toString().includes('/auth/login'), { timeout: 20000 })
}

test.describe('admin com conta demo (DEV)', () => {
  // A conta demo não tem sessão no banco: as consultas passam pela chave pública e a regra de acesso
  // devolve vazio (usuários) ou só os eventos publicados. O que não pode acontecer é aparecer usuário inventado.
  test('Usuários vazio (sem os 5 usuários inventados) e Eventos carrega sem erro', async ({ page }) => {
    await login(page, 'admin@aura.teste', 'senha123')
    await page.goto(`${ALPHA}/admin/users`)
    await expect(page.getByText(/Nenhum usuário encontrado/)).toBeVisible({ timeout: 15000 })
    for (const t of FICTICIOS) await expect(page.getByText(t)).toHaveCount(0)
    await page.goto(`${ALPHA}/admin/events`)
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByText('Produtor Teste')).toHaveCount(0) // exemplo do código só apareceria se a consulta falhasse
  })
})

test.describe('admin com conta real', () => {
  const email = process.env.E2E_ADMIN_EMAIL
  const senha = process.env.E2E_ADMIN_PASSWORD
  test.skip(!email || !senha, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD não definidos em app/.env.local')

  test('usuários e eventos reais aparecem; nenhuma tela quebra nos dois temas', async ({ page, isMobile }) => {
    test.skip(isMobile, 'o admin não tem versão para celular (colunas escondidas abaixo de md)')
    const erros: string[] = []
    page.on('pageerror', e => erros.push(String(e)))
    await login(page, email!, senha!)
    if (await page.getByText('Código de Autenticação').isVisible().catch(() => false)) {
      test.skip(true, 'a conta de teste tem 2FA; use uma conta sem 2FA para os e2e')
    }

    await page.goto(`${ALPHA}/admin/users`)
    await expect(page.locator('tbody').getByText(email!)).toBeVisible({ timeout: 15000 }) // só na tabela: a barra lateral também mostra o e-mail
    await page.goto(`${ALPHA}/admin/events`)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15000 })
    // A1b: painel de detalhes do evento (a barra lateral também tem "Ingressos", por isso o escopo no dialog)
    // Com o banco sem eventos (os de teste foram apagados em 28/09), a tabela mostra só o estado vazio
    const detalhes = page.getByRole('button', { name: 'Ver detalhes do evento' })
    if (await detalhes.count()) {
      await detalhes.first().click()
      await expect(page.getByRole('dialog')).toContainText('Ingressos')
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    } else {
      await expect(page.getByText('Nenhum evento nesta categoria.')).toBeVisible()
    }

    // A1b: produtores reais (a linha de "nenhum produtor" também é um tr, por isso a segunda checagem)
    await page.goto(`${ALPHA}/admin/producers`)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('tbody tr').first()).not.toContainText('Nenhum produtor')
    await expect(page.locator('body')).not.toContainText('Pulse Entretenimento')

    // A1b: dashboard sem os números inventados do antigo mock
    await page.goto(`${ALPHA}/admin/dashboard`)
    await expect(page.getByText('Fila de moderação')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Atualizado em/)).toBeVisible({ timeout: 20000 }) // só depois das consultas o body está completo
    const dashboard = await page.locator('body').innerText()
    expect(dashboard).not.toContain('107.968')
    expect(dashboard).not.toMatch(/882 assinantes|Distribuicao de Planos/)

    for (const tema of ['dark', 'light']) {
      await page.evaluate(t => localStorage.setItem('evokaa-theme', t), tema)
      for (const rota of ROTAS) {
        await page.goto(`${ALPHA}${rota}`)
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
        const body = await page.locator('body').innerText()
        for (const t of FICTICIOS) expect(body, `${rota} (${tema}) contém "${t}"`).not.toContain(t)
      }
    }
    expect(erros, 'erros de renderização').toEqual([])
  })
})
