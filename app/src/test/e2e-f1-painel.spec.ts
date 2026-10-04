import { test, expect, type Page } from '@playwright/test'

// F1 PR3b: painel do evento em /producer/events/:id/edit. O Supabase é simulado por page.route, com estado: o banco
// de mentira guarda o evento e os ingressos, aplica o que o painel grava e registra a ORDEM das chamadas (o "Enviar"
// tem ordem obrigatória). Conta de demonstração do produtor (só em desenvolvimento).
// PW_CHANNEL=chrome PW_BASE_URL=http://localhost:3110 npx playwright test src/test/e2e-f1-painel.spec.ts --project=chromium

const PRODUTOR = 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4' // produtor@aura.teste
const EVENTO = 'e0000000-0000-4000-8000-0000000000f1'
const T_PISTA = 'a0000000-0000-4000-8000-0000000000a1'
const T_CAMAROTE = 'a0000000-0000-4000-8000-0000000000a2'

test.skip(({ isMobile }) => isMobile, 'a lateral do produtor cobre a tela no celular nos e2e (sem layout de celular aqui)')

type Linha = Record<string, unknown>
type Banco = {
  evento: Linha; ingressos: Linha[]; link: string | null; vendidos: Record<string, number>
  chamadas: string[]; patches: Linha[]; aceite: () => { status: number; json: unknown }
}

const evento = (o: Linha = {}): Linha => ({
  id: EVENTO, producer_id: PRODUTOR, title: 'Noite de teste', subtitle: null, slug: 'noite-de-teste', description: 'Curta', category: null,
  temas: [], estilos: [], tags: [], date: null, time: null, start_date: '2026-10-04T12:00:00Z', end_date: null, local_modo: 'presencial',
  venue_name: null, venue_address: null, venue_city: null, venue_state: null, venue_zip: null, classificacao: null, accent_color: null,
  cover_image: null, image_url: null, status: 'draft', approval_status: 'pending', rejection_reason: null, created_at: '2026-10-01T00:00:00Z', ...o,
})
const ingresso = (o: Linha = {}): Linha => ({
  id: T_PISTA, event_id: EVENTO, name: 'Pista', description: null, price: 80, capacity: 200, quantity_total: 200, sold: 0, type: 'individual',
  perks: [], is_active: true, inclui_bebida: false, created_at: '2026-10-01T00:00:00Z', ...o,
})
const aprovado = (o: Linha = {}) => evento({
  description: 'Baile de forró no Espaço Torres, em Curitiba.', category: 'festa_encontro', temas: ['musica'], date: '2099-12-12', time: '22:00:00',
  venue_name: 'Espaço Torres', venue_city: 'Curitiba', venue_state: 'PR', venue_zip: '80010-000', venue_address: 'Rua das Flores, 123 - Centro',
  classificacao: 'A16', status: 'published', approval_status: 'approved', ...o,
})

