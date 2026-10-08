// Servidor da função: liga o handler (handler.ts, testado sem rede) ao Supabase. Publicar com --no-verify-jwt (ver handler.ts).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { pagbankFetch } from '../_shared/pagbank.ts'
import { handler } from './handler.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
Deno.serve(req => handler(req, {
  env,
  pagbank: (caminho, init) => pagbankFetch({ baseUrl: env('PAGBANK_BASE_URL'), token: env('PAGBANK_TOKEN') }, caminho, init),
  confirmar: async (args) => {
    const { data, error } = await admin.rpc('confirmar_pedido_pago', args)
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`)
    return String(data)
  },
  log: (m) => console.log(m),
}))
