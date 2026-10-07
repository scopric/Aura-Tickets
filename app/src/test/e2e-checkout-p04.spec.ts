import { test, expect, type Page } from '@playwright/test'

// P04: janela de venda, evento terminado, pedido grátis, teto por pedido e carrinho com mapa. PostgREST e Edge Functions simulados; nada vai ao banco real.
const H = 3_600_000
const iso = (ms: number) => new Date(Date.now() + ms).toISOString()
type Tipo = Record<string, unknown>
const tipo = (o: Tipo): Tipo => ({ id: 'tt-1', name: 'Pista', price: 50, type: 'individual', is_active: true, quantity_total: null, sold: 0, sale_start: null, sale_end: null, max_per_order: null, ...o })
const EVENTO = { id: 'evt-001', title: 'Festa Teste', status: 'published', approval_status: 'approved', start_date: iso(48 * H), end_date: iso(52 * H), date: null, time: null }
type Cap = { orders: any[]; rpcs: { nome: string; body: any }[]; fn: any[] }
const ASSENTOS = [
  { id: 's1', type: 'seat', label: 'A1', x: 2, y: 2, sectionId: 'vip', status: 'free', price: 50, color: '#000' },
  { id: 's2', type: 'seat', label: 'A2', x: 4, y: 2, sectionId: 'vip', status: 'free', price: 50, color: '#000' },
]

