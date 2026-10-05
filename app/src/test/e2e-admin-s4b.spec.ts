import { test, expect, type Page, type Route } from '@playwright/test'

// S4b: o front não lê mais a tabela profiles inteira. Perfil próprio por rpc meu_perfil; Equipe por admin_equipe;
// Atendimento por chat_atendentes; Usuários por admin_usuarios_lista; Checkout não grava nascimento sem saber.
// Sessão com JWT válido injetada + PostgREST simulado por page.route. Nada vai ao banco real; nenhuma senha.
// Rodar: PW_CHANNEL=chrome PW_BASE_URL=http://localhost:3215 npx playwright test e2e-admin-s4b --project=chromium --workers=2
const BASE = process.env.PW_BASE_URL || 'http://localhost:3000'
const ALPHA = process.env.PW_ALPHA_URL || BASE.replace('//localhost', '//alpha.localhost')
const APP = process.env.PW_APP_URL || BASE.replace('//localhost', '//app.localhost')
const VARIANTES = [
  { nome: 'desk-claro', w: 1440, h: 900, tema: 'light' },
  { nome: 'desk-escuro', w: 1440, h: 900, tema: 'dark' },
  { nome: 'cel-claro', w: 390, h: 844, tema: 'light' },
  { nome: 'cel-escuro', w: 390, h: 844, tema: 'dark' },
]
type V = typeof VARIANTES[number]
const UID = '11111111-1111-4111-8111-111111111111'
const TODAS = ['manage_users', 'manage_affiliates', 'manage_events', 'manage_finance', 'view_analytics', 'manage_tickets', 'manage_newsletter',
  'manage_coupons', 'manage_team', 'manage_feedback', 'manage_support', 'moderate_mesa', 'manage_settings']
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const json = (r: Route, status: number, body: unknown) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const E500 = { code: 'XX000', message: 'falha simulada', details: null, hint: null }
const E404 = { code: 'PGRST202', message: 'Could not find the function public.meu_perfil without parameters in the schema cache', details: null, hint: null }
const E42501 = { code: '42501', message: 'permission denied for function', details: null, hint: null }

type Rota = (r: Route) => unknown
type Opc = { host?: 'alpha' | 'app'; rota: string; perfil?: Rota | object; rpcs?: Record<string, Rota>; rest?: Record<string, Rota> }

// erros de JavaScript da página (a tela não pode quebrar)
const erros = (page: Page) => { const l: string[] = []; page.on('pageerror', (e) => l.push(e.message)); return l }

async function abrir(page: Page, v: V, o: Opc) {
  const exp = Math.floor(Date.now() / 1000) + 36000
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'conta@teste.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ aal: 'aal2', sub: UID, role: 'authenticated', exp })}.sig`
  const sess = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 36000, expires_at: exp, user }
  await page.setViewportSize({ width: v.w, height: v.h })
  await page.addInitScript(([t, s]) => { localStorage.setItem('evokaa-theme', t as string); localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(s)) }, [v.tema, sess])
  await page.route('**/auth/v1/**', (r) => json(r, 200, user))
  await page.route('**/functions/v1/**', (r) => json(r, 200, {}))
  await page.route('**/rest/v1/**', (r) => json(r, 200, []))
  await page.route('**/rest/v1/rpc/**', (r) => json(r, 200, []))
  for (const [p, fn] of Object.entries(o.rest ?? {})) await page.route(`**/rest/v1/${p}`, (r) => fn(r))
  for (const [n, fn] of Object.entries(o.rpcs ?? {})) await page.route(`**/rest/v1/rpc/${n}*`, (r) => fn(r))
  const perfil = o.perfil
  await page.route('**/rest/v1/rpc/meu_perfil*', (r) => (typeof perfil === 'function' ? perfil(r) : json(r, 200, perfil ?? PERFIL_ADMIN)))
  await page.goto(`${o.host === 'app' ? APP : ALPHA}${o.rota}`)
}
const PERFIL_ADMIN = { id: UID, full_name: 'Admin S4b', email: 'conta@teste.invalid', role: 'admin', admin_permissions: TODAS, is_authorized: true, avatar_url: null, phone: '+5511999990000', birth_date: null }
const perfil = (role: string, extra: object = {}) => ({ id: UID, full_name: `Conta ${role}`, email: 'conta@teste.invalid', role, admin_permissions: [], is_authorized: true, avatar_url: null, is_verified: true, ...extra })
const shot = (page: Page, n: string) => page.screenshot({ path: `test-results/s4b-${n}.png`, fullPage: true })
const semRolagemLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
const texto = (page: Page) => page.evaluate(() => document.body.innerText)
const abrirMenu = async (page: Page, v: V) => { if (v.w < 1024) await page.getByRole('button', { name: 'Abrir menu' }).click() }

