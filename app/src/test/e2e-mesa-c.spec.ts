import { test, expect, type Page } from '@playwright/test'

// PR C do Match de Mesa (painel do produtor e moderação no admin). As funções do banco
// (docs/sql/20261003_mesa_coletiva.sql, PR #77) ainda não existem em produção: page.route devolve
// respostas no formato exato delas. Contas de demonstração (só em desenvolvimento).

const BASE = process.env.PW_BASE_URL || 'http://localhost:3000'
const ALPHA = process.env.PW_ALPHA_URL || BASE.replace('//localhost', '//alpha.localhost')
const PRODUTOR = 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4' // produtor@aura.teste
const EVENTO = 'e0000000-0000-4000-8000-0000000000e1'
const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='
const T1 = 'a0000000-0000-4000-8000-000000000001'
const T2 = 'b0000000-0000-4000-8000-000000000002'

const EVENTO_ROW = {
  id: EVENTO, producer_id: PRODUTOR, title: 'Noite de teste', slug: 'noite-de-teste', description: 'Evento de teste',
  date: '2026-12-15', time: '21:00', status: 'published', approval_status: 'approved', venue_name: 'Local de teste', city: 'São Paulo',
  cover_image: null, image_url: null, created_at: '2026-10-01T00:00:00Z', profiles: { full_name: 'Produtor Teste', email: 'produtor@aura.teste' },
  ticket_types: [
    { id: 'e0000000-0000-4000-8000-0000000000c0', event_id: EVENTO, name: 'Pista', description: '', price: 50, capacity: 100, sold: 0, type: 'individual', perks: [], is_active: true },
    { id: 'e0000000-0000-4000-8000-0000000000c1', event_id: EVENTO, name: 'Match de Mesa', description: '', price: 80, capacity: 60, sold: 0, type: 'coletiva', perks: [], is_active: true },
  ],
}

// O menu lateral do admin e do produtor é fixo e cobre a tela no celular (e2e-producer e e2e-admin-config
// também falham no Mobile Chrome, sem este PR): só no computador até existir o layout de celular.
test.skip(({ isMobile }) => isMobile, 'painel do admin e do produtor sem layout de celular')

type Resposta = unknown | ((body: Record<string, unknown>) => { status?: number; json: unknown })

// Uma rota para todas as funções: responde as conhecidas, deixa passar as outras. Guarda as chamadas.
async function mockRpc(page: Page, respostas: Record<string, Resposta>) {
  const chamadas: { nome: string; body: Record<string, unknown> }[] = []
  await page.route('**/rest/v1/rpc/**', async (route) => {
    const nome = new URL(route.request().url()).pathname.split('/rpc/')[1]
    if (!(nome in respostas)) return route.fallback()
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>
    chamadas.push({ nome, body })
    const r = respostas[nome]
    const out = typeof r === 'function' ? (r as (b: Record<string, unknown>) => { status?: number; json: unknown })(body) : { json: r }
    await route.fulfill({ status: out.status ?? 200, contentType: 'application/json', body: JSON.stringify(out.json) })
  })
  return chamadas
}

const erro = (code: string, message: string) => ({ status: code === '42501' ? 403 : 400, json: { code, message, details: null, hint: null } })

async function mockEventos(page: Page, eventos: object[] = [EVENTO_ROW]) {
  await page.route('**/rest/v1/events?*', (route) => route.fulfill({ json: eventos }))
}

