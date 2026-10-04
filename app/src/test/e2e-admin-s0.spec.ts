import { test, expect, type Page, type Route } from '@playwright/test'

// S0 do admin: telas quebradas. Conta demo (só DEV) + PostgREST simulado por page.route. Nada vai ao banco real.
const BASE = process.env.PW_BASE_URL || 'http://localhost:3000'
const ALPHA = process.env.PW_ALPHA_URL || BASE.replace('//localhost', '//alpha.localhost')
const SHOT = 'test-results/s0'
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

for (const v of VARIANTES) {
  test.describe(v.nome, () => {
    test('1 produtores: cnpj null e sem producer_profiles', async ({ page }) => {
      await simular(page, {
        '**/rest/v1/profiles?*': (r) => json(r, 200, [
          { id: 'p1', email: 'um@teste.invalid', full_name: 'Produtor Um', avatar_url: null, created_at: '2026-09-01T10:00:00Z', producer_profiles: { company_name: 'Empresa Um', cnpj: null, is_verified: false, commission_rate: null }, events: [{ count: 2 }] },
          { id: 'p2', email: 'dois@teste.invalid', full_name: 'Produtor Dois', avatar_url: null, created_at: '2026-09-02T10:00:00Z', producer_profiles: null, events: [{ count: 0 }] },
        ]),
      })
      await entrar(page, v, '/admin/producers')
      await expect(page.getByRole('heading', { name: 'Produtores' })).toBeVisible()
      await expect(page.getByText('Algo deu errado')).toHaveCount(0)
      if (v.w > 800) await expect(page.getByText('CNPJ a preencher')).toBeVisible()
      await expect(page.getByText('aguardando o produtor completar o cadastro')).toBeVisible()
      await expect(page.getByRole('button', { name: /Completar cadastro/ })).toHaveCount(0)
      await shot(page, `1-${v.nome}`)
    })

    test('2 feedback: erro 400 no feedback + 1 contato; e caso normal', async ({ page }) => {
      await simular(page, {
        '**/rest/v1/feedback?*': (r) => json(r, 400, { code: 'PGRST100', message: 'coluna inexistente' }),
        '**/rest/v1/contact_messages?*': (r) => json(r, 200, [{ id: 'c1', name: 'Maria Contato', email: 'm@teste.invalid', phone: null, subject: 'Assunto X', message: 'Mensagem de contato visível', page: '/contato', created_at: '2026-10-01T10:00:00Z' }]),
      })
      await entrar(page, v, '/admin/feedback')
      await expect(page.getByRole('alert').first()).toContainText('Não foi possível carregar o feedback')
      await expect(page.getByText('Feedback indisponível (erro acima).')).toBeVisible()
      await expect(page.getByText('Maria Contato').first()).toBeVisible()
      await expect(page.getByText('Algo deu errado')).toHaveCount(0)
      await shot(page, `2a-${v.nome}`)
    })

    test('2b feedback normal', async ({ page }) => {
      await simular(page, {
        '**/rest/v1/feedback?*': (r) => json(r, 200, [{ id: 'f1', type: 'bug', message: 'Botão quebrado no checkout', rating: 4, page: '/x', status: 'novo', created_at: '2026-10-01T10:00:00Z' }]),
        '**/rest/v1/contact_messages?*': (r) => json(r, 200, []),
      })
      await entrar(page, v, '/admin/feedback')
      await expect(page.getByText('Botão quebrado no checkout').first()).toBeVisible()
      await expect(page.getByText('Feedback indisponível')).toHaveCount(0)
      await expect(page.getByText('4.0').first()).toBeVisible()
      await shot(page, `2b-${v.nome}`)
    })

    test('3 topo sem sino; feedback sem estrela manda rating null; erro RLS legível', async ({ page }) => {
      const corpos: Record<string, unknown>[] = []
      let modo: 'rls' | 'ok' = 'rls'
      await simular(page, {
        '**/rest/v1/feedback': (r) => {
          if (r.request().method() !== 'POST') return json(r, 200, [])
          corpos.push(r.request().postDataJSON())
          return modo === 'rls' ? json(r, 401, { code: '42501', message: 'new row violates row-level security policy for table "feedback"' }) : r.fulfill({ status: 201, body: '' })
        },
      })
      await entrar(page, v, '/admin/dashboard')
      await expect(page.getByRole('button', { name: 'Enviar feedback' })).toBeVisible()
      await expect(page.getByRole('button', { name: /notifica/i })).toHaveCount(0)
      await page.getByRole('button', { name: 'Enviar feedback' }).click()
      await page.getByLabel('Mensagem do feedback').fill('Teste sem estrela')
      await page.getByRole('button', { name: 'Enviar', exact: true }).click()
      await expect(page.getByText('Não foi possível enviar: entre de novo e tente outra vez.')).toBeVisible()
      expect(corpos).toHaveLength(1)
      expect(corpos[0].rating).toBeNull()
      expect(JSON.stringify(corpos[0])).not.toContain('row-level')
      await shot(page, `3-${v.nome}`)
    })

    test('4 configurações gerais: moeda fixa, BRL, [] = erro', async ({ page }) => {
      const gravados: Record<string, any>[] = []
      let resp: unknown = [{ id: 1 }]
      await simular(page, {
        '**/rest/v1/platform_settings*': (r) => {
          if (r.request().method() === 'GET') return json(r, 200, [{ key: 'general', value: { platformName: 'Evokaa', currency: 'USD' } }])
          gravados.push(r.request().postDataJSON())
          return json(r, 200, resp)
        },
      })
      await entrar(page, v, '/admin/settings')
      await expect(page.getByText(/Real \(R\$\)/).first()).toBeVisible()
      await expect(page.locator('select#currency')).toHaveCount(0)
      await page.getByRole('button', { name: 'Salvar' }).first().click()
      await expect(page.getByText('Configurações salvas com sucesso!')).toBeVisible()
      expect(gravados[0].value.currency).toBe('BRL')
      resp = []
      await page.getByRole('button', { name: 'Salvar' }).first().click()
      await expect(page.getByText(/Nada foi gravado/)).toBeVisible()
      await shot(page, `4-${v.nome}`)
    })

    test('5 checkout em R$ mesmo com USD no banco', async ({ page }) => {
      await simular(page, { '**/rest/v1/platform_settings*': (r) => json(r, 200, { value: { currency: 'USD' } }) })
      await page.setViewportSize({ width: v.w, height: v.h })
      await page.addInitScript(([t]) => {
        localStorage.setItem('evokaa-theme', t)
        sessionStorage.setItem('aura_pending_checkout', JSON.stringify({ eventId: 'evt-001', cart: { a: 2 }, totalAmount: 200, itemsSummary: [{ ticket_type_id: 'a', quantity: 2, name: 'Pista', price: 100 }] }))
      }, [v.tema])
      await page.goto(`${BASE}/auth/login`)
      await page.getByPlaceholder('seu@email.com').fill('user@aura.teste')
      await page.getByPlaceholder('Sua senha').fill('senha123')
      await page.getByRole('button', { name: /Entrar/ }).first().click()
      await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 20000 })
      await page.goto(`${BASE}/checkout/payment`)
      await expect(page.getByText('Total a pagar')).toBeVisible()
      const txt = await page.locator('main, body').first().innerText()
      expect(txt).toMatch(/R\$\s?200,00/)
      expect(txt).not.toMatch(/US\$|\$\s?200\.00|USD/)
      await shot(page, `5-${v.nome}`)
    })

    test('6 IA: cotação 5,25', async ({ page }) => {
      const gravados: Record<string, any>[] = []
      const cfg = { id: 1, enabled: true, model_router: 'm', model_simple: 'm', model_complex: 'm', model_vision: 'm', prices: { m: { in: 1, out: 2 } }, usd_brl: 5, daily_cap_brl: 50, hourly_limit: 30, quotas: { free: 5, starter: 20, plus: 50, pro: 100, enterprise: 500 }, credit_cost: { simples: 1, complexo: 3, imagem: 5 }, max_steps: 4, max_output_tokens: 2048 }
      await simular(page, {
        '**/rest/v1/rpc/ai_admin_resumo': (r) => json(r, 200, { totais: { usd: 0, brl: 0, perguntas: 0, chamadas: 0, custo_medio_brl: 0 }, por_dia: [], por_produtor: [], por_modelo: [], por_modo: [], historico: [] }),
        '**/rest/v1/rpc/ai_key_status': (r) => json(r, 200, { configurada: false, final_4: null, atualizada_em: null }),
        '**/rest/v1/ai_settings*': (r) => {
          if (r.request().method() === 'GET') return json(r, 200, cfg)
          gravados.push(r.request().postDataJSON()); return json(r, 200, [{ id: 1 }])
        },
      })
      await entrar(page, v, '/admin/ia')
      const campo = page.getByLabel('Cotação do dólar (R$)').or(page.locator('label:has-text("Cotação do dólar") input')).first()
      await campo.fill('5,25')
      await expect(campo).toHaveValue('5,25')
      await page.getByRole('button', { name: /Salvar configurações/ }).click()
      await expect(page.getByText('Configurações salvas.')).toBeVisible()
      expect(gravados[0].usd_brl).toBe(5.25)
      await campo.fill('25')
      await page.getByRole('button', { name: /Salvar configurações/ }).click()
      await expect(page.getByText('Cotação do dólar: entre 1 e 20 R$.')).toBeVisible()
      expect(gravados).toHaveLength(1)
      await shot(page, `6-${v.nome}`)
    })

    test('7 meu cadastro sem ficha', async ({ page }) => {
      await simular(page)
      await entrar(page, v, '/admin/meu-cadastro')
      const t = page.getByText('Sua conta foi criada como administradora antes do convite')
      await expect(t).toBeVisible()
      await expect(t).toContainText('Entre a remoção e o aceite, você fica sem acesso ao painel.')
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(sobra).toBeLessThanOrEqual(0)
      await shot(page, `7-${v.nome}`)
    })
  })
}
