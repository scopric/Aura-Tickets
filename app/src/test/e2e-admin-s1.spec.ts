import { test, expect, type Page, type Route } from '@playwright/test'

// S1 do admin: textos que prometem o que não existe. Conta demo (só DEV) + PostgREST simulado por page.route. Nada vai ao banco real.
const BASE = process.env.PW_BASE_URL || 'http://localhost:3000'
const ALPHA = process.env.PW_ALPHA_URL || BASE.replace('//localhost', '//alpha.localhost')
const SHOT = 'test-results/s1'
const VARIANTES = [
  { nome: 'desk-claro', w: 1440, h: 900, tema: 'light' },
  { nome: 'desk-escuro', w: 1440, h: 900, tema: 'dark' },
  { nome: 'cel-claro', w: 390, h: 844, tema: 'light' },
  { nome: 'cel-escuro', w: 390, h: 844, tema: 'dark' },
]

type Mock = Record<string, (r: Route) => unknown>
async function simular(page: Page, mocks: Mock = {}) {
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/rpc/**', (r) => r.fulfill({ json: {} }))
  for (const [padrao, fn] of Object.entries(mocks)) await page.route(padrao, (r) => fn(r))
}
async function entrar(page: Page, v: typeof VARIANTES[number], rota: string) {
  await page.setViewportSize({ width: v.w, height: v.h })
  await page.addInitScript((t) => localStorage.setItem('evokaa-theme', t), v.tema)
  await page.goto(`${ALPHA}/auth/login`)
  await page.getByPlaceholder('seu@email.com').fill('admin@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar/ }).first().click()
  await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 20000 })
  await page.goto(`${ALPHA}${rota}`)
}
const shot = (page: Page, n: string) => page.screenshot({ path: `${SHOT}-${n}.png`, fullPage: true })
const json = (r: Route, status: number, body: unknown) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const semEstouro = async (page: Page) => {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(sobra).toBeLessThanOrEqual(0)
}
const corpo = (page: Page) => page.locator('body').innerText()
const PROIBIDOS_NEWS = [/Pix Parcelado/i, /carteira digital offline/i, /acesso antecipado de 24/i, /lotes promocionais/i]

for (const v of VARIANTES) {
  test.describe(v.nome, () => {
    test('1 newsletter: modelos, cupom desligado, aviso, remetente', async ({ page }) => {
      await simular(page)
      await entrar(page, v, '/admin/newsletter')
      const cupom = page.locator('#coupon-toggle')
      const botoes = page.locator('button', { hasText: /Destaques da Semana|Aviso de pré-venda|Informativo Evokaa/ })
      await expect(botoes.first()).toBeVisible({ timeout: 15000 })
      const total = await botoes.count()
      expect(total).toBe(3)
      for (let i = 0; i < total; i++) {
        await botoes.nth(i).click()
        await expect(page.getByText(/Só ative quando o cupom existir/)).toBeVisible()
        await expect(cupom).not.toBeChecked()
        const campos = await page.evaluate(() => [...document.querySelectorAll('input,textarea')].map((e) => (e as HTMLInputElement).value).join('\n'))
        const tudo = campos + '\n' + (await corpo(page))
        for (const p of PROIBIDOS_NEWS) expect(tudo).not.toMatch(p)
        await shot(page, `1-modelo${i}-${v.nome}`)
      }
      await expect(page.getByText('contato@evokaa.com.br').first()).toBeVisible()
      await semEstouro(page)
    })

    test('2 tickets: aviso sem webhooks', async ({ page }) => {
      await simular(page)
      await entrar(page, v, '/admin/tickets')
      await expect(page.getByText(/Estorno e cortesia ainda não existem|Ainda não há emissão automática/).first()).toBeVisible()
      expect(await corpo(page)).not.toMatch(/webhook/i)
      await semEstouro(page)
      await shot(page, `2-${v.nome}`)
    })

    test('3 financeiro: aba Taxas', async ({ page }) => {
      await simular(page)
      await entrar(page, v, '/admin/finance')
      await page.getByRole('tab', { name: 'Taxas' }).or(page.getByRole('button', { name: 'Taxas' })).first().click()
      await expect(page.getByText(/10%/).first()).toBeVisible()
      const t = await corpo(page)
      expect(t).toMatch(/R\$\s?3,00/)
      expect(t).toMatch(/gratuito não paga/i)
      expect(t).not.toMatch(/D\+0|D\+14|D\+2|10\.000/)
      await expect(page.locator('input[type=range], [role=slider]')).toHaveCount(0)
      await semEstouro(page)
      await page.waitForTimeout(1200) // fim da animação da aba
      await shot(page, `3-${v.nome}`)
    })

    test('4 equipe: funções e aviso do convite', async ({ page }) => {
      // a conta demo não tem manage_team nem super_admin (convite só existe para quem tem): dá a permissão na memória do navegador, sem tocar no banco
      await simular(page)
      await entrar(page, v, '/admin/dashboard')
      await expect(page.getByRole('heading', { name: 'Painel' })).toBeVisible({ timeout: 15000 })
      await page.evaluate(async () => {
        const { useAuthStore } = await import('/src/stores/authStore.ts')
        const u = useAuthStore.getState().user!
        useAuthStore.getState().setUser({ ...u, admin_permissions: [...(u.admin_permissions || []), 'manage_team', 'super_admin'] })
      })
      await page.evaluate(() => { history.pushState({}, '', '/admin/team'); window.dispatchEvent(new PopStateEvent('popstate')) })
      await expect(page.getByText('Aviso de Segurança')).toBeVisible({ timeout: 15000 })
      const t = await corpo(page)
      expect(t).toContain('Estorno e cortesia ainda não existem')
      expect(t).toContain('Convidar, remover e alterar funções é só de quem tem Acesso total')
      await expect(page.getByText(/A pessoa recebe um link por e-mail \(vale 7 dias\)/)).toBeVisible()
      await expect(page.getByText('Aviso de Segurança')).toBeVisible()
      await expect(page.getByText(/toda a equipe ainda lê pedidos, financeiro/)).toBeVisible()
      await semEstouro(page)
      await shot(page, `4-${v.nome}`)
    })

    test('5 usuários: gerenciar produtor', async ({ page }) => {
      await simular(page, {
        '**/rest/v1/rpc/admin_usuarios_lista': (r) => json(r, 200, [{ id: 'p1', email: 'um@teste.invalid', full_name: 'Produtor Um', role: 'producer', avatar_url: null, created_at: '2026-09-01T10:00:00Z', producer_profiles: { company_name: 'Empresa Um', cnpj: null, is_verified: false, commission_rate: null } }]),
      })
      await entrar(page, v, '/admin/users')
      await page.getByRole('button', { name: /Gerenciar Produtor Um/ }).click()
      const dlg = page.getByRole('dialog')
      await expect(dlg).toBeVisible()
      await expect(dlg.getByRole('button', { name: 'Acesso' })).toBeVisible()
      await dlg.getByRole('button', { name: 'Acesso' }).click()
      const ops = await dlg.locator('option').allInnerTexts()
      expect(ops.join('|')).not.toMatch(/Editor/)
      const t = await dlg.innerText()
      expect(t).toContain('Ainda não libera nada')
      expect(t).not.toMatch(/Preço do plano/i)
      await semEstouro(page)
      await shot(page, `5-${v.nome}`)
    })

    test('6 conhecimento e atendimento', async ({ page }) => {
      await simular(page)
      await entrar(page, v, '/admin/conhecimento')
      await expect(page.getByText(/Sugestões da IA: ainda não existem/).first()).toBeAttached()
      await semEstouro(page)
      await shot(page, `6a-${v.nome}`)
      await page.goto(`${ALPHA}/admin/atendimento`)
      await expect(page.getByRole('heading').first()).toBeVisible()
      expect(await corpo(page)).not.toMatch(/Media[cç][aã]o/)
      await semEstouro(page)
      await shot(page, `6b-${v.nome}`)
    })

    test('7 produtores e analytics', async ({ page }) => {
      await simular(page)
      await entrar(page, v, '/admin/producers')
      await expect(page.getByText(/O selo Verificado é só um registro interno/)).toBeVisible()
      await semEstouro(page)
      await shot(page, `7a-${v.nome}`)
      await page.goto(`${ALPHA}/admin/analytics`)
      await page.waitForTimeout(1500)
      await expect(page.getByText('Algo deu errado')).toHaveCount(0)
      await expect(page.getByRole('heading').first()).toBeVisible()
      await shot(page, `7b-${v.nome}`)
    })

    test('8 home pública: card Segurança', async ({ page }) => {
      await simular(page)
      await page.setViewportSize({ width: v.w, height: v.h })
      await page.addInitScript((t) => localStorage.setItem('evokaa-theme', t), v.tema)
      await page.goto(`${BASE}/`)
      await expect(page.getByText('Seus dados tratados conforme a LGPD e ingresso com QR Code conferido na entrada.')).toBeAttached()
      expect(await page.locator('body').innerText()).not.toMatch(/antifraude/i)
      await semEstouro(page)
      await shot(page, `8-${v.nome}`)
    })
  })
}
