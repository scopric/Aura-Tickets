import { test, expect, type Page, type Route } from '@playwright/test'

// S9 PR1: Meu cadastro pede o código do 2FA de novo (42501 + hint 'reautenticar') e repete o salvar uma vez.
// Conta demo (só DEV) + PostgREST e /auth/v1/factors simulados por page.route. Nada vai ao banco real.
const BASE = process.env.PW_BASE_URL || 'http://localhost:3000'
const ALPHA = process.env.PW_ALPHA_URL || BASE.replace('//localhost', '//alpha.localhost')
const ADMIN_DEMO = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'
const VARIANTES = [
  { nome: 'desk-claro', w: 1440, h: 900, tema: 'light' },
  { nome: 'desk-escuro', w: 1440, h: 900, tema: 'dark' },
  { nome: 'cel-claro', w: 390, h: 844, tema: 'light' },
  { nome: 'cel-escuro', w: 390, h: 844, tema: 'dark' },
]
const FICHA = {
  user_id: ADMIN_DEMO, invite_id: 'conv-1', email: 'admin@aura.teste', cargo: 'Atendimento', nome_completo: 'Clara Teste da Silva',
  cpf: '52998224725', rg: '12.345.678-9', data_nascimento: '1990-05-20', cep: '01310100', rua: 'Avenida Paulista', numero: '1000',
  complemento: 'Sala 2', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', email_secundario: 'clara.pessoal@teste.invalid',
  telefone: '+5511987654321', whatsapp: '+5511987654321', emergencia_nome: 'Pedro Teste', emergencia_parentesco: 'Irmão',
  emergencia_telefone: '+5511912345678', banco: null, agencia: null, conta: null, pix_tipo: 'cpf', pix_chave: '52998224725',
  created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z',
}
const REAUTH = { code: '42501', details: null, hint: 'reautenticar', message: 'reautenticacao recente exigida' }
const json = (r: Route, status: number, body: unknown) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const USER = { id: ADMIN_DEMO, aud: 'authenticated', role: 'authenticated', email: 'admin@aura.teste', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T12:00:00Z' }
const totp = (id: string) => ({ id, friendly_name: id, factor_type: 'totp', status: 'verified', created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z' })

type Opcoes = {
  gravar: (n: number) => { status: number; body: unknown } // n = nº da tentativa de UPDATE (1, 2…)
  fatores?: string[]
  verify?: (fatorId: string, code: string) => { status: number; body: unknown }
}
async function simular(page: Page, o: Opcoes) {
  const t = { updates: 0, challenges: [] as string[], verifies: [] as string[] }
  const fatores = o.fatores ?? ['f1']
  const verify = o.verify ?? (() => ({ status: 200, body: { access_token: 'x.y.z', token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: USER } }))
  await page.route('**/rest/v1/**', (r) => json(r, 200, []))
  // com sessão do supabase-js o app relê o papel em profiles (.single() espera objeto)
  await page.route('**/rest/v1/profiles?*', (r) => json(r, 200, { id: ADMIN_DEMO, email: 'admin@aura.teste', full_name: 'Admin Demo', avatar_url: null, role: 'admin', is_authorized: true }))
  // S4b: o perfil próprio vem por rpc('meu_perfil'), não pela tabela
  await page.route('**/rest/v1/rpc/meu_perfil*', (r) => json(r, 200, { id: ADMIN_DEMO, email: 'admin@aura.teste', full_name: 'Admin Demo', avatar_url: null, role: 'admin', is_authorized: true, admin_permissions: [] }))
  await page.route('**/rest/v1/staff_profiles?*', (r) => {
    const req = r.request()
    if (req.method() === 'GET') return json(r, 200, [FICHA])
    t.updates++
    const resp = o.gravar(t.updates)
    return json(r, resp.status, resp.body)
  })
  await page.route('**/auth/v1/user', (r) => json(r, 200, { ...USER, factors: fatores.map(totp) }))
  await page.route('**/auth/v1/factors/*/challenge', (r) => {
    t.challenges.push(r.request().url().split('/factors/')[1].split('/')[0])
    return json(r, 200, { id: 'ch-1', type: 'totp', expires_at: 9999999999 })
  })
  await page.route('**/auth/v1/factors/*/verify', (r) => {
    const id = r.request().url().split('/factors/')[1].split('/')[0]
    const code = (r.request().postDataJSON() as { code: string }).code
    t.verifies.push(`${id}:${code}`)
    const resp = verify(id, code)
    return json(r, resp.status, resp.body)
  })
  return t
}
// JWT de mentira com formato válido (o supabase-js decodifica o payload nas chamadas mfa.*)
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ADMIN_DEMO, aud: 'authenticated', exp: 9999999999, aal: 'aal1', amr: [{ method: 'password', timestamp: 1 }] })}.assinatura`
async function entrar(page: Page, v: typeof VARIANTES[number]) {
  await page.setViewportSize({ width: v.w, height: v.h })
  await page.addInitScript((tema) => localStorage.setItem('evokaa-theme', tema), v.tema)
  await page.goto(`${ALPHA}/auth/login`)
  await page.getByPlaceholder('seu@email.com').fill('admin@aura.teste')
  await page.getByPlaceholder('Sua senha').fill('senha123')
  await page.getByRole('button', { name: /Entrar/ }).first().click()
  await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 20000 })
  // sessão do supabase-js só depois do login demo (o login do admin pede 2FA se já houver sessão); o hook chama mfa.*, que exige sessão
  await page.evaluate(([jwt, u]) => localStorage.setItem('sb-placeholder-auth-token', JSON.stringify({
    access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 9999999999, user: u,
  })), [JWT, USER] as const)
  await page.goto(`${ALPHA}/admin/meu-cadastro`)
  await expect(page.getByRole('heading', { name: 'Meu cadastro' })).toBeVisible()
}
const trocarPix = async (page: Page) => {
  await page.getByLabel('Tipo de chave Pix').selectOption('email')
  await page.getByLabel('Chave Pix', { exact: true }).fill('novo.pix@teste.invalid')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
}
const ok = (n: number) => ({ status: 200, body: [{ ...FICHA, pix_tipo: 'email', pix_chave: 'novo.pix@teste.invalid', updated_at: '2026-10-01T13:00:00Z' }] })
const pede = (n: number) => (n === 1 ? { status: 403, body: REAUTH } : ok(n))
const dialogo = (page: Page) => page.getByRole('dialog')
const shot = (page: Page, n: string) => page.screenshot({ path: `test-results/s9-${n}.png`, fullPage: true })
const semRolagemLateral = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

for (const v of VARIANTES) {
  test.describe(v.nome, () => {
    test('1 reautentica e repete o salvar uma vez (2 UPDATEs, não 3); Esc fecha', async ({ page }) => {
      const t = await simular(page, { gravar: pede })
      await entrar(page, v)
      await trocarPix(page)
      await expect(dialogo(page)).toBeVisible()
      await expect(page.locator('#reauth-codigo')).toBeFocused()
      await shot(page, `1a-${v.nome}`)
      if (v.w < 800) {
        expect(await semRolagemLateral(page)).toBe(true)
        await expect(page.getByRole('button', { name: 'Confirmar' })).toBeInViewport()
        await expect(page.getByRole('button', { name: 'Cancelar' })).toBeInViewport()
      }
      // Esc fecha e não repete
      await page.keyboard.press('Escape')
      await expect(dialogo(page)).toHaveCount(0)
      expect(t.updates).toBe(1)
      // salvar de novo: a 2ª tentativa de UPDATE (n=2) já passa; para reproduzir o fluxo, reabrimos o pedido
      t.updates = 0
      await page.getByRole('button', { name: 'Salvar alterações' }).click()
      await expect(dialogo(page)).toBeVisible()
      await page.locator('#reauth-codigo').fill('ab12')
      await expect(page.locator('#reauth-codigo')).toHaveValue('12') // só dígitos
      await page.locator('#reauth-codigo').fill('123456')
      await expect(page.locator('#reauth-codigo')).toHaveValue('123456')
      await page.getByRole('button', { name: 'Confirmar' }).click()
      await expect(page.getByText('Cadastro atualizado. A mudança de pagamento ficou registrada.')).toBeVisible()
      await expect(dialogo(page)).toHaveCount(0)
      expect(t.updates).toBe(2)
      expect(t.challenges).toEqual(['f1'])
      expect(t.verifies).toEqual(['f1:123456'])
      await shot(page, `1b-${v.nome}`)
    })

    test('2 código errado: "Código inválido", janela aberta, sem repetir', async ({ page }) => {
      const t = await simular(page, {
        gravar: pede,
        verify: () => ({ status: 400, body: { code: 'mfa_verification_failed', error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' } }),
      })
      await entrar(page, v)
      await trocarPix(page)
      await page.locator('#reauth-codigo').fill('000000')
      await page.getByRole('button', { name: 'Confirmar' }).click()
      await expect(dialogo(page).getByRole('alert')).toContainText('Código inválido')
      await expect(dialogo(page)).toBeVisible()
      expect(t.updates).toBe(1)
      await shot(page, `2-${v.nome}`)
    })

    test('3 cancelar: não repete e mostra o erro original compreensível', async ({ page }) => {
      const t = await simular(page, { gravar: pede })
      await entrar(page, v)
      await trocarPix(page)
      await dialogo(page).getByRole('button', { name: 'Cancelar' }).click()
      await expect(dialogo(page)).toHaveCount(0)
      await expect(page.getByRole('alert')).toContainText('confirme o código do aplicativo de verificação em duas etapas')
      expect(t.updates).toBe(1)
      expect(t.verifies).toEqual([])
      await shot(page, `3-${v.nome}`)
    })

    test('4 erro 500 no salvar: não abre a janela', async ({ page }) => {
      const t = await simular(page, { gravar: () => ({ status: 500, body: { code: 'XX000', message: 'erro interno' } }) })
      await entrar(page, v)
      await trocarPix(page)
      await expect(page.getByRole('alert')).toContainText('Não foi possível salvar agora')
      await expect(dialogo(page)).toHaveCount(0)
      expect(t.updates).toBe(1)
      await shot(page, `4-${v.nome}`)
    })

    test('5 dois fatores TOTP: o 1º recusa, o 2º aceita', async ({ page }) => {
      const t = await simular(page, {
        gravar: pede,
        fatores: ['f1', 'f2'],
        verify: (id) => id === 'f2'
          ? { status: 200, body: { access_token: 'x.y.z', token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: USER } }
          : { status: 400, body: { code: 'mfa_verification_failed', error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' } },
      })
      await entrar(page, v)
      await trocarPix(page)
      await page.locator('#reauth-codigo').fill('654321')
      await page.getByRole('button', { name: 'Confirmar' }).click()
      await expect(page.getByText('Cadastro atualizado. A mudança de pagamento ficou registrada.')).toBeVisible()
      expect(t.verifies).toEqual(['f1:654321', 'f2:654321'])
      expect(t.updates).toBe(2)
    })
  })
}
