import { test, expect, type Page } from '@playwright/test'

// P08: tela Compras e pedidos. PostgREST simulado; nada vai ao banco real.
// conta real simulada (não demo: a conta demo devolve pedidos de exemplo sem consultar o banco)
const UID = '22222222-2222-4222-8222-222222222222'
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 36000
const sess = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ aal: 'aal1', sub: UID, role: 'authenticated', exp })}.sig`, refresh_token: 'r', token_type: 'bearer', expires_in: 36000, expires_at: exp,
  user: { id: UID, aud: 'authenticated', role: 'authenticated', email: 'p@teste.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
const ID = 'abcdef12-0000-4000-8000-000000000001'
const pedido = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, event_id: 'evt-1', status, payment_method: 'pix', total: 80, created_at: '2026-01-02T12:00:00Z',
  events: { title: 'Noite de Forró', date: '2030-12-12', time: '22:00:00', venue_name: 'Espaço', status: 'published' },
  order_items: [{ quantity: 2, ticket_types: { name: 'Pista' } }], ...extra,
})

async function abrir(page: Page, orders: (n: number) => { status?: number; json: unknown }) {
  let n = 0
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.addInitScript((s) => localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(s)), sess)
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/rpc/chat_public_settings*', (r) => r.fulfill({ json: { aberto_agora: true, prazo: 'Respondemos em até 1 dia útil.' } }))
  await page.route('**/rest/v1/chat_topics*', (r) => r.fulfill({ json: [{ id: 't1', label: 'Não recebi ou não acho meu ingresso', hint: null, urgent: false }, { id: 't2', label: 'Pagamento: cobrança, Pix ou cartão', hint: null, urgent: false }] }))
  await page.route('**/rest/v1/orders*', (r) => r.fulfill(orders(n++)))
  await page.route('**/auth/v1/**', (r) => r.fulfill({ json: sess.user }))
  await page.route('**/rest/v1/rpc/meu_perfil', (r) => r.fulfill({ json: { id: UID, full_name: 'Teste', role: 'participant', email: 'p@teste.invalid', is_authorized: true } }))
  await page.goto('/app/orders')
}

test.describe('Compras P08', () => {
  test('cartão: evento, data do evento, itens, número copiável, Ver ingressos só no pago, suporte com o pedido', async ({ page }) => {
    await abrir(page, () => ({ json: [pedido(ID, 'paid'), pedido('bbbbbbbb-0000-4000-8000-000000000002', 'pending'), pedido('cccccccc-0000-4000-8000-000000000003', 'failed'), pedido('dddddddd-0000-4000-8000-000000000004', 'cancelled')] }))
    await expect(page.getByText('Pedido #ABCDEF12')).toBeVisible()
    await expect(page.getByText('2× Pista').first()).toBeVisible()
    await expect(page.getByText(/12 dez de 2030/).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Ver ingressos/ })).toHaveCount(1)
    await expect(page.getByRole('link', { name: /Ver ingressos/ })).toHaveAttribute('href', '/app/tickets?evento=evt-1')
    await expect(page.getByText('Respondemos em até 1 dia útil.').first()).toBeVisible()
    await page.getByRole('button', { name: 'Copiar número do pedido ABCDEF12' }).click()
    await expect(page.getByText('Copiado')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ID)
    await page.getByRole('button', { name: /Falar com o suporte sobre este pedido/ }).first().click()
    await expect(page.getByLabel('Mensagem')).toHaveValue(new RegExp(`Pedido #ABCDEF12.*${ID}`))
    await expect(page.getByRole('heading', { name: 'Não recebi ou não acho meu ingresso' })).toBeVisible()
    await page.screenshot({ path: 'test-results/p08-pedidos.png', fullPage: true })
  })

  test('dois cliques em pedidos diferentes: o campo traz o número do 2º', async ({ page }) => {
    const ID2 = 'bbbbbbbb-0000-4000-8000-000000000002'
    await abrir(page, () => ({ json: [pedido(ID, 'paid'), pedido(ID2, 'pending')] }))
    const botoes = page.getByRole('button', { name: /Falar com o suporte sobre este pedido/ })
    await botoes.nth(0).click()
    await expect(page.getByLabel('Mensagem')).toHaveValue(new RegExp(ID))
    await botoes.nth(1).click()
    await expect(page.getByLabel('Mensagem')).toHaveValue(new RegExp(ID2))
  })

  test('evento fora do ar: cartão "Evento indisponível" sem quebrar', async ({ page }) => {
    await abrir(page, () => ({ json: [pedido(ID, 'paid', { events: null })] }))
    await expect(page.getByRole('heading', { name: 'Evento indisponível' })).toBeVisible()
    await expect(page.getByText('Pedido #ABCDEF12')).toBeVisible()
  })

  test('erro ao carregar não vira "nenhuma compra"; tentar de novo recarrega', async ({ page }) => {
    let falha = true // o react-query repete a consulta sozinho: a falha vale até o clique
    await abrir(page, () => falha ? { status: 500, json: { message: 'falha' } } : { json: [pedido(ID, 'paid')] })
    await expect(page.getByText('Não foi possível carregar suas compras.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/nenhuma compra/)).toHaveCount(0)
    falha = false
    await page.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(page.getByText('Pedido #ABCDEF12')).toBeVisible()
  })

  test('sem pedidos: "nenhuma compra"', async ({ page }) => {
    await abrir(page, () => ({ json: [] }))
    await expect(page.getByText('Você ainda não fez nenhuma compra.')).toBeVisible()
  })
})
