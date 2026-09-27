// Registros exigidos por lei, gravados pelo servidor (o site não vê o próprio IP):
// - login: data/hora + IP + navegador em access_logs, guardados 6 meses (Marco Civil, art. 15;
//   base legal LGPD art. 7º, II — independe de consentimento de cookies);
// - aceite: no 1º login, o aceite dos Termos/Política vai para user_consents com o IP de agora
//   (LGPD art. 8º, § 2º). A versão vem dos metadados do cadastro (register) ou, para quem entra
//   por login social e nunca passou pelo cadastro, do body enviado pelo site (versão vigente).
//   A PROVA é recorded_at + ip (do servidor); accepted_at é informado pelo cliente e só é aceito
//   se estiver entre a criação da conta e agora.
// Chamada: POST { terms_version, privacy_version } com o JWT do usuário. Só age sobre o dono do token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const IP_RE = /^(\d{1,3}(\.\d{1,3}){3}|[0-9a-fA-F:]{2,39})$/
const VERSION_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * IP provável do cliente + cadeia completa dos proxies. O cliente pode inventar o PRIMEIRO
 * elemento do x-forwarded-for, mas não apagar o que os proxies acrescentam depois: por isso
 * a cadeia inteira (forwarded_for) é guardada e vale como registro; `ip` é só o candidato.
 */
export function clientIp(headers: Headers): { ip: string | null; forwarded_for: string | null } {
  const chain = headers.get('x-forwarded-for')
  const candidate = (headers.get('cf-connecting-ip') ?? chain?.split(',')[0] ?? headers.get('x-real-ip') ?? '').trim()
  return {
    ip: IP_RE.test(candidate) ? candidate : null,
    forwarded_for: chain ? chain.slice(0, 200) : null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Não autenticado' })
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) return json(401, { error: 'Não autenticado' })

  const { ip, forwarded_for } = clientIp(req.headers)
  const user_agent = (req.headers.get('user-agent') ?? '').slice(0, 300)

  // 1. Acesso — no máximo 1 registro por minuto por usuário (evita inflar a tabela em laço)
  const { data: recente } = await admin.from('access_logs').select('id')
    .eq('user_id', user.id).gte('created_at', new Date(Date.now() - 60_000).toISOString()).limit(1)
  if (!recente?.length) {
    let { error: logError } = await admin.from('access_logs').insert({ user_id: user.id, event: 'login', ip, forwarded_for, user_agent })
    if (logError && ip) {
      // IP que passou no regex mas o Postgres não aceitou como inet: registra sem ele
      ;({ error: logError } = await admin.from('access_logs').insert({ user_id: user.id, event: 'login', ip: null, forwarded_for, user_agent }))
    }
    if (logError) {
      console.error('[record-access] access_logs', user.id, logError.message)
      return json(500, { error: 'access_logs' })
    }
  }

  // 2. Aceite, uma vez por versão (unique + ignoreDuplicates: a 1ª gravação nunca é sobrescrita)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* sem body */ }
  const m = (user.user_metadata ?? {}) as Record<string, unknown>
  const terms_version = typeof m.terms_version === 'string' ? m.terms_version : body.terms_version
  const privacy_version = typeof m.privacy_version === 'string' ? m.privacy_version : body.privacy_version
  if (typeof terms_version === 'string' && VERSION_RE.test(terms_version) &&
      typeof privacy_version === 'string' && VERSION_RE.test(privacy_version)) {
    const now = Date.now()
    const created = Date.parse(user.created_at)
    const informed = typeof m.consent_at === 'string' ? Date.parse(m.consent_at) : NaN
    const accepted_at = new Date(informed >= created && informed <= now ? informed : now).toISOString()
    const { error: consentError } = await admin.from('user_consents').upsert({
      user_id: user.id, terms_version, privacy_version,
      marketing_consent: m.marketing_consent === true,
      data_sharing_consent: m.data_sharing_consent === true,
      accepted_at, ip, forwarded_for, user_agent,
    }, { onConflict: 'user_id,terms_version,privacy_version', ignoreDuplicates: true })
    if (consentError) console.error('[record-access] user_consents', user.id, consentError.message)
  }

  return json(200, { ok: true })
})