const EQUIPE = [
  { id: 'aa000000-0000-4000-8000-000000000001', full_name: 'Ana Super', email: 'ana@teste.invalid', avatar_url: null, role: 'admin', admin_permissions: ['super_admin'] },
  { id: 'aa000000-0000-4000-8000-000000000002', full_name: 'Beto Suporte', email: 'beto@teste.invalid', avatar_url: null, role: 'admin', admin_permissions: ['manage_support', 'manage_users'] },
]
const USUARIOS = [
  { id: 'bb000000-0000-4000-8000-000000000001', email: 'carla@teste.invalid', full_name: 'Carla Participante', phone: '+5511987650001', role: 'user', created_at: '2026-09-01T12:00:00Z', avatar_url: null, producer_subscriptions: null, user_custom_features: [] },
  { id: 'bb000000-0000-4000-8000-000000000002', email: 'davi@teste.invalid', full_name: 'Davi Produtor', phone: '+5511987650002', role: 'producer', created_at: '2026-09-02T12:00:00Z', avatar_url: null,
    producer_subscriptions: [{ plan: 'pro', expires_at: '2027-01-01T00:00:00Z', is_active: true }], user_custom_features: [{ feature_key: 'recurso_x', expires_at: null }] },
]
const ATENDENTES = [{ id: 'aa000000-0000-4000-8000-000000000002', full_name: 'Beto Suporte', email: 'beto@teste.invalid' }, { id: UID, full_name: 'Admin S4b', email: 'conta@teste.invalid' }]

