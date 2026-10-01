// Moderação automática da foto do Match de Mesa pelo Gemini (plano, Fase E).
//
// Chamada só pelo pg_cron (job "moderar_fotos", a cada 2 min) com o cabeçalho x-moderacao-secret,
// comparado com o segredo do Vault lido por mesa_moderacao_secret (como no chat-notify).
// Publicar com --no-verify-jwt. O lote, o modelo e a gravação vêm do banco
// (mesa_fotos_para_moderar_auto / mesa_foto_resultado_auto); a lógica fica em _shared/moderacao.ts.
// Responde só contagens: nenhuma foto, id, hash ou texto do Gemini vai para o log.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { moderarLote } from '../_shared/moderacao.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (req) => {
  let admin: ReturnType<typeof createClient> | null = null
  try {
    return await moderarLote(req, {
      chaveEnv: Deno.env.get('GEMINI_API_KEY') ?? '',
      fetch,
      // cliente só é criado quando há cabeçalho de segredo
      rpc: (fn, args) => (admin ??= createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)).rpc(fn, args),
    })
  } catch (e) {
    console.error('[moderar-foto] exceção não tratada:', e instanceof Error ? e.name : 'desconhecida')
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
