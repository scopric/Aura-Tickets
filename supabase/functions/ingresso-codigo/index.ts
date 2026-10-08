// Lista de códigos de entrada do ingresso (QR que muda a cada 30 s; Decisão 211).
//
// Chamada: POST com o JWT do COMPRADOR, corpo { ticketId }. Só o dono do ingresso ativo, de pedido pago, recebe a lista.
// Resposta 200: { servidorAgora, passo, primeiraJanela, prefixo, codigos } com os códigos das próximas 12 h (1.440). O navegador escolhe o código
// da vez por (servidorAgora + tempo desde a resposta) e monta o QR como `prefixo + código`. O segredo mestre (INGRESSO_SEGREDO) NUNCA sai daqui.
// 400 corpo inválido; 401 sem login; 403 não é seu ou não está ativo; 500 sem segredo ou falha do banco.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { corsHeaders } from '../_shared/cors.ts'
import { chaveDoIngresso, listaDeCodigos, PASSO_S, prefixoDoQr } from '../_shared/ingressoCodigo.ts'

// ponytail: contador em memória por instância da função (primeira barreira contra laço de chamadas; ~26 ms de CPU por chamada).
// Se virar problema real, mover para o banco (tabela de contagem) ou um limite do próprio Supabase.
const LIMITE = 10, JANELA_MS = 60_000
const visitas = new Map<string, { n: number; desde: number }>()
function passou(id: string, agora: number): boolean {
  if (visitas.size > 5000) for (const [k, v] of visitas) if (agora - v.desde > JANELA_MS) visitas.delete(k)
  const v = visitas.get(id)
  if (!v || agora - v.desde > JANELA_MS) { visitas.set(id, { n: 1, desde: agora }); return true }
  return ++v.n <= LIMITE
}

const HORAS = 12
const QUANTAS = (HORAS * 3600) / PASSO_S // 1.440

async function tratar(req: Request): Promise<Response> {
  const cors = corsHeaders(req)
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido' })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Faça login para ver o QR.' })
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return json(401, { error: 'Faça login para ver o QR.' })
  if (!passou(user.id, Date.now())) return json(429, { error: 'Muitas tentativas. Espere um minuto e tente de novo.' })

  let ticketId = ''
  try {
    const b = await req.json()
    ticketId = typeof b?.ticketId === 'string' ? b.ticketId : ''
  } catch { /* cai no 400 */ }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId)) return json(400, { error: 'Ingresso inválido.' })

  const segredo = Deno.env.get('INGRESSO_SEGREDO') ?? ''
  if (segredo.length < 32) {
    console.error('[ingresso-codigo] INGRESSO_SEGREDO ausente ou curto')
    return json(500, { error: 'O QR não está disponível agora. Tente de novo mais tarde.' })
  }

  const { data: t, error } = await admin.from('tickets').select('id, user_id, status, transfer_count, orders(status)').eq('id', ticketId).maybeSingle()
  if (error) {
    console.error('[ingresso-codigo] ingresso:', error.message)
    return json(500, { error: 'O QR não está disponível agora. Tente de novo mais tarde.' })
  }
  // Mesma resposta para "não existe" e "não é seu": não revela ingresso de outra pessoa.
  const pedido = Array.isArray(t?.orders) ? t?.orders[0] : t?.orders
  if (!t || t.user_id !== user.id || t.status !== 'active' || pedido?.status !== 'paid') {
    return json(403, { error: 'Este ingresso não está disponível para você.' })
  }

  const agora = Date.now()
  const chave = await chaveDoIngresso(segredo, t.id, t.transfer_count ?? 0)
  const { primeiraJanela, codigos } = await listaDeCodigos(chave, agora, QUANTAS)
  return json(200, { servidorAgora: agora, passo: PASSO_S, primeiraJanela, prefixo: prefixoDoQr(t.id), codigos })
}

Deno.serve(async (req) => {
  try {
    return await tratar(req)
  } catch (e) {
    console.error('[ingresso-codigo] erro:', (e as Error)?.message)
    return new Response(JSON.stringify({ error: 'O QR não está disponível agora. Tente de novo mais tarde.' }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
})
