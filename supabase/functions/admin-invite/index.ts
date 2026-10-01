// Convite de colaborador da Evokaa (Fase F; banco em docs/sql/20261002_convite_colaborador.sql).
//
// Chamada: POST com { acao, ... } (supabase.functions.invoke('admin-invite', { body })).
//   Super_admin com 2FA (JWT de quem chama; o banco decide com gf_admin_can('super_admin')):
//     { acao: 'criar', email, cargo, permissoes: string[] } → { ok:true, id } e o e-mail com o link
//     { acao: 'reenviar', id }                              → { ok:true } (token novo; o link antigo para de valer)
//     { acao: 'cancelar', id }                              → { ok:true }
//     { acao: 'listar' }                                    → { ok:true, convites }
//   Sem login (o token prova que a pessoa leu o e-mail convidado), com limite próprio por IP (5 em 10 min):
//     { acao: 'criar-conta', token, senha } → { ok:true, email } ou { ok:false, motivo:'conta_existe' };
//       a pessoa recebe o e-mail "Sua conta de colaborador da Evokaa foi criada em …" (se não foi ela, avisa)
//   Quem está aceitando (com 2FA; o banco confere o resto com o JWT dela):
//     { acao: 'aceitar', token, dados } → convite_aceitar e, na mesma requisição, o e-mail aos super_admins (com o
//       e-mail da conta e a hora em que ela foi criada); um aviso por convite. A garantia de que todo aceite é visto
//       é a lista "Aceitos recentemente" da tela Equipe (convites_listar; "sem aviso por e-mail" quando aviso_em é
//       null), não o e-mail: se o aviso falhar, o aceite vale do mesmo jeito.
// Respostas: 401 sem login, 403 sem 2FA ou sem super_admin, 429 no limite por IP, 503 sem banco ou sem Resend.
// Recusa de regra (convite repetido, inválido etc.) volta 200 com { ok:false, motivo, message }.
// O token (32 bytes aleatórios) só existe no link do e-mail (alpha.evokaa.com.br/convite#<token>, o # não vai
// ao servidor); o banco guarda o sha256 dele. Nada de token, senha, e-mail ou nome nos logs.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { corsHeaders } from '../_shared/cors.ts'
import { adminCan, comoQuemChamou, mfaOk } from '../_shared/mfa.ts'
import { colors, emailShell, escapeHtml, limitarPorIp, sendMail } from '../_shared/email.ts'
import { passwordError } from '../_shared/password.ts'
import { validarEmail } from '../_shared/validar.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

const REMETENTE = 'Evokaa <contato@evokaa.com.br>'
const ALPHA = 'https://alpha.evokaa.com.br'
// Mesma lista do banco (convite_permissoes_ok) e da tela Equipe (PERMISSIONS, sem super_admin): mudar as três juntas
const PERMISSOES = ['manage_users', 'manage_affiliates', 'manage_events', 'manage_finance', 'view_analytics',
  'manage_tickets', 'manage_settings', 'manage_feedback', 'manage_support', 'manage_newsletter', 'manage_coupons',
  'moderate_mesa', 'manage_team']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/ // 32 bytes em base64url, sem "="
const CONTROLE = /[\u0000-\u001F\u007F]/g

// sha256 (hex) do texto do token: o mesmo cálculo de public.convite_hash
export async function hashToken(token: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('')
}

function novoToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Quem chama é o dono do token, validado no GoTrue (mesmo padrão de aviso-politica)
async function getCaller(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  const { data, error } = await createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? '', criadaEm: data.user.created_at }
}

// "1 de outubro de 2026 às 14:30" no horário de Brasília
export const horaBrasilia = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))

// O mesmo visual de emailShell, sem o botão
const emailContaCriada = (quando: string) => `
  <div style="background-color: ${colors.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: ${colors.textDark};">
    <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,0,0,0.05);">
      <div style="background-color: ${colors.plum}; padding: 32px 30px; text-align: center; color: #FFFFFF;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Evokaa</h1>
        <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.8); font-size: 16px;">Conta criada</p>
      </div>
      <div style="padding: 30px; font-size: 15px; line-height: 1.6; color: ${colors.textDark};">
        <p>Sua conta de colaborador da Evokaa foi criada em ${escapeHtml(quando)} (horário de Brasília).</p>
        <p>Se não foi você, responda este e-mail ou avise a Evokaa.</p>
      </div>
    </div>
  </div>`

