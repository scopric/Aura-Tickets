import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

serve(async (req) => {
  const signature = req.headers.get('x-openpix-signature')
  const webhookSecret = Deno.env.get('WOOVI_WEBHOOK_SECRET')

  // Segurança Crítica: Barrar webhooks não validados para evitar forjamento de ingressos
  if (!signature || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'Missing signature or webhook secret' }), { status: 401 })
  }

  // A API Woovi/OpenPix permite validar a assinatura usando HMAC SHA256 do corpo do request
  const bodyText = await req.text()
  
  // Vamos validar a assinatura criptográfica usando a Web Crypto API nativa do Deno
  try {
    const keyBuf = new TextEncoder().encode(webhookSecret)
    const key = await crypto.subtle.importKey(
      "raw",
      keyBuf,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )
    
    const sigBuf = new Uint8Array(
      signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    )
    
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBuf,
      new TextEncoder().encode(bodyText)
    )

    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 403 })
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: `Signature verification error: ${err.message}` }), { status: 400 })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  const payload = JSON.parse(bodyText)
  const charge = payload.charge
  const correlationID = charge.correlationID // Este ID corresponde ao orderId na nossa arquitetura

  // 1. Idempotência: Gravar evento na tabela webhook_events para evitar duplicidade
  try {
    const { error: idempotencyError } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        gateway: 'woovi',
        event_id: payload.event || charge.correlationID,
        status: 'processing'
      })

    if (idempotencyError) {
      if (idempotencyError.code === '23505') {
        return new Response(JSON.stringify({ received: true, message: 'Duplicate webhook ignored' }), { status: 200 })
      }
      throw idempotencyError
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: `Idempotency check failed: ${err.message}` }), { status: 500 })
  }

  try {
    // 2. Processar o pagamento compensado via Pix
    if (charge.status === 'COMPLETED') {
      const orderId = correlationID

      // Buscar o pedido e seus itens
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        throw new Error(`Order ${orderId} not found: ${orderError?.message}`)
      }

      if (order.status !== 'paid') {
        // Atualizar status do pedido
        await supabaseAdmin
          .from('orders')
          .update({ status: 'paid', payment_method: 'pix', payment_gateway: 'woovi' })
          .eq('id', orderId)

        // Registrar o pagamento concluído
        await supabaseAdmin
          .from('payments')
          .insert({
            order_id: orderId,
            gateway: 'woovi',
            gateway_payment_id: charge.payment.transactionID || charge.correlationID,
            amount: charge.value / 100, // Woovi envia em centavos inteiros
            status: 'completed',
            metadata: { woovi_charge_id: charge.correlationID }
          })

        // Gerar ingressos no banco de dados (Batch Insert)
        const ticketsToInsert = []
        for (const item of order.order_items) {
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
        }
        
        if (ticketsToInsert.length > 0) {
          await supabaseAdmin.from('tickets').insert(ticketsToInsert)
        }

        // Registrar log de auditoria
        await supabaseAdmin
          .from('audit_logs')
          .insert({
            producer_id: order.user_id,
            action: 'payment_processed',
            amount: charge.value / 100,
            description: `Pagamento Pix aprovado para pedido ${orderId}`,
            metadata: { woovi_correlation_id: charge.correlationID }
          })
      }
    }

    // 3. Atualizar status do webhook processado
    await supabaseAdmin
      .from('webhook_events')
      .update({ status: 'processed' })
      .eq('event_id', payload.event || charge.correlationID)

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error) {
    await supabaseAdmin
      .from('webhook_events')
      .update({ status: 'failed' })
      .eq('event_id', payload.event || charge.correlationID)

    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
