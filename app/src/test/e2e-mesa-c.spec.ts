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
const T3 = 'c0000000-0000-4000-8000-000000000003'

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
// A falha fica numa variável e o expect sai fora do handler (erro dentro do handler some no log da rota).
async function permissoesDemo(page: Page, extras: string[]) {
  const estado = { trocado: false, falha: '' }
  await page.route('**/src/stores/authStore.ts*', async (route) => {
    const r = await route.fetch()
    const texto = await r.text()
    const novo = texto.replace(/\[(["'])manage_users\1/, (m) => `[${extras.map((e) => JSON.stringify(e)).join(', ')}, ${m.slice(1)}`)
    if (novo === texto) estado.falha = 'lista de permissões da conta demo não encontrada em authStore.ts'
    else estado.trocado = true
    await route.fulfill({ response: r, body: novo })
  })
  return estado
}

// extras vazio = a conta demo como ela é (sem moderate_mesa)
async function entrarAdmin(page: Page, extras: string[]) {
  const estado = extras.length ? await permissoesDemo(page, extras) : null
  await page.goto(`${ALPHA}/auth/login`)
  await page.getByPlaceholder('seu@email.com').fill('admin@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar/ }).first().click()
  await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 20000 })
  if (estado) {
    expect(estado.falha).toBe('')
    expect(estado.trocado).toBe(true)
  }
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
      { id: 'u4', nome: 'Dora Reis', foto: FOTO, hash: 'h-dora', situacao: 'pendente' },
    ]
    const chamadas = await mockRpc(page, {
      mesa_fotos_para_revisar: () => ({ json: fila }),
      mesa_foto_decidir: (b) => {
        if (b.p_hash === 'h-dora') return { json: false } // a pessoa trocou a foto depois da fila
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

    // fora do formato do app: não aprova, só recusa
    await expect(linha('Carla Dias').getByRole('button', { name: 'Aprovar' })).toBeDisabled()
    await expect(linha('Carla Dias').getByRole('button', { name: 'Recusar' })).toBeEnabled()

    await linha('Dora Reis').getByRole('button', { name: 'Aprovar' }).click()
    await expect(page.getByText('A pessoa trocou a foto; atualize a lista.')).toBeVisible()

    expect(chamadas.filter((c) => c.nome === 'mesa_foto_decidir').map((c) => c.body)).toEqual([
      { p_user: 'u1', p_hash: 'h-ana', p_aprovada: true },
      { p_user: 'u2', p_hash: 'h-bruno', p_aprovada: false },
      { p_user: 'u4', p_hash: 'h-dora', p_aprovada: true },
    ])
  })

  test('fotos: decisão e motivos da IA em pt-BR e selo "Contestada pela pessoa"', async ({ page }) => {
    await mockRpc(page, {
      mesa_fotos_para_revisar: [
        { id: 'u1', nome: 'Ana Souza', foto: FOTO, hash: 'h-ana', situacao: 'revisar', contestada: true,
          ia: { decisao: 'recusada', motivos: ['nudez', 'texto_contato', 'famoso', 'bloqueio_seguranca'], em: '2026-10-02T15:30:00+00:00' } },
        { id: 'u2', nome: 'Bruno Lima', foto: FOTO, hash: 'h-bruno', situacao: 'pendente', contestada: false, ia: null },
      ],
    })
    await page.goto(`${ALPHA}/admin/match-de-mesa`)
    const linha = (nome: string) => page.locator('div.rounded-xl', { hasText: nome }).filter({ has: page.getByRole('button', { name: 'Aprovar' }) })

    await expect(linha('Ana Souza').getByText('Contestada pela pessoa')).toBeVisible()
    await expect(linha('Ana Souza').getByText(/IA recusou: nudez, contato escrito, parece pessoa pública, bloqueada pelo filtro do Google/)).toBeVisible()
    await expect(linha('Ana Souza').getByText('Revisar', { exact: true })).toBeVisible() // não é "dúvida da IA": foi contestada
    await expect(page.getByText(/texto_contato|bloqueio_seguranca/)).toHaveCount(0)

    await expect(linha('Bruno Lima').getByText('Pendente')).toBeVisible()
    await expect(linha('Bruno Lima').getByText(/Contestada|IA /)).toHaveCount(0)
  })

  test('denúncias: mudar status e liberar para a organização; detalhe em texto puro', async ({ page }) => {
    const denuncia = {
      id: 'd1', criado_em: '2026-12-15T23:00:00Z', motivo: 'assedio', detalhe: '<b id="injetado">oi</b> na mesa', status: 'aberta',
      mesa: 'Mesa 3', denunciante: 'Ana Souza', denunciado: 'Bruno Lima', mesma_mesa: true,
      sobreposicao_inicio: '2026-12-15T21:00:00Z', sobreposicao_fim: '2026-12-15T22:30:00Z', status_mudado_em: null, liberada_produtor_em: null as string | null,
      resultado: null as string | null, resultado_explicacao: null as string | null,
    }
    const chamadas = await mockRpc(page, {
      mesa_fotos_para_revisar: [],
      mesa_denuncias_do_evento: () => ({ json: [denuncia] }),
      mesa_denuncia_status: (b) => {
        denuncia.status = b.p_status as string
        denuncia.resultado = (b.p_resultado as string) ?? null
        denuncia.resultado_explicacao = (b.p_explicacao as string) ?? null
        return { json: null }
      },
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

    // resolvida pede resultado e explicação (10 a 1000 caracteres); só então vai ao banco
    await page.getByLabel('Status da denúncia contra Bruno Lima').selectOption('resolvida')
    const confirmarResolucao = page.getByRole('button', { name: 'Confirmar resolução' })
    await expect(page.getByText(/Explique por que está resolvida/)).toBeVisible()
    await expect(confirmarResolucao).toBeDisabled() // faltam os dois
    await expect(page.getByLabel(/Procedente \(a denúncia era verdadeira\)/)).toBeFocused() // o foco vai para a primeira opção
    await expect(confirmarResolucao).toHaveAttribute('aria-describedby', 'resolver-falta-d1')
    await expect(page.locator('#resolver-falta-d1')).toHaveText('Falta escolher o resultado.')
    await page.getByLabel(/Procedente \(a denúncia era verdadeira\)/).check()
    await expect(confirmarResolucao).toBeDisabled() // falta a explicação
    await expect(page.locator('#resolver-falta-d1')).toHaveText(/^Falta a explicação/)
    await page.getByLabel(/Explique por que está resolvida/).fill('curta')
    await expect(confirmarResolucao).toBeDisabled() // menos de 10 caracteres
    await page.getByLabel(/Explique por que está resolvida/).fill('Confirmado pelo produtor no local')
    await confirmarResolucao.click()
    await expect(page.getByText('Procedente', { exact: true })).toBeVisible()
    await expect(page.getByText(/Confirmado pelo produtor no local/)).toBeVisible()

    await page.getByRole('button', { name: 'Liberar para a organização' }).click()
    await expect(page.getByText(/A organização verá o denunciado, o motivo e a mesa/)).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar liberação' }).click()
    await expect(page.getByText('Denúncia liberada para a organização.')).toBeVisible()
    await expect(page.getByText(/Liberada para a organização em/)).toBeVisible()

    expect(chamadas.find((c) => c.nome === 'mesa_denuncias_do_evento')?.body).toEqual({ p_event_id: EVENTO })
    expect(chamadas.filter((c) => c.nome.startsWith('mesa_denuncia_')).map((c) => [c.nome, c.body])).toEqual([
      ['mesa_denuncia_status', { p_id: 'd1', p_status: 'em_apuracao' }],
      ['mesa_denuncia_status', { p_id: 'd1', p_status: 'resolvida', p_resultado: 'procedente', p_explicacao: 'Confirmado pelo produtor no local' }],
      ['mesa_denuncia_liberar', { p_id: 'd1' }],
    ])
  })

  test('explicação do resultado em texto puro; 23514 mostra a mensagem genérica', async ({ page }) => {
    const denuncia = {
      id: 'd2', criado_em: '2026-12-15T23:00:00Z', motivo: 'outro', detalhe: null, status: 'resolvida',
      mesa: 'Mesa 3', denunciante: 'Ana Souza', denunciado: 'Bruno Lima', mesma_mesa: false,
      sobreposicao_inicio: null, sobreposicao_fim: null, status_mudado_em: null, liberada_produtor_em: null,
      resultado: 'improcedente', resultado_explicacao: '<b id="injetado2">não</b> se confirmou',
    }
    const aberta = { ...denuncia, id: 'd3', denunciado: 'Carla Dias', status: 'aberta', resultado: null, resultado_explicacao: null }
    const chamadas = await mockRpc(page, {
      mesa_fotos_para_revisar: [],
      mesa_denuncias_do_evento: [denuncia, aberta],
      mesa_denuncia_status: (b) => (b.p_status === 'em_apuracao' ? { json: null } : erro('23514', 'new row for relation "mesa_denuncias" violates check constraint')),
    })
    await page.goto(`${ALPHA}/admin/match-de-mesa`)
    await page.getByRole('tab', { name: 'Denúncias' }).click()
    await page.getByLabel('Evento').selectOption(EVENTO)
    await expect(page.getByText('<b id="injetado2">não</b> se confirmou', { exact: false })).toBeVisible()
    await expect(page.locator('#injetado2')).toHaveCount(0)

    // reabrir uma denúncia que estava improcedente avisa que a remoção desfeita não volta sozinha
    await page.getByLabel('Status da denúncia contra Bruno Lima').selectOption('em_apuracao')
    await expect(page.getByText('A remoção desfeita não volta sozinha; se for o caso, remova de novo pelo painel.')).toBeVisible()

    // caracteres de direção são tirados antes de enviar; o erro 23514 do banco vira a mensagem genérica
    await page.getByLabel('Status da denúncia contra Carla Dias').selectOption('resolvida')
    await page.getByLabel(/Improcedente \(a denúncia não se confirmou\)/).check()
    await page.getByLabel(/Explique por que está resolvida/).fill('Não se confirmou \u202E no local')
    await page.getByRole('button', { name: 'Confirmar resolução' }).click()
    await expect(page.getByText('Texto fora do tamanho permitido ou com caractere não aceito.')).toBeVisible()
    expect(chamadas.filter((c) => c.nome === 'mesa_denuncia_status').map((c) => c.body)).toEqual([
      { p_id: 'd2', p_status: 'em_apuracao' },
      { p_id: 'd3', p_status: 'resolvida', p_resultado: 'improcedente', p_explicacao: 'Não se confirmou  no local' },
    ])
  })

  test('remoções: desfazer com confirmação na tela', async ({ page }) => {
    const trava = {
      id: 'tr1', pessoa: 'Bruno Lima', motivo: 'comportamento_no_local', detalhe: null, por: 'Produtor Teste',
      em: '2026-12-15T23:30:00Z', destravada_em: null as string | null, destravada_por: null as string | null,
      denuncia_motivo: 'assedio', denuncia_resultado: 'procedente',
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
    await expect(page.getByText('Denúncia procedente')).toBeVisible()

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

  test('42501 "Acesso negado" mostra a falta de permissão', async ({ page }) => {
    await mockRpc(page, { mesa_fotos_para_revisar: () => erro('42501', 'Acesso negado') })
    await page.goto(`${ALPHA}/admin/match-de-mesa`)
    await expect(page.getByRole('alert').filter({ hasText: /^Sem permissão: só o produtor do evento/ })).toBeVisible()
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

test('admin sem moderate_mesa: sem item no menu e a rota volta ao dashboard', async ({ page }) => {
  await entrarAdmin(page, [])
  await page.goto(`${ALPHA}/admin/dashboard`)
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Match de Mesa/ })).toHaveCount(0)
  await page.goto(`${ALPHA}/admin/match-de-mesa`)
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
})

test.describe('produtor — Match de Mesa no evento', () => {
  test.beforeEach(async ({ page }) => {
    await mockEventos(page)
    await entrarProdutor(page)
  })

  test('formar mesas, lista, remover com motivo ("outro" exige detalhe) e denúncias liberadas', async ({ page }) => {
    // Ana não tem denúncia liberada (sem botão); Bruno e Carla têm
    let mesas = [
      { numero: 1, nome: 'Mesa 1', capacidade: 6, membros: [
        { nome: 'Ana Souza', ingresso: T1, pode_remover: false },
        { nome: 'Bruno Lima', ingresso: T2, pode_remover: true },
        { nome: 'Carla Dias', ingresso: T3, pode_remover: true },
      ] },
      { numero: 2, nome: 'Mesa 2', capacidade: 6, membros: [] as { nome: string; ingresso: string; pode_remover: boolean }[] },
    ]
    const chamadas = await mockRpc(page, {
      mesas_do_evento: () => ({ json: mesas }),
      formar_mesas: () => ({ json: 3 }),
      mesa_denuncias_do_evento: [{ denunciado: 'Bruno Lima', motivo: 'perfil_falso', mesa: 'Mesa 1', resultado: 'procedente' }, { denunciado: 'Carla Dias', motivo: 'assedio', mesa: 'Mesa 1', resultado: null }],
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
    await painel.getByRole('button', { name: 'Cancelar' }).click()
    expect(chamadas.some((c) => c.nome === 'formar_mesas')).toBe(false)
    await painel.getByRole('button', { name: 'Formar mesas agora' }).click()
    await painel.getByRole('button', { name: 'Confirmar formação' }).click()
    await expect(page.getByText('3 pessoas entraram nas mesas.')).toBeVisible()

    await expect(painel.getByRole('heading', { name: /^Mesa 1/ })).toBeVisible()
    await expect(painel.getByText('· 3/6 lugares')).toBeVisible()
    await expect(painel.getByText('Ana Souza')).toBeVisible()
    await expect(painel.getByText(`ingresso ${T1.slice(0, 8)}`)).toBeVisible()
    await expect(painel.getByText('Mesa vazia.')).toBeVisible()

    // denúncias liberadas: só denunciado, motivo e mesa
    await expect(painel.getByText('Denúncias liberadas pela moderação')).toBeVisible()
    await expect(painel.locator('li', { hasText: 'Perfil falso' })).toHaveText('Bruno Lima · Perfil falso · Mesa 1 · Procedente')

    // sem denúncia liberada, sem botão de remover
    const ana = painel.locator('li', { hasText: 'Ana Souza' })
    await expect(ana.getByRole('button', { name: 'Remover da mesa' })).toHaveCount(0)
    await expect(ana.getByText('Sem denúncia que você possa usar')).toBeVisible()

    const bruno = painel.locator('li', { hasText: 'Bruno Lima' }).filter({ has: page.getByRole('button') })
    await bruno.getByRole('button', { name: 'Remover da mesa' }).click()
    await expect(bruno.getByText(/Não escreva dados de saúde ou de terceiros/)).toBeVisible()
    const confirmar = bruno.getByRole('button', { name: 'Confirmar remoção' })
    await expect(confirmar).toBeDisabled() // sem motivo
    await expect(bruno.getByRole('option', { name: 'Pedido da própria pessoa' })).toHaveCount(0) // sem denúncia não se remove; quem quer sair usa "sair da mesa"
    await bruno.getByLabel('Motivo').selectOption('outro')
    await expect(confirmar).toBeDisabled() // "outro" sem detalhe
    await bruno.getByLabel(/Detalhe/).fill('ab')
    await expect(confirmar).toBeDisabled() // menos de 3 caracteres
    await bruno.getByLabel(/Detalhe/).fill('Pediu para trocar de lugar')
    await confirmar.click()
    await expect(page.getByText('Pessoa removida da mesa.')).toBeVisible()
    await expect(painel.locator('li', { hasText: 'Bruno Lima' }).filter({ has: page.getByRole('button') })).toHaveCount(0)

    const carla = painel.locator('li', { hasText: 'Carla Dias' }).filter({ has: page.getByRole('button') })
    await carla.getByRole('button', { name: 'Remover da mesa' }).click()
    await carla.getByLabel('Motivo').selectOption('comportamento_no_local')
    await carla.getByRole('button', { name: 'Confirmar remoção' }).click() // detalhe opcional fora de "outro"
    await expect(painel.locator('li', { hasText: 'Carla Dias' }).filter({ has: page.getByRole('button') })).toHaveCount(0)

    expect(chamadas.filter((c) => c.nome === 'formar_mesas').map((c) => c.body)).toEqual([{ p_event_id: EVENTO }])
    expect(chamadas.filter((c) => c.nome === 'mesa_remover_membro').map((c) => c.body)).toEqual([
      { p_event_id: EVENTO, p_ticket_id: T2, p_motivo: 'outro', p_detalhe: 'Pediu para trocar de lugar' },
      { p_event_id: EVENTO, p_ticket_id: T3, p_motivo: 'comportamento_no_local', p_detalhe: null },
    ])
  })

  test('o banco recusa remover quem não tem denúncia (22023): mostra a mensagem', async ({ page }) => {
    await mockRpc(page, {
      mesas_do_evento: [{ numero: 1, nome: 'Mesa 1', capacidade: 6, membros: [{ nome: 'Ana Souza', ingresso: T1, pode_remover: true }] }],
      mesa_denuncias_do_evento: [],
      mesa_remover_membro: () => erro('22023', 'Só é possível remover quem tem denúncia neste evento'),
    })
    await page.goto(`/producer/events/${EVENTO}/edit`)
    const painel = page.getByRole('region', { name: 'Match de Mesa' })
    await painel.getByRole('button', { name: 'Remover da mesa' }).click()
    await painel.getByLabel('Motivo').selectOption('comportamento_no_local')
    await painel.getByRole('button', { name: 'Confirmar remoção' }).click()
    await expect(page.getByText('Só é possível remover quem tem denúncia neste evento.')).toBeVisible()
    await expect(painel.getByRole('button', { name: 'Confirmar remoção' })).toHaveCount(0) // o formulário fecha no erro
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

  test('evento de outro produtor não mostra o painel', async ({ page }) => {
    await page.unroute('**/rest/v1/events?*')
    await mockEventos(page, [{ ...EVENTO_ROW, producer_id: 'f0000000-0000-4000-8000-00000000000f' }])
    const chamadas = await mockRpc(page, { mesas_do_evento: [], mesa_denuncias_do_evento: [] })
    await page.goto(`/producer/events/${EVENTO}/edit`)
    await expect(page.getByText('Editar Evento')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Match de Mesa' })).toHaveCount(0)
    expect(chamadas).toEqual([])
  })

  test('42501 "Acesso negado" vira mensagem de permissão, não "entre de novo"', async ({ page }) => {
    await mockRpc(page, {
      mesas_do_evento: () => erro('42501', 'Acesso negado'),
      mesa_denuncias_do_evento: () => erro('42501', 'Acesso negado'),
    })
    await page.goto(`/producer/events/${EVENTO}/edit`)
    const painel = page.getByRole('region', { name: 'Match de Mesa' })
    await expect(painel.getByRole('alert').first()).toHaveText(/^Sem permissão: só o produtor do evento/)
    await expect(painel.getByText(/Entre de novo/)).toHaveCount(0)
  })
})
