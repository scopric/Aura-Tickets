import { test, expect, type Page } from '@playwright/test'

// PR B do Match de Mesa (lado do participante). As funções do banco (docs/sql/20261003_mesa_coletiva.sql,
// PR #77) ainda não existem em produção: page.route devolve respostas no formato exato delas.
// Conta de demonstração (só em desenvolvimento).

const DEMO = 'b2c3d4e5-f6a7-8901-bcde-f23456789012' // user@aura.teste
const EVENTO = 'e0000000-0000-4000-8000-0000000000e1'
const TIPO = 'e0000000-0000-4000-8000-0000000000c1'
const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='

const PERFIL_OK = {
  user_id: DEMO, temperament: 'ambivert', intention: 'fun', music_style: 'rock', energy_level: 'medium', vibe: 'Versátil',
  tags: { musica: ['rock', 'pop'], idiomas: ['ingles'] }, education: 'superior', social_url: null, quiz_completed_at: '2026-10-01T00:00:00Z',
  mesa_consent_version: '2026-10-03', mesa_consent_at: '2026-10-01T00:00:00Z', mesa_consent_revoked_at: null,
  rede_consent_at: null, rede_consent_revoked_at: null,
}

const cartao = (o: Record<string, unknown>) => ({
  id: null, nome: 'Lugar ocupado', faixa_idade: null, foto: null, perfil: null, tags: null, escolaridade: null, rede_social: null, ...o,
})

const MESA_COM_COLEGAS = {
  forma_em: '2026-12-14T21:00:00+00:00',
  saiu: false,
  mesas: [{
    nome: 'Mesa 3', capacidade: 6, colegas: [
      { ...cartao({ id: 'm-eu', nome: 'Usuario', faixa_idade: '25–34', foto: FOTO, perfil: 'Versátil', tags: PERFIL_OK.tags, escolaridade: 'superior' }), eu: true },
      { ...cartao({ id: 'm-ana', nome: 'Ana', faixa_idade: '25–34', foto: FOTO, perfil: 'Animador', tags: { musica: ['rock', 'funk'], comida: ['pizza'] }, escolaridade: 'pos', rede_social: 'https://instagram.com/ana.teste' }), eu: false },
      { ...cartao({ id: 'm-bruno', nome: 'Bruno' }), eu: false },
      { ...cartao({}), eu: false },
    ],
  }],
}

const TICKET = {
  id: 't1', order_id: 'o1', ticket_type_id: TIPO, user_id: DEMO, code: 'MESA-1', qr_code: 'MESA-1', status: 'active', seat_info: null,
  checked_in_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
  ticket_types: { name: 'Match de Mesa', price: 80, type: 'coletiva', events: { id: EVENTO, title: 'Noite de teste', cover_image: null, date: '2026-12-15', time: '21:00', venue_name: 'Local de teste' } },
}

const EVENTO_ROW = {
  id: EVENTO, producer_id: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4', title: 'Noite de teste', slug: 'noite-de-teste', description: 'Evento de teste',
  date: '2026-12-15', time: '21:00', status: 'published', approval_status: 'approved', venue_name: 'Local de teste', city: 'São Paulo',
  cover_image: null, image_url: null,
  ticket_types: [
    { id: 'e0000000-0000-4000-8000-0000000000c0', event_id: EVENTO, name: 'Pista', description: '', price: 50, capacity: 100, sold: 0, type: 'individual', perks: [], is_active: true },
    { id: TIPO, event_id: EVENTO, name: 'Match de Mesa', description: 'Mesa com gente nova', price: 80, capacity: 60, sold: 0, type: 'coletiva', perks: [], is_active: true },
  ],
}

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

const erro22023 = (message: string) => ({ status: 400, json: { code: '22023', message, details: null, hint: null } })

// user_profiles_ext: leitura (maybeSingle = array) e upsert (single = objeto). Guarda o corpo dos upserts.
async function mockPerfil(page: Page, perfil: object | null) {
  const upserts: Record<string, unknown>[] = []
  await page.route('**/rest/v1/user_profiles_ext*', async (route) => {
    const req = route.request()
    const objeto = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
    if (req.method() === 'GET') return route.fulfill({ json: objeto ? perfil : perfil ? [perfil] : [] })
    const body = req.postDataJSON() as Record<string, unknown>
    upserts.push(body)
    return route.fulfill({ status: 201, json: objeto ? { ...PERFIL_OK, ...body } : [{ ...PERFIL_OK, ...body }] })
  })
  return upserts
}

