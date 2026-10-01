import { test, expect, type Page, type Route } from '@playwright/test'

// Fase F: convite de colaborador. A página /convite (alpha) com o Supabase inteiro simulado por page.route:
// GoTrue (login, 2FA), PostgREST (convite_conferir, profiles) e a Edge Function admin-invite (criar-conta, aceitar),
// nos formatos reais deles. A tela Equipe com a conta demo de admin + super_admin (só em desenvolvimento).
// O banco e a função têm testes próprios (docs/sql/20261002_convite_colaborador_testes.sql e
// supabase/functions/admin-invite/index_test.ts); aqui é o fluxo da tela.

const BASE = process.env.PW_BASE_URL || 'http://localhost:3000'
const ALPHA = process.env.PW_ALPHA_URL || BASE.replace('//localhost', '//alpha.localhost')
const TOKEN = 'Tk0123456789abcdefghijklmnopqrstuvwxyzABCDE' // 43 caracteres base64url, como o da Edge Function
const UID = 'c1a7a000-0000-4000-8000-000000000001'
const EMAIL = 'clara@teste.invalid'
const SENHA = 'Senha@Forte1'

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
// JWT de mentira (o supabase-js só lê o conteúdo; a assinatura não é conferida no navegador)
const jwt = (aal: 'aal1' | 'aal2') => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
  sub: UID, email: EMAIL, role: 'authenticated', aud: 'authenticated', aal, session_id: 's1',
  amr: [{ method: aal === 'aal2' ? 'totp' : 'password', timestamp: Math.floor(Date.now() / 1000) }],
  exp: Math.floor(Date.now() / 1000) + 3600,
})}.assinatura`

type Estado = {
  temFator: boolean // a conta já tem 2FA confirmado
  aal: 'aal1' | 'aal2'
  papel: 'user' | 'admin'
  contaExiste: boolean
  emailConta: string // e-mail da conta com sessão aberta
  conferir: { valido: boolean; email?: string }
  aceitar: { ok: boolean; message?: string }
  chamadas: { onde: string; body: Record<string, unknown> }[]
}

async function simularSupabase(page: Page, mudar: Partial<Estado> = {}) {
  const e: Estado = {
    temFator: false, aal: 'aal1', papel: 'user', contaExiste: false, emailConta: EMAIL,
    conferir: { valido: true, email: 'c***@teste.invalid' }, aceitar: { ok: true }, chamadas: [], ...mudar,
  }
  const usuario = () => ({
    id: UID, aud: 'authenticated', role: 'authenticated', email: e.emailConta, app_metadata: {}, user_metadata: {},
    created_at: '2026-10-01T00:00:00Z',
    factors: e.temFator ? [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'app', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }] : [],
  })
  const sessao = () => ({ access_token: jwt(e.aal), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r1', user: usuario() })
  const corpo = (r: Route) => { try { return (r.request().postDataJSON() ?? {}) as Record<string, unknown> } catch { return {} } }
  const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: body === null ? '' : JSON.stringify(body) })

  // o resto do PostgREST (painel depois do convite): vazio
  await page.route('**/rest/v1/**', (r) => json(r, []))
  await page.route('**/rest/v1/profiles?*', (r) => json(r, { id: UID, email: EMAIL, full_name: 'Clara Teste', role: e.papel, admin_permissions: e.papel === 'admin' ? ['manage_support'] : [] }))
  await page.route('**/rest/v1/rpc/**', (r) => {
    const nome = new URL(r.request().url()).pathname.split('/rpc/')[1]
    e.chamadas.push({ onde: nome, body: corpo(r) })
    if (nome === 'convite_conferir') return json(r, e.conferir)
    return json(r, [])
  })
  await page.route('**/functions/v1/**', (r) => {
    const body = corpo(r)
    const funcao = new URL(r.request().url()).pathname.split('/functions/v1/')[1]
    e.chamadas.push({ onde: `${funcao}:${String(body.acao ?? '')}`, body })
    if (funcao === 'admin-invite' && body.acao === 'criar-conta') {
      return json(r, e.contaExiste
        ? { ok: false, motivo: 'conta_existe', message: 'Já existe uma conta com este e-mail. Entre com ela para aceitar o convite.' }
        : { ok: true, email: EMAIL })
    }
    if (funcao === 'admin-invite' && body.acao === 'aceitar') {
      if (!e.aceitar.ok) return json(r, { ok: false, motivo: 'recusado', message: e.aceitar.message })
      e.papel = 'admin'
      return json(r, { ok: true, avisados: 1 })
    }
    return json(r, { ok: true })
  })
  await page.route('**/auth/v1/**', (r) => {
    const u = new URL(r.request().url())
    const metodo = r.request().method()
    if (u.pathname.endsWith('/token')) {
      const b = corpo(r)
      e.chamadas.push({ onde: 'login', body: { email: b.email } })
      if (b.password !== SENHA) return json(r, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400)
      e.emailConta = String(b.email)
      return json(r, sessao())
    }
    if (u.pathname.endsWith('/user')) return json(r, usuario())
    if (u.pathname.endsWith('/logout')) { e.chamadas.push({ onde: 'logout', body: {} }); return r.fulfill({ status: 204 }) }
    if (/\/factors\/[^/]+\/challenge$/.test(u.pathname)) return json(r, { id: 'ch1', type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 })
    if (/\/factors\/[^/]+\/verify$/.test(u.pathname)) {
      if (corpo(r).code !== '123456') return json(r, { code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }, 422)
      e.temFator = true
      e.aal = 'aal2'
      e.chamadas.push({ onde: '2fa-verify', body: {} })
      return json(r, sessao())
    }
    if (u.pathname.endsWith('/factors') && metodo === 'POST') {
      return json(r, { id: 'f1', type: 'totp', friendly_name: '', totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg"/>', secret: 'SEGREDODETESTE', uri: 'otpauth://totp/x' } })
    }
    return json(r, {})
  })
  await page.route('**/viacep.com.br/**', (r) => json(r, { cep: '01310-100', logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' }))
  return { e, sessao }
}

async function preencherCadastro(page: Page, mudar: Record<string, string> = {}) {
  const v = { nome: 'Clara Teste da Silva', cpf: '52998224725', email2: 'clara.pessoal@teste.invalid', ...mudar }
  await page.getByLabel('Nome completo').fill(v.nome)
  await page.getByLabel('CPF', { exact: true }).fill(v.cpf)
  await page.getByLabel('RG').fill('12.345.678-9')
  await page.getByLabel('Data de nascimento').fill('1990-05-20')
  await page.getByLabel('CEP').fill('01310100')
  await page.getByLabel('Número').fill('1000') // tira o foco do CEP: busca o endereço
  await expect(page.getByLabel('Rua')).toHaveValue('Avenida Paulista')
  await expect(page.getByLabel('UF')).toHaveValue('SP')
  await page.getByLabel(/E-mail secundário/).fill(v.email2)
  await page.locator('#c-telefone').fill('11987654321')
  await page.locator('#c-whatsapp').fill('11987654321')
  await page.locator('#c-emerg-nome').fill('Pedro Teste')
  await page.getByLabel('Parentesco').fill('Irmão')
  await page.locator('#c-emerg-tel').fill('11912345678')
  await page.getByLabel('Tipo de chave Pix').selectOption('cpf')
  await page.getByLabel('Chave Pix', { exact: true }).fill('52998224725')
}

test.describe('página /convite', () => {
  test('conta nova: senha, 2FA, cadastro e painel; permissões nunca saem do navegador', async ({ page }) => {
    const { e } = await simularSupabase(page)
    await page.goto(`${ALPHA}/convite#${TOKEN}`)
    await expect(page.getByRole('heading', { name: 'Você foi convidado para a equipe de colaboradores da Evokaa' })).toBeVisible()
    await expect(page.getByText('c***@teste.invalid')).toBeVisible()
    expect(e.chamadas.find((c) => c.onde === 'convite_conferir')?.body).toEqual({ p_token: TOKEN })
    // o token sai da barra de endereço e fica na aba: recarregar continua
    await expect(page).toHaveURL(`${ALPHA}/convite`)
    expect(await page.evaluate(() => sessionStorage.getItem('evokaa_convite'))).toBe(TOKEN)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Você foi convidado para a equipe de colaboradores da Evokaa' })).toBeVisible()
    // nada de "admin" na página do convite (Decisão 125)
    await expect(page.locator('body')).not.toContainText(/admin/i)

    await page.getByRole('button', { name: /Começar/ }).click()
    await expect(page.getByRole('heading', { name: 'Crie a sua senha' })).toBeVisible()
    await page.getByLabel('Senha', { exact: true }).fill('fraca')
    await page.getByLabel('Repita a senha').fill('fraca')
    await page.getByRole('button', { name: 'Criar conta e continuar' }).click()
    await expect(page.getByRole('alert')).toContainText('pelo menos 8')
    expect(e.chamadas.some((c) => c.onde === 'admin-invite:criar-conta')).toBe(false)

    await page.getByLabel('Senha', { exact: true }).fill(SENHA)
    await page.getByLabel('Repita a senha').fill(SENHA)
    await page.getByRole('button', { name: 'Criar conta e continuar' }).click()
    await expect(page.getByRole('heading', { name: 'Ative a verificação em duas etapas' })).toBeVisible()
    expect(e.chamadas.find((c) => c.onde === 'admin-invite:criar-conta')?.body).toEqual({ acao: 'criar-conta', token: TOKEN, senha: SENHA })
    expect(e.chamadas.find((c) => c.onde === 'login')?.body).toEqual({ email: EMAIL })

    await page.getByRole('button', { name: 'Ativar agora' }).click()
    await page.getByLabel('Código de verificação').fill('123456')
    await page.getByRole('button', { name: 'Ativar 2FA' }).click()
    await expect(page.getByRole('heading', { name: 'Seu cadastro de colaborador' })).toBeVisible()

    await preencherCadastro(page)
    await page.getByRole('button', { name: 'Concluir cadastro' }).click()
    await expect(page.getByRole('heading', { name: 'Tudo pronto' })).toBeVisible()

    // uma chamada só: a função aceita (banco) e avisa os super_admins
    const aceite = e.chamadas.find((c) => c.onde === 'admin-invite:aceitar')!.body
    expect(aceite.token).toBe(TOKEN)
    expect(e.chamadas.some((c) => c.onde === 'convite_aceitar')).toBe(false)
    expect(await page.evaluate(() => sessionStorage.getItem('evokaa_convite'))).toBeNull()
    const dados = aceite.dados as Record<string, string>
    expect(dados).toMatchObject({
      nome_completo: 'Clara Teste da Silva', cpf: '52998224725', cep: '01310100', rua: 'Avenida Paulista', uf: 'SP',
      email_secundario: 'clara.pessoal@teste.invalid', telefone: '+5511987654321', emergencia_telefone: '+5511912345678',
      pix_tipo: 'cpf', pix_chave: '52998224725',
    })
    // papel e funções vêm do convite gravado no banco: o navegador não manda nada disso
    for (const k of ['role', 'admin_permissions', 'permissions', 'cargo', 'user_id']) expect(dados).not.toHaveProperty(k)

    await page.getByRole('button', { name: /Ir para o painel/ }).click()
    await expect(page).toHaveURL(/\/admin\/dashboard/)
  })

  test('conta existente com 2FA: "entre com a sua conta", código e cadastro; erro do banco aparece', async ({ page }) => {
    const { e } = await simularSupabase(page, { contaExiste: true, temFator: true, aceitar: { ok: false, message: 'CPF inválido.' } })
    await page.goto(`${ALPHA}/convite#${TOKEN}`)
    await page.getByRole('button', { name: /Começar/ }).click()
    await page.getByLabel('Senha', { exact: true }).fill(SENHA)
    await page.getByLabel('Repita a senha').fill(SENHA)
    await page.getByRole('button', { name: 'Criar conta e continuar' }).click()
    await expect(page.getByRole('heading', { name: 'Entre com a sua conta' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Entre com ela para aceitar o convite')

    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill('errada')
    await page.getByRole('button', { name: 'Entrar e continuar' }).click()
    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos')
    await page.getByLabel('Senha').fill(SENHA)
    await page.getByRole('button', { name: 'Entrar e continuar' }).click()
    await expect(page.getByRole('heading', { name: 'Digite o código' })).toBeVisible()
    await page.getByLabel('Código').fill('000000')
    await page.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByRole('alert')).toContainText('Código inválido')
    await page.getByLabel('Código').fill('123456')
    await page.getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByRole('heading', { name: 'Seu cadastro de colaborador' })).toBeVisible()

    // validação na tela: e-mail secundário igual ao da conta não chega ao banco
    await preencherCadastro(page, { email2: EMAIL })
    await page.getByRole('button', { name: 'Concluir cadastro' }).click()
    await expect(page.getByRole('alert')).toContainText('diferente do e-mail da conta')
    expect(e.chamadas.some((c) => c.onde === 'admin-invite:aceitar')).toBe(false)
    // nome só com letras
    await page.getByLabel('Nome completo').fill('Clara <b>')
    await page.getByLabel(/E-mail secundário/).fill('outro@teste.invalid')
    await page.getByRole('button', { name: 'Concluir cadastro' }).click()
    await expect(page.getByRole('alert')).toContainText('só com letras')
    await page.getByLabel('Nome completo').fill('Clara D\'Ávila-Souza Jr.')
    // recusa do banco vira mensagem na tela
    await page.getByLabel(/E-mail secundário/).fill('outro@teste.invalid')
    await page.getByRole('button', { name: 'Concluir cadastro' }).click()
    await expect(page.getByRole('alert')).toContainText('CPF inválido.')
    await expect(page.getByRole('heading', { name: 'Tudo pronto' })).toHaveCount(0)
  })

  test('sessão aberta de outra conta: avisa antes do cadastro e troca de conta sem perder o convite', async ({ page }) => {
    const { e, sessao } = await simularSupabase(page, { emailConta: 'outra@teste.invalid' })
    // sessão salva do supabase-js (chave sb-<projeto>-auth-token; sem .env.local o projeto é "placeholder")
    const salva = JSON.stringify(sessao())
    await page.addInitScript((v) => { if (!sessionStorage.getItem('semeado')) { localStorage.setItem('sb-placeholder-auth-token', v); sessionStorage.setItem('semeado', '1') } }, salva)
    await page.goto(`${ALPHA}/convite#${TOKEN}`)
    await page.getByRole('button', { name: /Começar/ }).click()
    await expect(page.getByRole('heading', { name: 'Continuar com esta conta?' })).toBeVisible()
    await expect(page.getByText('outra@teste.invalid')).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Esta conta não é a do convite')
    await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Usar outra conta' }).click()
    await expect(page.getByRole('heading', { name: 'Entre com a sua conta' })).toBeVisible()
    expect(e.chamadas.some((c) => c.onde === 'logout')).toBe(true)
    expect(await page.evaluate(() => localStorage.getItem('sb-placeholder-auth-token'))).toBeNull()
    expect(await page.evaluate(() => sessionStorage.getItem('evokaa_convite'))).toBe(TOKEN)
    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByLabel('Senha').fill(SENHA)
    await page.getByRole('button', { name: 'Entrar e continuar' }).click()
    await expect(page.getByRole('heading', { name: 'Ative a verificação em duas etapas' })).toBeVisible()
  })

  test('convite que não vale e link sem token', async ({ page }) => {
    const { e } = await simularSupabase(page, { conferir: { valido: false } })
    await page.goto(`${ALPHA}/convite#${TOKEN}`)
    await expect(page.getByRole('heading', { name: 'Este convite não vale mais' })).toBeVisible()
    expect(e.chamadas.filter((c) => c.onde === 'convite_conferir').length).toBeGreaterThan(0)
    // sem token no link nem na aba: nem pergunta ao banco
    await page.evaluate(() => sessionStorage.clear())
    e.chamadas.length = 0
    await page.goto(`${ALPHA}/convite`)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Este convite não vale mais' })).toBeVisible()
    expect(e.chamadas.filter((c) => c.onde === 'convite_conferir')).toHaveLength(0)
  })
})

