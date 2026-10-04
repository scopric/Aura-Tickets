import { createHash } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import { ACEITE_VERSAO, textoAceite } from '../lib/tipoEvento'

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
  evento: Linha; ingressos: Linha[]; link: string | null; vendidos: Record<string, number>; aceites: Linha[]
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

function umAceite(ev: Linha, temBebida: boolean): Linha {
  const texto = textoAceite({ titulo: ev.title as string, formato: (ev.category as string | null) ?? null, classificacao: (ev.classificacao as string | null) ?? null, temBebida })
  return { classificacao: ev.category === 'esporte' ? null : (ev.classificacao ?? null), tem_bebida: temBebida, versao: ACEITE_VERSAO, texto_hash: createHash('sha256').update(texto).digest('hex') }
}
// O que a função aceite-evento responde: lê o evento e os ingressos GRAVADOS, grava o aceite e devolve o hash do texto
function aceiteOk(db: Banco) {
  const a = umAceite(db.evento, db.ingressos.some(t => t.inclui_bebida))
  db.aceites.push(a)
  return { status: 200, json: { ok: true, id: 'a1', aceito_em: '2026-10-05T00:00:00Z', ...a } }
}

async function montarBanco(page: Page, ini: Partial<Banco> & { evento: Linha }): Promise<Banco> {
  const db: Banco = {
    ingressos: [], link: null, vendidos: {}, chamadas: [], patches: [],
    aceites: [], aceite: () => aceiteOk(db),
    ...ini,
  }
  // evento que já foi aprovado tem um aceite coerente com ele, salvo se o teste disser outra coisa
  if (!ini.aceites && db.evento.status === 'published') db.aceites.push(umAceite(db.evento, db.ingressos.some(t => t.inclui_bebida)))
  const idDe = (url: string, campo: string) => new URL(url).searchParams.get(campo)?.replace(/^eq\./, '') ?? ''

  await page.route(/\/rest\/v1\/events(\?|$)/, async route => {
    const r = route.request()
    if (r.method() === 'GET') return route.fulfill({ json: [{ ...db.evento, ticket_types: db.ingressos }] })
    if (r.method() === 'PATCH') {
      const body = r.postDataJSON() as Linha
      db.patches.push(body)
      db.chamadas.push(`PATCH events ${Object.keys(body).join(',')}`)
      // o gatilho do banco: rascunho que vira published fica pending (PR3a); mudar conteúdo de evento aprovado também (F0a)
      if (body.status === 'published' && db.evento.status !== 'published') db.evento.approval_status = 'pending'
      else if (db.evento.status === 'published' && db.evento.approval_status === 'approved' && Object.keys(body).some(k => k !== 'accent_color')) db.evento.approval_status = 'pending'
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
    if (r.method() === 'DELETE') { db.link = null; db.chamadas.push('DELETE evento_privado'); return route.fulfill({ status: 204, body: '' }) }
    if (r.method() === 'POST') {
      const body = r.postDataJSON() as Linha
      db.link = (body.online_url as string | null) ?? null
      db.chamadas.push(`UPSERT evento_privado ${db.link ?? 'null'}`)
      return route.fulfill({ status: 201, json: { event_id: EVENTO } })
    }
    return route.fallback()
  })
  await page.route(/\/rest\/v1\/evento_aceites(\?|$)/, route => route.fulfill({ json: db.aceites.slice(-1) }))
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
    await expect(page.getByText('Aceite pendente', { exact: true })).toHaveCount(0) // o aceite acabou de ser feito e foi relido
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
    await expect(page.getByRole('alert').filter({ hasText: 'não confere com o texto que você leu' })).toBeVisible()
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
    await expect(dlg).toContainText('A classificação ou a bebida mudou depois do último aceite: refaça o aceite com a classificação A18')
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

test.describe('painel do evento: aceite pendente, saída com mudanças e link por modo', () => {
  test('evento no ar: aceite que falha depois de gravar vira "Em análise" com "Aceite pendente", e dá para refazer', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado(), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Regras e idade/)
    await page.getByRole('radio', { name: /18 anos/ }).click()
    await page.getByRole('button', { name: 'Enviar alterações para análise' }).click()
    const dlg = page.getByRole('dialog', { name: 'Enviar alterações para análise?' })
    await page.waitForTimeout(400)
    await dlg.getByLabel(/Li e aceito o termo do produtor com a classificação A18/).check()
    const ok = db.aceite
    db.aceite = () => ({ status: 500, json: { error: 'DETALHE INTERNO' } })
    await dlg.getByRole('button', { name: 'Enviar para análise' }).click()

    // o conteúdo já foi gravado (e o gatilho mandou o evento para análise): a tela diz a verdade
    await expect(page.getByText('As alterações já foram para análise, mas o aceite não foi registrado. O servidor não conseguiu registrar o aceite. Tente de novo em instantes.').first()).toBeVisible()
    await expect(page.getByText('DETALHE INTERNO')).toHaveCount(0)
    await expect(page.getByText('Em análise pela equipe')).toBeVisible()
    await expect(page.getByText('Em análise', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Aceite pendente', { exact: true })).toBeVisible()
    expect(db.evento).toMatchObject({ classificacao: 'A18', approval_status: 'pending' })
    expect(db.chamadas).toEqual(['PATCH events classificacao', 'INVOKE aceite-evento'])

    // refazer o aceite: só o aceite, sem gravar nem publicar
    db.aceite = ok
    await page.getByRole('button', { name: 'Refazer o aceite' }).click()
    const dlg2 = page.getByRole('dialog', { name: 'Refazer o aceite?' })
    await page.waitForTimeout(400)
    await dlg2.getByRole('button', { name: 'Registrar o aceite' }).click({ force: true })
    expect(db.chamadas).toHaveLength(2) // sem o aceite marcado não envia
    await dlg2.getByLabel(/Li e aceito o termo do produtor/).check()
    await dlg2.getByRole('button', { name: 'Registrar o aceite' }).click()
    await expect(page.getByText('Aceite registrado.')).toBeVisible()
    await expect(page.getByText('Aceite pendente', { exact: true })).toHaveCount(0)
    expect(db.chamadas).toEqual(['PATCH events classificacao', 'INVOKE aceite-evento', 'INVOKE aceite-evento'])
    expect(db.evento.status).toBe('published')
  })

  test('refazer o aceite NÃO grava as alterações pendentes: o diálogo manda para "Enviar alterações para análise"', async ({ page }) => {
    const db = await montarBanco(page, {
      evento: aprovado({ classificacao: 'A18' }), ingressos: [ingresso()],
      aceites: [{ classificacao: 'A16', tem_bebida: false, versao: ACEITE_VERSAO, texto_hash: 'x' }], // o último aceite é de A16
    })
    await entrarProdutor(page)
    await abrirPainel(page)
    await expect(page.getByText('Aceite pendente', { exact: true })).toBeVisible()
    await abre(page, /^O que é/)
    await page.getByLabel('Subtítulo').fill('Mudou depois')
    await expect(page.getByText(/o envio delas para análise já refaz o aceite/)).toBeVisible()
    await page.getByRole('button', { name: 'Refazer o aceite' }).click()
    const dlg = page.getByRole('dialog', { name: 'Refazer o aceite?' })
    await expect(dlg).toContainText('O aceite não grava conteúdo')
    await expect(dlg.getByRole('button', { name: 'Registrar o aceite' })).toHaveCount(0)
    expect(db.chamadas).toEqual([]) // nada gravado, nada enviado
    await page.waitForTimeout(400)
    await dlg.getByRole('button', { name: 'Enviar alterações para análise' }).click()
    await expect(page.getByRole('dialog', { name: 'Enviar alterações para análise?' })).toBeVisible()
    await page.getByRole('dialog').getByLabel(/Li e aceito o termo do produtor com a classificação A18/).check()
    await page.getByRole('dialog').getByRole('button', { name: 'Enviar para análise' }).click()
    await expect(page.getByText('Alterações enviadas para análise.')).toBeVisible()
    expect(db.chamadas).toEqual(['PATCH events subtitle', 'INVOKE aceite-evento'])
    await expect(page.getByText('Aceite pendente', { exact: true })).toHaveCount(0) // o aceite novo já foi relido
  })

  for (const [nome, evt] of [['evento aprovado', () => aprovado()], ['evento em análise', () => aprovado({ approval_status: 'pending' })]] as const) {
    test(`${nome} SEM nenhum aceite registrado: faixa própria e o aceite é registrado`, async ({ page }) => {
      const db = await montarBanco(page, { evento: evt(), ingressos: [ingresso()], aceites: [] })
      await entrarProdutor(page)
      await abrirPainel(page)
      await expect(page.getByText('Aceite pendente', { exact: true })).toBeVisible()
      await expect(page.getByText('Este evento ainda não tem aceite do produtor registrado.')).toBeVisible()
      await page.getByRole('button', { name: 'Registrar o aceite' }).click()
      const dlg = page.getByRole('dialog', { name: 'Refazer o aceite?' })
      await page.waitForTimeout(400)
      await dlg.getByLabel(/Li e aceito o termo do produtor/).check()
      await dlg.getByRole('button', { name: 'Registrar o aceite' }).click()
      await expect(page.getByText('Aceite registrado.')).toBeVisible()
      await expect(page.getByText('Aceite pendente', { exact: true })).toHaveCount(0)
      expect(db.chamadas).toEqual(['INVOKE aceite-evento']) // só o aceite
    })
  }

  test('evento no ar, falha parcial (o evento gravou e o link não): relê e mostra "Em análise"', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ local_modo: 'online' }), ingressos: [ingresso()], link: 'https://meet.google.com/abc' })
    await entrarProdutor(page)
    await page.route(/\/rest\/v1\/evento_privado(\?|$)/, route => (route.request().method() === 'POST' ? route.fulfill({ status: 500, json: { message: 'falhou' } }) : route.fallback()))
    await abrirPainel(page)
    await abre(page, /^O que é/)
    await page.getByLabel('Subtítulo').fill('Mudou o subtítulo')
    await abre(page, /^Quando e onde/)
    await page.getByLabel('Link da transmissão').fill('https://meet.google.com/outro')
    await page.getByRole('button', { name: 'Enviar alterações para análise' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('dialog').getByRole('button', { name: 'Enviar para análise' }).click()
    await expect(page.getByText('Em análise pela equipe')).toBeVisible() // o banco já estava em análise
    await expect(page.getByText('O evento foi salvo e enviado para análise, mas o link não foi gravado: ele será salvo de novo.').first()).toBeVisible()
    expect(db.evento).toMatchObject({ approval_status: 'pending', subtitle: 'Mudou o subtítulo' })
    expect(db.link).toBe('https://meet.google.com/abc') // o link não gravou
  })

  test('evento NO AR presencial com link antigo: nada aparece como alteração; a cor salva na hora e sair não pergunta', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ local_modo: 'presencial' }), ingressos: [ingresso()], link: 'https://meet.google.com/velho' })
    await entrarProdutor(page)
    await abrirPainel(page)
    await page.waitForTimeout(1500)
    await expect(page.getByText(/Alterações não enviadas/)).toHaveCount(0)
    expect(db.chamadas).toEqual([]) // nada gravado nem apagado sozinho
    await abre(page, /^Imagem/)
    await salva(page, db, () => page.getByLabel('Cor do evento').evaluate((el: HTMLInputElement) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      set.call(el, '#336699'); el.dispatchEvent(new Event('input', { bubbles: true }))
    }))
    expect(db.patches.at(-1)).toEqual({ accent_color: '#336699' })
    await page.getByRole('link', { name: 'Todos os eventos' }).first().click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/producer\/events$/)
    expect(db.link).toBe('https://meet.google.com/velho') // o link antigo segue lá, inofensivo
  })

  test('divergência de hash: relê o evento e o próximo refazer funciona sem recarregar', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ classificacao: 'A18' }), ingressos: [ingresso()], aceites: [{ classificacao: 'A16', tem_bebida: false, versao: ACEITE_VERSAO, texto_hash: 'x' }] })
    const ok = db.aceite
    db.aceite = () => ({ status: 200, json: { ok: true, classificacao: 'A18', tem_bebida: false, texto_hash: 'e'.repeat(64) } })
    await entrarProdutor(page)
    await abrirPainel(page)
    await page.getByRole('button', { name: 'Refazer o aceite' }).click()
    const dlg = page.getByRole('dialog', { name: 'Refazer o aceite?' })
    await page.waitForTimeout(400)
    await dlg.getByLabel(/Li e aceito o termo do produtor/).check()
    await dlg.getByRole('button', { name: 'Registrar o aceite' }).click()
    await expect(dlg.getByRole('alert')).toContainText('Recarregue a página e refaça o aceite')
    db.aceite = ok
    await expect(dlg.getByRole('button', { name: 'Registrar o aceite' })).toBeEnabled()
    if (!(await dlg.getByLabel(/Li e aceito o termo do produtor/).isChecked())) await dlg.getByLabel(/Li e aceito o termo do produtor/).check()
    await dlg.getByRole('button', { name: 'Registrar o aceite' }).click()
    await expect(page.getByText('Aceite registrado.')).toBeVisible()
    await expect(page.getByText('Aceite pendente', { exact: true })).toHaveCount(0)
  })

  test('leitura do aceite falhou: a bebida mudada nos ingressos exige aceite no envio das alterações', async ({ page }) => {
    await montarBanco(page, { evento: aprovado(), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await page.route(/\/rest\/v1\/evento_aceites(\?|$)/, route => route.fulfill({ status: 500, json: { message: 'falhou' } }))
    await abrirPainel(page)
    await abre(page, /^Ingressos/)
    await page.getByLabel('Inclui bebida alcoólica').check()
    await page.getByRole('button', { name: 'Salvar ingressos' }).click()
    await expect(page.getByText('Ingressos salvos.')).toBeVisible()
    await abre(page, /^O que é/)
    await page.getByLabel('Subtítulo').fill('Mudou')
    await page.getByRole('button', { name: 'Enviar alterações para análise' }).click()
    await expect(page.getByRole('dialog').getByLabel(/Li e aceito o termo do produtor/)).toBeVisible()
  })

  test('link antigo: evento aberto em modo presencial com link salvo o apaga na primeira gravação', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending', local_modo: 'presencial' }), ingressos: [ingresso()], link: 'https://meet.google.com/velho' })
    await entrarProdutor(page)
    await abrirPainel(page)
    await expect.poll(() => db.chamadas.includes('DELETE evento_privado'), { timeout: 8000 }).toBe(true)
    expect(db.link).toBeNull()
  })

  test('em análise: mudar a classificação sem aceite novo mostra "Aceite pendente"', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ approval_status: 'pending' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await expect(page.getByText('Em análise pela equipe')).toBeVisible()
    await expect(page.getByText('Aceite pendente', { exact: true })).toHaveCount(0)
    await abre(page, /^Regras e idade/)
    await salva(page, db, () => page.getByRole('radio', { name: /18 anos/ }).click())
    await expect(page.getByText('Aceite pendente', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Refazer o aceite' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('dialog').getByLabel(/Li e aceito o termo do produtor/).check()
    await page.getByRole('dialog').getByRole('button', { name: 'Registrar o aceite' }).click()
    await expect(page.getByText('Aceite registrado.')).toBeVisible()
    await expect(page.getByText('Aceite pendente', { exact: true })).toHaveCount(0)
    expect(db.chamadas.at(-1)).toBe('INVOKE aceite-evento')
  })

  test('em análise: a bebida marcada num ingresso salvo também pede aceite novo', async ({ page }) => {
    await montarBanco(page, { evento: aprovado({ approval_status: 'pending' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Ingressos/)
    await page.getByLabel('Inclui bebida alcoólica').check()
    await page.getByRole('button', { name: 'Salvar ingressos' }).click()
    await expect(page.getByText('Ingressos salvos.')).toBeVisible()
    await expect(page.getByText('Aceite pendente', { exact: true })).toBeVisible()
  })

  test('hash do texto registrado diverge do que a pessoa leu: para e NÃO publica', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending' }), ingressos: [ingresso()] })
    db.aceite = () => ({ status: 200, json: { ok: true, classificacao: 'A16', tem_bebida: false, texto_hash: 'f'.repeat(64) } })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Publicar/)
    await page.getByLabel('Li e aceito o termo do produtor').check()
    await page.getByRole('button', { name: 'Enviar para aprovação' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'não confere com o texto que você leu' })).toBeVisible()
    expect(db.evento.status).toBe('draft')
    expect(db.chamadas.some(c => c === 'PATCH events status')).toBe(false)
  })

  test('resposta do aceite sem texto_hash também não publica', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending' }), ingressos: [ingresso()] })
    db.aceite = () => ({ status: 200, json: { ok: true, classificacao: 'A16', tem_bebida: false } })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Publicar/)
    await page.getByLabel('Li e aceito o termo do produtor').check()
    await page.getByRole('button', { name: 'Enviar para aprovação' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'não confere com o texto que você leu' })).toBeVisible()
    expect(db.evento.status).toBe('draft')
  })

  for (const [nome, evt] of [['rascunho', () => aprovado({ status: 'draft', approval_status: 'pending' })], ['evento no ar', () => aprovado()]] as const) {
    test(`ingresso não salvo: sair pela lateral pede confirmação (${nome})`, async ({ page }) => {
      await montarBanco(page, { evento: evt(), ingressos: [ingresso()] })
      await entrarProdutor(page)
      await abrirPainel(page)
      await abre(page, /^Ingressos/)
      await page.getByLabel('Preço (R$)').fill('99,00')
      await page.getByRole('link', { name: 'Todos os eventos' }).first().click()
      const dlg = page.getByRole('dialog', { name: 'Sair sem salvar?' })
      await expect(dlg).toContainText('ingressos com mudanças não salvas')
      await dlg.getByRole('button', { name: 'Continuar editando' }).click()
      await expect(page.getByLabel('Preço (R$)')).toHaveValue('99,00')
    })
  }

  test('autosave com erro: sair pela lateral avisa', async ({ page }) => {
    await montarBanco(page, { evento: evento() })
    await entrarProdutor(page)
    await page.route(/\/rest\/v1\/events(\?|$)/, route => (route.request().method() === 'PATCH' ? route.fulfill({ status: 500, json: { message: 'falhou' } }) : route.fallback()))
    await abrirPainel(page)
    await abre(page, /^O que é/)
    await page.getByLabel('Nome do evento').fill('Nome que não salvou')
    await expect(page.getByRole('status').filter({ hasText: /Não salvou/ })).toBeVisible()
    await page.getByRole('link', { name: 'Todos os eventos' }).first().click()
    const dlg = page.getByRole('dialog', { name: 'Sair sem salvar?' })
    await expect(dlg).toContainText('mudanças que ainda não foram salvas')
    await dlg.getByRole('button', { name: 'Continuar editando' }).click()
  })

  test('modo presencial apaga o link salvo; só a cor no evento no ar salva na hora, sem análise', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending', local_modo: 'online' }), ingressos: [ingresso()], link: 'https://meet.google.com/abc' })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Quando e onde/)
    await expect(page.getByLabel('Link da transmissão')).toHaveValue('https://meet.google.com/abc')
    await page.getByRole('radio', { name: 'Presencial' }).click()
    await expect.poll(() => db.chamadas.includes('DELETE evento_privado'), { timeout: 8000 }).toBe(true)
    expect(db.link).toBeNull()
    expect(db.patches.at(-1)).toEqual({ local_modo: 'presencial' })
  })

  test('evento no ar: só a cor salva na hora ("vale na hora"), sem faixa nem análise', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado(), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Imagem/)
    await salva(page, db, () => page.getByLabel('Cor do evento').evaluate((el: HTMLInputElement) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      set.call(el, '#336699'); el.dispatchEvent(new Event('input', { bubbles: true }))
    }))
    expect(db.patches.at(-1)).toEqual({ accent_color: '#336699' })
    await expect(page.getByText('Salvo: vale na hora')).toBeVisible()
    await expect(page.getByText(/Alterações não enviadas/)).toHaveCount(0)
    expect(db.evento.approval_status).toBe('approved')
    expect(db.chamadas).toEqual(['PATCH events accent_color'])
  })

  test('nome vazio (ou só espaços) não é gravado: mostra o erro e espera', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^O que é/)
    await page.getByLabel('Nome do evento').fill('   ')
    await expect(page.getByRole('alert').filter({ hasText: 'Escreva o nome: ele aparece na página e no ingresso.' })).toBeVisible()
    await expect(page.getByLabel('Nome do evento')).toHaveAttribute('aria-invalid', 'true')
    await page.waitForTimeout(1600)
    expect(db.patches).toHaveLength(0)
    await page.getByLabel('Nome do evento').fill('')
    await page.waitForTimeout(1600)
    expect(db.patches).toHaveLength(0)
    await salva(page, db, () => page.getByLabel('Nome do evento').fill('Nome novo'))
    expect(db.patches.at(-1)).toEqual({ title: 'Nome novo' })
  })

  test('quantidade acima de 1.000.000 não passa; erro 422 do banco ao salvar ingressos não fala de internet', async ({ page }) => {
    await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await page.route(/\/rest\/v1\/ticket_types(\?|$)/, route => (route.request().method() === 'PATCH' ? route.fulfill({ status: 422, json: { code: '22003', message: 'out of range' } }) : route.fallback()))
    await abrirPainel(page)
    await abre(page, /^Ingressos/)
    await page.getByLabel('Quantidade').fill('10000000000')
    await expect(page.getByText('Quantidade inválida: use um número inteiro entre 1 e 1.000.000.')).toBeVisible()
    await page.getByLabel('Quantidade').fill('1000000')
    await expect(page.getByText(/Quantidade inválida/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Salvar ingressos' }).click()
    await expect(page.getByText('O banco recusou um dos ingressos: confira nome, preço e quantidade.')).toBeVisible()
    await expect(page.getByText(/Confira a internet/)).toHaveCount(0)
  })

  test('depois de Descartar o foco vai para o título da página, não para o body', async ({ page }) => {
    await montarBanco(page, { evento: aprovado(), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^O que é/)
    await page.getByLabel('Subtítulo').fill('Mudou')
    await page.getByRole('button', { name: 'Descartar' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  })

  test('segmentados do painel: as setas trocam a seleção (Local e tipo do ingresso)', async ({ page }) => {
    await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Quando e onde/)
    await page.getByRole('radio', { name: 'Presencial' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: 'Online' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: 'Online' })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: 'Híbrido' })).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('radio', { name: 'Online' })).toHaveAttribute('aria-checked', 'true')
    await abre(page, /^Ingressos/)
    await page.getByRole('button', { name: 'Adicionar ingresso' }).click()
    const grupo = page.getByRole('group', { name: 'Ingresso 2' })
    await grupo.getByRole('radio', { name: 'Individual' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(grupo.getByRole('radio', { name: 'Mesa coletiva' })).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('ArrowLeft')
    await expect(grupo.getByRole('radio', { name: 'Individual' })).toHaveAttribute('aria-checked', 'true')
  })

  test('data com erro não é gravada: mostra o erro e espera', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado({ status: 'draft', approval_status: 'pending' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Quando e onde/)
    await page.getByLabel('Data de início').fill('2020-01-01')
    await expect(page.getByRole('alert').filter({ hasText: 'O início já passou' })).toBeVisible()
    await page.waitForTimeout(1600)
    expect(db.patches).toHaveLength(0)
    await page.getByLabel('Data de início').fill('2099-12-31')
    await expect.poll(() => db.patches.length, { timeout: 8000 }).toBe(1)
    expect(db.patches[0]).toMatchObject({ date: '2099-12-31', time: '22:00' })
  })

  test('quem não é dono nem colaborador de um evento no ar vê "Evento não encontrado"', async ({ page }) => {
    await montarBanco(page, { evento: aprovado({ producer_id: 'f0000000-0000-4000-8000-00000000000f' }), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await page.goto(`/producer/events/${EVENTO}/edit`)
    await expect(page.getByText('Evento não encontrado')).toBeVisible()
    await expect(page.getByRole('button', { name: /^O que é/ })).toHaveCount(0)
  })

  test('releitura que falha não desmonta o painel aberto', async ({ page }) => {
    const db = await montarBanco(page, { evento: aprovado(), ingressos: [ingresso()] })
    await entrarProdutor(page)
    await abrirPainel(page)
    await abre(page, /^Ingressos/)
    await page.route(/\/rest\/v1\/events(\?|$)/, route => (route.request().method() === 'GET' ? route.abort() : route.fallback()))
    await page.getByLabel('Inclui bebida alcoólica').check()
    await page.getByRole('button', { name: 'Salvar ingressos' }).click()
    await expect(page.getByText('Ingressos salvos.')).toBeVisible()
    await page.waitForTimeout(1500) // a releitura (com retry) falha: o painel continua
    await expect(page.getByRole('heading', { level: 1, name: 'Noite de teste' })).toBeVisible()
    await expect(page.getByText('Não foi possível carregar o evento')).toHaveCount(0)
    expect(db.ingressos[0]).toMatchObject({ inclui_bebida: true })
  })
})