async function preparar(page: Page, o: { ingressos: Tipo[]; evento?: Record<string, unknown>; cart?: Record<string, number>; mapa?: boolean; destino?: string; vencePorSeg?: number }): Promise<Cap> {
  const cap: Cap = { orders: [], rpcs: [], fn: [] }
  const evento = { ...EVENTO, ...o.evento }
  const cart = o.cart ?? {}
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/rpc/evento_publico*', (r) => r.fulfill({ json: { evento, ingressos: o.ingressos } }))
  await page.route('**/rest/v1/rpc/confirmar_pedido_gratis*', (r) => { cap.rpcs.push({ nome: 'confirmar_pedido_gratis', body: r.request().postDataJSON() }); return r.fulfill({ json: null }) })
  await page.route('**/rest/v1/seating_maps*', (r) => r.fulfill({ json: o.mapa
    ? { environments: [{ id: 'terreo', name: 'Térreo', sections: [{ id: 'vip', name: 'VIP', color: '#000', price: 50, ticketTypeId: 'tt-1' }], seats: ASSENTOS }] }
    : null }))
  // lugar marcado: A2 já vendido; a reserva devolve o pedido e o prazo (o banco real faz isso em reservar_assentos)
  await page.route('**/rest/v1/rpc/assentos_ocupados*', (r) => r.fulfill({ json: [{ seat_key: 'terreo:s2', estado: 'vendido' }] }))
  await page.route('**/rest/v1/rpc/reservar_assentos*', (r) => {
    cap.rpcs.push({ nome: 'reservar_assentos', body: r.request().postDataJSON() })
    return r.fulfill({ json: { order_id: 'ord-seat', expira_em: iso((o.vencePorSeg ?? 600) * 1000), agora: iso(0) } })
  })
  await page.route('**/rest/v1/orders*', (r) => {
    const req = r.request()
    if (req.method() === 'POST') {
      const b = req.postDataJSON(); cap.orders.push(b)
      return r.fulfill({ status: 201, json: { id: 'ord-new', total: b.total, gateway_payment_id: null, customer_name: 'Maria', customer_email: 'user@aura.teste', status: 'pending', payment_method: b.payment_method } })
    }
    if (req.url().includes('ord-seat')) return r.fulfill({ json: { id: 'ord-seat', total: 55, status: 'pending', customer_name: 'Maria', customer_email: 'user@aura.teste' } })
    return r.fulfill({ json: [] })
  })
  await page.route('**/rest/v1/order_items*', (r) => r.fulfill(r.request().method() === 'POST' ? { status: 201, json: [] } : { json: [] }))
  await page.route('**/functions/v1/**', (r) => {
    cap.fn.push({ url: r.request().url(), body: r.request().postDataJSON() })
    return r.fulfill({ json: { chargeId: 'c1', qrCodeData: '000201PIXMOCK', qrCodeImageUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', transactionId: 't1', clientSecret: 's' } })
  })
  const resumo = o.ingressos.filter(t => cart[t.id as string]).map(t => ({ ticket_type_id: t.id, quantity: cart[t.id as string], name: t.name, price: t.price }))
  await page.addInitScript((p) => sessionStorage.setItem('aura_pending_checkout', JSON.stringify(p)), { eventId: 'evt-001', cart, totalAmount: 0, itemsSummary: resumo })
  await page.goto('/auth/login')
  await page.getByRole('button', { name: 'Participante', exact: true }).click()
  await page.getByPlaceholder('seu@email.com').fill('user@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar como Participante/ }).click()
  await expect(page).toHaveURL(/.*\/app\/hub/)
  await page.goto(o.destino ?? '/checkout')
  return cap
}

const contador = (page: Page, nome: string) => page.getByRole('group', { name: `Quantidade de ${nome}` })
const mais = (page: Page, nome: string) => page.getByRole('button', { name: `Adicionar um ${nome}` })
const qtd = async (page: Page, nome: string) => Number((await contador(page, nome).locator('span[aria-hidden="true"]').last().innerText()).trim())

test.describe('Checkout P04', () => {
  test('1. sale_start no futuro: "Vendas abrem em", + desligado e não avança', async ({ page }) => {
    await preparar(page, { ingressos: [tipo({ sale_start: iso(5 * H) })] })
    await expect(page.getByText(/Vendas abrem em/)).toBeVisible()
    await expect(mais(page, 'Pista')).toHaveAttribute('aria-disabled', 'true')
    await mais(page, 'Pista').click({ force: true })
    expect(await qtd(page, 'Pista')).toBe(0)
    await page.getByRole('button', { name: /Continuar|Pagamento|Finalizar/ }).first().click({ force: true }).catch(() => {})
    await expect(page).not.toHaveURL(/payment/)
    await page.screenshot({ path: 'test-results/p04-vendas-abrem.png', fullPage: true })
  })

  test('1b. carrinho antigo com tipo ainda fechado não avança para o pagamento', async ({ page }) => {
    await preparar(page, { ingressos: [tipo({ sale_start: iso(5 * H) })], cart: { 'tt-1': 1 } })
    await page.getByRole('button', { name: /Continuar|Pagamento|Finalizar/ }).first().click()
    await expect(page.getByText(/Pista: Vendas abrem em/)).toBeVisible()
    await expect(page).not.toHaveURL(/payment/)
  })

  test('2. sale_end passado: "Vendas encerradas"; evento terminado: "Este evento já terminou"', async ({ page }) => {
    await preparar(page, { ingressos: [tipo({ sale_end: iso(-2 * H) })] })
    await expect(page.getByText('Vendas encerradas')).toBeVisible()
    await expect(mais(page, 'Pista')).toHaveAttribute('aria-disabled', 'true')
    await page.screenshot({ path: 'test-results/p04-encerradas.png', fullPage: true })
  })

  test('2b. evento já terminou', async ({ page }) => {
    await preparar(page, { ingressos: [tipo({})], evento: { start_date: iso(-30 * H), end_date: iso(-26 * H) } })
    await expect(page.getByText('Este evento já terminou')).toBeVisible()
    await expect(mais(page, 'Pista')).toHaveAttribute('aria-disabled', 'true')
    await page.screenshot({ path: 'test-results/p04-terminou.png', fullPage: true })
  })

  test('3. evento grátis: sem cartão/Pix, pedido total 0 sem forma de pagamento, confirmar_pedido_gratis e /checkout/success', async ({ page }) => {
    const cap = await preparar(page, { ingressos: [tipo({ price: 0 })], cart: { 'tt-1': 2 }, destino: '/checkout/payment' })
    await expect(page.getByRole('button', { name: 'Garantir ingresso grátis' })).toBeVisible()
    await expect(page.getByRole('radio')).toHaveCount(0)
    await expect(page.getByLabel('Número do Cartão')).toHaveCount(0)
    await expect(page.getByText(/Pix/)).toHaveCount(0)
    await page.screenshot({ path: 'test-results/p04-gratis.png', fullPage: true })
    await page.getByRole('button', { name: 'Garantir ingresso grátis' }).click()
    await expect(page).toHaveURL(/\/checkout\/success/)
    expect(cap.orders[0]).toMatchObject({ total: 0, payment_method: null })
    expect(cap.rpcs).toEqual([{ nome: 'confirmar_pedido_gratis', body: { p_order: 'ord-new' } }])
    expect(cap.fn).toHaveLength(0)
  })

  test('4. teto: max_per_order 4 para em 4; grátis sem max para em 10; pago sem max passa de 10', async ({ page }) => {
    await preparar(page, { ingressos: [
      tipo({ id: 'tt-a', name: 'Com Teto', max_per_order: 4 }),
      tipo({ id: 'tt-b', name: 'Gratis', price: 0 }),
      tipo({ id: 'tt-c', name: 'Pago Livre' }),
    ] })
    await expect(page.getByText('máx. 4 por pedido').first()).toBeVisible()
    for (const [nome, n] of [['Com Teto', 6], ['Gratis', 12], ['Pago Livre', 12]] as const) for (let i = 0; i < n; i++) await mais(page, nome).click({ force: true }) // no limite o botão é aria-disabled e ignora o clique
    expect(await qtd(page, 'Com Teto')).toBe(4)
    expect(await qtd(page, 'Gratis')).toBe(10)
    expect(await qtd(page, 'Pago Livre')).toBe(12)
    await expect(mais(page, 'Com Teto')).toHaveAttribute('aria-disabled', 'true')
    await expect(mais(page, 'Pago Livre')).toHaveAttribute('aria-disabled', 'false')
    await page.screenshot({ path: 'test-results/p04-teto.png', fullPage: true })
  })

  test('5. evento com mapa: carrinho vindo da página não é zerado', async ({ page }) => {
    await preparar(page, { ingressos: [tipo({})], cart: { 'tt-1': 2 }, mapa: true })
    await expect(page.getByRole('button', { name: 'Ver o mapa do salão' })).toBeVisible()
    expect(await qtd(page, 'Pista')).toBe(2)
    await page.getByRole('button', { name: 'Ver o mapa do salão' }).click()
    await expect(page.getByRole('note')).toBeVisible()
    expect(await qtd(page, 'Pista')).toBe(2)
    await expect(page.getByText(/100,00/).first()).toBeVisible()
    await page.screenshot({ path: 'test-results/p04-mapa.png', fullPage: true })
  })

  test('5b. lugar marcado: escolhe A1, A2 vendido não clica, reserva, vai ao pagamento com a contagem e o pedido do banco', async ({ page }) => {
    const cap = await preparar(page, { ingressos: [tipo({})], mapa: true })
    await page.getByRole('button', { name: 'Ver o mapa do salão' }).click()
    await expect(page.getByRole('button', { name: 'A2' })).toHaveCount(0) // vendido: não é botão
    await page.getByRole('button', { name: 'A1' }).click()
    await expect(page.getByText('1 lugar escolhido')).toBeVisible()
    await page.screenshot({ path: 'test-results/p03-lugar-escolhido.png', fullPage: true })
    await page.getByRole('button', { name: /Continuar para Pagamento/ }).click()
    await expect(page).toHaveURL(/checkout\/payment/)
    expect(cap.rpcs).toEqual([{ nome: 'reservar_assentos', body: { p_event: 'evt-001', p_seats: ['terreo:s1'] } }])
    await expect(page.getByRole('timer')).toContainText(/Seu lugar fica reservado por 09:5\d|Seu lugar fica reservado por 10:00/)
    expect(cap.orders).toHaveLength(0) // o pedido veio da reserva: o navegador não cria outro
    await page.screenshot({ path: 'test-results/p03-pagamento-contagem.png', fullPage: true })
  })

  test('5c. lugar marcado: a contagem zera, mostra "Tempo esgotado" e volta ao mapa', async ({ page }) => {
    await preparar(page, { ingressos: [tipo({})], mapa: true, vencePorSeg: 6 })
    await page.getByRole('button', { name: 'Ver o mapa do salão' }).click()
    await page.getByRole('button', { name: 'A1' }).click()
    await page.getByRole('button', { name: /Continuar para Pagamento/ }).click()
    await page.getByRole('radio', { name: /Pix/ }).click()
    await page.getByRole('button', { name: /Pagar Agora/ }).click()
    await expect(page.getByRole('heading', { name: 'Efetue o pagamento Pix' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Tempo esgotado', { timeout: 12000 })
    // com o tempo esgotado o Pix gerado (código e QR) some
    await expect(page.getByRole('heading', { name: 'Efetue o pagamento Pix' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Copiar código Pix/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Pagar Agora/ })).toHaveCount(0)
    await page.screenshot({ path: 'test-results/p03-tempo-esgotado.png', fullPage: true })
    await page.getByRole('button', { name: 'Voltar ao mapa' }).click()
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByRole('button', { name: 'A1' })).toBeVisible()
  })

  test('6. fluxo pago (Pix): amount = total do pedido', async ({ page }) => {
    const cap = await preparar(page, { ingressos: [tipo({})], cart: { 'tt-1': 2 }, destino: '/checkout/payment' })
    await expect(page.getByRole('button', { name: /Pagar Agora/ })).toBeVisible()
    await page.getByRole('radio', { name: /Pix/ }).click()
    await page.getByRole('button', { name: /Pagar Agora/ }).click()
    await expect(page.getByRole('heading', { name: 'Efetue o pagamento Pix' })).toBeVisible()
    expect(cap.orders[0]).toMatchObject({ subtotal: 100, service_fee: 10, total: 110, payment_method: 'pix' })
    expect(cap.fn[0].url).toContain('woovi-create-pix')
    expect(cap.fn[0].body).toMatchObject({ orderId: 'ord-new', amount: 110 })
    expect(cap.rpcs).toHaveLength(0)
  })
})
