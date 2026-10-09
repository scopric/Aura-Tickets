import { test, expect, type Page } from '@playwright/test'

// P05: Payment com pedido gravado pelo total do banco e sem promessa falsa. PostgREST e Edge Functions simulados; nada vai ao banco real.
const PEDIDO = { id: 'ord-new', total: 110, gateway_payment_id: 'PAY-X', customer_name: 'Maria', customer_email: 'user@aura.teste', status: 'pending', payment_method: 'pix' }
type Cap = { orders: any[]; items: any[]; fn: { url: string; body: any }[] }

async function preparar(page: Page, preco: number | null = 50): Promise<Cap> {
  const cap: Cap = { orders: [], items: [], fn: [] }
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/rpc/evento_publico*', (r) => r.fulfill({ json: { evento: { id: 'evt-001', start_date: new Date(Date.now() + 30 * 864e5).toISOString(), end_date: null }, ingressos: [{ id: 'tt-1', price: preco }] } }))
  await page.route('**/rest/v1/orders*', (r) => {
    const req = r.request()
    if (req.method() === 'POST') { cap.orders.push(req.postDataJSON()); return r.fulfill({ status: 201, json: PEDIDO }) }
    return r.fulfill({ json: [] })
  })
  await page.route('**/rest/v1/order_items*', (r) => {
    if (r.request().method() === 'POST') { cap.items.push(r.request().postDataJSON()); return r.fulfill({ status: 201, json: [] }) }
    return r.fulfill({ json: [] })
  })
  await page.route('**/functions/v1/**', (r) => {
    cap.fn.push({ url: r.request().url(), body: r.request().postDataJSON() })
    return r.fulfill({ json: { chargeId: 'c1', qrCodeData: '000201PIXMOCK', qrCodeImageUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', transactionId: 't1', clientSecret: 's' } })
  })
  await page.addInitScript(() => sessionStorage.setItem('aura_pending_checkout', JSON.stringify({
    eventId: 'evt-001', cart: { 'tt-1': 2 }, totalAmount: 110,
    itemsSummary: [{ ticket_type_id: 'tt-1', quantity: 2, name: 'Pista', price: 50 }],
  })))
  await page.goto('/auth/login')
  await page.getByRole('button', { name: 'Participante', exact: true }).click()
  await page.getByPlaceholder('seu@email.com').fill('user@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar como Participante/ }).click()
  await expect(page).toHaveURL(/.*\/app\/hub/)
  await page.goto('/checkout/payment')
  return cap
}

test.describe('Checkout P05 (pagamento ainda mock)', () => {
  test('sem textos falsos; cartão em breve e só Pix', async ({ page }) => {
    await preparar(page)
    await expect(page.getByRole('heading', { name: 'Pagamento' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Cartão de Crédito/ })).toHaveAttribute('aria-disabled', 'true')
    const txt = await page.locator('body').innerText()
    for (const falso of [/Woovi/i, /Stripe/i, /criptograf/i, /pagamento seguro/i, /compra segura/i, /SSL/i, /aprovad/i]) expect(txt).not.toMatch(falso)
    await page.screenshot({ path: 'test-results/p05-payment.png', fullPage: true })
  })

  test('Pix: pedido gravado com total do banco e CPF obrigatório', async ({ page }) => {
    const cap = await preparar(page)
    await page.getByRole('button', { name: /Pagar Agora/ }).click()
    await expect(page.getByLabel('CPF do comprador')).toBeFocused()
    expect(cap.orders).toHaveLength(0)
    // a chamada a pagbank-criar-pedido exige reCAPTCHA real: aqui só se confere o pedido
    await page.getByLabel('CPF do comprador').fill('52998224725')
    await page.getByRole('button', { name: /Pagar Agora/ }).click()
    await expect.poll(() => cap.orders.length).toBeGreaterThan(0)
    expect(cap.orders[0]).toMatchObject({ subtotal: 100, service_fee: 10, total: 110, status: 'pending' })
    expect(cap.items[0]).toEqual([expect.objectContaining({ ticket_type_id: 'tt-1', quantity: 2, unit_price: 50, subtotal: 100 })])
    await page.screenshot({ path: 'test-results/p05-pix.png', fullPage: true })
  })

  test('ingresso sem preço: erro amigável e nenhum pedido gravado', async ({ page }) => {
    const cap = await preparar(page, null)
    await page.getByRole('radio', { name: /Pix/ }).click()
    await page.getByRole('button', { name: /Pagar Agora/ }).click()
    await expect(page.getByText(/Erro ao criar pedido: Ingresso sem preço/)).toBeVisible()
    expect(cap.orders).toHaveLength(0)
    expect(cap.fn).toHaveLength(0)
    await page.screenshot({ path: 'test-results/p05-sem-preco.png', fullPage: true })
  })
})
