// Registros exigidos por lei, gravados pelo servidor (o site não vê o próprio IP):
// - login: data/hora + IP + navegador em access_logs, guardados 6 meses (Marco Civil, art. 15;
//   base legal LGPD art. 7º, II — independe de consentimento de cookies);
// - aceite: no 1º login, copia dos metadados do cadastro (terms_version, privacy_version,
//   consentimentos, consent_at) para user_consents, com o IP de agora (LGPD art. 8º, § 2º).
// Chamada: POST { kind: 'login' } com o JWT do usuário. Só age sobre o dono do token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** Primeiro IP do x-forwarded-for (o do cliente); null se não parecer um IP. */
export function clientIp(headers: Headers): string | null {
  const raw = headers.get('cf-connecting-ip') ?? headers.get('x-forwarded-for')?.split(',')[0] ?? headers.get('x-real-ip') ?? ''
  const ip = raw.trim()
  return /^[0-9a-fA-F.:]{3,45}$/.test(ip) ? ip : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Não autenticado' })
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) return json(401, { error: 'Não autenticado' })

  const ip = clientIp(req.headers)
  const user_agent = (req.headers.get('user-agent') ?? '').slice(0, 300)

  // 1. Acesso
  const { error: logError } = await admin.from('access_logs').insert({ user_id: user.id, event: 'login', ip, user_agent })
  if (logError) {
    console.error('[record-access] access_logs', user.id, logError.message)
    return json(500, { error: 'access_logs' })
  }

  // 2. Aceite, uma vez por versão (o unique evita repetição; metadados vêm do signUp)
  const m = user.user_metadata ?? {}
  if (typeof m.terms_version === 'string' && typeof m.privacy_version === 'string') {
    const { error: consentError } = await admin.from('user_consents').upsert({
      user_id: user.id,
      terms_version: m.terms_version,
      privacy_version: m.privacy_version,
      marketing_consent: m.marketing_consent === true,
      data_sharing_consent: m.data_sharing_consent === true,
      accepted_at: typeof m.consent_at === 'string' ? m.consent_at : user.created_at,
      ip, user_agent,
    }, { onConflict: 'user_id,terms_version,privacy_version', ignoreDuplicates: true })
    if (consentError) console.error('[record-access] user_consents', user.id, consentError.message)
  }

  return json(200, { ok: true })
})
