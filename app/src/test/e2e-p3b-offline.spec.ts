import { test, expect, type Route } from '@playwright/test'

// P3b: ingresso sem internet. Roda contra o BUILD (vite preview), não o dev: o service worker só registra em produção.
// Supabase simulado por page.route; nenhuma senha. Rodar com PW_BASE_URL=http://localhost:4173.
const UID = '22222222-2222-4222-8222-222222222222'
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const json = (r: Route, body: unknown) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const amanha = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10)
const ingresso = { id: 't1', order_id: 'o1', event_id: 'e1', ticket_type_id: 'tt1', user_id: UID, qr_code: 'QR-OFFLINE-123', status: 'active', buyer_name: 'Teste', checked_in_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  ticket_types: { name: 'Pista', price: 50, type: 'individual', events: { id: 'e1', title: 'Show Offline Teste', cover_image: null, image_url: null, accent_color: null, date: amanha, end_date: null, status: 'published', time: '20:00', venue_name: 'Casa X', venue_address: null, venue_city: 'SP', venue_state: 'SP' } } }

test('Ingressos já vistos abrem sem internet e o resto do app não é interceptado', async ({ page, context }) => {
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ aal: 'aal1', sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.sig`
  const sess = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000,
    user: { id: UID, aud: 'authenticated', role: 'authenticated', email: 'p@teste.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
  await page.addInitScript((s) => { if (!localStorage.getItem('sb-placeholder-auth-token')) localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(s)) }, sess)
  await page.route('**/auth/v1/**', (r) => json(r, sess.user))
  await page.route('**/rest/v1/**', (r) => json(r, []))
  await page.route('**/rest/v1/rpc/meu_perfil', (r) => json(r, { id: UID, full_name: 'Teste', role: 'participant', email: 'p@teste.invalid', is_authorized: true }))
  await page.route('**/rest/v1/tickets?*', (r) => json(r, [ingresso]))

  await page.goto('/app/tickets')
  await expect(page.getByRole('link', { name: 'Mostrar o QR de Show Offline Teste' })).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // já controlada pelo worker
  await expect(page.getByRole('link', { name: 'Mostrar o QR de Show Offline Teste' })).toBeVisible()
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await page.unrouteAll() // sem os simulados: offline de verdade, o Supabase falha e quem responde é a cópia guardada
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Mostrar o QR de Show Offline Teste' })).toBeVisible({ timeout: 15000 })
  await page.screenshot({ path: 'test-results/p3b-offline.png' })

  // fora de /app/tickets o worker não responde: sem internet o navegador mostra o erro dele
  await expect(page.goto('/app')).rejects.toThrow()

  // a cópia é uma chave por conta
  await context.setOffline(false)
  await page.goto('/app/tickets').catch(() => {})
  const outra = await page.evaluate((uid) => Object.keys(localStorage).filter(k => k.startsWith('evk.ingressos.')).map(k => k.endsWith(uid)), UID)
  expect(outra).toEqual([true])
})

test('Token vencido e rede falhando: ingressos aparecem da cópia, com aviso; saída com rede apaga a cópia', async ({ page }) => {
  const sess = (exp: number) => {
    const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ aal: 'aal1', sub: UID, role: 'authenticated', exp })}.sig`
    return { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: exp,
      user: { id: UID, aud: 'authenticated', role: 'authenticated', email: 'p@teste.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
  }
  const valida = sess(Math.floor(Date.now() / 1000) + 36000)
  await page.addInitScript((s) => { if (!sessionStorage.getItem('semeado')) { sessionStorage.setItem('semeado', '1'); localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(s)) } }, valida) // só na 1ª carga
  await page.route('**/auth/v1/**', (r) => json(r, valida.user))
  await page.route('**/rest/v1/**', (r) => json(r, []))
  await page.route('**/rest/v1/rpc/meu_perfil', (r) => json(r, { id: UID, full_name: 'Teste', role: 'participant', email: 'p@teste.invalid', is_authorized: true }))
  await page.route('**/rest/v1/tickets?*', (r) => json(r, [ingresso]))
  const link = page.getByRole('link', { name: 'Mostrar o QR de Show Offline Teste' })
  await page.goto('/app/tickets')
  await expect(link).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)

  // token venceu (1 h) e o Supabase não responde, embora o aparelho esteja "conectado"
  await page.evaluate((s) => localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(s)), sess(Math.floor(Date.now() / 1000) - 600))
  await page.unrouteAll()
  await page.route('**/auth/v1/**', (r) => r.abort('failed'))
  await page.route('**/rest/v1/**', (r) => r.abort('failed'))
  await page.reload()
  await expect(link).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(/Sem conexão\. Cópia de \d\d\/\d\d/)).toBeVisible()

  // o servidor recusa a sessão (saída de verdade, com rede): token some e a cópia é apagada
  await page.evaluate(() => { localStorage.removeItem('sb-placeholder-auth-token') })
  await page.unrouteAll()
  await page.route('**/auth/v1/**', (r) => json(r, {}))
  await page.route('**/rest/v1/**', (r) => json(r, []))
  await page.reload()
  await expect(link).toBeHidden({ timeout: 15000 })
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('evk.ingressos.')))).toEqual([])
})
