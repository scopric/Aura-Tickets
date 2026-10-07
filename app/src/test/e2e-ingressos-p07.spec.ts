import { test, expect } from '@playwright/test'

// P07: Meus ingressos em tela de celular (390x844). Supabase simulado por page.route; nada vai ao banco real.
// Wake Lock real e QR em iPhone/Android de verdade ficam com o Ricardo: aqui só se confere o pedido e o fallback silencioso.
const UID = '22222222-2222-4222-8222-222222222222'
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 36000
const sess = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ aal: 'aal1', sub: UID, role: 'authenticated', exp })}.sig`, refresh_token: 'r', token_type: 'bearer', expires_in: 36000, expires_at: exp,
  user: { id: UID, aud: 'authenticated', role: 'authenticated', email: 'p@teste.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
const amanha = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10)
const ingresso = (status: string) => ({ id: 't1', order_id: 'o1', event_id: 'e1', ticket_type_id: 'tt1', user_id: UID, qr_code: 'QR-P07-123', status: 'active', buyer_name: 'Teste', checked_in_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  ticket_types: { name: 'Pista', price: 50, type: 'individual', events: { id: 'e1', title: 'Show P07', cover_image: null, image_url: null, accent_color: null, date: amanha, end_date: null, status, time: '20:00', venue_name: 'Casa X', venue_address: null, venue_city: 'SP', venue_state: 'SP' } } })

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function abrir(page: import('@playwright/test').Page, status: string, url: string) {
  await page.addInitScript((s) => localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(s)), sess)
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/rpc/chat_public_settings*', (r) => r.fulfill({ json: { aberto_agora: true, prazo: 'Respondemos em até 1 dia útil.' } }))
  await page.route('**/rest/v1/chat_topics*', (r) => r.fulfill({ json: [{ id: 't1', label: 'Não recebi ou não acho meu ingresso', hint: null, urgent: false }] }))
  await page.route('**/auth/v1/**', (r) => r.fulfill({ json: sess.user }))
  await page.route('**/rest/v1/rpc/meu_perfil', (r) => r.fulfill({ json: { id: UID, full_name: 'Teste', role: 'participant', email: 'p@teste.invalid', is_authorized: true } }))
  await page.route('**/rest/v1/tickets?*', (r) => r.fulfill({ json: [ingresso(status)] }))
  await page.goto(url)
}

test('celular: QR visível e Wake Lock pedido ao ampliar', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __wl: number }).__wl = 0
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { (window as unknown as { __wl: number }).__wl++; return { release: async () => {}, addEventListener() {} } } } })
  })
  await abrir(page, 'published', '/app/tickets?evento=e1&qr=1')
  await page.getByRole('button', { name: /Ampliar o QR/ }).click()
  await expect(page.getByRole('dialog').locator('svg').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Salvar QR como imagem/ })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __wl: number }).__wl)).toBeGreaterThan(0)
  await page.screenshot({ path: 'test-results/p07-qr-mobile.png' })
})

test('celular: sem Wake Lock o QR ampliado abre sem erro', async ({ page }) => {
  const erros: string[] = []
  page.on('pageerror', e => erros.push(e.message))
  await page.addInitScript(() => { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined }); delete (navigator as { wakeLock?: unknown }).wakeLock })
  await abrir(page, 'published', '/app/tickets?evento=e1&qr=1')
  await page.getByRole('button', { name: /Ampliar o QR/ }).click()
  await expect(page.getByText('Mostre na entrada')).toBeVisible()
  expect(erros).toEqual([])
})

test('celular: evento cancelado avisa e não esconde o ingresso; Detalhes leva ao assunto do chat', async ({ page }) => {
  await abrir(page, 'cancelled', '/app/tickets?evento=e1')
  await expect(page.getByRole('status').filter({ hasText: 'Evento cancelado' }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ingressos' }).or(page.getByText('Show P07').first())).toBeVisible()
  await page.getByRole('button', { name: /Detalhes/ }).click()
  await expect(page.getByRole('dialog')).not.toContainText('Lugar')
  await page.getByRole('button', { name: 'Não vejo meu ingresso' }).click()
  await expect(page.getByRole('heading', { name: 'Não recebi ou não acho meu ingresso' })).toBeVisible()
  // o foco fica na janela do Evo, não volta para o botão que abriu a folha
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[aria-labelledby="suporte-titulo"]'))).toBe(true)
})
