// Aviso por e-mail da nova Política de Privacidade: envio único, disparado por um admin.
//
// Chamada: POST com o JWT do admin (supabase.functions.invoke('aviso-politica', { body })).
//   { mode: 'contar' }                        → { ok:true, versao, destinatarios }
//   { mode: 'enviar', confirmacao: 'ENVIAR' } → { ok:true, versao, enviados, falhas, restantes }
// Recusas voltam 200 com { ok:false, motivo }; 401 só sem login.
// Banco: docs/sql/20260929_aviso_politica.sql (destinatários e registro de quem já recebeu).
// Envio único: quem tem linha em policy_notices é pulado; a Idempotency-Key da Resend evita
// duplicar se a mesma pessoa for tentada de novo em 24 h (ex.: registro falhou após o envio).
// Assunto e texto são fixos aqui: o admin não escolhe conteúdo nem destinatário.
// O log leva só user_id e status HTTP: nunca o e-mail nem a chave.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { mfaOk } from '../_shared/mfa.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

// Igual a PRIVACY_VERSION de app/src/lib/legal.ts: mudar os dois juntos.
const VERSAO = '2026-09-29'
const REMETENTE = 'Evokaa <contato@evokaa.com.br>'
// A Edge Function tem 150 s de parede; 110 s de envios + no máx. 15 s do último pedido deixa folga.
const PRAZO_MS = 110_000
// Resend: 2 pedidos por segundo por padrão (skill resend, references/sending/overview.md).
const PAUSA_MS = 600

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Mesmo padrão da função agent: quem chama é o dono do token, validado no GoTrue.
async function getCaller(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id }
}

const ASSUNTO = 'Atualizamos a nossa Política de Privacidade'
const INTRO = 'Atualizamos a Política de Privacidade da Evokaa em 29 de setembro de 2026. A mudança explica o Evo, o nosso novo assistente de inteligência artificial para produtores de eventos.'
const ITENS = [
  'Quando um produtor usa o Evo, as mensagens que ele escreve e os dados de planejamento do evento são processados pelo Google (Gemini), em nome da Evokaa. O Google não usa esse conteúdo para treinar os modelos dele e o guarda por 55 dias, só para prevenir abuso.',
  'Esse processamento pode acontecer fora do Brasil, com as garantias contratuais previstas na LGPD (art. 33).',
  'Não enviamos ao Evo dados de quem compra ingressos.',
  'O Evo só sugere: nada é criado, publicado ou pago sem o clique do produtor.',
  'A Evokaa não grava a conversa; guarda um registro de cada uso (com um resumo curto e mascarado da mensagem) até você pedir a eliminação.',
]
const PARTICIPANTE = 'Se você participa de eventos pela Evokaa, nada muda no uso dos seus dados: o Evo é usado só por produtores.'
const URL_POLITICA = 'https://www.evokaa.com.br/privacidade'
const URL_CONTATO = 'https://www.evokaa.com.br/contato'
const ASSINATURA = 'Equipe Evokaa — Evoka Soluções Ltda, CNPJ 68.076.437/0001-42'

const TEXTO = [
  'Olá,',
  INTRO,
  ...ITENS.map(i => `• ${i}`),
  PARTICIPANTE,
  `Política completa: ${URL_POLITICA}`,
  `Dúvidas ou pedidos sobre seus dados: dpo@evokaa.com.br ou ${URL_CONTATO}`,
  ASSINATURA,
].join('\n')

const link = (u: string) => `<a href="${u}" style="color: #7E22CE;">${u}</a>`
const HTML = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1F1B24; font-size: 15px; line-height: 1.6;">
<p>Olá,</p>
<p>${INTRO}</p>
<ul>${ITENS.map(i => `<li style="margin-bottom: 8px;">${i}</li>`).join('')}</ul>
<p>${PARTICIPANTE}</p>
<p>Política completa: ${link(URL_POLITICA)}</p>
<p>Dúvidas ou pedidos sobre seus dados: dpo@evokaa.com.br ou ${link(URL_CONTATO)}</p>
<p style="color: #6B6470; font-size: 13px;">${ASSINATURA}</p>
</div>`

const pausa = (ms: number) => new Promise(r => setTimeout(r, ms))

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { ok: false, motivo: 'entrada_invalida' })

  const caller = await getCaller(req)
  if (!caller) return json(401, { ok: false, motivo: 'nao_autorizado' })
  // Admin com 2FA: só com o código confirmado nesta sessão (a senha sozinha não dispara e-mail em massa)
  if (!(await mfaOk(req))) return json(403, { ok: false, motivo: 'nao_autorizado' })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: perfil } = await admin.from('profiles').select('role, admin_permissions').eq('id', caller.id).maybeSingle()
  // mesma regra do gf_admin_can('manage_settings') no banco
  const perms: string[] = perfil?.admin_permissions ?? []
  if (!(perfil?.role === 'admin' && (perms.includes('super_admin') || perms.includes('manage_settings')))) {
    return json(200, { ok: false, motivo: 'nao_autorizado' })
  }

  let b: any = null
  try {
    b = await req.json()
  } catch {
    // corpo inválido cai em entrada_invalida
  }
  const contar = b?.mode === 'contar'
  const enviar = b?.mode === 'enviar' && b?.confirmacao === 'ENVIAR'
  if (!contar && !enviar) return json(200, { ok: false, motivo: 'entrada_invalida' })
  if (enviar && !RESEND_API_KEY) return json(200, { ok: false, motivo: 'sem_resend' })

  // ponytail: o PostgREST devolve no máx. 1000 linhas por chamada; basta rodar de novo (quem recebeu é pulado)
  const { data: lista, error } = await admin.rpc('aviso_politica_destinatarios', { p_version: VERSAO })
  if (error || !Array.isArray(lista)) {
    console.error('[aviso-politica] destinatarios falhou:', error?.message)
    return json(200, { ok: false, motivo: 'erro_banco' })
  }
  if (contar) return json(200, { ok: true, versao: VERSAO, destinatarios: lista.length })

  const prazo = Date.now() + PRAZO_MS
  let enviados = 0
  let falhas = 0
  for (let i = 0; i < lista.length; i++) {
    if (i > 0) await pausa(PAUSA_MS)
    if (Date.now() >= prazo) break
    const d = lista[i] as { user_id: string; email: string }
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15_000)
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `politica-${VERSAO}/${d.user_id}`,
        },
        body: JSON.stringify({ from: REMETENTE, to: [d.email], subject: ASSUNTO, html: HTML, text: TEXTO }),
        signal: ctrl.signal,
      })
      await r.body?.cancel()
      if (!r.ok) {
        // ponytail: sem nova tentativa aqui (429/5xx incluídos); quem falhou continua pendente e vai na próxima rodada
        falhas++
        console.error('[aviso-politica] resend recusou:', d.user_id, r.status)
        continue
      }
    } catch {
      falhas++
      console.error('[aviso-politica] resend sem resposta:', d.user_id)
      continue
    } finally {
      clearTimeout(timer)
    }
    enviados++
    // O e-mail já saiu: se o registro falhar, a pessoa volta na próxima rodada e a Idempotency-Key
    // segura a duplicata por 24 h.
    const { error: regError } = await admin.rpc('aviso_politica_registrar', { p_user: d.user_id, p_version: VERSAO })
    if (regError) console.error('[aviso-politica] registrar falhou:', d.user_id, regError.message)
  }

  return json(200, { ok: true, versao: VERSAO, enviados, falhas, restantes: lista.length - enviados - falhas })
})