for (const v of VARIANTES) {
  test.describe(v.nome, () => {
    test('1 admin: menu completo com meu_perfil role admin', async ({ page }) => {
      const e = erros(page)
      await abrir(page, v, { rota: '/admin/dashboard' })
      await abrirMenu(page, v)
      const nav = page.getByRole('navigation', { name: 'Menu do admin' })
      for (const r of ['Dashboard', 'Usuários', 'Produtores', 'Afiliados Evokaa', 'Eventos', 'Financeiro', 'Analytics', 'Ingressos', 'Newsletter', 'Cupons', 'Equipe', 'Feedback', 'Atendimento', 'Match de Mesa', 'Conhecimento', 'IA / Evo', 'Configurações', 'Meu cadastro'])
        await expect(nav.getByText(r, { exact: true })).toBeVisible()
      await shot(page, `1-admin-menu-${v.nome}`)
      expect(e).toEqual([])
    })

    test('2a produtor: área do produtor', async ({ page }) => {
      const e = erros(page)
      await abrir(page, v, { host: 'app', rota: '/producer/dashboard', perfil: perfil('producer') })
      await expect(page).toHaveURL(/\/producer\/dashboard/)
      await expect(page.locator('main, [role=main], body').first()).toContainText(/Produtor|evento|Painel|Dashboard|Visão/i)
      await shot(page, `2a-produtor-${v.nome}`)
      expect(await semRolagemLateral(page)).toBe(true)
      expect(e).toEqual([])
    })

    test('2b participante: área do participante', async ({ page }) => {
      const e = erros(page)
      await abrir(page, v, { host: 'app', rota: '/app/hub', perfil: perfil('user', { birth_date: '1990-01-01' }) })
      await expect(page).toHaveURL(/\/app\/hub/)
      await expect(page.locator('body')).toContainText(/ingresso|Meus|Olá|Hub|evento/i)
      await shot(page, `2b-participante-${v.nome}`)
      expect(await semRolagemLateral(page)).toBe(true)
      expect(e).toEqual([])
    })

    for (const [nome, erro, status] of [['500', E500, 500], ['404 PGRST202', E404, 404]] as const) {
      test(`3 meu_perfil com erro ${nome}: admin (alpha) e participante (app) não quebram`, async ({ page }) => {
        const e = erros(page)
        await abrir(page, v, { rota: '/admin/dashboard', perfil: (r) => json(r, status, erro) })
        await page.waitForTimeout(1500)
        const urlAlpha = page.url()
        const txtAlpha = (await texto(page)).replace(/\s+/g, ' ').slice(0, 200)
        console.log(`[3 ${nome} ${v.nome}] alpha -> ${urlAlpha} | "${txtAlpha}"`)
        await shot(page, `3-${nome.slice(0, 3)}-alpha-${v.nome}`)
        expect((await texto(page)).trim().length).toBeGreaterThan(0)
        expect(urlAlpha).not.toMatch(/\/admin\/dashboard$/) // sem papel confirmado o admin NÃO pode ver o painel

        await page.goto(`${APP}/app/hub`)
        await page.waitForTimeout(1500)
        console.log(`[3 ${nome} ${v.nome}] app -> ${page.url()} | "${(await texto(page)).replace(/\s+/g, ' ').slice(0, 200)}"`)
        await shot(page, `3-${nome.slice(0, 3)}-app-${v.nome}`)
        expect((await texto(page)).trim().length).toBeGreaterThan(0)
        expect(await semRolagemLateral(page)).toBe(true)
        expect(e).toEqual([])
      })
    }

    test('4a Equipe: lista, vazio, 42501', async ({ page }) => {
      const e = erros(page)
      await abrir(page, v, { rota: '/admin/team', rpcs: { admin_equipe: (r) => json(r, 200, EQUIPE) } })
      await expect(page.getByText('Ana Super')).toBeVisible()
      await expect(page.getByText('Beto Suporte')).toBeVisible()
      expect(await semRolagemLateral(page)).toBe(true)
      await shot(page, `4a-equipe-lista-${v.nome}`)
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await abrir(page, v, { rota: '/admin/team', rpcs: { admin_equipe: (r) => json(r, 200, []) } })
      await expect(page.getByText('Nenhum colaborador cadastrado.')).toBeVisible()
      expect(await semRolagemLateral(page)).toBe(true)
      await shot(page, `4a-equipe-vazio-${v.nome}`)
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await abrir(page, v, { rota: '/admin/team', rpcs: { admin_equipe: (r) => json(r, 403, E42501) } })
      await expect(page.getByText(/Não foi possível carregar a equipe/)).toBeVisible()
      console.log(`[4a 42501 ${v.nome}] "${(await page.getByText(/Não foi possível carregar a equipe/).innerText()).trim()}"`)
      expect(await semRolagemLateral(page)).toBe(true)
      await shot(page, `4a-equipe-42501-${v.nome}`)
      expect(e).toEqual([])
    })

    test('4b Usuários: lista com telefone, vazio, 42501', async ({ page }) => {
      const e = erros(page)
      await abrir(page, v, { rota: '/admin/users', rpcs: { admin_usuarios_lista: (r) => json(r, 200, USUARIOS) } })
      await expect(page.getByText('Carla Participante')).toBeVisible()
      await expect(page.getByText('Davi Produtor')).toBeVisible()
      if (v.w >= 768) { // coluna de contato só aparece a partir de md
        await expect(page.getByText('+5511987650001')).toBeVisible()
        await expect(page.getByText('+5511987650002')).toBeVisible()
      } else console.log(`[4b ${v.nome}] telefone na lista: ${await page.getByText('+5511987650001').count() ? 'visível' : 'oculto (coluna md+)'}`)
      if (v.w >= 1024) { await expect(page.getByText('pro', { exact: true })).toBeVisible(); await expect(page.getByText('recurso_x')).toBeVisible() }
      expect(await semRolagemLateral(page)).toBe(true)
      await shot(page, `4b-usuarios-lista-${v.nome}`)
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await abrir(page, v, { rota: '/admin/users', rpcs: { admin_usuarios_lista: (r) => json(r, 200, []) } })
      await expect(page.getByText('Nenhum usuário encontrado com as configurações de busca.')).toBeVisible()
      expect(await semRolagemLateral(page)).toBe(true)
      await shot(page, `4b-usuarios-vazio-${v.nome}`)
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await abrir(page, v, { rota: '/admin/users', rpcs: { admin_usuarios_lista: (r) => json(r, 403, E42501) } })
      await expect(page.getByText(/Não foi possível carregar os usuários/)).toBeVisible()
      console.log(`[4b 42501 ${v.nome}] "${(await page.getByText(/Não foi possível carregar os usuários/).innerText()).trim()}"`)
      expect(await semRolagemLateral(page)).toBe(true)
      await shot(page, `4b-usuarios-42501-${v.nome}`)
      expect(e).toEqual([])
    })

    const INBOX = [{ id: 'c0000000-0000-4000-8000-000000000001', user_id: 'bb000000-0000-4000-8000-000000000001', status: 'open', priority: 'normal', assignee_id: null, department_name: 'Geral',
      topic_label: 'Dúvida', contact_name: 'Carla Participante', last_message_at: '2026-10-04T12:00:00Z', last_message_preview: 'Oi, preciso de ajuda', last_customer_message_at: '2026-10-04T12:00:00Z',
      last_reply_at: null, nao_lida: false, bot_state: 'humano', bot_resolveu: false }]
    const CONVERSA = { id: INBOX[0].id, user_id: INBOX[0].user_id, status: 'open', priority: 'normal', assignee_id: null, assignee_name: null, department_id: null, customer_last_read_at: null,
      agent_last_read_at: '2026-10-04T12:01:00Z', last_customer_message_at: '2026-10-04T12:00:00Z', created_at: '2026-10-04T11:59:00Z', rating: null, bot_state: 'humano', bot_resolveu: false,
      chat_topics: { label: 'Dúvida' }, chat_contacts: { name: 'Carla Participante', email: 'carla@teste.invalid', phone: null, origin: 'site', marketing_opt_in: false } }
    const atendimento = async (page: Page, atend: Rota) => {
      await abrir(page, v, { rota: '/admin/atendimento', rpcs: { chat_atendentes: atend, chat_inbox: (r) => json(r, 200, INBOX), chat_cliente_contexto: (r) => json(r, 200, { ingressos: [], pedidos: [], papel: 'user', plano: null }) },
        rest: { 'conversations?*': (r) => json(r, 200, (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object') ? CONVERSA : r.request().url().includes('id=eq.') ? [CONVERSA] : []) } })
      await page.getByRole('button', { name: /Carla Participante/ }).first().click()
      if (v.w < 1280) await page.getByRole('button', { name: /Detalhes/ }).first().click()
    }
    test('4c Atendimento: atendentes, vazio, 42501', async ({ page }) => {
      const e = erros(page)
      await atendimento(page, (r) => json(r, 200, ATENDENTES))
      const sel = page.locator('#atendimento-dono')
      await expect(sel).toBeVisible()
      await expect(sel.locator('option')).toHaveText(['Sem dono', 'Beto Suporte', 'Admin S4b (você)'])
      await shot(page, `4c-atendimento-lista-${v.nome}`)
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await atendimento(page, (r) => json(r, 200, []))
      await expect(page.locator('#atendimento-dono option')).toHaveText(['Sem dono'])
      await expect(page.getByText(/Não foi possível carregar a lista de atendentes/)).toHaveCount(0)
      await shot(page, `4c-atendimento-vazio-${v.nome}`)
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      await atendimento(page, (r) => json(r, 403, E42501))
      await expect(page.getByText(/Não foi possível carregar a lista de atendentes/)).toBeVisible()
      console.log(`[4c 42501 ${v.nome}] "${(await page.getByText(/Não foi possível carregar a lista de atendentes/).innerText()).trim()}"`)
      expect(await semRolagemLateral(page)).toBe(true)
      await shot(page, `4c-atendimento-42501-${v.nome}`)
      expect(e).toEqual([])
    })

    // ---- 5 Checkout com Match de Mesa ----
    const EVENTO = 'e0000000-0000-4000-8000-0000000000e1'
    const TIPO = 'e0000000-0000-4000-8000-0000000000c1'
    const EVENTO_ROW = { id: EVENTO, producer_id: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4', title: 'Noite de teste', slug: 'noite-de-teste', description: 'x', date: '2026-12-15', time: '21:00', status: 'published',
      approval_status: 'approved', venue_name: 'Local de teste', city: 'São Paulo', cover_image: null, image_url: null }
    const INGRESSOS = [{ id: TIPO, event_id: EVENTO, name: 'Match de Mesa', description: 'Mesa', price: 80, capacity: 60, sold: 0, type: 'coletiva', perks: [], is_active: true }]
    const checkout = async (page: Page, p: Rota | object) => {
      const patches: unknown[] = []
      await abrir(page, v, { host: 'app', rota: '/', perfil: p,
        rpcs: { evento_publico: (r) => json(r, 200, { acesso: 'aberto', evento: EVENTO_ROW, ingressos: INGRESSOS }) },
        rest: { 'profiles?*': (r) => { if (r.request().method() === 'PATCH') { patches.push(r.request().postDataJSON()); return json(r, 200, [{ id: UID }]) } return json(r, 200, []) } } })
      await page.evaluate(([ev, t]) => sessionStorage.setItem('aura_pending_checkout', JSON.stringify({ eventId: ev, cart: { [t]: 1 } })), [EVENTO, TIPO] as const)
      await page.goto(`${APP}/checkout`)
      return patches
    }
    test('5a checkout: perfil sem data grava só { birth_date } (1 PATCH)', async ({ page }) => {
      const e = erros(page)
      const patches = await checkout(page, perfil('user', { birth_date: null }))
      await expect(page.getByRole('heading', { name: 'Match de Mesa: sua data de nascimento' })).toBeVisible()
      await page.getByLabel('Data de nascimento').fill('1995-06-15')
      await page.getByRole('button', { name: 'Salvar data' }).click()
      await expect(page.getByText('Data de nascimento salva no seu Perfil.')).toBeVisible()
      expect(patches).toEqual([{ birth_date: '1995-06-15' }])
      expect(await semRolagemLateral(page)).toBe(true)
      await shot(page, `5a-checkout-grava-${v.nome}`)
      expect(e).toEqual([])
    })
    test('5b checkout: perfil com data não pede nem sobrescreve (0 PATCH)', async ({ page }) => {
      const e = erros(page)
      const patches = await checkout(page, perfil('user', { birth_date: '1990-01-01' }))
      await expect(page.getByRole('button', { name: 'Continuar para Pagamento' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Match de Mesa: sua data de nascimento' })).toHaveCount(0)
      await page.waitForTimeout(500)
      expect(patches).toHaveLength(0)
      expect(await semRolagemLateral(page)).toBe(true)
      await shot(page, `5b-checkout-com-data-${v.nome}`)
      expect(e).toEqual([])
    })
    test('5c checkout: perfil que não carrega (meu_perfil 500) não grava e avisa (0 PATCH)', async ({ page }) => {
      const e = erros(page)
      const patches = await checkout(page, (r) => json(r, 500, E500))
      await page.getByLabel('Data de nascimento').fill('1995-06-15')
      await page.getByRole('button', { name: 'Salvar data' }).click()
      await expect(page.getByText('Aguarde o perfil terminar de carregar e tente de novo')).toBeVisible()
      expect(patches).toHaveLength(0)
      expect(await semRolagemLateral(page)).toBe(true)
      await shot(page, `5c-checkout-sem-perfil-${v.nome}`)
      expect(e).toEqual([])
    })
  })
}
