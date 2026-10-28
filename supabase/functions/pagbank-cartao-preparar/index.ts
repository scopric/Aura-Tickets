// Servidor da função: liga o handler (handler.ts, testado sem rede) ao Supabase. Leitura do pedido, login e limite iguais ao pagbank-criar-pedido.
// Nada é gravado aqui.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { corsHeaders } from '../_shared/cors.ts'
import { limitarPorIp } from '../_shared/email.ts'
import { pagbankFetch } from '../_shared/pagbank.ts'
import { verificarRecaptcha, type Pedido } from '../pagbank-criar-pedido/handler.ts'
import { handler } from './handler.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
const cfg = () => ({ baseUrl: env('PAGBANK_BASE_URL'), token: env('PAGBANK_TOKEN') })
Deno.serve(req => handler(req, {
  env,
  // mesmo prefixo e teto do Pix: Pix e cartão dividem a cota de 20 a cada 10 min por usuário
  limitar: (r, uid) => limitarPorIp(r, admin, (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders(r), 'Content-Type': 'application/json' } }), 'pagbank-pedido:', { chave: uid, max: 20 }),
  autenticar: async (t) => {
    const { data: { user }, error } = await admin.auth.getUser(t)
    return error || !user ? null : { id: user.id, email: user.email ?? null }
  },
  captcha: (t, ip, acao) => verificarRecaptcha(t, ip, env, fetch, acao),
  carregar: async (id, uid) => {
    const { data: o, error } = await admin.from('orders')
      .select('id,user_id,status,reservado_ate,total')
      .eq('id', id).maybeSingle()
    if (error) throw new Error(`leitura do pedido: ${error.message}`)
    return !o || o.user_id !== uid ? null : o as unknown as Pedido
  },
  pagbank: (caminho, init) => pagbankFetch(cfg(), caminho, init),
  sdk: (baseUrl, caminho, body) => pagbankFetch({ baseUrl, token: env('PAGBANK_TOKEN') }, caminho, { method: 'POST', body }),
  agora: () => new Date(),
}))
