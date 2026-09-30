// 2FA no servidor: a mesma regra do banco (public.gf_mfa_ok, docs/sql/20260930_2fa_no_banco.sql).
// Conta com 2FA só passa com token aal2; conta sem 2FA passa. Erro conta como "não passou".
// Publicar as funções que usam isto só DEPOIS de aplicar o SQL (sem gf_mfa_ok, ninguém passa).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

export async function mfaOk(req: Request): Promise<boolean> {
  const cliente = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data, error } = await cliente.rpc('gf_mfa_ok')
  return !error && data === true
}
