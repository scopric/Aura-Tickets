import { test, expect, type Page, type Route } from '@playwright/test'

// S2 do admin: "zero no lugar de erro". Sessão de admin falsa (localStorage + /auth/v1 e perfil simulados) e PostgREST
// simulado por page.route. Nada vai ao banco real; nenhuma senha. Rodar com PW_BASE_URL=http://localhost:3199.
const BASE = process.env.PW_BASE_URL || 'http://localhost:3000'
const ALPHA = process.env.PW_ALPHA_URL || BASE.replace('//localhost', '//alpha.localhost')
const SHOT = 'test-results/s2'
const VARIANTES = [
  { nome: 'desk-claro', w: 1440, h: 900, tema: 'light' },
  { nome: 'desk-escuro', w: 1440, h: 900, tema: 'dark' },
  { nome: 'cel-claro', w: 390, h: 844, tema: 'light' },
  { nome: 'cel-escuro', w: 390, h: 844, tema: 'dark' },
]
const UID = '11111111-1111-4111-8111-111111111111'
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const json = (r: Route, status: number, body: unknown, headers: Record<string, string> = {}) =>
  r.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) })
const falha = (r: Route) => json(r, 500, { code: 'XX000', message: 'falha simulada' })
const contagem = (r: Route, n: number) => json(r, 200, [], { 'content-range': `0-0/${n}`, 'access-control-expose-headers': 'content-range' }) // sem expor o cabeçalho (CORS) o navegador não deixa o supabase-js ler a contagem

