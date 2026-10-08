// Servidor da função: só liga o handler (handler.ts, testado sem rede) ao Supabase, no mesmo estilo das outras funções.
// Contrato (colunas lidas e gravadas): orders.total, orders.reservado_ate e os itens são gravados APENAS por `reservar_ingressos`
// (anon/authenticated não têm INSERT/UPDATE em orders/order_items em produção); aqui só se grava payment_gateway/payment_method/gateway_payment_id.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { corsHeaders } from '../_shared/cors.ts'
import { limitarPorIp } from '../_shared/email.ts'
import { pagbankFetch } from '../_shared/pagbank.ts'
import { handler, verificarRecaptcha, type Pedido } from './handler.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
const cfg = () => ({ baseUrl: env('PAGBANK_BASE_URL'), token: env('PAGBANK_TOKEN') })
Deno.serve(req => handler(req, {
  env,
  limitar: (r, uid) => limitarPorIp(r, admin, (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders(r), 'Content-Type': 'application/json' } }), 'pagbank-pedido:', { chave: uid, max: 20 }),
  autenticar: async (t) => {
    const { data: { user }, error } = await admin.auth.getUser(t)
    return error || !user ? null : { id: user.id, email: user.email ?? null }
  },
  captcha: (t, ip) => verificarRecaptcha(t, ip, env),
  carregar: async (id, uid) => {
    const { data: o, error } = await admin.from('orders')
      .select('id,user_id,status,reservado_ate,total,subtotal,discount,service_fee,processing_fee,customer_name,customer_email,gateway_payment_id,events(producer_id,start_date,end_date),order_items(quantity,unit_price,ticket_types(name))')
      .eq('id', id).maybeSingle()
    if (error) throw new Error(`leitura do pedido: ${error.message}`)
    // pedido de outro usuário = igual a inexistente, e o produtor nem é consultado
    if (!o || o.user_id !== uid) return null
    const ev = (Array.isArray(o.events) ? o.events[0] : o.events) as Pedido['evento'] | null
    if (!ev) throw new Error('pedido sem evento')
    const { data: pp } = await admin.from('producer_profiles').select('payout_account_id').eq('id', ev.producer_id).maybeSingle()
    return {
      ...o, evento: ev, payout_account_id: pp?.payout_account_id ?? null,
      itens: ((o.order_items ?? []) as { quantity: number; unit_price: number; ticket_types: { name: string } | { name: string }[] | null }[]).map(i => ({
        nome: (Array.isArray(i.ticket_types) ? i.ticket_types[0]?.name : i.ticket_types?.name) ?? 'Ingresso', quantity: i.quantity, unit_price: i.unit_price,
      })),
    } as Pedido
  },
  gravar: async (id, pagbankId) => {
    const { data, error } = await admin.from('orders')
      .update({ payment_gateway: 'pagbank', payment_method: 'pix', gateway_payment_id: pagbankId })
      .eq('id', id).eq('status', 'pending').is('gateway_payment_id', null).select('id')
    if (error) throw new Error(`gravação do pedido: ${error.message}`)
    return (data?.length ?? 0) > 0
  },
  pagbank: (caminho, init) => pagbankFetch(cfg(), caminho, init),
  agora: () => new Date(),
  esperar: (ms) => new Promise(r => setTimeout(r, ms)),
}))
