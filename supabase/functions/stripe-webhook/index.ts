import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno"

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!signature || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'Missing signature or webhook secret' }), { status: 400 })
  }

  let event
  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }), { status: 400 })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  // 1. Idempotência: Gravar evento na tabela webhook_events para evitar duplicidade
  try {
    const { error: idempotencyError } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        gateway: 'stripe',
        event_id: event.id,
        status: 'processing'
      })

    if (idempotencyError) {
      if (idempotencyError.code === '23505') {
        // Registro único violado (duplicata). Webhook já foi processado anteriormente.
        return new Response(JSON.stringify({ received: true, message: 'Duplicate event ignored' }), { status: 200 })
      }
      throw idempotencyError
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: `Idempotency check failed: ${err.message}` }), { status: 500 })
  }

  try {
    // 2. Processar o evento de sucesso do pagamento
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object
      const orderId = paymentIntent.metadata.orderId

      if (!orderId) {
        throw new Error('Missing orderId in metadata')
      }

      // Buscar o pedido e seus itens associados
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        throw new Error(`Order ${orderId} not found: ${orderError?.message}`)
      }

      // Iniciar transações e atualizações lógicas
      if (order.status !== 'paid') {
        // Atualizar status do pedido
        await supabaseAdmin
          .from('orders')
          .update({ status: 'paid', payment_method: 'credit_card', payment_gateway: 'stripe' })
          .eq('id', orderId)

        // Registrar o pagamento concluído
        await supabaseAdmin
          .from('payments')
          .insert({
            order_id: orderId,
            gateway: 'stripe',
            gateway_payment_id: paymentIntent.id,
            amount: paymentIntent.amount / 100,
            status: 'completed',
            metadata: paymentIntent.metadata
          })

        // Gerar ingressos no banco de dados
        for (const item of order.order_items) {
          const ticketsToInsert = []
          for (let i = 0; i < item.quantity; i++) {
            ticketsToInsert.push({
              order_id: orderId,
              ticket_type_id: item.ticket_type_id,
              event_id: order.event_id,
              user_id: order.user_id,
              buyer_name: order.customer_name || 'Participante',
              buyer_email: order.customer_email || '',
              buyer_cpf: order.customer_cpf || '',
              status: 'active',
              price_paid: item.unit_price
            })
          }
          await supabaseAdmin.from('tickets').insert(ticketsToInsert)
        }

        // Registrar log de auditoria
        await supabaseAdmin
          .from('audit_logs')
          .insert({
            producer_id: order.user_id,
            action: 'payment_processed',
            amount: paymentIntent.amount / 100,
            description: `Pagamento aprovado para pedido ${orderId}`,
            metadata: { stripe_payment_intent_id: paymentIntent.id }
          })
      }
    }

    // 3. Atualizar o status do webhook processado
    await supabaseAdmin
      .from('webhook_events')
      .update({ status: 'processed' })
      .eq('event_id', event.id)

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error) {
    // Marcar como falha no controle de webhooks
    await supabaseAdmin
      .from('webhook_events')
      .update({ status: 'failed' })
      .eq('event_id', event.id)

    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