const ASSUNTO_CONVITE = 'Você foi convidado para a equipe de colaboradores da Evokaa'
const htmlConvite = (link: string) => emailShell(
  'Convite para a equipe',
  'Olá! Você foi convidado para a equipe de colaboradores da Evokaa.',
  `<p style="line-height: 1.6; font-size: 15px; color: ${colors.textDark};">Para aceitar, crie a sua senha (ou entre com a sua conta, se já tiver uma), ative a verificação em duas etapas e preencha o seu cadastro.</p>
   <p style="line-height: 1.6; font-size: 14px; color: ${colors.textMuted};">O link vale por 7 dias e só pode ser usado uma vez. Se você não esperava este convite, ignore este e-mail.</p>`,
  'Aceitar o convite',
  link,
)

// Aviso aos super_admins de um aceite (Decisão 125). Só convite usado por quem chama e ainda sem aviso; aviso_em é
// marcado só depois de pelo menos um e-mail sair (sem envio, fica "sem aviso por e-mail" na lista). O token é de uso
// único: só a requisição que aceitou chega aqui, então não há dois avisos do mesmo convite ao mesmo tempo.
// Devolve quantos e-mails saíram.
async function avisarSuperAdmins(caller: { id: string; email: string; criadaEm: string }): Promise<number> {
  if (!RESEND_API_KEY) return 0
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: semAviso, error } = await admin.from('admin_invites').select('id')
    .eq('used_by', caller.id).eq('status', 'usado').is('aviso_em', null)
  if (error) { console.error('[admin-invite] aviso: convites', error.code); return 0 }
  if (!semAviso?.length) return 0

  const [{ data: ficha }, { data: supers, error: e2 }] = await Promise.all([
    admin.from('staff_profiles').select('nome_completo').eq('user_id', caller.id).maybeSingle(),
    admin.from('profiles').select('email').eq('role', 'admin').contains('admin_permissions', ['super_admin']),
  ])
  if (e2) { console.error('[admin-invite] aviso: super_admins', e2.code); return 0 }
  const nome = String(ficha?.nome_completo ?? 'Uma pessoa').replace(CONTROLE, ' ').trim()
  const assunto = `${nome} concluiu o cadastro como colaborador(a) da Evokaa`
  const html = emailShell(
    'Novo colaborador',
    `${escapeHtml(nome)} aceitou o convite e concluiu o cadastro como colaborador(a) da Evokaa. O acesso já está liberado, com as funções escolhidas no convite.`,
    `<p style="line-height: 1.6; font-size: 14px; color: ${colors.textDark};">Conta: ${escapeHtml(caller.email)}, criada em ${escapeHtml(horaBrasilia(caller.criadaEm))} (horário de Brasília).</p>
     <p style="line-height: 1.6; font-size: 14px; color: ${colors.textMuted};">Na tela Equipe você vê o cadastro, muda as funções ou remove o acesso.</p>`,
    'Abrir a Equipe',
    `${ALPHA}/admin/team`,
  )
  let enviados = 0
  for (const s of supers ?? []) {
    if (!s.email) continue
    try {
      await sendMail(s.email, assunto, html, REMETENTE)
      enviados++
    } catch {
      console.error('[admin-invite] resend recusou o aviso')
    }
  }
  if (enviados) {
    const { error: e3 } = await admin.from('admin_invites').update({ aviso_em: new Date().toISOString() })
      .in('id', semAviso.map((c) => c.id)).is('aviso_em', null)
    if (e3) console.error('[admin-invite] aviso: marcar', e3.code)
  }
  return enviados
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { ok: false, motivo: 'entrada_invalida' })

  let b: Record<string, unknown> = {}
  try {
    b = (await req.json()) ?? {}
  } catch {
    // corpo inválido cai em entrada_invalida
  }
  const acao = b.acao
  const recusa = (motivo: string, message: string) => json(200, { ok: false, motivo, message })

  // Erro das funções do banco: as mensagens de regra (P0001, 22023) são escritas para a tela
  const erroBanco = (contexto: string, error: { code?: string; message: string }) => {
    if (error.code === '42501') return json(403, { ok: false, motivo: 'nao_autorizado', message: 'Sem permissão.' })
    if (error.code === 'P0001' || error.code === '22023') return recusa('recusado', error.message)
    console.error('[admin-invite]', contexto, error.code)
    return json(503, { ok: false, motivo: 'indisponivel', message: 'Não foi possível agora. Tente de novo em instantes.' })
  }

  const enviarConvite = async (email: string, token: string) => {
    try {
      await sendMail(email, ASSUNTO_CONVITE, htmlConvite(`${ALPHA}/convite#${token}`), REMETENTE)
      return true
    } catch {
      console.error('[admin-invite] resend recusou o convite')
      return false
    }
  }

  // ---- Sem login: criar a conta do convidado ----
  if (acao === 'criar-conta') {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(503, { ok: false, motivo: 'indisponivel' })
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    // limite próprio (chave separada da do formulário de contato), 5 tentativas a cada 10 minutos
    const limite = await limitarPorIp(req, admin, (body, s = 200) => json(s, body), 'convite-conta:')
    if (limite) return limite
    const token = typeof b.token === 'string' ? b.token : ''
    const senha = typeof b.senha === 'string' ? b.senha : ''
    if (!TOKEN_RE.test(token)) return recusa('convite_invalido', 'Convite inválido ou expirado.')
    const erroSenha = passwordError(senha)
    if (erroSenha) return recusa('senha_fraca', erroSenha)

    const { data: convite, error } = await admin.from('admin_invites').select('email')
      .eq('token_hash', await hashToken(token)).eq('status', 'pendente').gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (error) return erroBanco('criar-conta convite', error)
    if (!convite) return recusa('convite_invalido', 'Convite inválido ou expirado.')

    // O link chegou no e-mail convidado: a conta já nasce com o e-mail confirmado
    const { data: criada, error: e } = await admin.auth.admin.createUser({ email: convite.email, password: senha, email_confirm: true })
    if (e) {
      const codigo = (e as { code?: string }).code
      if (codigo === 'email_exists' || e.status === 422 && /already|exists|registered/i.test(e.message)) {
        return recusa('conta_existe', 'Já existe uma conta com este e-mail. Entre com ela para aceitar o convite.')
      }
      if (codigo === 'weak_password') return recusa('senha_fraca', 'Senha fraca. Escolha outra.')
      console.error('[admin-invite] createUser falhou', e.status, codigo)
      return json(503, { ok: false, motivo: 'indisponivel', message: 'Não foi possível criar a conta agora. Tente de novo.' })
    }
    // Quem pegou o link de outra pessoa cria a conta dela: o e-mail avisa a dona do endereço. Falha não desfaz a conta.
    const quando = horaBrasilia(criada?.user?.created_at ?? new Date().toISOString())
    try {
      // Sem botão: o e-mail só informa e orienta (não leva a pessoa a nenhuma tela)
      await sendMail(convite.email, 'Sua conta de colaborador da Evokaa foi criada', emailContaCriada(quando), REMETENTE)
    } catch {
      console.error('[admin-invite] resend recusou o aviso de conta criada')
    }
    return json(200, { ok: true, email: convite.email })
  }

  if (!['criar', 'reenviar', 'cancelar', 'listar', 'aceitar'].includes(acao as string)) {
    return json(400, { ok: false, motivo: 'entrada_invalida' })
  }
  const caller = await getCaller(req)
  if (!caller) return json(401, { ok: false, motivo: 'nao_autorizado' })
  // 2FA: só com o código confirmado nesta sessão
  if (!(await mfaOk(req))) {
    return json(403, { ok: false, motivo: 'sem_2fa', message: 'Confirme o código da verificação em duas etapas (saia e entre de novo).' })
  }

  // ---- Aceitar: o banco aplica (com o JWT de quem chama) e o aviso sai na mesma requisição ----
  if (acao === 'aceitar') {
    const token = typeof b.token === 'string' ? b.token : ''
    const dados = b.dados
    if (!TOKEN_RE.test(token)) return recusa('convite_invalido', 'Convite inválido ou expirado.')
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return json(400, { ok: false, motivo: 'entrada_invalida' })
    const { error } = await comoQuemChamou(req).rpc('convite_aceitar', { p_token: token, p_dados: dados })
    if (error) {
      // aqui o 42501 é regra escrita para a tela (e-mail de outra conta, 2FA)
      if (['42501', 'P0001', '22023'].includes(error.code ?? '')) return recusa('recusado', error.message)
      return erroBanco('aceitar', error)
    }
    // O aceite já está gravado: nenhum erro do aviso vira erro do aceite
    let avisados = 0
    try {
      avisados = await avisarSuperAdmins(caller)
    } catch {
      console.error('[admin-invite] aviso aos super_admins falhou')
    }
    return json(200, { ok: true, avisados })
  }

  // ---- Super_admin ----
  const pode = await adminCan(req, 'super_admin')
  if (pode === null) return json(503, { ok: false, motivo: 'indisponivel', message: 'Tente de novo em instantes.' })
  if (!pode) return json(403, { ok: false, motivo: 'nao_autorizado', message: 'Só quem tem Acesso total convida colaboradores.' })
  const db = comoQuemChamou(req)

  if (acao === 'listar') {
    const { data, error } = await db.rpc('convites_listar')
    if (error) return erroBanco('listar', error)
    return json(200, { ok: true, convites: data ?? [] })
  }

  const id = typeof b.id === 'string' && UUID_RE.test(b.id) ? b.id : null
  if (acao === 'cancelar') {
    if (!id) return json(400, { ok: false, motivo: 'entrada_invalida' })
    const { error } = await db.rpc('convite_cancelar', { p_id: id })
    if (error) return erroBanco('cancelar', error)
    return json(200, { ok: true })
  }

  if (!RESEND_API_KEY) return json(503, { ok: false, motivo: 'sem_resend', message: 'O envio de e-mails não está configurado.' })
  const token = novoToken()

  if (acao === 'reenviar') {
    if (!id) return json(400, { ok: false, motivo: 'entrada_invalida' })
    const { data: email, error } = await db.rpc('convite_reenviar', { p_id: id, p_token_hash: await hashToken(token) })
    if (error) return erroBanco('reenviar', error)
    if (!(await enviarConvite(String(email), token))) {
      return recusa('email_falhou', 'O link foi renovado, mas o e-mail não saiu. Tente reenviar de novo.')
    }
    return json(200, { ok: true })
  }

  // criar
  const email = validarEmail(b.email)
  const cargo = typeof b.cargo === 'string' ? b.cargo.trim() : ''
  const lista = Array.isArray(b.permissoes) ? b.permissoes : null
  if (!email) return recusa('entrada_invalida', 'Informe um e-mail válido.')
  if (cargo.length < 2 || cargo.length > 80 || /[\u0000-\u001F\u007F]/.test(cargo)) {
    return recusa('entrada_invalida', 'Informe o cargo (2 a 80 caracteres).')
  }
  if (!lista || !lista.every((p) => typeof p === 'string' && PERMISSOES.includes(p))) {
    return recusa('entrada_invalida', 'Função inválida no convite.')
  }
  const { data: novoId, error } = await db.rpc('convite_criar', {
    p_email: email, p_cargo: cargo, p_permissions: [...new Set(lista as string[])], p_token_hash: await hashToken(token),
  })
  if (error) return erroBanco('criar', error)
  if (!(await enviarConvite(email, token))) {
    return recusa('email_falhou', 'O convite foi criado, mas o e-mail não saiu. Use Reenviar na lista de convites.')
  }
  return json(200, { ok: true, id: novoId })
})
