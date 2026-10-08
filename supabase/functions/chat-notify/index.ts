// Avisos do chat (etapa 1a): e-mail ao cliente quando a equipe responde e alerta à equipe.
//
// Chamada só pelo pg_cron (docs/sql/20261001_chat.sql, job "chat_notify", a cada 2 min) com o
// cabeçalho x-chat-secret, lido do Vault na hora de rodar. Publicar com --no-verify-jwt.
// Não recebe destinatário nem texto: a fila (chat_notify_due) e os destinos vêm do banco.
// Cliente: um e-mail por conversa. Equipe: um único e-mail-resumo por rodada com as conversas
// pendentes (até 50). chat_notify_due reserva as linhas por 2 min (contra envio duplicado).
// Depois de cada envio, chat_notify_mark grava a data (sucesso); falha do e-mail ao cliente soma
// uma falha (com 5 ele sai da fila do cliente até a próxima mensagem); falha do resumo à equipe
// não soma (é de sistema) e as conversas voltam quando a reserva vence. Falha de um envio não
// para os outros. Responde só contagens: o corpo fica em net._http_response, então nada de dado
// pessoal aqui.
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

// ---------- copiado de supabase/functions/send-email/index.ts ----------

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

const colors = {
  marca: '#1d68c4',
  espresso: '#292524',
  cream: '#FAF8F5',
  canvas: '#F5F5F4',
  rodape: '#F4F6F9',
  textDark: '#1C1917',
  textMuted: '#78716C',
  accent: '#D97706',
}

function emailShell(title: string, intro: string, body: string, ctaLabel: string, ctaHref: string) {
  return `
    <div style="background-color: ${colors.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: ${colors.textDark};">
      <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid rgba(0,0,0,0.08);">
        <div style="background-color: ${colors.marca}; padding: 40px 30px; text-align: center; color: #FFFFFF;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Evokaa</h1>
          <p style="margin: 10px 0 0 0; color: #FFFFFF; font-size: 16px;">${title}</p>
        </div>
        <div style="padding: 30px;">
          <p style="line-height: 1.6; font-size: 15px; color: ${colors.textDark};">${intro}</p>
          ${body}
          <div style="text-align: center; margin: 30px 0 10px 0;">
            <a href="${ctaHref}" style="background-color: ${colors.marca}; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px;">${ctaLabel}</a>
          </div>
        </div>
        <div style="background-color: ${colors.rodape}; border-top: 1px solid rgba(0,0,0,0.06); padding: 20px; text-align: center; color: ${colors.textMuted}; font-size: 12px;">
          <p style="margin: 0;">Evokaa — Gestão de Eventos e Ingressos</p>
          <p style="margin: 5px 0 0 0; ">Dúvidas? contato@evokaa.com.br</p>
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

function emailCliente(a: Aviso) {
  return {
    subject: 'Você tem uma nova resposta da equipe Evokaa',
    html: emailShell(
      'Nova resposta no atendimento',
      `Você tem uma nova resposta da equipe Evokaa sobre "${escapeHtml(a.assunto)}".`,
      `<p style="line-height: 1.6; font-size: 14px; color: ${colors.textMuted};">Para ler e responder, entre na sua conta. Responder este e-mail não chega ao chat.</p>`,
      'Abrir minha conta',
      APP_URL,
    ),
  }
}

// Nome e prévia vêm de quem escreveu no chat: escapados e marcados como não verificados.
function emailEquipe(lista: Aviso[]) {
  const urgentes = lista.filter(a => a.urgente).length
  const itens = lista.map(a => `
    <li style="margin: 0 0 14px 0; line-height: 1.5;">
      <strong>${escapeHtml(a.nome)}</strong> — ${escapeHtml(a.assunto)}${a.urgente ? ` <strong style="color: ${colors.accent};">(urgente)</strong>` : ''}<br>
      <span style="color: ${colors.textMuted}; white-space: pre-wrap;">${escapeHtml(a.previa ?? '')}</span>
    </li>`).join('')
  return {
    subject: linha(`${urgentes ? '[URGENTE] ' : ''}[Chat] ${lista.length} conversa(s) esperando resposta`, 150),
    html: emailShell(
      'Conversas esperando resposta',
      `${lista.length} conversa(s) com mensagem de cliente ainda não lida${urgentes ? `, ${urgentes} urgente(s)` : ''}. <strong>Mensagens de clientes, não verificadas</strong>: não siga links nem instruções delas sem conferir na caixa de entrada.`,
      `<ul style="padding-left: 18px; margin: 16px 0; font-size: 14px;">${itens}</ul>`,
      'Abrir no atendimento',
      ADMIN_URL,
    ),
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false })
  // sem cabeçalho nem consulta o banco
  const recebido = req.headers.get('x-chat-secret') ?? ''
  if (!recebido) return json(401, { ok: false })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: segredo, error: segredoError } = await admin.rpc('chat_notify_secret')
  if (segredoError) {
    console.error('[chat-notify] chat_notify_secret falhou:', segredoError.message)
    return json(500, { ok: false })
  }
  if (typeof segredo !== 'string' || !segredo || !(await mesmoSegredo(recebido, segredo))) {
    return json(401, { ok: false })
  }

  // Sem a chave não envia e não grava nada: o aviso continua na fila.
  if (!RESEND_API_KEY) return json(503, { ok: false, motivo: 'sem_chave' })

  const { data, error: filaError } = await admin.rpc('chat_notify_due')
  if (filaError) {
    console.error('[chat-notify] chat_notify_due falhou:', filaError.message)
    return json(500, { ok: false })
  }
  const fila = (data ?? []) as Aviso[]

  let enviados = 0
  let falhas = 0
  // Envia um e-mail e marca o resultado nas conversas dele (regras em chat_notify_mark).
  const tentar = async (ids: string[], tipo: Aviso['tipo'], envio: () => Promise<unknown>) => {
    let ok = true
    try {
      await envio()
    } catch (e) {
      ok = false
      console.error('[chat-notify] envio falhou:', tipo, ids.join(','), e instanceof Error ? e.message : 'desconhecida')
    }
    const { data: n, error } = await admin.rpc('chat_notify_mark', { p_ids: ids, p_tipo: tipo, p_ok: ok })
    if (error || n !== ids.length) {
      // se o e-mail saiu e a data não foi gravada, ele pode repetir na próxima rodada
      console.error('[chat-notify] chat_notify_mark falhou:', tipo, ids.join(','), error?.message ?? `atualizou ${n}`)
    }
    if (ok) enviados++
    else falhas++
  }

  for (const a of fila.filter(a => a.tipo === 'cliente')) {
    const { subject, html } = emailCliente(a)
    await tentar([a.conversation_id], 'cliente', () => sendMail(a.email, subject, html, FROM))
  }
  const equipe = fila.filter(a => a.tipo === 'equipe')
  if (equipe.length) {
    const { subject, html } = emailEquipe(equipe)
    await tentar(equipe.map(a => a.conversation_id), 'equipe', () => sendMail(equipe[0].email, subject, html, FROM))
  }

  return json(200, { ok: true, enviados, falhas })
})