async function mockEvento(page: Page) {
  await page.route('**/rest/v1/events?*', (route) =>
    route.request().url().includes(`id=eq.${EVENTO}`) ? route.fulfill({ json: [EVENTO_ROW] }) : route.fallback())
}

async function entrar(page: Page) {
  await page.goto('/auth/login')
  await page.getByRole('button', { name: 'Participante', exact: true }).click()
  await page.getByPlaceholder('seu@email.com').fill('user@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar como Participante/ }).click()
  await expect(page).toHaveURL(/\/app\/hub/)
}

// Tela de sucesso de um pedido com ingresso de Match de Mesa, com "Sua mesa" aberta
async function abrirSuaMesa(page: Page) {
  await page.route('**/rest/v1/tickets?*', (route) => route.fulfill({ json: [TICKET] }))
  await page.goto('/')
  await page.evaluate(() => {
    history.pushState({ usr: { orderId: 'o1' }, key: 'mesa1', idx: 1 }, '', '/checkout/success')
    history.pushState({ usr: null, key: 'mesa2', idx: 2 }, '', '/')
    history.back()
  })
  await expect(page).toHaveURL(/\/checkout\/success$/)
  await page.getByRole('button', { name: 'Ver Minha Mesa', exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await entrar(page)
})

test('sua mesa: colegas com faixa de idade, etiquetas em comum, rede social, "Lugar ocupado", aviso e foto em análise', async ({ page }) => {
  const chamadas = await mockRpc(page, {
    minha_mesa: MESA_COM_COLEGAS,
    meus_avisos_mesa: [{ id: 'a1', evento: EVENTO, mesa: 'Mesa 3', tipo: 'entrou', mensagem: 'Entrou alguém na sua mesa', criado_em: '2026-10-02T00:00:00Z', lido: false }],
    marcar_avisos_lidos: null,
  })
  await mockPerfil(page, PERFIL_OK)
  await page.route('**/rest/v1/profiles?*', (route) =>
    route.request().url().includes('avatar_moderacao') ? route.fulfill({ json: [{ avatar_moderacao: 'pendente' }] }) : route.fallback())
  await abrirSuaMesa(page)

  await expect(page.getByRole('heading', { name: 'Mesa 3' })).toBeVisible()
  expect(chamadas.find(c => c.nome === 'minha_mesa')?.body).toEqual({ p_event_id: EVENTO })
  await expect(page.getByText('Ana', { exact: true })).toBeVisible()
  await expect(page.getByText('25 a 34 anos · Animador · Pós-graduação')).toBeVisible()
  await expect(page.getByText('Rock (em comum)')).toBeVisible() // em comum com as minhas etiquetas
  await expect(page.getByText('Funk', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Rede social' })).toHaveAttribute('href', 'https://instagram.com/ana.teste')
  await expect(page.getByText('Bruno', { exact: true })).toBeVisible()
  await expect(page.getByText('Lugar ocupado')).toBeVisible()
  await expect(page.getByText('Sua foto está em análise. Seu perfil aparece para os colegas depois da aprovação.')).toBeVisible()
  // textos falsos da tela antiga
  await expect(page.getByText(/Gerada pela IA|Vibe compatível|Compatibilidade|Missão da Mesa/)).toHaveCount(0)

  await expect(page.getByText('Entrou alguém na sua mesa (Mesa 3)')).toBeVisible()
  await page.getByRole('button', { name: 'Ok, entendi' }).click()
  await expect.poll(() => chamadas.some(c => c.nome === 'marcar_avisos_lidos')).toBe(true)
})

test('sem mesa: "Sua mesa será formada em DD/MM às HH:MM" (horário de Brasília)', async ({ page }) => {
  await mockRpc(page, { minha_mesa: { forma_em: '2026-12-14T21:00:00+00:00', saiu: false, mesas: [] }, meus_avisos_mesa: [] })
  await mockPerfil(page, null)
  await abrirSuaMesa(page)
  await expect(page.getByText(/Sua mesa será formada em\s*14\/12 às 18:00/)).toBeVisible()
  // sem aceite: convite para o termo, sem escolha de mesa
  await expect(page.getByRole('button', { name: 'Ler e aceitar o termo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Escolher minha mesa' })).toHaveCount(0)
})

test('travado: participação suspensa pela organização', async ({ page }) => {
  await mockRpc(page, { minha_mesa: { mesas: [], travado: true }, meus_avisos_mesa: [] })
  await mockPerfil(page, PERFIL_OK)
  await abrirSuaMesa(page)
  await expect(page.getByText('Sua participação nas mesas deste evento foi suspensa pela organização.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Escolher minha mesa|Trocar de mesa/ })).toHaveCount(0)
})

test('escolher mesa: lista, "Mesa indisponível" e entrada na mesa', async ({ page }) => {
  let tentativa = 0
  const chamadas = await mockRpc(page, {
    minha_mesa: { forma_em: '2026-12-14T21:00:00+00:00', saiu: false, mesas: [] },
    meus_avisos_mesa: [],
    mesas_para_escolher: {
      mesas: [{
        numero: 2, vagas: 3,
        pessoas: [cartao({ id: 'm-carla', nome: 'Carla', faixa_idade: '35–44', foto: FOTO, perfil: 'Curioso', tags: { musica: ['rock'] }, escolaridade: 'medio' }), cartao({})],
        etiquetas: null,
      }],
    },
    escolher_mesa: () => (++tentativa === 1 ? erro22023('Mesa indisponível') : { json: { numero: 2, nome: 'Mesa 2' } }),
  })
  await mockPerfil(page, PERFIL_OK)
  await abrirSuaMesa(page)

  await page.getByRole('button', { name: 'Escolher minha mesa' }).click()
  await expect(page.getByText('Carla', { exact: true })).toBeVisible()
  await expect(page.getByText('35 a 44 anos · Curioso · Ensino médio')).toBeVisible()
  await expect(page.getByText(/30 minutos entre uma troca e outra/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mesa nova' })).toBeVisible()

  await page.getByRole('button', { name: 'Entrar na Mesa 2' }).click()
  await expect(page.getByText('Mesa indisponível')).toBeVisible()
  await page.getByRole('button', { name: 'Entrar na Mesa 2' }).click()
  await expect(page.getByText('Você está na Mesa 2.')).toBeVisible()
  expect(chamadas.filter(c => c.nome === 'escolher_mesa').map(c => c.body)).toEqual([
    { p_event_id: EVENTO, p_mesa_numero: 2 }, { p_event_id: EVENTO, p_mesa_numero: 2 },
  ])
})

test('denunciar colega: motivo de lista fechada, aviso sobre o detalhe e "já denunciado"', async ({ page }) => {
  let vez = 0
  const chamadas = await mockRpc(page, {
    minha_mesa: MESA_COM_COLEGAS,
    meus_avisos_mesa: [],
    mesa_denunciar: () => ({ json: ++vez === 1 ? { ok: true } : { ja_denunciado: true } }),
  })
  await mockPerfil(page, PERFIL_OK)
  await abrirSuaMesa(page)

  await expect(page.getByRole('button', { name: /Denunciar Lugar ocupado/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Denunciar Ana' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Denunciar Ana' })
  await expect(dialogo.getByText(/Não escreva dados de saúde/)).toBeVisible()
  await expect(dialogo.getByRole('button', { name: 'Enviar denúncia' })).toBeDisabled()
  await dialogo.getByLabel('Perfil falso').check()
  await dialogo.getByLabel('Detalhe (opcional)').fill('Foto de outra pessoa')
  await dialogo.getByRole('button', { name: 'Enviar denúncia' }).click()
  await expect(page.getByText('Denúncia enviada. A equipe da Evokaa vai analisar.')).toBeVisible()
  expect(chamadas.find(c => c.nome === 'mesa_denunciar')?.body).toEqual({ p_membro: 'm-ana', p_motivo: 'perfil_falso', p_detalhe: 'Foto de outra pessoa' })

  await page.getByRole('button', { name: 'Denunciar Ana' }).click()
  await page.getByRole('dialog').getByLabel('Assédio').check()
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar denúncia' }).click()
  await expect(page.getByText('Você já denunciou esta pessoa neste evento.')).toBeVisible()
})

test('aceite e questionário: sem "Romance" nem gênero, tudo opcional; grava etiquetas, escolaridade e rede normalizada', async ({ page }) => {
  const chamadas = await mockRpc(page, { mesa_consentir: null })
  const upserts = await mockPerfil(page, null)
  await mockEvento(page)
  await page.goto(`/event/${EVENTO}`)

  await page.getByRole('button', { name: 'Adicionar ao Carrinho' }).nth(1).click() // o 2º é o Match de Mesa
  const termo = page.getByRole('dialog', { name: 'Match de Mesa' })
  await expect(termo.getByText(/algoritmo|matchmaking/i)).toHaveCount(0)
  await expect(termo.getByRole('button', { name: 'Aceitar e continuar' })).toBeDisabled()
  await termo.getByLabel('Li e aceito o termo do Match de Mesa.').check()
  await termo.getByRole('button', { name: 'Aceitar e continuar' }).click()
  await expect.poll(() => chamadas.find(c => c.nome === 'mesa_consentir')?.body).toEqual({ p_versao: '2026-10-03' })

  const passo = async (n: number) => expect(page.getByText(`Pergunta ${n} · opcional`)).toBeVisible()
  const pular = () => page.getByRole('button', { name: /^(Pular|Continuar)$/ }).click()

  await passo(1)
  await expect(page.getByText(/Tudo aqui é opcional/)).toBeVisible()
  await pular()
  await passo(2)
  await expect(page.getByRole('button', { name: /Networking/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Romance/ })).toHaveCount(0)
  for (let n = 3; n <= 4; n++) { await pular(); await passo(n) }
  await pular()
  await passo(5) // Música
  await page.getByRole('button', { name: 'Rock', exact: true }).click()
  await page.getByRole('button', { name: 'Forró', exact: true }).click()
  for (let n = 6; n <= 11; n++) { await pular(); await passo(n) }
  await pular()
  await passo(12) // escolaridade: escolher avança
  await page.getByRole('button', { name: /Superior completo/ }).click()
  await passo(13)
  await expect(page.getByText(/só aparece para os colegas de mesa se você der um segundo aceite/)).toBeVisible()
  await expect(page.getByText(/gênero/i)).toHaveCount(0)

  await page.getByLabel('Link da rede social').fill('facebook.com/ana')
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await expect(page.getByRole('alert')).toContainText('Instagram, TikTok, X (Twitter) ou LinkedIn')
  await page.getByLabel('Link da rede social').fill('Instagram.COM/Ana.Teste')
  await page.getByRole('button', { name: 'Finalizar' }).click()

  await expect.poll(() => upserts.length, { timeout: 10_000 }).toBe(1)
  const u = upserts[0]
  expect(u).toMatchObject({ tags: { musica: ['rock', 'forro'] }, education: 'superior', social_url: 'https://instagram.com/Ana.Teste', intention: null, vibe: null })
  for (const proibido of ['gender', 'bio', 'birth_year', 'mesa_consent_at', 'mesa_consent_version', 'rede_consent_at']) {
    expect(u).not.toHaveProperty(proibido)
  }
  // o questionário fecha e o ingresso entra no carrinho
  await expect(page.getByText('1 ingresso', { exact: true })).toBeVisible({ timeout: 10_000 })
})

test('checkout de Match de Mesa: quantidade fixa em 1 e data de nascimento (18+) antes do pedido', async ({ page }) => {
  await mockRpc(page, {})
  await mockPerfil(page, null)
  await mockEvento(page)
  const gravadas: Record<string, unknown>[] = []
  await page.route('**/rest/v1/profiles?*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    gravadas.push({ url: route.request().url(), body: route.request().postDataJSON() })
    await route.fulfill({ json: [{ id: DEMO }] })
  })
  await page.goto(`/event/${EVENTO}`)
  await page.getByRole('button', { name: 'Adicionar ao Carrinho' }).nth(1).click()
  await page.getByRole('dialog', { name: 'Match de Mesa' }).getByRole('button', { name: 'Agora não, só comprar o ingresso' }).click()
  await page.getByRole('button', { name: 'Finalizar' }).click()
  await expect(page).toHaveURL(/\/checkout$/)

  await expect(page.getByRole('button', { name: 'Mais um Match de Mesa' })).toBeDisabled()
  await expect(page.getByRole('heading', { name: 'Match de Mesa: sua data de nascimento' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar para Pagamento' }).click()
  await expect(page.getByText('Informe sua data de nascimento para comprar o Match de Mesa.')).toBeVisible()
  await expect(page).toHaveURL(/\/checkout$/)

  const menor = new Date()
  menor.setFullYear(menor.getFullYear() - 17)
  await page.getByLabel('Data de nascimento').fill(menor.toISOString().slice(0, 10))
  await page.getByRole('button', { name: 'Salvar data' }).click()
  await expect(page.getByText(/só para maiores de 18/).first()).toBeVisible()
  expect(gravadas).toHaveLength(0)

  await page.getByLabel('Data de nascimento').fill('1995-06-15')
  await page.getByRole('button', { name: 'Salvar data' }).click()
  await expect(page.getByText('Data de nascimento salva no seu Perfil.')).toBeVisible()
  expect(gravadas).toHaveLength(1)
  expect(gravadas[0].body).toEqual({ birth_date: '1995-06-15' })
  expect(String(gravadas[0].url)).toContain('birth_date=is.null') // só preenche data vazia

  await page.getByRole('button', { name: 'Continuar para Pagamento' }).click()
  await expect(page).toHaveURL(/\/checkout\/payment$/)
})
