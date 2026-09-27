// Exclusão de conta pelo próprio usuário (LGPD, art. 18, VI).
//
// Por que anonimizar em vez de apagar: `profiles` cai em cascata com `auth.users`, mas
// `orders`, `tickets`, `transactions` (e mais 20 tabelas) apontam para `profiles` SEM cascata
// e precisam ser guardados (obrigação fiscal; LGPD, art. 16, I). Apagar de verdade falharia
// em qualquer conta com compra. Então: o perfil vira "Usuário removido" sem nenhum dado
// pessoal, o cadastro de produtor perde os dados bancários, as tabelas só pessoais são
// apagadas e o login é desativado (soft delete: sessões encerradas, e-mail ofuscado).
//
// Chamada: POST com o JWT do próprio usuário (supabase.functions.invoke('delete-account')).
// Só age sobre o usuário do token: não recebe id nenhum de fora.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Tabelas com dados só do usuário, sem valor fiscal: apagadas de vez.
const PERSONAL_TABLES = [
  'user_activities', 'user_preferences', 'user_profiles_ext', 'user_custom_features',
  'user_course_progress', 'onboarding_logs', 'notifications', 'interest_lists',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' })

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''

  // 1. Quem está pedindo: o dono do token, e só ele
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await asUser.auth.getUser()
  if (userError || !user) return json(401, { error: 'Não autenticado' })
  const uid = user.id
  const anonEmail = `removido-${uid.slice(0, 8)}@anonimo.evokaa.com.br`

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const failures: string[] = []

  // 2. Perfil anonimizado (a linha fica, porque pedidos e ingressos apontam para ela)
  const { error: profileError } = await admin.from('profiles').update({
    email: anonEmail, full_name: 'Usuário removido', phone: null, cpf: null, avatar_url: null,
    bio: null, city: null, birth_date: null, instagram: null, tiktok: null, linkedin: null,
    website: null, stripe_customer_id: null, role: 'user', admin_permissions: null, is_verified: false,
  }).eq('id', uid)
  if (profileError) return json(500, { error: `Perfil: ${profileError.message}` })

  // 3. Cadastro de produtor: dados bancários e chaves fora
  const { error: producerError } = await admin.from('producer_profiles').update({
    company_name: 'Removido', cnpj: null, stripe_account_id: null, woovi_account_id: null,
    bank_account: null, pix_key: null, api_key: null, webhook_url: null, notification_settings: null, is_verified: false,
  }).eq('id', uid)
  if (producerError) failures.push(`producer_profiles: ${producerError.message}`)

  // 4. Tabelas só pessoais
  for (const table of PERSONAL_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', uid)
    if (error) failures.push(`${table}: ${error.message}`)
  }

  // 5. Login desativado: sessões encerradas, e-mail e telefone ofuscados, identidades (Google etc.) removidas
  const { error: authError } = await admin.auth.admin.deleteUser(uid, true)
  if (authError) return json(500, { error: `Login: ${authError.message}`, failures })

  if (failures.length) console.warn('[delete-account] parcial', uid, failures)
  return json(200, { ok: true, failures })
})