// ---- Tela Equipe (super_admin) ----

// A conta demo de admin não tem super_admin: acrescenta na lista fixa dela (stores/authStore.ts, só em DEV)
// ao servir o módulo, sem mudar o app (mesmo recurso de e2e-mesa-c.spec.ts).
async function permissoesDemo(page: Page, extras: string[]) {
  const estado = { trocado: false, falha: '' }
  await page.route('**/src/stores/authStore.ts*', async (route) => {
    const r = await route.fetch()
    const texto = await r.text()
    const novo = texto.replace(/\[(["'])manage_users\1/, (m) => `[${extras.map((x) => JSON.stringify(x)).join(', ')}, ${m.slice(1)}`)
    if (novo === texto) estado.falha = 'lista de permissões da conta demo não encontrada em authStore.ts'
    else estado.trocado = true
    await route.fulfill({ response: r, body: novo })
  })
  return estado
}

const ADMIN_DEMO = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'
const CLARA = 'c1a7a000-0000-4000-8000-0000000000c1'

test.describe('tela Equipe — convidar colaborador', () => {
  // O menu lateral do admin cobre a tela no celular (como em e2e-mesa-c): só no computador
  test.skip(({ isMobile }) => isMobile, 'painel do admin sem layout de celular')

  test('convidar, reenviar, cancelar e ver o cadastro do colaborador', async ({ page }) => {
    const chamadas: Record<string, unknown>[] = []
    let convites = [
      { id: 'conv-1', email: 'pendente@teste.invalid', cargo: 'Financeiro', permissions: ['manage_finance'], status: 'pendente', expires_at: '2026-10-08T12:00:00Z' },
      { id: 'conv-2', email: 'vencido@teste.invalid', cargo: 'Eventos', permissions: [], status: 'expirado', expires_at: '2026-09-20T12:00:00Z' },
      { id: 'conv-3', email: 'usado@teste.invalid', cargo: 'Eventos', permissions: [], status: 'usado', expires_at: '2026-09-20T12:00:00Z', used_at: '2026-09-25T12:00:00Z', nome: 'Davi Usado', aviso_em: null },
    ]
    await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
    await page.route('**/rest/v1/profiles?*', (r) => r.fulfill({ json: [
      { id: ADMIN_DEMO, email: 'admin@aura.teste', full_name: 'Admin Teste', avatar_url: null, role: 'admin', admin_permissions: ['super_admin'], updated_at: null },
      { id: CLARA, email: 'clara@teste.invalid', full_name: 'Clara Teste', avatar_url: null, role: 'admin', admin_permissions: ['manage_support'], updated_at: null },
    ] }))
    await page.route('**/rest/v1/rpc/colaboradores_resumo', (r) => r.fulfill({ json: [{ user_id: CLARA, nome: 'Clara Teste da Silva', cargo: 'Atendimento', email: 'clara@teste.invalid' }] }))
    await page.route('**/rest/v1/rpc/colaborador_dados', (r) => {
      chamadas.push({ rpc: 'colaborador_dados', ...(r.request().postDataJSON() as object) })
      return r.fulfill({ json: [{
        user_id: CLARA, cargo: 'Atendimento', email: 'clara@teste.invalid', nome_completo: 'Clara Teste da Silva', cpf: '52998224725', rg: '12.345.678-9',
        data_nascimento: '1990-05-20', cep: '01310100', rua: 'Avenida Paulista', numero: '1000', complemento: null, bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP',
        email_secundario: 'clara.pessoal@teste.invalid', telefone: '+5511987654321', whatsapp: '+5511987654321', emergencia_nome: 'Pedro Teste',
        emergencia_parentesco: 'Irmão', emergencia_telefone: '+5511912345678', banco: null, agencia: null, conta: null, pix_tipo: 'cpf', pix_chave: '52998224725',
      }] })
    })
    await page.route('**/functions/v1/admin-invite', (r) => {
      const b = r.request().postDataJSON() as Record<string, unknown>
      chamadas.push(b)
      if (b.acao === 'listar') return r.fulfill({ json: { ok: true, convites } })
      if (b.acao === 'cancelar') convites = convites.filter((c) => c.id !== b.id)
      if (b.acao === 'criar') convites = [{ id: 'conv-4', email: String(b.email), cargo: String(b.cargo), permissions: b.permissoes as string[], status: 'pendente', expires_at: '2026-10-09T12:00:00Z' }, ...convites]
      return r.fulfill({ json: { ok: true } })
    })

    const estado = await permissoesDemo(page, ['super_admin'])
    await page.goto(`${ALPHA}/auth/login`)
    await page.getByPlaceholder('seu@email.com').fill('admin@aura.teste')
    await page.getByPlaceholder('Sua senha').fill('senha123')
    await page.getByRole('button', { name: /Entrar/ }).first().click()
    await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 20000 })
    expect(estado.falha).toBe('')

    page.on('dialog', (d) => d.accept())
    await page.goto(`${ALPHA}/admin/team`)
    await expect(page.getByRole('heading', { name: 'Colaboradores da Evokaa' })).toBeVisible()
    await expect(page.getByText('Atendimento ·')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Promover conta existente' })).toHaveCount(0)

    // convites: pendente e expirado com ações; aceito recente em "Aceitos recentemente", sem aviso por e-mail
    await expect(page.getByText('pendente@teste.invalid')).toBeVisible()
    await expect(page.getByText('vencido@teste.invalid')).toBeVisible()
    await expect(page.getByText('expirado')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Aceitos recentemente' })).toBeVisible()
    const aceito = page.locator('li', { hasText: 'Davi Usado' })
    await expect(aceito).toContainText('usado@teste.invalid · Eventos · aceito em 25/09/2026')
    await expect(aceito).toContainText('sem aviso por e-mail')
    await expect(aceito.getByRole('button')).toHaveCount(0)
    // nada de "admin" nos textos da tela (Decisão 125)
    await expect(page.locator('main')).not.toContainText(/Super Admin|Time Admin|Equipe Admin/)

    // convidar: e-mail, cargo e funções; super_admin não é opção
    await expect(page.getByRole('heading', { name: 'Convidar colaborador' })).toBeVisible()
    const quadro = page.locator('form', { has: page.getByRole('button', { name: 'Enviar convite' }) })
    await expect(quadro.getByText('Acesso total 👑')).toHaveCount(0)
    await quadro.getByLabel('E-mail', { exact: true }).fill('nova@teste.invalid')
    await quadro.getByLabel('Cargo', { exact: true }).fill('Atendimento')
    await quadro.getByText('Atendimento (chat)').click()
    await quadro.getByText('Moderar Match de Mesa').click()
    await page.getByRole('button', { name: 'Enviar convite' }).click()
    await expect(page.getByText('Convite enviado')).toBeVisible()
    expect(chamadas.find((c) => c.acao === 'criar')).toEqual({ acao: 'criar', email: 'nova@teste.invalid', cargo: 'Atendimento', permissoes: ['manage_support', 'moderate_mesa'] })
    await expect(page.getByText('nova@teste.invalid')).toBeVisible()

    // reenviar e cancelar
    const linha = page.locator('li', { hasText: 'pendente@teste.invalid' })
    await linha.getByRole('button', { name: 'Reenviar' }).click()
    await expect(page.getByText('Convite reenviado')).toBeVisible()
    expect(chamadas.find((c) => c.acao === 'reenviar')).toEqual({ acao: 'reenviar', id: 'conv-1' })
    await linha.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByText('Convite cancelado.')).toBeVisible()
    expect(chamadas.find((c) => c.acao === 'cancelar')).toEqual({ acao: 'cancelar', id: 'conv-1' })
    await expect(page.getByText('pendente@teste.invalid')).toHaveCount(0)

    // ficha do colaborador
    await page.getByText('Clara Teste', { exact: true }).click()
    await expect(page.getByText('Dados do cadastro')).toBeVisible()
    await expect(page.getByText('529.982.247-25')).toBeVisible()
    await expect(page.getByText('Pedro Teste (Irmão), +5511912345678')).toBeVisible()
    expect(chamadas.find((c) => c.rpc === 'colaborador_dados')).toEqual({ rpc: 'colaborador_dados', p_user: CLARA })
  })
})

test.describe('tela Equipe — colaborador sem Acesso total', () => {
  test.skip(({ isMobile }) => isMobile, 'painel do admin sem layout de celular')

  test('vê a equipe, mas não o quadro de convite nem os convites', async ({ page }) => {
    let listou = false
    await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
    await page.route('**/functions/v1/admin-invite', (r) => { listou = true; return r.fulfill({ json: { ok: true, convites: [] } }) })
    const estado = await permissoesDemo(page, ['manage_team'])
    await page.goto(`${ALPHA}/auth/login`)
    await page.getByPlaceholder('seu@email.com').fill('admin@aura.teste')
    await page.getByPlaceholder('Sua senha').fill('senha123')
    await page.getByRole('button', { name: /Entrar/ }).first().click()
    await page.waitForURL((u) => !u.toString().includes('/auth/login'), { timeout: 20000 })
    expect(estado.falha).toBe('')
    await page.goto(`${ALPHA}/admin/team`)
    await expect(page.getByRole('heading', { name: 'Colaboradores da Evokaa' })).toBeVisible()
    await expect(page.getByText('Só quem tem Acesso total convida colaboradores')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Convidar colaborador' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Convites' })).toHaveCount(0)
    expect(listou).toBe(false)
  })
})