// A conta demo de admin não tem moderate_mesa nem super_admin: acrescenta na lista fixa dela
// (stores/authStore.ts, só em DEV) ao servir o módulo, sem mudar o app.
async function permissoesDemo(page: Page, extras: string[]) {
  await page.route('**/src/stores/authStore.ts*', async (route) => {
    const r = await route.fetch()
    const texto = await r.text()
    const novo = texto.replace(/\[(["'])manage_users\1/, (m) => `[${extras.map((e) => JSON.stringify(e)).join(', ')}, ${m.slice(1)}`)
    if (novo === texto) throw new Error('lista de permissões da conta demo não encontrada em authStore.ts')
    await route.fulfill({ response: r, body: novo })
  })
}

async function entrarAdmin(page: Page, extras: string[]) {
  await permissoesDemo(page, extras)
  await page.goto(`${ALPHA}/auth/login`)
  await page.getByPlaceholder('seu@email.com').fill('admin@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar/ }).first().click()
  await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 20000 })
}

async function entrarProdutor(page: Page) {
  await page.goto('/auth/login')
  await page.getByRole('button', { name: 'Produtor' }).click()
  await page.getByPlaceholder('seu@email.com').fill('produtor@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar como Produtor/ }).click()
  await expect(page).toHaveURL(/\/producer\/dashboard/)
}

test.describe('admin — Match de Mesa (moderate_mesa)', () => {
  test.beforeEach(async ({ page }) => {
    await mockEventos(page)
    await entrarAdmin(page, ['moderate_mesa'])
  })

  test('fotos: aprovar, recusar e hash antigo', async ({ page }) => {
    let fila = [
      { id: 'u1', nome: 'Ana Souza', foto: FOTO, hash: 'h-ana', situacao: 'pendente' },
      { id: 'u2', nome: 'Bruno Lima', foto: FOTO, hash: 'h-bruno', situacao: 'revisar' },
      { id: 'u3', nome: 'Carla Dias', foto: 'https://exemplo.invalido/foto.jpg', hash: 'h-carla', situacao: 'pendente' },
    ]
    const chamadas = await mockRpc(page, {
      mesa_fotos_para_revisar: () => ({ json: fila }),
      mesa_foto_decidir: (b) => {
        if (b.p_hash === 'h-carla') return { json: false } // a pessoa trocou a foto depois da fila
        fila = fila.filter((f) => f.id !== b.p_user)
        return { json: true }
      },
    })
    await page.goto(`${ALPHA}/admin/match-de-mesa`)
    await expect(page.getByRole('heading', { name: 'Match de Mesa' })).toBeVisible()
    // menu do admin com o item novo
    await expect(page.getByRole('link', { name: /Match de Mesa/ })).toBeVisible()

    await expect(page.getByText('Ana Souza')).toBeVisible()
    await expect(page.getByText('Revisar (dúvida da IA)')).toBeVisible()
    // só base64 JPEG vira <img>
    await expect(page.getByRole('img', { name: 'Foto de Ana Souza' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Foto de Carla Dias' })).toHaveCount(0)
    await expect(page.locator('img[src^="https://exemplo.invalido"]')).toHaveCount(0)

    const linha = (nome: string) => page.locator('div.rounded-xl', { hasText: nome }).filter({ has: page.getByRole('button', { name: 'Aprovar' }) })
    await linha('Ana Souza').getByRole('button', { name: 'Aprovar' }).click()
    await expect(page.getByText('Foto aprovada.')).toBeVisible()
    await expect(page.getByText('Ana Souza')).toHaveCount(0)

    await linha('Bruno Lima').getByRole('button', { name: 'Recusar' }).click()
    await expect(page.getByText('Foto recusada.')).toBeVisible()

    await linha('Carla Dias').getByRole('button', { name: 'Aprovar' }).click()
    await expect(page.getByText('A pessoa trocou a foto; atualize a lista.')).toBeVisible()

    expect(chamadas.filter((c) => c.nome === 'mesa_foto_decidir').map((c) => c.body)).toEqual([
      { p_user: 'u1', p_hash: 'h-ana', p_aprovada: true },
      { p_user: 'u2', p_hash: 'h-bruno', p_aprovada: false },
      { p_user: 'u3', p_hash: 'h-carla', p_aprovada: true },
    ])
  })

  test('denúncias: mudar status e liberar para a organização; detalhe em texto puro', async ({ page }) => {
    const denuncia = {
      id: 'd1', criado_em: '2026-12-15T23:00:00Z', motivo: 'assedio', detalhe: '<b id="injetado">oi</b> na mesa', status: 'aberta',
      mesa: 'Mesa 3', denunciante: 'Ana Souza', denunciado: 'Bruno Lima', mesma_mesa: true,
      sobreposicao_inicio: '2026-12-15T21:00:00Z', sobreposicao_fim: '2026-12-15T22:30:00Z', status_mudado_em: null, liberada_produtor_em: null as string | null,
    }
    const chamadas = await mockRpc(page, {
      mesa_fotos_para_revisar: [],
      mesa_denuncias_do_evento: () => ({ json: [denuncia] }),
      mesa_denuncia_status: (b) => { denuncia.status = b.p_status as string; return { json: null } },
      mesa_denuncia_liberar: () => { denuncia.liberada_produtor_em = '2026-12-16T10:00:00Z'; return { json: null } },
    })
    await page.goto(`${ALPHA}/admin/match-de-mesa`)
    await page.getByRole('tab', { name: 'Denúncias' }).click()
    await page.getByLabel('Evento').selectOption(EVENTO)

    await expect(page.getByText('Bruno Lima', { exact: true })).toBeVisible()
    await expect(page.getByText(/Denunciado por Ana Souza/)).toBeVisible()
    await expect(page.getByText('<b id="injetado">oi</b> na mesa')).toBeVisible()
    await expect(page.locator('#injetado')).toHaveCount(0)

    await page.getByLabel('Status da denúncia contra Bruno Lima').selectOption('em_apuracao')
    await expect(page.getByText('Status atualizado.')).toBeVisible()

    await page.getByRole('button', { name: 'Liberar para a organização' }).click()
    await expect(page.getByText(/A organização verá o denunciado, o motivo e a mesa/)).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar liberação' }).click()
    await expect(page.getByText('Denúncia liberada para a organização.')).toBeVisible()
    await expect(page.getByText(/Liberada para a organização em/)).toBeVisible()

    expect(chamadas.find((c) => c.nome === 'mesa_denuncias_do_evento')?.body).toEqual({ p_event_id: EVENTO })
    expect(chamadas.filter((c) => c.nome.startsWith('mesa_denuncia_')).map((c) => [c.nome, c.body])).toEqual([
      ['mesa_denuncia_status', { p_id: 'd1', p_status: 'em_apuracao' }],
      ['mesa_denuncia_liberar', { p_id: 'd1' }],
    ])
  })

  test('remoções: desfazer com confirmação na tela', async ({ page }) => {
    const trava = {
      id: 'tr1', pessoa: 'Bruno Lima', motivo: 'comportamento_no_local', detalhe: null, por: 'Produtor Teste',
      em: '2026-12-15T23:30:00Z', destravada_em: null as string | null, destravada_por: null as string | null,
    }
    const chamadas = await mockRpc(page, {
      mesa_fotos_para_revisar: [],
      mesa_travas_do_evento: () => ({ json: [trava] }),
      mesa_destravar: () => { trava.destravada_em = '2026-12-16T09:00:00Z'; trava.destravada_por = 'Admin Teste'; return { json: null } },
    })
    await page.goto(`${ALPHA}/admin/match-de-mesa`)
    await page.getByRole('tab', { name: 'Remoções' }).click()
    await page.getByLabel('Evento').selectOption(EVENTO)
    await expect(page.getByText('Bruno Lima', { exact: true })).toBeVisible()
    await expect(page.getByText(/Comportamento no local/)).toBeVisible()

    await page.getByRole('button', { name: 'Desfazer' }).click()
    await page.getByRole('button', { name: 'Cancelar' }).click()
    expect(chamadas.some((c) => c.nome === 'mesa_destravar')).toBe(false)

    await page.getByRole('button', { name: 'Desfazer' }).click()
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
    await expect(page.getByText('Remoção desfeita.')).toBeVisible()
    await expect(page.getByText(/Desfeita em .* por Admin Teste/)).toBeVisible()
    expect(chamadas.find((c) => c.nome === 'mesa_destravar')?.body).toEqual({ p_event_id: EVENTO, p_trava_id: 'tr1' })
  })

  test('sessão sem 2FA: 42501 com o botão para ativar', async ({ page }) => {
    await mockRpc(page, { mesa_fotos_para_revisar: () => erro('42501', 'Ative o 2FA para moderar') })
    await page.goto(`${ALPHA}/admin/match-de-mesa`)
    const alerta = page.getByRole('alert').filter({ hasText: 'Ative o 2FA para moderar.' })
    await expect(alerta).toBeVisible()
    await expect(alerta.getByRole('button', { name: 'Ativar o 2FA agora' })).toBeVisible()
  })
})

test('admin — Equipe mostra a permissão "Moderar Match de Mesa"', async ({ page }) => {
  await page.route('**/rest/v1/profiles?*', (route) => route.request().method() === 'GET'
    ? route.fulfill({ json: [{ id: 'p-outro', email: null, full_name: 'Moderadora Teste', avatar_url: null, role: 'admin', admin_permissions: [], updated_at: null }] })
    : route.fallback())
  await entrarAdmin(page, ['super_admin', 'manage_team'])
  await page.goto(`${ALPHA}/admin/team`)
  await page.getByText('Moderadora Teste').click()
  await expect(page.getByText('Moderar Match de Mesa')).toBeVisible()
  await expect(page.getByText('Aprova fotos de perfil, faz a triagem de denúncias e revisa remoções. Exige 2FA.')).toBeVisible()
})

test.describe('produtor — Match de Mesa no evento', () => {
  test.beforeEach(async ({ page }) => {
    await mockEventos(page)
    await entrarProdutor(page)
  })

  test('formar mesas, lista, remover com motivo ("outro" exige detalhe) e denúncias liberadas', async ({ page }) => {
    let mesas = [
      { numero: 1, nome: 'Mesa 1', capacidade: 6, membros: [{ nome: 'Ana Souza', ingresso: T1 }, { nome: 'Bruno Lima', ingresso: T2 }] },
      { numero: 2, nome: 'Mesa 2', capacidade: 6, membros: [] as { nome: string; ingresso: string }[] },
    ]
    const chamadas = await mockRpc(page, {
      mesas_do_evento: () => ({ json: mesas }),
      formar_mesas: () => ({ json: 3 }),
      mesa_denuncias_do_evento: [{ denunciado: 'Bruno Lima', motivo: 'perfil_falso', mesa: 'Mesa 1' }],
      mesa_remover_membro: (b) => {
        mesas = mesas.map((m) => ({ ...m, membros: m.membros.filter((p) => p.ingresso !== b.p_ticket_id) }))
        return { json: null }
      },
    })
    await page.goto(`/producer/events/${EVENTO}/edit`)
    const painel = page.getByRole('region', { name: 'Match de Mesa' })
    await expect(painel).toBeVisible()
    await expect(painel.getByText(/quem já escolheu a mesa fica nela, e os demais completam as mesas com vaga/)).toBeVisible()

    await painel.getByRole('button', { name: 'Formar mesas agora' }).click()
    await expect(page.getByText('3 pessoas entraram nas mesas.')).toBeVisible()

    await expect(painel.getByRole('heading', { name: /^Mesa 1/ })).toBeVisible()
    await expect(painel.getByText('· 2/6 lugares')).toBeVisible()
    await expect(painel.getByText('Ana Souza')).toBeVisible()
    await expect(painel.getByText(`ingresso ${T1.slice(0, 8)}`)).toBeVisible()
    await expect(painel.getByText('Mesa vazia.')).toBeVisible()

    // denúncias liberadas: só denunciado, motivo e mesa
    await expect(painel.getByText('Denúncias liberadas pela moderação')).toBeVisible()
    await expect(painel.locator('li', { hasText: 'Perfil falso' })).toHaveText('Bruno Lima · Perfil falso · Mesa 1')

    const ana = painel.locator('li', { hasText: 'Ana Souza' })
    await ana.getByRole('button', { name: 'Remover da mesa' }).click()
    await expect(ana.getByText(/Não escreva dados de saúde ou de terceiros/)).toBeVisible()
    const confirmar = ana.getByRole('button', { name: 'Confirmar remoção' })
    await expect(confirmar).toBeDisabled() // sem motivo
    await ana.getByLabel('Motivo').selectOption('outro')
    await expect(confirmar).toBeDisabled() // "outro" sem detalhe
    await ana.getByLabel(/Detalhe/).fill('ab')
    await expect(confirmar).toBeDisabled() // menos de 3 caracteres
    await ana.getByLabel(/Detalhe/).fill('Pediu para trocar de lugar')
    await confirmar.click()
    await expect(page.getByText('Pessoa removida da mesa.')).toBeVisible()
    await expect(painel.getByText('Ana Souza')).toHaveCount(0)

    const bruno = painel.locator('li', { hasText: 'Bruno Lima' }).filter({ has: page.getByRole('button') })
    await bruno.getByRole('button', { name: 'Remover da mesa' }).click()
    await bruno.getByLabel('Motivo').selectOption('comportamento_no_local')
    await bruno.getByRole('button', { name: 'Confirmar remoção' }).click() // detalhe opcional fora de "outro"
    await expect(painel.locator('li', { hasText: 'Bruno Lima' }).filter({ has: page.getByRole('button') })).toHaveCount(0)

    expect(chamadas.filter((c) => c.nome === 'formar_mesas').map((c) => c.body)).toEqual([{ p_event_id: EVENTO }])
    expect(chamadas.filter((c) => c.nome === 'mesa_remover_membro').map((c) => c.body)).toEqual([
      { p_event_id: EVENTO, p_ticket_id: T1, p_motivo: 'outro', p_detalhe: 'Pediu para trocar de lugar' },
      { p_event_id: EVENTO, p_ticket_id: T2, p_motivo: 'comportamento_no_local', p_detalhe: null },
    ])
  })

  test('evento sem ingresso coletiva não mostra o painel', async ({ page }) => {
    await page.unroute('**/rest/v1/events?*')
    await mockEventos(page, [{ ...EVENTO_ROW, ticket_types: [EVENTO_ROW.ticket_types[0]] }])
    const chamadas = await mockRpc(page, { mesas_do_evento: [], mesa_denuncias_do_evento: [] })
    await page.goto(`/producer/events/${EVENTO}/edit`)
    await expect(page.getByText('Editar Evento')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Match de Mesa' })).toHaveCount(0)
    expect(chamadas).toEqual([])
  })
})
