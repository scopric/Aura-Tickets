import { test, expect, type Page } from '@playwright/test'

// P05: pagamento Pix. PostgREST, Edge Functions e reCAPTCHA simulados; nada vai ao banco, ao PagBank nem ao Google.
// Rodar com a chave pública de teste no servidor: VITE_RECAPTCHA_SITE_KEY=teste npm run dev (o script do Google é trocado por um falso aqui).
type Cap = { rpc: { fn: string; body: any }[]; pix: any[]; pago: boolean }

async function preparar(page: Page, reserva: Record<string, unknown> = {}): Promise<Cap> {
  const cap: Cap = { rpc: [], pix: [], pago: false }
  const agora = Date.now()
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/rpc/evento_publico*', (r) => r.fulfill({ json: { evento: { id: 'evt-001', start_date: new Date(agora + 30 * 864e5).toISOString(), end_date: null }, ingressos: [{ id: 'tt-1', price: 50 }] } }))
  await page.route('**/rest/v1/rpc/reservar_ingressos*', (r) => {
    cap.rpc.push({ fn: 'reservar_ingressos', body: r.request().postDataJSON() })
    return r.fulfill({ json: { ok: true, order_id: 'ord-new', subtotal: 100, desconto: 0, taxa: 11.5, total: 111.5, agora: new Date(agora).toISOString(), reservado_ate: new Date(agora + 10 * 60_000).toISOString(), ...reserva } })
  })
  await page.route('**/rest/v1/orders*', (r) => r.fulfill({ json: cap.pago && r.request().url().includes('id=eq.ord-new') ? [{ status: 'paid' }] : [] })) // a tela consulta o status do pedido certo a cada 5 s
  await page.route('**/functions/v1/pagbank-criar-pedido', (r) => {
    cap.pix.push(r.request().postDataJSON())
    return r.fulfill({ json: { pix_copia_e_cola: '000201PIXMOCK', expira_em: new Date(agora + 9 * 60_000).toISOString() } })
  })
  await page.route('https://www.google.com/recaptcha/api.js*', (r) => r.fulfill({
    contentType: 'text/javascript',
    body: 'window.grecaptcha = { ready: (cb) => cb(), execute: async () => "token-de-teste" }',
  }))
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

test.describe('Checkout P05 (Pix)', () => {
  test('sem textos falsos; cartão em breve e só Pix', async ({ page }) => {
    await preparar(page)
    await expect(page.getByRole('heading', { name: 'Pagamento' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Cartão de Crédito/ })).toHaveAttribute('aria-disabled', 'true')
    const txt = await page.locator('body').innerText()
    for (const falso of [/Woovi/i, /Stripe/i, /criptograf/i, /pagamento seguro/i, /compra segura/i, /SSL/i, /aprovad/i]) expect(txt).not.toMatch(falso)
    await page.screenshot({ path: 'test-results/p05-payment.png', fullPage: true })
  })

  test('Pix: CPF obrigatório; reserva pelo banco; Pix pedido ao PagBank; sucesso quando o banco marca pago', async ({ page }) => {
    const cap = await preparar(page)
    await page.getByRole('button', { name: /Pagar Agora/ }).click()
    await expect(page.getByLabel('CPF do comprador')).toBeFocused()
    expect(cap.rpc).toHaveLength(0)
    expect(cap.pix).toHaveLength(0)

    await page.getByLabel('CPF do comprador').fill('529.982.247-25')
    await page.getByRole('button', { name: /Pagar Agora/ }).click()
    await expect(page.getByRole('heading', { name: 'Efetue o pagamento Pix' })).toBeVisible()
    await expect(page.getByText('000201PIXMOCK')).toBeVisible()
    await expect(page.getByText(/111,50/).first()).toBeVisible() // total devolvido pelo banco, não o da sessão (110)
    // quem calcula preço e taxa é o banco: o navegador só manda o que o comprador escolheu
    expect(cap.rpc).toHaveLength(1)
    expect(cap.rpc[0].body).toMatchObject({ p_event_id: 'evt-001', p_itens: [{ ticket_type_id: 'tt-1', quantidade: 2, beneficio: 'inteira' }] })
    expect(cap.pix).toEqual([{ order_id: 'ord-new', captcha_token: 'token-de-teste', customer: { tax_id: '52998224725' } }])
    await page.screenshot({ path: 'test-results/p05-pix.png', fullPage: true })

    cap.pago = true
    await expect(page).toHaveURL(/\/checkout\/success\?pedido=ord-new/, { timeout: 15_000 })
  })

  test('banco recusa a reserva: mostra a mensagem dele e não pede o Pix', async ({ page }) => {
    const cap = await preparar(page, { ok: false, motivo: 'indisponivel', mensagem: 'Pista esgotou. Escolha outro ingresso.' })
    await page.getByLabel('CPF do comprador').fill('52998224725')
    await page.getByRole('button', { name: /Pagar Agora/ }).click()
    await expect(page.getByText('Pista esgotou. Escolha outro ingresso.')).toBeVisible()
    expect(cap.pix).toHaveLength(0)
    await page.screenshot({ path: 'test-results/p05-recusa.png', fullPage: true })
  })
})
