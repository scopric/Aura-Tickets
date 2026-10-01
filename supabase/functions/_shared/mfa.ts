// 2FA no servidor: a mesma regra do banco (public.gf_mfa_ok, docs/sql/20260930_2fa_no_banco.sql).
// Conta com 2FA só passa com token aal2; conta sem 2FA passa. Erro conta como "não passou".
// Publicar as funções que usam isto só DEPOIS de aplicar o SQL (sem gf_mfa_ok, ninguém passa).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

// Cliente com a chave anon e o JWT de quem chamou: o banco decide com auth.uid() e o aal do token
const comoQuemChamou = (req: Request) =>
  createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })

export async function mfaOk(req: Request): Promise<boolean> {
  const { data, error } = await comoQuemChamou(req).rpc('gf_mfa_ok')
  return !error && data === true
}

// "É admin" decidido pelo banco, nunca lendo profiles com a service role: gf_admin_can(p) ou, sem
// permissão, gf_is_admin(). Admin só passa com fator confirmado e token aal2 (Decisão 99,
// docs/sql/20261001_seg4_2fa_admin.sql). null = o banco não respondeu (quem chama nega ou devolve "tente de novo").
export async function adminCan(req: Request, p?: string): Promise<boolean | null> {
  const cliente = comoQuemChamou(req)
  const { data, error } = p ? await cliente.rpc('gf_admin_can', { p }) : await cliente.rpc('gf_is_admin')
  if (error) {
    console.error('[adminCan]', error.message)
    return null
  }
  return data === true
}
