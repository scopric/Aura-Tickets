import { test, expect, type Page } from '@playwright/test'

// F1 PR3e-1: visibilidade do evento. No painel (Publicar), escolher "Só com link" grava visibility e o evento some de
// /events, mas abre pelo link (rpc evento_publico). O Supabase é simulado por page.route, com estado.
// Conta de demonstração do produtor (só em desenvolvimento).
// PW_CHANNEL=chrome PW_BASE_URL=http://localhost:3161 npx playwright test src/test/e2e-f1-visibilidade.spec.ts --project=chromium

const PRODUTOR = 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4' // produtor@aura.teste
const EVENTO = 'e0000000-0000-4000-8000-0000000000f1'
test.skip(({ isMobile }) => isMobile, 'a lateral do produtor cobre a tela no celular nos e2e')

type Linha = Record<string, unknown>
const ingresso: Linha = { id: 'a0000000-0000-4000-8000-0000000000a1', event_id: EVENTO, name: 'Pista', description: null, price: 80, capacity: 200, quantity_total: 200, sold: 0, type: 'individual', perks: [], is_active: true, inclui_bebida: false, created_at: '2026-10-01T00:00:00Z' }

async function montarBanco(page: Page) {
  const evento: Linha = {
    id: EVENTO, producer_id: PRODUTOR, title: 'Noite de teste', subtitle: null, slug: 'noite-de-teste', description: 'Baile de forró no Espaço Torres, em Curitiba.', category: 'festa_encontro',
    temas: ['musica'], estilos: [], tags: [], date: '2099-12-12', time: '22:00:00', start_date: '2099-12-12T22:00:00-03:00', end_date: null, local_modo: 'presencial',
    venue_name: 'Espaço Torres', venue_address: 'Rua das Flores, 123 - Centro', venue_city: 'Curitiba', venue_state: 'PR', venue_zip: '80010-000', classificacao: 'A16', accent_color: null,
    cover_image: null, image_url: null, status: 'published', approval_status: 'approved', visibility: 'public', created_at: '2026-10-01T00:00:00Z',
  }
  const db = { evento, patches: [] as Linha[], rpc: [] as unknown[] }
  await page.route(/\/rest\/v1\/events(\?|$)/, async route => {
    const r = route.request()
    if (r.method() === 'PATCH') {
      const body = r.postDataJSON() as Linha
      db.patches.push(body)
      Object.assign(db.evento, body)
      return route.fulfill({ json: { id: EVENTO } })
    }
    if (r.method() !== 'GET') return route.fallback()
    // a lista pública filtra por visibility=eq.public (o banco de verdade também esconde o resto por RLS)
    if (r.url().includes('visibility=eq.public')) return route.fulfill({ json: db.evento.visibility === 'public' ? [{ ...db.evento, ticket_types: [ingresso] }] : [] })
    return route.fulfill({ json: [{ ...db.evento, ticket_types: [ingresso] }] })
  })
  await page.route('**/rest/v1/rpc/evento_publico', async route => {
    const { p_ref } = route.request().postDataJSON() as { p_ref: string }
    db.rpc.push(p_ref)
    const acesso = db.evento.visibility === 'public' ? 'aberto' : db.evento.visibility === 'unlisted' ? 'link' : null
    return route.fulfill({ json: acesso && (p_ref === EVENTO || p_ref === db.evento.slug) ? { acesso, evento: db.evento, ingressos: [ingresso] } : null })
  })
  await page.route(/\/rest\/v1\/ticket_types(\?|$)/, route => route.fulfill({ json: [ingresso] }))
  await page.route(/\/rest\/v1\/tickets(\?|$)/, route => route.fulfill({ headers: { 'content-range': '*/0', 'access-control-expose-headers': 'content-range' }, json: [] }))
  await page.route(/\/rest\/v1\/evento_privado(\?|$)/, route => route.fulfill({ json: [] }))
  await page.route(/\/rest\/v1\/evento_aceites(\?|$)/, route => route.fulfill({ json: [] }))
  await page.route(/\/rest\/v1\/onboarding_logs(\?|$)/, route => route.fulfill({ json: [{ step_name: 'guia:painel-evento' }] }))
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

test('"Só com link" no painel grava, o evento some de /events e abre pelo link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const db = await montarBanco(page)
  await entrarProdutor(page)

  await page.goto('/events')
  await expect(page.getByText('Noite de teste').first()).toBeVisible()

  await page.goto(`/producer/events/${EVENTO}/edit`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const publicar = page.getByRole('button', { name: /^Publicar/ })
  if ((await publicar.getAttribute('aria-expanded')) !== 'true') await publicar.click()

  const grupo = page.getByRole('radiogroup', { name: 'Quem pode ver o evento' })
  await expect(grupo.getByRole('radio', { name: /Pública/ })).toBeChecked()
  await expect(grupo.getByRole('radio', { name: /Com senha/ })).toBeDisabled()
  await expect(grupo.getByRole('radio', { name: /Só para convidados/ })).toBeDisabled()
  await grupo.getByRole('radio', { name: /Só com link/ }).click()
  await expect(page.getByText('Visibilidade atualizada.')).toBeVisible()
  expect(db.patches).toEqual([{ visibility: 'unlisted' }])
  await expect(grupo.getByRole('radio', { name: /Só com link/ })).toBeChecked()

  await page.getByRole('button', { name: 'Copiar link' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/event\/noite-de-teste$/)

  await page.goto('/events')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Noite de teste')).toHaveCount(0)

  await page.goto('/event/noite-de-teste')
  await expect(page.getByRole('heading', { level: 1, name: 'Noite de teste' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
})

test('evento público continua indexável', async ({ page }) => {
  await montarBanco(page)
  await page.goto('/event/noite-de-teste')
  await expect(page.getByRole('heading', { level: 1, name: 'Noite de teste' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
})
