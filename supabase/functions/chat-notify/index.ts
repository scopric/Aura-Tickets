// Avisos do chat (etapa 1a): e-mail ao cliente quando a equipe responde e alerta à equipe.
//
// Chamada só pelo pg_cron (docs/sql/20261001_chat.sql, job "chat_notify", a cada 2 min) com o
// cabeçalho x-chat-secret, lido do Vault na hora de rodar. Publicar com --no-verify-jwt.
// Não recebe destinatário nem texto: a fila (chat_notify_due) e os destinos vêm do banco.
// Grava customer_emailed_at / team_alerted_at só depois de o Resend aceitar; falha de uma linha
// não para as outras (ela volta na próxima rodada). Responde só contagens: o corpo fica em
// net._http_response, então nada de dado pessoal aqui.
// O e-mail ao cliente NÃO repete a resposta: o e-mail da conta não é confirmado (plano, "Limite
// conhecido"); ele só avisa e leva para a conta.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

const FROM = 'Evokaa <contato@evokaa.com.br>'
const APP_URL = 'https://app.evokaa.com.br'
const ADMIN_URL = 'https://alpha.evokaa.com.br/admin/atendimento'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Comparação em tempo constante: compara os hashes SHA-256 (mesmo tamanho) byte a byte.
async function mesmoSegredo(a: string, b: string) {
  const hash = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  const [x, y] = await Promise.all([hash(a), hash(b)])
  let d = 0
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]
  return d === 0
}

// ---------- copiado de app/supabase/functions/send-email/index.ts ----------

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

const colors = {
  plum: '#581C87',
  plumLight: '#7E22CE',
  espresso: '#292524',
  cream: '#FAF8F5',
  canvas: '#F5F5F4',
  void: '#0C0A09',
  textDark: '#1C1917',
  textMuted: '#78716C',
  accent: '#D97706',
}

function emailShell(title: string, intro: string, body: string, ctaLabel: string, ctaHref: string) {
  return `
    <div style="background-color: ${colors.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: ${colors.textDark};">
      <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05);">
        <div style="background-color: ${colors.plum}; padding: 40px 30px; text-align: center; color: #FFFFFF;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Evokaa</h1>
          <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.8); font-size: 16px;">${title}</p>
        </div>
        <div style="padding: 30px;">
          <p style="line-height: 1.6; font-size: 15px; color: ${colors.textDark};">${intro}</p>
          ${body}
          <div style="text-align: center; margin: 30px 0 10px 0;">
            <a href="${ctaHref}" style="background-color: ${colors.plum}; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px;">${ctaLabel}</a>
          </div>
        </div>
        <div style="background-color: ${colors.void}; padding: 20px; text-align: center; color: rgba(255,255,255,0.6); font-size: 12px;">
          <p style="margin: 0;">Evokaa — Gestão de Eventos e Ingressos</p>
          <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.4);">Dúvidas? contato@evokaa.com.br</p>
        </div>
      </div>
    </div>
  `
}

// Sem o ramo "demo" da original: sem chave o handler já devolveu 503; resposta não-2xx lança
// erro (sem o texto do Resend, que pode trazer o endereço).
async function sendMail(to: string, subject: string, html: string, from: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Resend ${response.status} ${data?.name ?? ''}`.trim())
  return data
}

// ---------- montagem dos e-mails ----------

type Aviso = {
  tipo: 'cliente' | 'equipe'
  conversation_id: string
  email: string
  nome: string
  assunto: string
  urgente: boolean
  previa: string | null
}

// Assunto de e-mail é cabeçalho: sem quebra de linha e com tamanho limitado.
const linha = (s: string, max: number) => s.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)

function montar(a: Aviso) {
  if (a.tipo === 'cliente') {
    return {
      subject: 'Você tem uma nova resposta da equipe Evokaa',
      html: emailShell(
        'Nova resposta no atendimento',
        `Olá! Você tem uma nova resposta da equipe Evokaa sobre "${escapeHtml(a.assunto)}".`,
        `<p style="line-height: 1.6; font-size: 14px; color: ${colors.textMuted};">Para ler e responder, entre na sua conta. Responder este e-mail não chega ao chat.</p>`,
        'Abrir minha conta',
        APP_URL,
      ),
    }
  }
  return {
    subject: linha(`${a.urgente ? '[URGENTE] ' : ''}[Chat] ${a.nome}: ${a.assunto}`, 150),
    html: emailShell(
      'Nova mensagem no chat',
      `${escapeHtml(a.nome)} escreveu sobre "${escapeHtml(a.assunto)}"${a.urgente ? ' (urgente)' : ''}.`,
      `<blockquote style="margin: 16px 0; padding: 12px 16px; background-color: ${colors.canvas}; border-left: 4px solid ${colors.plum}; white-space: pre-wrap;">${escapeHtml(a.previa ?? '')}</blockquote>`,
      'Abrir no atendimento',
      ADMIN_URL,
    ),
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: segredo, error: segredoError } = await admin.rpc('chat_notify_secret')
  if (segredoError) {
    console.error('[chat-notify] chat_notify_secret falhou:', segredoError.message)
    return json(500, { ok: false })
  }
  const recebido = req.headers.get('x-chat-secret') ?? ''
  if (typeof segredo !== 'string' || !segredo || !recebido || !(await mesmoSegredo(recebido, segredo))) {
    return json(401, { ok: false })
  }

  // Sem a chave não envia e não grava nada: o aviso continua na fila.
  if (!RESEND_API_KEY) return json(503, { ok: false, motivo: 'sem_chave' })

  const { data: fila, error: filaError } = await admin.rpc('chat_notify_due')
  if (filaError) {
    console.error('[chat-notify] chat_notify_due falhou:', filaError.message)
    return json(500, { ok: false })
  }

  let enviados = 0
  let falhas = 0
  for (const a of (fila ?? []) as Aviso[]) {
    try {
      const { subject, html } = montar(a)
      await sendMail(a.email, subject, html, FROM)
    } catch (e) {
      falhas++
      console.error('[chat-notify] envio falhou:', a.tipo, a.conversation_id, e instanceof Error ? e.message : 'desconhecida')
      continue
    }
    const coluna = a.tipo === 'cliente' ? 'customer_emailed_at' : 'team_alerted_at'
    const { data, error } = await admin
      .from('conversations')
      .update({ [coluna]: new Date().toISOString() })
      .eq('id', a.conversation_id)
      .select('id')
    if (error || !data?.length) {
      // o e-mail saiu mas a data não foi gravada: pode repetir na próxima rodada
      falhas++
      console.error('[chat-notify] gravar data falhou:', a.tipo, a.conversation_id, error?.message ?? 'nenhuma linha')
      continue
    }
    enviados++
  }

  return json(200, { ok: true, enviados, falhas })
})