type Mock = Record<string, (r: Route) => unknown>
async function entrar(page: Page, v: typeof VARIANTES[number], rota: string, permissoes: string[], mocks: Mock = {}) {
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ aal: 'aal2', sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.sig`
  const sess = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000,
    user: { id: UID, aud: 'authenticated', role: 'authenticated', email: 'admin@teste.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
  await page.setViewportSize({ width: v.w, height: v.h })
  await page.addInitScript(([t, s]) => { localStorage.setItem('evokaa-theme', t as string); localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(s)) }, [v.tema, sess])
  await page.route('**/auth/v1/**', (r) => json(r, 200, sess.user))
  await page.route('**/functions/v1/**', (r) => json(r, 200, {}))
  await page.route('**/rest/v1/**', (r) => json(r, 200, []))
  await page.route('**/rest/v1/rpc/**', (r) => json(r, 200, {}))
  await page.route('**/rest/v1/profiles?*id=eq.' + UID + '*', (r) => json(r, 200, { id: UID, full_name: 'Admin Teste S2', role: 'admin', admin_permissions: permissoes, email: 'admin@teste.invalid', is_authorized: true }))
  for (const [padrao, fn] of Object.entries(mocks)) await page.route(padrao, (r) => fn(r))
  await page.goto(`${ALPHA}${rota}`)
}
const shot = (page: Page, n: string) => page.screenshot({ path: `${SHOT}-${n}.png`, fullPage: true })
const SUPER = ['super_admin']
const dia = 86400000
const iso = (ms: number) => new Date(Date.now() + ms).toISOString()
const evento = (id: string, title: string, status: string, ap: string, ini: number, fim: number | null) => ({
  id, title, status, approval_status: ap, start_date: iso(ini), end_date: fim === null ? null : iso(fim), date: null, time: null, created_at: iso(-30 * dia),
  profiles: { full_name: 'Produtor X', email: 'p@teste.invalid' }, ticket_types: [{ id: id + 't', name: 'Pista', price: 100, sold: 7, quantity: 50 }],
})
// 3 aprovados+publicados: um futuro, um em andamento; 1 passado (excluído); 1 rascunho aprovado (excluído); 1 pendente
const EVENTOS = [
  evento('e1', 'Futuro', 'published', 'approved', 10 * dia, 10 * dia + 3600000),
  evento('e2', 'Em andamento', 'published', 'approved', -3600000, 4 * 3600000),
  evento('e3', 'Passado', 'published', 'approved', -20 * dia, -20 * dia + 3600000),
  evento('e4', 'Rascunho aprovado', 'draft', 'approved', 10 * dia, 10 * dia + 3600000),
  evento('e5', 'Pendente', 'published', 'pending', 10 * dia, 10 * dia + 3600000),
]

// o menor ancestral do rótulo que também contém o texto dado (o cartão do Stat)
const cartao = (page: Page, rot: string) => page.getByText(rot, { exact: true }).locator('xpath=ancestor::*[.//*[self::div or self::p or self::span][last()]][1]')
const textoCartao = async (page: Page, rot: string) => {
  const l = page.getByText(rot, { exact: true }).first()
  return l.evaluate((el) => { let n: HTMLElement | null = el as HTMLElement; while (n && n.innerText.trim() === (el as HTMLElement).innerText.trim()) n = n.parentElement; return n?.innerText ?? '' })
}
const PERMISSOES_EVENTOS = ['manage_events']
const mocksEventos: Mock = { '**/rest/v1/events?*': (r) => json(r, 200, EVENTOS) }

for (const v of VARIANTES) {
  test.describe(v.nome, () => {
    test('1 painel super_admin: cartões e Eventos no ar', async ({ page }) => {
      await entrar(page, v, '/admin/dashboard', SUPER, {
        '**/rest/v1/profiles?select=role': (r) => json(r, 200, [{ role: 'user' }, { role: 'producer' }, { role: 'admin' }]),
        '**/rest/v1/events?select=id%2Cstatus*': (r) => json(r, 200, EVENTOS),
        '**/rest/v1/newsletter_subscribers*': (r) => contagem(r, 12),
        '**/rest/v1/conversations*': (r) => contagem(r, 3),
        '**/rest/v1/contact_messages*': (r) => contagem(r, 5),
      })
      await expect(page.getByText('Conversas abertas com a equipe', { exact: true })).toBeVisible()
      for (const r of ['Contas', 'Eventos pendentes', 'Eventos no ar', 'Inscritos na newsletter', 'Conversas abertas com a equipe', 'Mensagens de contato']) await expect(page.getByText(r, { exact: true })).toBeVisible()
      await expect.poll(() => textoCartao(page, 'Eventos no ar')).toMatch(/Eventos no ar\s*2\s*4 aprovados no total/)
      expect(await textoCartao(page, 'Eventos pendentes')).toMatch(/Eventos pendentes\s*1\b/)
      expect(await textoCartao(page, 'Conversas abertas com a equipe')).toMatch(/\b3\b/)
      expect(await textoCartao(page, 'Inscritos na newsletter')).toMatch(/\b12\b/)
      await expect(page.getByRole('link', { name: /Abrir financeiro/ })).toBeVisible()
      await shot(page, `1-${v.nome}`)
    })

    test('2 painel só manage_events: sem acesso e sem requisição às outras áreas', async ({ page }) => {
      const tabelas: string[] = []
      page.on('request', (q) => { const m = q.url().match(/\/rest\/v1\/([a-z_]+)(\?[^ ]*)?/); if (m) tabelas.push(m[1] + (m[1] === 'profiles' && !m[2]?.includes('id=eq.') ? '(lista)' : '')) })
      await entrar(page, v, '/admin/dashboard', PERMISSOES_EVENTOS, { '**/rest/v1/events?*': (r) => json(r, 200, EVENTOS) })
      await expect(page.getByText('Eventos no ar', { exact: true })).toBeVisible()
      await expect.poll(() => textoCartao(page, 'Eventos no ar')).toMatch(/\b2\b/)
      for (const r of ['Contas', 'Inscritos na newsletter', 'Conversas abertas com a equipe', 'Mensagens de contato']) {
        const t = await textoCartao(page, r)
        expect(t, r).toContain('—')
        expect(t, r).toContain('Sem acesso a esta área')
      }
      await expect(page.getByRole('link', { name: /Abrir financeiro/ })).toHaveCount(0)
      for (const proibida of ['newsletter_subscribers', 'contact_messages']) expect(tabelas, proibida).not.toContain(proibida)
      expect(tabelas).not.toContain('profiles(lista)') // só o próprio perfil, nunca a lista de contas
      expect(tabelas).not.toContain('newsletter_subscribers')
      await shot(page, `2-${v.nome}`)
      console.log('TABELAS', [...new Set(tabelas)].join(','))
    })

    test('3 eventos: No ar = Painel, Receita —, sem coluna Receita, sem Vendidos', async ({ page }) => {
      await entrar(page, v, '/admin/events', SUPER, mocksEventos)
      await expect(page.getByText('Futuro').first()).toBeVisible()
      expect(await textoCartao(page, 'No ar')).toMatch(/No ar\s*2\s*4 aprovados no total/)
      const rec = await textoCartao(page, 'Receita')
      expect(rec).toContain('—'); expect(rec).toContain('sem venda confirmada')
      await expect(page.getByRole('columnheader', { name: 'Receita' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Aprovados (todos)' })).toBeVisible()
      await page.getByRole('button', { name: 'Ver detalhes do evento' }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('dialog').getByText('Pista')).toBeVisible() // a tabela de ingressos abriu, só sem a coluna Vendidos
      await expect(page.getByRole('dialog').getByText('Vendidos')).toHaveCount(0)
      await shot(page, `3-${v.nome}`)
    })

    test('4 financeiro: orders 500', async ({ page }) => {
      await entrar(page, v, '/admin/finance', SUPER, { '**/rest/v1/orders*': falha })
      await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar os dados financeiros' })).toBeVisible({ timeout: 20000 })
      const corpo = await page.locator('main').innerText()
      expect(corpo).not.toContain('R$ 0,00')
      expect(corpo).not.toContain('Estes números são reais')
      await expect(page.getByText('Repasses / Saques (—)')).toBeVisible()
      await expect(page.getByText(/modo de teste|Fase 4/i).first()).toBeVisible()
      await shot(page, `4-${v.nome}`)
    })

    test('4b financeiro feliz', async ({ page }) => {
      await entrar(page, v, '/admin/finance', SUPER, {
        '**/rest/v1/orders*': (r) => json(r, 200, [{ id: 'o1', total: 150, status: 'paid', payment_method: 'pix', created_at: iso(-dia), customer_name: 'Cliente', customer_email: 'c@teste.invalid', event_id: 'e1', platform_fee: 15 }]),
      })
      await expect(page.getByText('Repasses / Saques (0)')).toBeVisible({ timeout: 20000 })
      await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' })).toHaveCount(0)
      await expect(page.getByText('Estes números são')).toBeVisible()
      await shot(page, `4b-${v.nome}`)
    })

    test('5 analytics: user_activities 500', async ({ page }) => {
      await entrar(page, v, '/admin/analytics', SUPER, { '**/rest/v1/user_activities*': falha })
      const aviso = page.getByRole('alert').filter({ hasText: 'Não foi possível ler os dados agora' })
      await expect(aviso).toBeVisible({ timeout: 20000 })
      await shot(page, `5a-${v.nome}`)
      await page.getByRole('button', { name: 'Atividades recentes' }).click()
      await expect(aviso).toBeVisible()
      // o vazio pode aparecer junto do aviso (já visível acima), nunca sozinho
      await shot(page, `5b-${v.nome}`)
      await page.getByRole('button', { name: /Tráfego e audiência/ }).click()
      await expect(page.getByText('Não foi possível ler os dados agora')).toHaveCount(0)
      await shot(page, `5c-${v.nome}`)
    })

    test('6 cupons: fila de pedidos 500; e feliz', async ({ page }) => {
      await entrar(page, v, '/admin/coupons', SUPER, { '**/rest/v1/affiliate_coupon_requests*': falha })
      await page.getByRole('button', { name: /Pedidos dos afiliados/ }).first().click()
      await expect(page.getByRole('button', { name: /Pedidos dos afiliados \(—\)/ }).first()).toBeVisible({ timeout: 20000 })
      await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar os pedidos' })).toBeVisible()
      await expect(page.getByText(/Nenhum pedido/)).toHaveCount(0)
      await shot(page, `6-${v.nome}`)
    })

    test('6b cupons feliz', async ({ page }) => {
      await entrar(page, v, '/admin/coupons', SUPER)
      await page.getByRole('button', { name: /Pedidos dos afiliados/ }).first().click()
      await expect(page.getByRole('button', { name: /Pedidos dos afiliados \(0\)/ }).first()).toBeVisible({ timeout: 20000 })
      await expect(page.getByText(/Nenhum pedido/).first()).toBeVisible()
      await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' })).toHaveCount(0)
      await shot(page, `6b-${v.nome}`)
    })

    test('7 equipe: ficha 500 e ficha ausente', async ({ page }) => {
      const colega = { id: '22222222-2222-4222-8222-222222222222', full_name: 'Colega Admin', email: 'colega@teste.invalid', role: 'admin', admin_permissions: ['manage_events'], avatar_url: null, created_at: iso(-dia) }
      let rpcFicha: (r: Route) => unknown = falha
      await entrar(page, v, '/admin/team', SUPER, {
        '**/rest/v1/profiles?*role=eq.admin*': (r) => json(r, 200, [colega]),
        '**/rest/v1/rpc/colaborador_dados': (r) => rpcFicha(r),
      })
      await page.getByText('Colega Admin').first().click()
      await expect(page.getByText(/Não foi possível carregar o cadastro/)).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(/Sem cadastro de colaborador/)).toHaveCount(0)
      await shot(page, `7a-${v.nome}`)
      // contraste: ficha realmente ausente (200 vazio) mostra "Sem cadastro"
      rpcFicha = (r) => json(r, 200, [])
      await page.getByRole('button', { name: /Cancelar|Fechar/ }).first().click().catch(() => {})
      await page.reload()
      await page.getByText('Colega Admin').first().click()
      await expect(page.getByText(/Sem cadastro de colaborador/)).toBeVisible({ timeout: 15000 })
      await shot(page, `7b-${v.nome}`)
    })

    test('8 configurações: leitura 500; e feliz', async ({ page }) => {
      await entrar(page, v, '/admin/settings', SUPER, { '**/rest/v1/platform_settings*': falha })
      await expect(page.getByRole('alert').filter({ hasText: 'Recarregue a página' })).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('button', { name: 'Salvar' }).first()).toBeDisabled()
      await shot(page, `8-${v.nome}`)
    })

    test('8b configurações feliz', async ({ page }) => {
      await entrar(page, v, '/admin/settings', SUPER, { '**/rest/v1/platform_settings*': (r) => r.request().method() === 'GET' ? json(r, 200, [{ key: 'general', value: { platformName: 'Evokaa' } }]) : json(r, 200, [{ id: 1 }]) })
      await expect(page.getByRole('button', { name: 'Salvar' }).first()).toBeEnabled({ timeout: 15000 })
      await expect(page.getByRole('alert').filter({ hasText: 'Recarregue a página' })).toHaveCount(0)
      await page.getByRole('button', { name: 'Salvar' }).first().click()
      await expect(page.getByText('Configurações salvas com sucesso!')).toBeVisible()
      await shot(page, `8b-${v.nome}`)
    })
  })
}
