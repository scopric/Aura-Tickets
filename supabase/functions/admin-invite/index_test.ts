// Testes da Edge Function admin-invite com fetch simulado (GoTrue, PostgREST e Resend falsos).
// Rodar: docker run --rm -v "$PWD/supabase/functions:/f" -w /f denoland/deno:latest test --allow-env --allow-net admin-invite/index_test.ts
// (--allow-net só para baixar os imports do esm.sh; nenhum pedido sai de verdade: o fetch é trocado abaixo.)
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1'

Deno.env.set('SUPABASE_URL', 'http://supabase.teste')
Deno.env.set('SUPABASE_ANON_KEY', 'anon-teste')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-teste')
Deno.env.set('RESEND_API_KEY', 're_teste')

type Estado = {
  usuario: string | null // id do dono do JWT (null = token inválido)
  mfa: boolean
  superAdmin: boolean | null // null = o banco não respondeu
  rpc: Record<string, { status?: number; body: unknown }>
  convite: { email: string } | null // admin_invites achado por hash (criar-conta)
  criarConta: { status: number; body: unknown }
  limiteContagem: number
  marcados: { id: string }[]
  supers: { email: string }[]
  resendOk: boolean
}
let estado: Estado
let chamadas: { metodo: string; url: string; corpo: string; headers: Headers }[] = []
const logs: string[] = []

function novoEstado(mudar: Partial<Estado> = {}): void {
  estado = {
    usuario: 'u-super', mfa: true, superAdmin: true, rpc: {}, convite: { email: 'convidada@teste.invalid' },
    criarConta: { status: 200, body: { id: 'u-nova', email: 'convidada@teste.invalid', created_at: '2026-10-01T17:30:00Z' } },
    limiteContagem: 1, marcados: [{ id: 'conv-1' }], supers: [{ email: 'super1@teste.invalid' }, { email: 'super2@teste.invalid' }],
    resendOk: true, ...mudar,
  }
  chamadas = []
  logs.length = 0
}

const resp = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
  const req = new Request(entrada, init)
  const url = new URL(req.url)
  const corpo = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text()
  chamadas.push({ metodo: req.method, url: req.url, corpo, headers: req.headers })
  const objeto = (req.headers.get('Accept') ?? '').includes('vnd.pgrst.object')
  if (url.hostname === 'api.resend.com') return estado.resendOk ? resp(200, { id: 'email-1' }) : resp(422, { message: 'recusado' })
  if (url.pathname === '/auth/v1/user') {
    return estado.usuario
      ? resp(200, { id: estado.usuario, aud: 'authenticated', email: 'quem@teste.invalid', created_at: '2026-09-30T13:05:00Z' })
      : resp(401, { msg: 'invalid JWT' })
  }
  if (url.pathname === '/auth/v1/admin/users') return resp(estado.criarConta.status, estado.criarConta.body)
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const nome = url.pathname.slice('/rest/v1/rpc/'.length)
    if (nome === 'gf_mfa_ok') return resp(200, estado.mfa)
    if (nome === 'gf_admin_can') return estado.superAdmin === null ? resp(500, { code: 'XX000', message: 'fora' }) : resp(200, estado.superAdmin)
    const r = estado.rpc[nome]
    return r ? resp(r.status ?? 200, r.body) : resp(404, { code: 'PGRST202', message: 'sem função' })
  }
  if (url.pathname === '/rest/v1/contact_rate_limit_hits') {
    if (req.method === 'POST') return resp(201, objeto ? { id: 7 } : [{ id: 7 }])
    if (req.method === 'HEAD') return resp(200, undefined, { 'Content-Range': `0-0/${estado.limiteContagem}` })
    if (req.method === 'DELETE') return resp(204, undefined)
  }
  if (url.pathname === '/rest/v1/admin_invites') {
    if (req.method === 'GET') {
      const achado = estado.convite ? [estado.convite] : []
      return objeto ? (achado.length ? resp(200, achado[0]) : resp(406, { code: 'PGRST116', message: '0 rows' })) : resp(200, achado)
    }
    if (req.method === 'PATCH') return resp(200, JSON.parse(corpo).aviso_em === null ? [] : estado.marcados)
  }
  if (url.pathname === '/rest/v1/staff_profiles') return resp(200, objeto ? { nome_completo: 'Clara <b>Teste</b>' } : [{ nome_completo: 'Clara <b>Teste</b>' }])
  if (url.pathname === '/rest/v1/profiles') return resp(200, estado.supers)
  return resp(599, { message: `rota não simulada: ${req.method} ${url.pathname}` })
}) as typeof fetch

