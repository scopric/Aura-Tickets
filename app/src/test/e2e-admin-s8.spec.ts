import { test, expect, type Page, type Route } from '@playwright/test'

// S8 do admin: moderação de evento. Sessão de admin falsa e PostgREST simulado por page.route (nada vai ao banco real;
// nenhuma senha). Rodar com PW_BASE_URL=http://localhost:3198 (vite dev com VITE_SUPABASE_URL=https://placeholder.supabase.co).
const BASE = process.env.PW_BASE_URL || 'http://localhost:3000'
const ALPHA = process.env.PW_ALPHA_URL || BASE.replace('//localhost', '//alpha.localhost')
const UID = '11111111-1111-4111-8111-111111111111'
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const json = (r: Route, status: number, body: unknown) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const VERSAO = '2026-10-05T10:00:00.123456+00:00'
const TEXTO = 'Aceito os termos do evento'
const EVENTO = {
  id: 'e1', producer_id: 'p1', title: 'Festa Aprovada', status: 'published', approval_status: 'approved', featured_carousel: false,
  category: 'festa', classificacao: 'A16', temas: ['musica'], estilos: ['funk'], local_modo: 'hibrido', gallery: [],
  updated_at: VERSAO, created_at: '2026-10-01T10:00:00+00:00', start_date: '2026-11-01T20:00:00+00:00', ingressos_alterados_em: '2026-10-05T17:30:00+00:00',
  profiles: { full_name: 'Paula', email: 'p@teste.invalid' }, ticket_types: [{ id: 't1', name: 'Pista', price: 100, sold: 0, quantity_total: 50, is_active: true }],
}

async function entrar(page: Page, rpcs: unknown[], hashOk: boolean) {
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ aal: 'aal2', sub: UID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.sig`
  const sess = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000,
    user: { id: UID, aud: 'authenticated', role: 'authenticated', email: 'admin@teste.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
  const { createHash } = await import('node:crypto')
  const hash = createHash('sha256').update(hashOk ? TEXTO : 'outro texto').digest('hex')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(([t, s]) => { localStorage.setItem('evokaa-theme', t as string); localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(s)) }, ['light', sess])
  await page.route('**/auth/v1/**', (r) => json(r, 200, sess.user))
  await page.route('**/functions/v1/**', (r) => json(r, 200, {}))
  await page.route('**/rest/v1/**', (r) => json(r, 200, []))
  await page.route('**/rest/v1/profiles?*id=eq.' + UID + '*', (r) => json(r, 200, { id: UID, full_name: 'Admin S8', role: 'admin', admin_permissions: ['manage_events'], email: 'admin@teste.invalid', is_authorized: true }))
  // S4b: o perfil próprio vem por rpc('meu_perfil')
  await page.route('**/rest/v1/rpc/meu_perfil*', (r) => json(r, 200, { id: UID, full_name: 'Admin S8', role: 'admin', admin_permissions: ['manage_events'], email: 'admin@teste.invalid', is_authorized: true }))
  await page.route('**/rest/v1/events?*', (r) => json(r, 200, [EVENTO]))
  await page.route('**/rest/v1/evento_privado?*', (r) => json(r, 200, [{ online_url: 'https://live.exemplo.com.br/sala?token=segredo' }]))
  await page.route('**/rest/v1/evento_aceites?*', (r) => json(r, 200, [{ versao: '2026-10-04', aceito_em: '2026-10-05T12:00:00+00:00', texto: TEXTO, texto_hash: hash }]))
  await page.route('**/rest/v1/rpc/admin_evento_decidir', (r) => { rpcs.push(r.request().postDataJSON()); return json(r, 200, EVENTO) })
  await page.goto(`${ALPHA}/admin/events`)
}

test('S8: selo, detalhe só com o domínio, hash e decisão pela RPC com p_versao', async ({ page }) => {
  const rpcs: unknown[] = []
  await entrar(page, rpcs, true)
  await expect(page.getByText(/Ingressos alterados em \d{2}\/\d{2} \d{2}:\d{2} \(depois da aprovação\)/)).toBeVisible()
  await page.getByRole('button', { name: 'Ver detalhes do evento' }).click()
  const painel = page.getByRole('dialog')
  await expect(painel.getByText('live.exemplo.com.br', { exact: true })).toBeVisible()
  await expect(painel.getByText(/hash confere/)).toBeVisible()
  expect(await painel.locator('a[href*="exemplo.com.br"]').count()).toBe(0)
  expect(await painel.innerText()).not.toContain('segredo')
  await painel.getByRole('button', { name: /Revogar aprovação/ }).click({ trial: true })
  page.once('dialog', (d) => d.accept())
  await painel.getByRole('button', { name: /Revogar aprovação/ }).click()
  await expect.poll(() => rpcs.length).toBe(1)
  expect(rpcs[0]).toEqual({ p_id: 'e1', p_decisao: 'revogar', p_motivo: null, p_versao: VERSAO })
})

test('S8: aceite com texto alterado mostra "hash não confere"', async ({ page }) => {
  await entrar(page, [], false)
  await page.getByRole('button', { name: 'Ver detalhes do evento' }).click()
  await expect(page.getByRole('dialog').getByText(/hash não confere/)).toBeVisible()
})
