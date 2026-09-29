import { test, expect, type Page } from '@playwright/test'

// Fase A2a do admin (alpha): Configurações sem campos falsos, alpha sem rastreio, equipe sem gente inventada.
// Roda contra PW_ALPHA_URL (padrão alpha.localhost:3000) com a conta demo (só existe no navegador, em DEV).
const ALPHA = process.env.PW_ALPHA_URL || 'http://alpha.localhost:3000'

async function login(page: Page, email: string, senha: string) {
  await page.goto(`${ALPHA}/auth/login`)
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto(`${ALPHA}/auth/login`)
  await page.getByPlaceholder('seu@email.com').fill(email)
  await page.getByPlaceholder('Sua senha').fill(senha)
  await page.getByRole('button', { name: /Entrar/ }).first().click()
  await page.waitForURL(u => !u.toString().includes('/auth/login'), { timeout: 20000 })
}

test.describe('admin — configurações (conta demo, DEV)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'admin@aura.teste', 'senha123')
  })

  test('abas existem e os campos falsos sumiram', async ({ page }) => {
    await page.goto(`${ALPHA}/admin/settings`)
    await expect(page.getByRole('heading', { name: 'Configuracoes', exact: true })).toBeVisible({ timeout: 15000 })

    const aba = (nome: RegExp) => page.getByRole('button', { name: nome }).first()
    for (const nome of [/^Geral$/, /^E-mail$/, /^Backup$/, /^Logs$/, /^Seguran[cç]a$/]) {
      await expect(aba(nome)).toBeVisible()
    }

    // Geral: sem chave de API de CEP (a linha `general` é pública no navegador)
    await aba(/^Geral$/).click()
    await expect(page.getByText('Chave da API')).toHaveCount(0)

    // E-mail: informação real (Resend), sem SMTP inventado
    await aba(/^E-mail$/).click()
    await expect(page.getByText('Resend').first()).toBeVisible()
    await expect(page.getByText('SMTP Host')).toHaveCount(0)

    // Backup: sem agendamento de mentira
    await aba(/^Backup$/).click()
    await expect(page.getByText('Agendar Backup')).toHaveCount(0)

    // Logs: nenhum log fixo de 2025
    await aba(/^Logs$/).click()
    await expect(page.getByText('admin@aura.com')).toHaveCount(0)

    // Segurança: sem sessões/revogação fictícias
    await aba(/^Seguran[cç]a$/).click()
    await expect(page.getByText('Revogar')).toHaveCount(0)
  })

  test('alpha sem aviso de cookies; feedback só na barra do topo', async ({ page }) => {
    await page.goto(`${ALPHA}/admin/dashboard`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await expect(page.getByText('Sua privacidade importa')).toHaveCount(0)
    // Decisão 69 (substitui a 46 nesse ponto): feedback na barra fixa do topo, sem o botão flutuante antigo
    await expect(page.getByRole('button', { name: 'Enviar feedback' })).toHaveCount(1)
  })

  test('equipe sem admin inventado', async ({ page }) => {
    await page.goto(`${ALPHA}/admin/team`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    // A demo não tem manage_team: o ProtectedRoute manda para o dashboard
    test.skip(!page.url().includes('/admin/team'), 'a conta demo não tem permissão manage_team')
    await expect(page.getByText('Lucas Almeida')).toHaveCount(0)
    await expect(page.getByText('Promover conta existente')).toBeVisible()
  })
})