for (const nivel of ['error', 'warn', 'log'] as const) {
  console[nivel] = (...a: unknown[]) => { logs.push(a.map(String).join(' ')) }
}

let handler!: (req: Request) => Promise<Response>
// deno-lint-ignore no-explicit-any
;(Deno as any).serve = (h: typeof handler) => { handler = h }
const { hashToken } = await import('./index.ts')

const chamar = async (body: unknown, opcoes: { jwt?: boolean; ip?: string } = {}) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://alpha.evokaa.com.br' }
  if (opcoes.jwt !== false) headers.Authorization = 'Bearer jwt-teste'
  headers['cf-connecting-ip'] = opcoes.ip ?? '203.0.113.9'
  const r = await handler(new Request('http://funcao/admin-invite', { method: 'POST', headers, body: JSON.stringify(body) }))
  return { status: r.status, body: await r.json() }
}
const rpcs = () => chamadas.filter((c) => c.url.includes('/rest/v1/rpc/')).map((c) => new URL(c.url).pathname.split('/rpc/')[1])
const emails = () => chamadas.filter((c) => c.url.startsWith('https://api.resend.com')).map((c) => JSON.parse(c.corpo))
const tokenDoEmail = (html: string) => html.match(/https:\/\/alpha\.evokaa\.com\.br\/convite#([A-Za-z0-9_-]+)/)?.[1] ?? ''
const opts = { sanitizeOps: false, sanitizeResources: false }

Deno.test({ name: 'hashToken: sha256 hex, igual a public.convite_hash', ...opts, fn: async () => {
  assertEquals(await hashToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
} })

Deno.test({ name: 'criar: super_admin com 2FA grava o hash do token do link e manda o e-mail sem as funções', ...opts, fn: async () => {
  novoEstado({ rpc: { convite_criar: { body: 'conv-1' } } })
  const r = await chamar({ acao: 'criar', email: ' Clara@Teste.invalid ', cargo: ' Atendimento ', permissoes: ['manage_support', 'manage_support', 'moderate_mesa'] })
  assertEquals(r, { status: 200, body: { ok: true, id: 'conv-1' } })
  assertEquals(rpcs(), ['gf_mfa_ok', 'gf_admin_can', 'convite_criar'])
  const criar = JSON.parse(chamadas.find((c) => c.url.endsWith('/rpc/convite_criar'))!.corpo)
  // a função do banco recebe o JWT de quem chama (o banco confere o super_admin de novo)
  assertEquals(chamadas.find((c) => c.url.endsWith('/rpc/convite_criar'))!.headers.get('Authorization'), 'Bearer jwt-teste')
  assertEquals(criar.p_email, 'clara@teste.invalid')
  assertEquals(criar.p_cargo, 'Atendimento')
  assertEquals(criar.p_permissions, ['manage_support', 'moderate_mesa'])
  const [mail] = emails()
  assertEquals(mail.to, ['clara@teste.invalid'])
  assertEquals(mail.from, 'Evokaa <contato@evokaa.com.br>')
  assertEquals(mail.subject, 'Você foi convidado para a equipe de colaboradores da Evokaa')
  const token = tokenDoEmail(mail.html)
  assertMatch(token, /^[A-Za-z0-9_-]{43}$/)
  assertEquals(criar.p_token_hash, await hashToken(token))
  assert(!/manage_|moderate_|Atendimento/.test(mail.html), 'o e-mail mostra cargo ou funções')
  assertEquals(logs, [])
} })

Deno.test({ name: 'criar: recusa super_admin, função inventada, e-mail inválido e cargo vazio sem chamar o banco', ...opts, fn: async () => {
  for (const corpo of [
    { acao: 'criar', email: 'a@teste.invalid', cargo: 'Atendimento', permissoes: ['super_admin'] },
    { acao: 'criar', email: 'a@teste.invalid', cargo: 'Atendimento', permissoes: ['manage_support', 'dono'] },
    { acao: 'criar', email: 'a@teste.invalid', cargo: 'Atendimento', permissoes: 'manage_support' },
    { acao: 'criar', email: 'nao-e-email', cargo: 'Atendimento', permissoes: [] },
    { acao: 'criar', email: 'a@teste.invalid', cargo: ' ', permissoes: [] },
  ]) {
    novoEstado({ rpc: { convite_criar: { body: 'x' } } })
    const r = await chamar(corpo)
    assertEquals(r.status, 200)
    assertEquals(r.body.ok, false)
    assert(!rpcs().includes('convite_criar'), `chamou o banco com ${JSON.stringify(corpo)}`)
    assertEquals(emails().length, 0)
  }
} })

Deno.test({ name: 'criar: mensagem de regra do banco volta para a tela; e-mail que não sai avisa para reenviar', ...opts, fn: async () => {
  novoEstado({ rpc: { convite_criar: { status: 400, body: { code: 'P0001', message: 'Já existe um convite pendente para este e-mail. Use Reenviar na lista de convites.' } } } })
  let r = await chamar({ acao: 'criar', email: 'a@teste.invalid', cargo: 'Atendimento', permissoes: [] })
  assertEquals(r.body, { ok: false, motivo: 'recusado', message: 'Já existe um convite pendente para este e-mail. Use Reenviar na lista de convites.' })
  assertEquals(emails().length, 0)
  novoEstado({ rpc: { convite_criar: { body: 'conv-2' } }, resendOk: false })
  r = await chamar({ acao: 'criar', email: 'a@teste.invalid', cargo: 'Atendimento', permissoes: [] })
  assertEquals(r.body.motivo, 'email_falhou')
  assert(!logs.join('\n').includes('a@teste.invalid'), 'e-mail no log')
} })

Deno.test({ name: 'sem login 401; sem 2FA 403; sem super_admin 403; banco fora 503', ...opts, fn: async () => {
  novoEstado({ usuario: null })
  assertEquals((await chamar({ acao: 'listar' })).status, 401)
  novoEstado()
  assertEquals((await chamar({ acao: 'criar' }, { jwt: false })).status, 401)
  novoEstado({ mfa: false, rpc: { convite_criar: { body: 'x' } } })
  let r = await chamar({ acao: 'criar', email: 'a@teste.invalid', cargo: 'Atendimento', permissoes: [] })
  assertEquals(r.status, 403)
  assertEquals(r.body.motivo, 'sem_2fa')
  assertEquals(rpcs(), ['gf_mfa_ok'])
  novoEstado({ superAdmin: false, rpc: { convite_criar: { body: 'x' } } })
  for (const acao of ['criar', 'reenviar', 'cancelar', 'listar']) {
    r = await chamar({ acao, id: '11111111-1111-4111-8111-111111111111', email: 'a@teste.invalid', cargo: 'Atendimento', permissoes: [] })
    assertEquals(r.status, 403, acao)
  }
  assert(!rpcs().includes('convite_criar'))
  assertEquals(emails().length, 0)
  novoEstado({ superAdmin: null })
  assertEquals((await chamar({ acao: 'listar' })).status, 503)
} })

Deno.test({ name: 'reenviar: token novo no e-mail, hash novo no banco; listar e cancelar', ...opts, fn: async () => {
  const id = '11111111-1111-4111-8111-111111111111'
  novoEstado({ rpc: { convite_reenviar: { body: 'convidada@teste.invalid' }, convites_listar: { body: [{ id, status: 'pendente' }] }, convite_cancelar: { body: null } } })
  let r = await chamar({ acao: 'reenviar', id })
  assertEquals(r.body, { ok: true })
  const corpo = JSON.parse(chamadas.find((c) => c.url.endsWith('/rpc/convite_reenviar'))!.corpo)
  assertEquals(corpo.p_id, id)
  const [mail] = emails()
  assertEquals(mail.to, ['convidada@teste.invalid'])
  assertEquals(corpo.p_token_hash, await hashToken(tokenDoEmail(mail.html)))
  r = await chamar({ acao: 'reenviar', id: 'nao-e-uuid' })
  assertEquals(r.status, 400)
  r = await chamar({ acao: 'listar' })
  assertEquals(r.body, { ok: true, convites: [{ id, status: 'pendente' }] })
  r = await chamar({ acao: 'cancelar', id })
  assertEquals(r.body, { ok: true })
  assertEquals(JSON.parse(chamadas.find((c) => c.url.endsWith('/rpc/convite_cancelar'))!.corpo), { p_id: id })
} })

const TOKEN = 'A'.repeat(43)
const SENHA = 'Senha@Forte1'

Deno.test({ name: 'criar-conta: sem login, cria a conta confirmada com o e-mail DO CONVITE e devolve o e-mail', ...opts, fn: async () => {
  novoEstado()
  const r = await chamar({ acao: 'criar-conta', token: TOKEN, senha: SENHA, email: 'outro@teste.invalid' }, { jwt: false })
  assertEquals(r, { status: 200, body: { ok: true, email: 'convidada@teste.invalid' } })
  const busca = new URL(chamadas.find((c) => c.metodo === 'GET' && c.url.includes('/admin_invites'))!.url)
  assertEquals(busca.searchParams.get('token_hash'), `eq.${await hashToken(TOKEN)}`)
  assertEquals(busca.searchParams.get('status'), 'eq.pendente')
  assert(busca.searchParams.get('expires_at')?.startsWith('gt.'), 'sem conferir a validade')
  const criada = JSON.parse(chamadas.find((c) => c.url.endsWith('/auth/v1/admin/users'))!.corpo)
  assertEquals(criada.email, 'convidada@teste.invalid')
  assertEquals(criada.password, SENHA)
  assertEquals(criada.email_confirm, true)
  // a dona do e-mail é avisada da conta criada, com a hora de Brasília
  const [aviso] = emails()
  assertEquals(aviso.to, ['convidada@teste.invalid'])
  assertEquals(aviso.subject, 'Sua conta de colaborador da Evokaa foi criada')
  assert(aviso.html.includes('1 de outubro de 2026 às 14:30') && aviso.html.includes('Se não foi você'), aviso.html)
  // limite por IP com chave própria, separada da do formulário de contato
  const hit = JSON.parse(chamadas.find((c) => c.metodo === 'POST' && c.url.includes('contact_rate_limit_hits'))!.corpo)
  assertEquals(hit.ip, 'convite-conta:203.0.113.9')
  const conta = new URL(chamadas.find((c) => c.metodo === 'HEAD')!.url)
  assertEquals(conta.searchParams.get('ip'), 'eq.convite-conta:203.0.113.9')
  // nada de token, senha ou e-mail no log
  const tudo = logs.join('\n')
  assert(!tudo.includes(TOKEN) && !tudo.includes(SENHA) && !tudo.includes('convidada@'), tudo)
} })

Deno.test({ name: 'criar-conta: conta existente → "entre com a sua conta", sem mais nada', ...opts, fn: async () => {
  novoEstado({ criarConta: { status: 422, body: { code: 'email_exists', msg: 'A user with this email address has already been registered' } } })
  const r = await chamar({ acao: 'criar-conta', token: TOKEN, senha: SENHA }, { jwt: false })
  assertEquals(r.body, { ok: false, motivo: 'conta_existe', message: 'Já existe uma conta com este e-mail. Entre com ela para aceitar o convite.' })
} })

Deno.test({ name: 'criar-conta: convite inválido, token fora do formato, senha fraca e limite por IP', ...opts, fn: async () => {
  novoEstado({ convite: null })
  let r = await chamar({ acao: 'criar-conta', token: TOKEN, senha: SENHA }, { jwt: false })
  assertEquals(r.body.motivo, 'convite_invalido')
  assert(!chamadas.some((c) => c.url.endsWith('/auth/v1/admin/users')), 'criou conta sem convite')
  novoEstado()
  r = await chamar({ acao: 'criar-conta', token: 'curto', senha: SENHA }, { jwt: false })
  assertEquals(r.body.motivo, 'convite_invalido')
  r = await chamar({ acao: 'criar-conta', token: TOKEN, senha: 'fraca' }, { jwt: false })
  assertEquals(r.body.motivo, 'senha_fraca')
  assert(!chamadas.some((c) => c.url.endsWith('/auth/v1/admin/users')), 'criou conta com senha fraca')
  novoEstado({ limiteContagem: 6 })
  r = await chamar({ acao: 'criar-conta', token: TOKEN, senha: SENHA }, { jwt: false })
  assertEquals(r.status, 429)
  assert(!chamadas.some((c) => c.url.includes('/admin_invites')), 'consultou o convite acima do limite')
} })

const DADOS = { nome_completo: 'Clara', cpf: '52998224725' }

Deno.test({ name: 'aceitar: convite_aceitar com o JWT de quem chama e, na mesma requisição, o aviso aos super_admins', ...opts, fn: async () => {
  novoEstado({ usuario: 'u-clara', rpc: { convite_aceitar: { status: 204, body: undefined } } })
  let r = await chamar({ acao: 'aceitar', token: TOKEN, dados: DADOS })
  assertEquals(r.body, { ok: true, avisados: 2 })
  const aceite = chamadas.find((c) => c.url.endsWith('/rpc/convite_aceitar'))!
  assertEquals(aceite.headers.get('Authorization'), 'Bearer jwt-teste')
  assertEquals(JSON.parse(aceite.corpo), { p_token: TOKEN, p_dados: DADOS })
  const marcar = new URL(chamadas.find((c) => c.metodo === 'PATCH')!.url)
  assertEquals(marcar.searchParams.get('used_by'), 'eq.u-clara')
  assertEquals(marcar.searchParams.get('status'), 'eq.usado')
  assertEquals(marcar.searchParams.get('aviso_em'), 'is.null')
  const enviados = emails()
  assertEquals(enviados.map((m) => m.to[0]), ['super1@teste.invalid', 'super2@teste.invalid'])
  assertEquals(enviados[0].subject, 'Clara <b>Teste</b> concluiu o cadastro como colaborador(a) da Evokaa')
  assert(enviados[0].html.includes('Clara &lt;b&gt;Teste&lt;/b&gt;') && !enviados[0].html.includes('<b>Teste'), 'nome sem escape no HTML')
  // e-mail da conta e a hora em que ela foi criada (Brasília)
  assert(enviados[0].html.includes('quem@teste.invalid') && enviados[0].html.includes('30 de setembro de 2026 às 10:05'), enviados[0].html)
  assert(enviados[0].html.includes('https://alpha.evokaa.com.br/admin/team'))
  assert(!rpcs().includes('gf_admin_can'), 'aceitar não exige super_admin')

  // aviso já dado: aceita sem repetir
  novoEstado({ usuario: 'u-clara', marcados: [], rpc: { convite_aceitar: { status: 204, body: undefined } } })
  r = await chamar({ acao: 'aceitar', token: TOKEN, dados: DADOS })
  assertEquals(r.body, { ok: true, avisados: 0 })
  assertEquals(emails().length, 0)

  // Resend fora: o aceite vale, o aviso fica desmarcado
  novoEstado({ usuario: 'u-clara', resendOk: false, rpc: { convite_aceitar: { status: 204, body: undefined } } })
  r = await chamar({ acao: 'aceitar', token: TOKEN, dados: DADOS })
  assertEquals(r.body, { ok: true, avisados: 0 })
  assertEquals(chamadas.filter((c) => c.metodo === 'PATCH').map((c) => JSON.parse(c.corpo).aviso_em === null), [false, true])
} })

Deno.test({ name: 'aceitar: recusa do banco volta para a tela, sem aviso; token inválido, dados ausentes e sem 2FA', ...opts, fn: async () => {
  novoEstado({ usuario: 'u-outra', rpc: { convite_aceitar: { status: 403, body: { code: '42501', message: 'Entre com a conta do e-mail que recebeu o convite.' } } } })
  let r = await chamar({ acao: 'aceitar', token: TOKEN, dados: DADOS })
  assertEquals(r.body, { ok: false, motivo: 'recusado', message: 'Entre com a conta do e-mail que recebeu o convite.' })
  assert(!chamadas.some((c) => c.metodo === 'PATCH') && emails().length === 0, 'avisou sem aceite')
  novoEstado({ usuario: 'u-clara', rpc: { convite_aceitar: { status: 204, body: undefined } } })
  r = await chamar({ acao: 'aceitar', token: 'curto', dados: DADOS })
  assertEquals(r.body.motivo, 'convite_invalido')
  r = await chamar({ acao: 'aceitar', token: TOKEN, dados: ['x'] })
  assertEquals(r.status, 400)
  assert(!rpcs().includes('convite_aceitar'))
  novoEstado({ usuario: 'u-clara', mfa: false })
  assertEquals((await chamar({ acao: 'aceitar', token: TOKEN, dados: DADOS })).status, 403)
  assert(!rpcs().includes('convite_aceitar'))
  assertEquals((await chamar({ acao: 'avisar-aceite' })).status, 400) // ação antiga não existe mais
} })

Deno.test({ name: 'ação desconhecida 400; GET 405; OPTIONS com CORS', ...opts, fn: async () => {
  novoEstado()
  assertEquals((await chamar({ acao: 'apagar-tudo' })).status, 400)
  assertEquals((await handler(new Request('http://funcao/admin-invite'))).status, 405)
  const o = await handler(new Request('http://funcao/admin-invite', { method: 'OPTIONS', headers: { Origin: 'https://alpha.evokaa.com.br' } }))
  assertEquals(o.headers.get('Access-Control-Allow-Origin'), 'https://alpha.evokaa.com.br')
} })
