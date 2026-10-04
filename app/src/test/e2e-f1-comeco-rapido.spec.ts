import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'

// F1 PR3c: começo rápido em /producer/events/new (do zero, com o Evo, copiando um evento) e duplicarEvento. O Supabase é
// simulado por page.route, com estado: o banco de mentira guarda o que o app cria e registra a ORDEM das chamadas.
// Conta de demonstração do produtor (só em desenvolvimento).
// PW_CHANNEL=chrome PW_BASE_URL=http://localhost:3161 npx playwright test src/test/e2e-f1-comeco-rapido.spec.ts --project=chromium

const PRODUTOR = 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4' // produtor@aura.teste
const FOTO = 'https://x.supabase.co/storage/v1/object/public/capas-eventos/d3f6ab7a/e1/aaaaaaaa.webp'
// o app sobe a foto do bucket como está (webp, sem recodificar): o conteúdo não é decodificado, basta o tipo
const FOTO_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGM4YRMFRwzEcQA/8hXhzZh4swAAAABJRU5ErkJggg==', 'base64')
const PRINTS = path.resolve(process.cwd(), '../test-results/pr3c')

test.skip(({ isMobile }) => isMobile, 'os prints de 390 px trocam o tamanho da janela dentro do teste')

type Linha = Record<string, unknown>
type Banco = { eventos: Linha[]; chamadas: string[]; posts: Linha[]; falhaIngressos: boolean }

const original = (o: Linha = {}): Linha => ({
  id: 'e1', producer_id: PRODUTOR, title: 'Noite de Forró', slug: 'noite-de-forro', description: 'Baile de forró', category: 'festa_encontro',
  temas: ['musica'], estilos: ['forro'], tags: [], date: '2099-12-12', time: '22:00:00', start_date: '2099-12-12T22:00:00-03:00', end_date: null,
  local_modo: 'presencial', venue_name: 'Espaço Torres', venue_city: 'Curitiba', venue_state: 'PR', classificacao: 'A16', accent_color: '#a55c65',
  cover_image: FOTO, image_url: FOTO, status: 'published', approval_status: 'approved', visibility: 'public', created_at: '2026-10-01T00:00:00Z',
  ticket_types: [
    { id: 't1', event_id: 'e1', name: 'Pista', description: null, price: 80, capacity: 200, quantity_total: 200, sold: 0, type: 'individual', perks: [], is_active: true },
    { id: 't2', event_id: 'e1', name: 'Camarote', description: null, price: 200, capacity: 20, quantity_total: 20, sold: 0, type: 'individual', perks: [], is_active: true },
  ], ...o,
})

async function montarBanco(page: Page, ini: Partial<Banco> = {}): Promise<Banco> {
  const db: Banco = { eventos: [original()], chamadas: [], posts: [], falhaIngressos: false, ...ini }
  await page.route(/\/rest\/v1\/events(\?|$)/, async route => {
    const r = route.request()
    if (r.method() === 'GET') return route.fulfill({ json: db.eventos })
    if (r.method() === 'POST') {
      const body = r.postDataJSON() as Linha
      db.posts.push(body)
      db.chamadas.push('POST events')
      const novo = { id: `n000000${db.posts.length}-0000-4000-8000-000000000000`, ...body }
      db.eventos.unshift({ ...novo, ticket_types: [] })
      return route.fulfill({ status: 201, json: novo }) // .select().single(): um objeto
    }
    if (r.method() === 'PATCH') { db.chamadas.push(`PATCH events ${Object.keys(r.postDataJSON() as Linha).join(',')}`); return route.fulfill({ json: { id: 'n' } }) }
    return route.fallback()
  })
  await page.route(/\/rest\/v1\/ticket_types(\?|$)/, async route => {
    const r = route.request()
    if (r.method() === 'POST') {
      db.chamadas.push(`POST ticket_types ${(r.postDataJSON() as Linha[]).length}`)
      return db.falhaIngressos
        ? route.fulfill({ status: 500, json: { message: 'internal error', code: 'XX000' } })
        : route.fulfill({ status: 201, body: '' })
    }
    return route.fulfill({ json: [] })
  })
  await page.route('**/storage/v1/object/capas-eventos/**', route => {
    db.chamadas.push('UPLOAD capa')
    return route.fulfill({ json: { Key: 'capas-eventos/x' } })
  })
  await page.route(FOTO, route => route.fulfill({ body: FOTO_BYTES, contentType: 'image/webp', headers: { 'access-control-allow-origin': '*' } }))
  return db
}