async function montarBanco(page: Page, ini: Partial<Banco> & { evento: Linha }): Promise<Banco> {
  const db: Banco = {
    ingressos: [], link: null, vendidos: {}, chamadas: [], patches: [],
    aceite: () => ({ status: 200, json: { ok: true, id: 'a1', aceito_em: '2026-10-05T00:00:00Z', versao: '2026-10-04', classificacao: db.evento.classificacao ?? null, tem_bebida: db.ingressos.some(t => t.inclui_bebida) } }),
    ...ini,
  }
  const idDe = (url: string, campo: string) => new URL(url).searchParams.get(campo)?.replace(/^eq\./, '') ?? ''

  await page.route(/\/rest\/v1\/events(\?|$)/, async route => {
    const r = route.request()
    if (r.method() === 'GET') return route.fulfill({ json: [{ ...db.evento, ticket_types: db.ingressos }] })
    if (r.method() === 'PATCH') {
      const body = r.postDataJSON() as Linha
      db.patches.push(body)
      db.chamadas.push(`PATCH events ${Object.keys(body).join(',')}`)
      if (body.status === 'published' && db.evento.status !== 'published') db.evento.approval_status = 'pending' // o gatilho do banco (PR3a)
      Object.assign(db.evento, body)
      return route.fulfill({ json: { id: EVENTO, updated_at: new Date().toISOString() } })
    }
    if (r.method() === 'DELETE') { db.chamadas.push('DELETE events'); return route.fulfill({ json: [{ id: EVENTO }] }) }
    return route.fallback()
  })
  await page.route(/\/rest\/v1\/ticket_types(\?|$)/, async route => {
    const r = route.request()
    if (r.method() === 'GET') return route.fulfill({ json: db.ingressos })
    if (r.method() === 'POST') {
      const lista = r.postDataJSON() as Linha[]
      lista.forEach((t, i) => db.ingressos.push({ ...t, id: `b0000000-0000-4000-8000-${String(db.ingressos.length + i + 1).padStart(12, '0')}`, created_at: `2026-10-0${db.ingressos.length + 2}T00:00:00Z` }))
      db.chamadas.push(`POST ticket_types ${lista.length}`)
      return route.fulfill({ status: 201, body: '' })
    }
    if (r.method() === 'PATCH') {
      const id = idDe(r.url(), 'id')
      const body = r.postDataJSON() as Linha
      db.chamadas.push(`PATCH ticket_types ${Object.keys(body).join(',')}`)
      const t = db.ingressos.find(x => x.id === id)
      if (t) Object.assign(t, body)
      return route.fulfill({ json: [{ id }] })
    }
    if (r.method() === 'DELETE') {
      const ids = (new URL(r.url()).searchParams.get('id') ?? '').replace(/^in\.\(|\)$/g, '').split(',')
      db.ingressos = db.ingressos.filter(t => !ids.includes(t.id as string))
      db.chamadas.push(`DELETE ticket_types ${ids.length}`)
      return route.fulfill({ json: ids.map(id => ({ id })) })
    }
    return route.fallback()
  })
  await page.route(/\/rest\/v1\/tickets(\?|$)/, route => {
    const n = db.vendidos[idDe(route.request().url(), 'ticket_type_id')] ?? 0
    return route.fulfill({ status: 200, headers: { 'content-range': `*/${n}`, 'access-control-expose-headers': 'content-range' }, json: [] })
  })
  await page.route(/\/rest\/v1\/evento_privado(\?|$)/, async route => {
    const r = route.request()
    if (r.method() === 'GET') return route.fulfill({ json: db.link ? [{ online_url: db.link }] : [] })
    if (r.method() === 'POST') {
      const body = r.postDataJSON() as Linha
      db.link = (body.online_url as string | null) ?? null
      db.chamadas.push(`UPSERT evento_privado ${db.link ?? 'null'}`)
      return route.fulfill({ status: 201, json: { event_id: EVENTO } })
    }
    return route.fallback()
  })
  await page.route('**/functions/v1/aceite-evento', route => {
    db.chamadas.push('INVOKE aceite-evento')
    const a = db.aceite()
    return route.fulfill({ status: a.status, json: a.json })
  })
  await page.route('https://viacep.com.br/**', route => route.fulfill({ json: { logradouro: 'Rua das Flores', bairro: 'Centro', localidade: 'Curitiba', uf: 'PR' } }))
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

async function abrirPainel(page: Page) {
  await page.goto(`/producer/events/${EVENTO}/edit`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

const secao = (page: Page, nome: RegExp) => page.getByRole('button', { name: nome })
async function abre(page: Page, nome: RegExp) {
  const s = secao(page, nome)
  if ((await s.getAttribute('aria-expanded')) !== 'true') await s.click()
  await expect(s).toHaveAttribute('aria-expanded', 'true')
}
// Faz a ação e espera o salvamento automático terminar (uma gravação nova no banco de mentira e "Salvo" no cabeçalho)
async function salva(page: Page, db: Banco, acao: () => Promise<unknown>) {
  const n = db.patches.length
  await acao()
  await expect.poll(() => db.patches.length, { timeout: 8000 }).toBeGreaterThan(n)
  await expect(page.getByRole('status').filter({ hasText: /Salvo|Salvando|Não salvou/ })).toHaveText(/Salvo/)
}

test.describe('painel do evento: rascunho até "Em análise"', () => {
  test('preenche o que falta, salva o ingresso, escolhe a classificação, aceita e envia', async ({ page }) => {
    const db = await montarBanco(page, { evento: evento() })
    await entrarProdutor(page)
    await abrirPainel(page)

    await expect(page.getByRole('heading', { level: 1, name: 'Noite de teste' })).toBeVisible()
    await expect(page.getByText('Rascunho', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('1 de 8')).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Itens prontos' })).toHaveAttribute('aria-valuenow', '1')

    // O que é: formato e descrição salvam sozinhos, só a chave mudada
    await abre(page, /^O que é/)
    await salva(page, db, () => page.getByLabel('Formato').selectOption('festa_encontro'))
    expect(db.patches.at(-1)).toEqual({ category: 'festa_encontro' })
    await salva(page, db, () => page.getByLabel('Descrição').fill('Baile de forró no Espaço Torres, em Curitiba.'))
    expect(db.patches.at(-1)).toEqual({ description: 'Baile de forró no Espaço Torres, em Curitiba.' })

    // Quando e onde: data, hora e local vão juntos; o CEP preenche o endereço
    await abre(page, /^Quando e onde/)
    await salva(page, db, async () => {
      await page.getByLabel('Data de início').fill('2099-12-12')
      await page.getByLabel('Hora de início').fill('22:00')
      await page.getByLabel('Nome do local').fill('Espaço Torres')
      await page.getByLabel('CEP').fill('80010000')
      await expect(page.getByLabel('Endereço')).toHaveValue(/Rua das Flores - Centro · Curitiba – PR/)
      await page.getByLabel('Número').fill('123')
      await expect(page.getByLabel('Endereço')).toHaveValue(/Rua das Flores, 123 - Centro · Curitiba – PR/)
    })
    await expect(page.getByRole('status').filter({ hasText: /Salvo|Salvando|Não salvou/ })).toHaveText(/Salvo/)
    const gravados = Object.assign({}, ...db.patches)
    expect(gravados).toMatchObject({ date: '2099-12-12', time: '22:00', venue_name: 'Espaço Torres', venue_zip: '80010-000', venue_city: 'Curitiba', venue_state: 'PR', venue_address: 'Rua das Flores, 123 - Centro' })
    expect(db.patches.some(p => 'time' in p && !('date' in p))).toBe(false) // a hora nunca vai sem a data
    expect(db.patches.every(p => !('status' in p) && !('approval_status' in p))).toBe(true)

    // Ingressos: gravação própria; nada de ingresso no salvamento automático
    await abre(page, /^Ingressos/)
    expect(db.chamadas.some(c => c.includes('ticket_types'))).toBe(false)
    await page.getByRole('button', { name: 'Adicionar ingresso' }).click()
    await page.getByLabel('Nome', { exact: true }).fill('Pista')
    await page.getByLabel('Preço (R$)').fill('80,00')
    await page.getByLabel('Quantidade').fill('200')
    await expect(page.getByText(/Comprador paga/)).toContainText('R$ 88,00')
    await expect(page.getByText('Ingressos com mudanças não salvas')).toBeVisible()
    await page.getByLabel('Preço (R$)').fill('8x')
    await expect(page.getByText(/Preço inválido: use só números, com vírgula nos centavos/)).toBeVisible()
    await page.getByLabel('Preço (R$)').fill('80,00')

    // Mesa coletiva num evento que não é 18+: aviso (o ingresso não é salvo)
    await page.getByRole('button', { name: 'Adicionar ingresso' }).click()
    await page.getByRole('group', { name: 'Ingresso 2' }).getByRole('radio', { name: 'Mesa coletiva' }).click()
    await expect(page.getByText('Só maiores de 18 compram a Mesa coletiva.')).toBeVisible()
    await page.getByRole('button', { name: /^Remover o ingresso 2$/ }).click()
    await expect(page.getByText('Só maiores de 18 compram a Mesa coletiva.')).toHaveCount(0)

    await page.getByRole('button', { name: 'Salvar ingressos' }).click()
    await expect(page.getByText('Ingressos salvos.')).toBeVisible()
    expect(db.ingressos).toHaveLength(1)
    expect(db.ingressos[0]).toMatchObject({ name: 'Pista', price: 80, capacity: 200, quantity_total: 200, type: 'individual', is_active: true })
    await expect(page.getByText('Ingressos com mudanças não salvas')).toHaveCount(0)

    // Regras e idade: classificação, aviso de entrada e resumo da bebida (por ingresso)
    await abre(page, /^Regras e idade/)
    await expect(page.getByText('Nenhum ingresso inclui bebida alcoólica')).toBeVisible()
    await salva(page, db, () => page.getByRole('radio', { name: /16 anos/ }).click())
    await expect(page.getByText(/Não recomendado para menores de 16 anos/).first()).toBeVisible()
    expect(db.patches.at(-1)).toEqual({ classificacao: 'A16' })

    // Publicar: só falta o aceite; o botão não envia sem ele
    await abre(page, /^Publicar/)
    await expect(page.getByText('7 de 8')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar para aprovação' })).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByRole('region', { name: 'Texto do aceite' })).toContainText('Autoclassifiquei o evento como A16 (16 anos)')
    await expect(page.getByRole('region', { name: 'Texto do aceite' })).toContainText('Nenhum ingresso deste evento inclui bebida alcoólica.')
    await page.getByRole('button', { name: 'Enviar para aprovação' }).click({ force: true })
    expect(db.chamadas.some(c => c.includes('aceite') || c.includes('status'))).toBe(false)
    await page.getByLabel('Li e aceito o termo do produtor').check()
    await expect(page.getByText('8 de 8')).toBeVisible()
    const antes = db.chamadas.length
    await page.getByRole('button', { name: 'Enviar para aprovação' }).click()

    await expect(page.getByText('Em análise pela equipe')).toBeVisible()
    await expect(page.getByText('Em análise', { exact: true }).first()).toBeVisible()
    expect(db.chamadas.slice(antes)).toEqual(['INVOKE aceite-evento', 'PATCH events status'])
    expect(db.evento).toMatchObject({ status: 'published', approval_status: 'pending' })
  })

  test('o aceite se desfaz quando o texto muda (classificação, nome ou bebida)', async ({ page }) => {
    await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Publicar/)
    const aceite = page.getByLabel('Li e aceito o termo do produtor')
    await aceite.check()
    await expect(page.getByText('8 de 8')).toBeVisible()
    await abre(page, /^Regras e idade/)
    await page.getByRole('radio', { name: /18 anos/ }).click()
    await expect(aceite).not.toBeChecked()
    await expect(page.getByText('7 de 8')).toBeVisible()
    await aceite.check()
    await abre(page, /^O que é/)
    await page.getByLabel('Nome do evento').fill('Outro nome')
    await expect(aceite).not.toBeChecked()
  })

  test('classificação que o servidor registrou diverge da tela: avisa e NÃO publica', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending' }), ingressos: [ingresso()] })
    db.aceite = () => ({ status: 200, json: { ok: true, classificacao: 'A18', tem_bebida: false } })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Publicar/)
    await page.getByLabel('Li e aceito o termo do produtor').check()
    await page.getByRole('button', { name: 'Enviar para aprovação' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'não é a que está na tela' })).toBeVisible()
    expect(db.chamadas).toContain('INVOKE aceite-evento')
    expect(db.chamadas.some(c => c === 'PATCH events status')).toBe(false)
    expect(db.evento.status).toBe('draft')
  })

  test('409 do aceite vira texto amigável', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending' }), ingressos: [ingresso()] })
    db.aceite = () => ({ status: 409, json: { error: 'Texto do aceite desatualizado; recarregue a página' } })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Publicar/)
    await page.getByLabel('Li e aceito o termo do produtor').check()
    await page.getByRole('button', { name: 'Enviar para aprovação' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'O texto do aceite mudou. Recarregue a página e envie de novo.' })).toBeVisible()
    expect(db.evento.status).toBe('draft')
  })

  test('falha no salvamento automático: "Não salvou", o digitado fica e "Tentar de novo" grava', async ({ page }) => {
    const db = await montarBanco(page, { evento: evento() })
    await entrarProdutor(page)
    let falhar = true
    await page.route(/\/rest\/v1\/events(\?|$)/, route => {
      if (route.request().method() === 'PATCH' && falhar) return route.fulfill({ status: 500, json: { message: 'falhou' } })
      return route.fallback()
    })
    await abrirPainel(page)
    await abre(page, /^O que é/)
    await page.getByLabel('Nome do evento').fill('Nome novo')
    await expect(page.getByRole('status').filter({ hasText: /Não salvou/ })).toBeVisible()
    await expect(page.getByLabel('Nome do evento')).toHaveValue('Nome novo')
    falhar = false
    await salva(page, db, () => page.getByRole('button', { name: 'Tentar de novo' }).click())
    expect(db.patches.at(-1)).toEqual({ title: 'Nome novo' })
  })
})

