// Servidor da função: liga o handler (handler.ts, testado sem rede) ao Supabase. Publicar com --no-verify-jwt (ver handler.ts).
// Env lido com trim (espaço ou quebra de linha no fim do PAGBANK_TOKEN derrubaria toda assinatura); faltou algum, o handler dá 503.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { pagbankFetch } from '../_shared/pagbank.ts'
import { handler } from './handler.ts'

const env = (k: string) => (Deno.env.get(k) ?? '').trim()
let admin: SupabaseClient | null = null // criado na 1ª chamada: sem env, createClient lançaria na carga do módulo
Deno.serve(req => handler(req, {
  env,
  pagbank: (caminho, init) => pagbankFetch({ baseUrl: env('PAGBANK_BASE_URL'), token: env('PAGBANK_TOKEN') }, caminho, init),
  confirmar: async (args) => {
    admin ??= createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
    const { data, error } = await admin.rpc('confirmar_pedido_pago', args)
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`)
    return String(data)
  },
  log: (m) => console.log(m),
}))