async function entrarProdutor(page: Page) {
  await page.goto('/auth/login')
  await page.getByRole('button', { name: 'Produtor' }).click()
  await page.getByPlaceholder('seu@email.com').fill('produtor@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar como Produtor/ }).click()
  await expect(page).toHaveURL(/\/producer\/dashboard/)
}

test.describe('começo rápido', () => {
  test('/producer/planner redireciona para /producer/events/new', async ({ page }) => {
    await montarBanco(page)
    await entrarProdutor(page)
    await page.goto('/producer/planner')
    await expect(page).toHaveURL(/\/producer\/events\/new$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Criar evento' })).toBeVisible()
  })

  test('celular de 320 e 375 px: sem rolagem para o lado, mesmo com título longo na lista de copiar', async ({ page }) => {
    await montarBanco(page, { eventos: [original({ title: '[TESTE] Evento de validação Evokaa (F0a) com um título bem comprido' })] })
    await entrarProdutor(page)
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/producer/events/new')
      await expect(page.getByRole('heading', { level: 1, name: 'Criar evento' })).toBeVisible()
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(sobra, `largura ${width}`).toBeLessThanOrEqual(0)
    }
  })

  test('/producer/ingressos-avancados redireciona para /producer/events/new', async ({ page }) => {
    await montarBanco(page)
    await entrarProdutor(page)
    await page.goto('/producer/ingressos-avancados')
    await expect(page).toHaveURL(/\/producer\/events\/new$/)
  })

  test('?tour=criar-evento abre o tour de 3 passos no começo rápido e concluir tira o parâmetro', async ({ page }) => {
    await montarBanco(page)
    await entrarProdutor(page)
    await page.goto('/producer/events/new?tour=criar-evento')
    const dialogo = page.getByRole('dialog')
    await expect(dialogo.getByText('Do zero')).toBeVisible()
    await dialogo.getByRole('button', { name: 'Próximo' }).click()
    await expect(dialogo.getByText('Montar com o Evo')).toBeVisible()
    await dialogo.getByRole('button', { name: 'Próximo' }).click()
    await expect(dialogo.getByText('Copiar de um evento anterior')).toBeVisible()
    await dialogo.getByRole('button', { name: 'Concluir' }).click()
    await expect(page).toHaveURL(/\/producer\/events\/new$/)
  })

  test('do zero: o nome é obrigatório; cria rascunho sem ingressos e abre o painel', async ({ page }) => {
    const db = await montarBanco(page)
    await entrarProdutor(page)
    await page.goto('/producer/events/new')

    await page.getByRole('button', { name: /Criar rascunho/ }).click()
    await expect(page.getByText('Escreva o nome: ele aparece na página e no ingresso.')).toBeVisible()
    expect(db.chamadas).toEqual([])

    await page.getByLabel('Nome do evento').fill('Festa do teste')
    await page.getByLabel('Formato').selectOption('festa_encontro')
    await page.getByLabel('Data').fill('2099-11-20')
    await page.getByLabel('Hora de início').fill('21:30')
    await page.getByLabel('Cidade').fill('Curitiba')
    await page.getByRole('button', { name: /Criar rascunho/ }).click()

    await expect(page).toHaveURL(/\/producer\/events\/n0000001-0000-4000-8000-000000000000\/edit$/)
    expect(db.chamadas).toEqual(['POST events']) // um evento, nenhum ingresso
    expect(db.posts[0]).toMatchObject({ title: 'Festa do teste', category: 'festa_encontro', date: '2099-11-20', time: '21:30', venue_city: 'Curitiba', status: 'draft' })
  })

  test('montar com o Evo: abre o painel do Evo já no formulário de planejar', async ({ page }) => {
    await montarBanco(page)
    await entrarProdutor(page)
    await page.goto('/producer/events/new')
    await page.getByRole('button', { name: 'Abrir o Evo' }).click()
    await expect(page.getByRole('dialog', { name: 'Central do Evo' })).toBeVisible()
    await expect(page.getByLabel('Formato do evento')).toBeVisible()
  })

  test('copiar: cria o rascunho com os ingressos e a foto, mostra o que foi copiado e abre o painel do evento novo', async ({ page }) => {
    const db = await montarBanco(page)
    page.on('dialog', d => d.accept())
    await entrarProdutor(page)
    await page.goto('/producer/events/new')
    await expect(page.getByText('sáb, 12 dez · Espaço Torres')).toBeVisible()
    await page.getByRole('button', { name: 'Copiar Noite de Forró' }).click()

    await expect(page).toHaveURL(/\/producer\/events\/n0000001-0000-4000-8000-000000000000\/edit$/)
    await expect(page.getByText(/Copiado: os dados do evento, 2 tipos de ingresso, a foto\./)).toBeVisible()
    await expect(page.getByText(/Não vão: datas, vendas, aprovação e destaque\./)).toBeVisible()
    expect(db.chamadas.slice(0, 4)).toEqual(['POST events', 'POST ticket_types 2', 'UPLOAD capa', expect.stringMatching(/^PATCH events cover_image/)])
    expect(db.posts).toHaveLength(1)
    expect(db.posts[0]).toMatchObject({ title: 'Noite de Forró (cópia)', status: 'draft', date: null })
    expect(db.posts[0]).not.toHaveProperty('approval_status')
  })

  test('copiar com ingressos falhando: 1 evento só e o aviso diz o que faltou', async ({ page }) => {
    const db = await montarBanco(page, { falhaIngressos: true })
    page.on('dialog', d => d.accept())
    await entrarProdutor(page)
    await page.goto('/producer/events/new')
    await page.getByRole('button', { name: 'Copiar Noite de Forró' }).click()
    await expect(page).toHaveURL(/\/producer\/events\/n0000001-[^/]+\/edit$/)
    await expect(page.getByText(/Atenção: os ingressos não foram copiados\./)).toBeVisible()
    expect(db.posts).toHaveLength(1)
  })

  test('copiar com a foto bloqueada (CORS): evento criado e aviso "foto não copiada"', async ({ page }) => {
    const db = await montarBanco(page)
    await page.route(FOTO, route => route.abort())
    page.on('dialog', d => d.accept())
    await entrarProdutor(page)
    await page.goto('/producer/events/new')
    await page.getByRole('button', { name: 'Copiar Noite de Forró' }).click()
    await expect(page).toHaveURL(/\/producer\/events\/n0000001-[^/]+\/edit$/)
    await expect(page.getByText(/Copiado: os dados do evento, 2 tipos de ingresso\..*Atenção: foto não copiada\./)).toBeVisible()
    expect(db.posts).toHaveLength(1)
    expect(db.chamadas).not.toContain('UPLOAD capa')
  })

  test('Meus eventos: Duplicar usa o mesmo caminho e abre o painel do evento novo', async ({ page }) => {
    const db = await montarBanco(page)
    page.on('dialog', d => d.accept())
    await entrarProdutor(page)
    await page.goto('/producer/events')
    await page.getByRole('button', { name: 'Duplicar Noite de Forró' }).click()
    await expect(page).toHaveURL(/\/producer\/events\/n0000001-[^/]+\/edit$/)
    await expect(page.getByText(/Cópia criada como rascunho\. Copiado: os dados do evento, 2 tipos de ingresso, a foto\./)).toBeVisible()
    expect(db.posts).toHaveLength(1)
  })

  for (const [nome, largura, altura] of [['1440', 1440, 900], ['390', 390, 844]] as const) {
    for (const tema of ['claro', 'escuro'] as const) {
      test(`print ${nome} ${tema}`, async ({ page }) => {
        await montarBanco(page)
        await page.emulateMedia({ colorScheme: tema === 'escuro' ? 'dark' : 'light' })
        await page.setViewportSize({ width: largura, height: altura })
        await entrarProdutor(page)
        await page.goto('/producer/events/new')
        await expect(page.getByRole('heading', { level: 1, name: 'Criar evento' })).toBeVisible()
        await expect(page.getByText('sáb, 12 dez · Espaço Torres')).toBeVisible()
        await page.getByRole('button', { name: 'Aceitar todos' }).click({ timeout: 3000 }).catch(() => {}) // o aviso de cookies cobre a tela
        await page.getByRole('button', { name: 'Fechar aviso da Política de Privacidade' }).click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(500) // fontes e capa
        await page.screenshot({ path: path.join(PRINTS, `comeco-${nome}-${tema}.png`), fullPage: true })
        await page.getByRole('button', { name: /Criar rascunho/ }).click() // estado de erro
        await expect(page.getByText('Escreva o nome: ele aparece na página e no ingresso.')).toBeVisible()
        await page.screenshot({ path: path.join(PRINTS, `comeco-${nome}-${tema}-erro.png`), fullPage: true })
      })
    }
  }
})