test.describe('painel do evento: recusado, em análise, no ar e travado', () => {
  test('recusado: motivo na faixa, "Recusado" no cabeçalho e continua salvando sozinho', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'rejected', rejection_reason: 'A descrição promete open bar, mas nenhum ingresso marca bebida.' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await expect(page.getByText('Recusado', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('A descrição promete open bar, mas nenhum ingresso marca bebida.')).toBeVisible()
    await page.getByRole('button', { name: 'Ir para Publicar' }).click()
    await expect(secao(page, /^Publicar/)).toHaveAttribute('aria-expanded', 'true')
    await abre(page, /^O que é/)
    await salva(page, db, () => page.getByLabel('Subtítulo').fill('Com trio pé-de-serra'))
    expect(db.patches.at(-1)).toEqual({ subtitle: 'Com trio pé-de-serra' })
  })

  test('publicado e aprovado: nada salva sozinho; faixa, descartar, aceite novo e envio', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado(), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await expect(page.getByText('À venda', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/Alterações não enviadas/)).toHaveCount(0)

    await abre(page, /^O que é/)
    await page.getByLabel('Descrição').fill('Baile de forró com trio pé-de-serra no Espaço Torres, em Curitiba.')
    await page.waitForTimeout(1500)
    expect(db.patches).toHaveLength(0) // nada salva sozinho
    await expect(page.getByText('Alterações não enviadas: descrição')).toBeVisible()

    // descartar volta ao que está no ar
    await page.getByRole('button', { name: 'Descartar' }).click()
    await expect(page.getByLabel('Descrição')).toHaveValue('Baile de forró no Espaço Torres, em Curitiba.')
    await expect(page.getByText(/Alterações não enviadas/)).toHaveCount(0)

    await page.getByLabel('Descrição').fill('Baile de forró com trio pé-de-serra no Espaço Torres, em Curitiba.')
    await abre(page, /^Regras e idade/)
    await page.getByRole('radio', { name: /18 anos/ }).click()
    await expect(page.getByText('Alterações não enviadas: descrição, classificação')).toBeVisible()

    // a classificação mudou: o diálogo pede o aceite novo e o botão não envia sem ele
    await page.getByRole('button', { name: 'Enviar alterações para análise' }).click()
    const dlg = page.getByRole('dialog', { name: 'Enviar alterações para análise?' })
    await expect(dlg).toContainText('Vai para análise: descrição, classificação.')
    await expect(dlg).toContainText('A classificação mudou de A16 para A18: refaça o aceite')
    const enviar = dlg.getByRole('button', { name: 'Enviar para análise' })
    await expect(enviar).toHaveAttribute('aria-disabled', 'true')
    await page.waitForTimeout(400) // a animação de abrir do diálogo: um clique no meio dela cairia fora e fecharia
    await enviar.click({ force: true }) // aria-disabled: o Playwright não clica sem força
    expect(db.chamadas).toEqual([])
    await dlg.getByLabel(/Li e aceito o termo do produtor com a classificação A18/).check()
    await enviar.click()
    await expect(page.getByText('Alterações enviadas para análise.')).toBeVisible()

    // ordem: grava as colunas mudadas e depois aceita; não mexe em status
    expect(db.chamadas).toEqual(['PATCH events description,classificacao', 'INVOKE aceite-evento'])
    expect(db.patches[0]).toEqual({ description: 'Baile de forró com trio pé-de-serra no Espaço Torres, em Curitiba.', classificacao: 'A18' })
  })

  test('publicado: sem mudar classificação nem bebida, enviar não refaz o aceite', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado(), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^O que é/)
    await page.getByLabel('Subtítulo').fill('Novo subtítulo')
    await page.getByRole('button', { name: 'Enviar alterações para análise' }).click()
    const dlg = page.getByRole('dialog')
    await expect(dlg.getByText(/refaça o aceite/)).toHaveCount(0)
    await dlg.getByRole('button', { name: 'Enviar para análise' }).click()
    await expect(page.getByText('Alterações enviadas para análise.')).toBeVisible()
    expect(db.chamadas).toEqual(['PATCH events subtitle'])
  })

  test('publicado com alterações: sair pela lateral pede confirmação', async ({ page }) => {
    await montarBanco(page, { evento: aprovado(), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^O que é/)
    await page.getByLabel('Subtítulo').fill('Mudou')
    await page.getByRole('link', { name: 'Todos os eventos' }).first().click()
    const dlg = page.getByRole('dialog', { name: 'Sair sem enviar?' })
    await expect(dlg).toBeVisible()
    await dlg.getByRole('button', { name: 'Continuar editando' }).click()
    await expect(page).toHaveURL(new RegExp(`/producer/events/${EVENTO}/edit`))
    await expect(page.getByLabel('Subtítulo')).toHaveValue('Mudou')
    await page.getByRole('link', { name: 'Todos os eventos' }).first().click()
    await page.getByRole('dialog', { name: 'Sair sem enviar?' }).getByRole('button', { name: 'Sair e perder' }).click()
    await expect(page).toHaveURL(/\/producer\/events$/)
  })

  test('em análise: faixa "pode continuar editando" e o painel salva sozinho', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ approval_status: 'pending' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await expect(page.getByText('Em análise pela equipe')).toBeVisible()
    await expect(page.getByText(/Você pode continuar editando/)).toBeVisible()
    await abre(page, /^O que é/)
    await salva(page, db, () => page.getByLabel('Subtítulo').fill('Ajuste durante a análise'))
    expect(db.patches.at(-1)).toEqual({ subtitle: 'Ajuste durante a análise' })
  })

  test('com ingresso vendido: data, hora, modo e local travados; ingresso não sai, só oculta', async ({ page }) => {
    const db = await montarBanco(page, {
      evento: aprovado(), ingressos: [ingresso({ sold: 0 }), ingresso({ id: T_CAMAROTE, name: 'Camarote', price: 180, capacity: 80, quantity_total: 80, created_at: '2026-10-02T00:00:00Z' })],
      vendidos: { [T_PISTA]: 180 },
    })
    await entrarProdutor(page)
    await abrirPainel(page)
    await expect(page.getByText('Travado: há ingressos vendidos')).toBeVisible()
    await abre(page, /^Quando e onde/)
    await expect(page.getByText('Data, hora e local ficam travados depois da primeira venda.')).toBeVisible()
    await expect(page.getByRole('link', { name: /Falar com a equipe/ })).toBeVisible()
    for (const l of ['Data de início', 'Hora de início', 'Nome do local', 'CEP', 'Número']) await expect(page.getByLabel(l)).toBeDisabled()
    await expect(page.getByRole('radio', { name: 'Online' })).toHaveCount(0)

    await abre(page, /^Ingressos/)
    const pista = page.getByRole('group', { name: 'Ingresso Pista' })
    await expect(pista.getByText('180 vendidos')).toBeVisible()
    await expect(pista.getByRole('button', { name: /^Remover/ })).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Ingresso Camarote' }).getByRole('button', { name: /^Remover/ })).toBeVisible()
    await expect(pista.getByText('Tipo: Individual')).toBeVisible()

    // quantidade abaixo dos vendidos não passa
    await pista.getByLabel('Quantidade').fill('100')
    await expect(pista.getByText(/Já foram vendidos 180/)).toBeVisible()
    await pista.getByLabel('Quantidade').fill('200')

    await pista.getByRole('button', { name: 'Ocultar' }).click()
    await expect(page.getByText('Ingresso oculto: não aparece mais para venda.')).toBeVisible()
    await expect(pista.getByRole('button', { name: 'Mostrar' })).toBeVisible()
    await expect(pista.getByText(/Oculto/)).toBeVisible()
    expect(db.ingressos.find(t => t.id === T_PISTA)).toMatchObject({ is_active: false })
    expect(db.chamadas).toEqual(['PATCH ticket_types is_active'])

    // remover o que não tem venda: só apaga ao salvar
    await page.getByRole('group', { name: 'Ingresso Camarote' }).getByRole('button', { name: /^Remover/ }).click()
    await page.getByRole('button', { name: 'Salvar ingressos' }).click()
    await expect(page.getByText('Ingressos salvos.')).toBeVisible()
    expect(db.ingressos.map(t => t.name)).toEqual(['Pista'])
    expect(db.chamadas).toContain('DELETE ticket_types 1')
  })

  test('link da transmissão: só https sem usuário@, mostra o domínio e grava em evento_privado', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending', local_modo: 'online' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await expect(page.getByText('6 de 8')).toBeVisible() // online sem link: faltam o link e o aceite
    await abre(page, /^Quando e onde/)
    const campo = page.getByLabel('Link da transmissão')
    await campo.fill('https://google.com@evil.com/live')
    await expect(page.getByRole('alert').filter({ hasText: /não tenha usuário@/ })).toBeVisible()
    await page.waitForTimeout(1500)
    expect(db.link).toBeNull() // inválido não é salvo
    await campo.fill('http://x.com/live')
    await expect(page.getByRole('alert').filter({ hasText: /comece com https:\/\//i })).toBeVisible()
    await campo.fill('https://meet.google.com/abc-defg')
    await expect(page.getByText('O link abre em')).toContainText('meet.google.com')
    await expect.poll(() => db.link, { timeout: 8000 }).toBe('https://meet.google.com/abc-defg')
    await expect(page.getByText('7 de 8')).toBeVisible() // falta só o aceite
  })

  test('esporte: sem selo e aviso de venda bloqueada', async ({ page }) => {
    await montarBanco(page, { evento: aprovado({ category: 'esporte', classificacao: null, status: 'draft', approval_status: 'pending' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Regras e idade/)
    await expect(page.getByText('Evento esportivo não leva selo de classificação.')).toBeVisible()
    await expect(page.getByText('A venda de evento esportivo fica bloqueada por enquanto')).toBeVisible()
    await expect(page.getByRole('radio', { name: /16 anos/ })).toHaveCount(0)
  })
})
