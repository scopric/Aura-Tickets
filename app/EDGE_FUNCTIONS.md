# Edge Functions — Setup e Deploy

## Funcoes Disponiveis

1. `stripe-create-payment` — Cria PaymentIntent no Stripe
2. `stripe-webhook` — Recebe webhooks de pagamento do Stripe
3. `woovi-create-pix` — Cria cobranca Pix via Woovi/OpenPix
4. `woovi-webhook` — Recebe webhooks de confirmacao Pix
5. `check-in-validate` — Valida QR code de ingresso na porta
6. `send-email` — Envia emails transacionais via Resend

---

## Variaveis de Ambiente (Secrets)

No Supabase Dashboard > Project Settings > Edge Functions, configure:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
WOOVI_API_KEY=...
WOOVI_WEBHOOK_SECRET=...
RESEND_API_KEY=re_...
SUPABASE_URL=https://rwaezeqyuhxrssntcxdv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Deploy via Dashboard (sem CLI)

1. Acesse o Supabase Dashboard
2. Va em **Edge Functions** > **New function**
3. Para cada funcao abaixo, crie uma funcao com o nome indicado e cole o codigo

---

### 1. stripe-create-payment

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: 'Stripe secret key not configured' }), { status: 500, headers: corsHeaders })
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const { orderId, amount, customerEmail, customerName } = await req.json()

    if (!orderId || amount === undefined || amount === null) {
      return new Response(
        JSON.stringify({ error: 'Missing orderId or amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const amountNum = Number(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountNum * 100),
      currency: 'brl',
      payment_method_types: ['card'],
      metadata: {
        orderId: orderId,
        customerEmail: customerEmail,
        customerName: customerName,
      },
    })

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, transactionId: paymentIntent.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

---

### 2. stripe-webhook

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno"

serve(async (req) => {
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!stripeSecret || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'Missing Stripe configuration' }), { status: 500 })
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 })
  }

  let event
  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }), { status: 400 })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  try {
    const { error: idempotencyError } = await supabaseAdmin
      .from('webhook_events')
      .insert({ gateway: 'stripe', event_id: event.id, status: 'processing' })

    if (idempotencyError) {
      if (idempotencyError.code === '23505') {
        return new Response(JSON.stringify({ received: true, message: 'Duplicate event ignored' }), { status: 200 })
      }
      throw idempotencyError
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Idempotency check failed: ${err.message}` }), { status: 500 })
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object
      const orderId = paymentIntent.metadata?.orderId
      if (!orderId) throw new Error('Missing orderId in metadata')

      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders').select('*, order_items(*)').eq('id', orderId).single()

      if (orderError || !order) throw new Error(`Order ${orderId} not found`)

      if (order.status !== 'paid') {
        await supabaseAdmin.from('orders')
          .update({ status: 'paid', payment_method: 'credit_card', payment_gateway: 'stripe' })
          .eq('id', orderId)

        await supabaseAdmin.from('payments').insert({
          order_id: orderId, gateway: 'stripe', gateway_payment_id: paymentIntent.id,
          amount: paymentIntent.amount / 100, status: 'completed', metadata: paymentIntent.metadata
        })

        for (const item of order.order_items || []) {
          const ticketsToInsert = []
          for (let i = 0; i < item.quantity; i++) {
            ticketsToInsert.push({
              order_id: orderId, ticket_type_id: item.ticket_type_id, event_id: order.event_id,
              user_id: order.user_id, buyer_name: order.customer_name || 'Participante',
              buyer_email: order.customer_email || '', buyer_cpf: order.customer_cpf || '',
              status: 'active', price_paid: item.unit_price
            })
          }
          if (ticketsToInsert.length > 0) await supabaseAdmin.from('tickets').insert(ticketsToInsert)
        }

        await supabaseAdmin.from('audit_logs').insert({
          producer_id: order.user_id, action: 'payment_processed',
          amount: paymentIntent.amount / 100,
          description: `Pagamento aprovado para pedido ${orderId}`,
          metadata: { stripe_payment_intent_id: paymentIntent.id }
        })
      }
    }

    await supabaseAdmin.from('webhook_events').update({ status: 'processed' }).eq('event_id', event.id)
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error: any) {
    await supabaseAdmin.from('webhook_events').update({ status: 'failed' }).eq('event_id', event.id)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
```

---

### 3. woovi-create-pix

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const wooviApiKey = Deno.env.get('WOOVI_API_KEY')
    if (!wooviApiKey) {
      return new Response(JSON.stringify({ error: 'Woovi API Key is not configured' }), { status: 500 })
    }

    const { orderId, amount, customerName, customerEmail, customerCpf } = await req.json()
    if (!orderId || amount === undefined || amount === null) {
      return new Response(JSON.stringify({ error: 'Missing orderId or amount' }), { status: 400, headers: corsHeaders })
    }

    const amountNum = Number(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: corsHeaders })
    }

    const body: any = {
      correlationID: orderId,
      value: Math.round(amountNum * 100),
      comment: `Ingressos Aura - Pedido ${orderId}`,
    }

    if (customerName || customerEmail || customerCpf) {
      body.customer = {}
      if (customerName) body.customer.name = customerName
      if (customerEmail) body.customer.email = customerEmail
      if (customerCpf) body.customer.taxID = customerCpf.replace(/\D/g, '')
    }

    const response = await fetch('https://api.openpix.com.br/v1/charge', {
      method: 'POST',
      headers: { 'Authorization': wooviApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create Pix charge on Woovi')
    }

    const data = await response.json()
    return new Response(
      JSON.stringify({ chargeId: data.charge.correlationID, qrCodeData: data.charge.brCode, qrCodeImageUrl: data.charge.qrCodeImage, status: 'pending' }),
      { status: 200, headers: corsHeaders }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
```

---

### 4. woovi-webhook

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

serve(async (req) => {
  const signature = req.headers.get('x-openpix-signature')
  const webhookSecret = Deno.env.get('WOOVI_WEBHOOK_SECRET')

  if (!signature || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'Missing signature or webhook secret' }), { status: 401 })
  }

  const bodyText = await req.text()

  try {
    const keyBuf = new TextEncoder().encode(webhookSecret)
    const key = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-256" }, false, ["verify"])
    const sigBuf = new Uint8Array(signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
    const isValid = await crypto.subtle.verify("HMAC", key, sigBuf, new TextEncoder().encode(bodyText))
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 403 })
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Signature verification error: ${err.message}` }), { status: 400 })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  const payload = JSON.parse(bodyText)
  const charge = payload.charge
  const idempotencyKey = charge.correlationID

  try {
    const { error: idempotencyError } = await supabaseAdmin
      .from('webhook_events')
      .insert({ gateway: 'woovi', event_id: idempotencyKey, status: 'processing' })

    if (idempotencyError) {
      if (idempotencyError.code === '23505') {
        return new Response(JSON.stringify({ received: true, message: 'Duplicate webhook ignored' }), { status: 200 })
      }
      throw idempotencyError
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Idempotency check failed: ${err.message}` }), { status: 500 })
  }

  try {
    if (charge.status === 'COMPLETED') {
      const orderId = charge.correlationID
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders').select('*, order_items(*)').eq('id', orderId).single()

      if (orderError || !order) throw new Error(`Order ${orderId} not found`)

      if (order.status !== 'paid') {
        await supabaseAdmin.from('orders')
          .update({ status: 'paid', payment_method: 'pix', payment_gateway: 'woovi' })
          .eq('id', orderId)

        await supabaseAdmin.from('payments').insert({
          order_id: orderId, gateway: 'woovi',
          gateway_payment_id: charge.payment?.transactionID || charge.correlationID,
          amount: charge.value / 100, status: 'completed',
          metadata: { woovi_charge_id: charge.correlationID }
        })

        const ticketsToInsert = []
        for (const item of order.order_items || []) {
          for (let i = 0; i < item.quantity; i++) {
            ticketsToInsert.push({
              order_id: orderId, ticket_type_id: item.ticket_type_id, event_id: order.event_id,
              user_id: order.user_id, buyer_name: order.customer_name || 'Participante',
              buyer_email: order.customer_email || '', buyer_cpf: order.customer_cpf || '',
              status: 'active', price_paid: item.unit_price
            })
          }
        }
        if (ticketsToInsert.length > 0) await supabaseAdmin.from('tickets').insert(ticketsToInsert)

        await supabaseAdmin.from('audit_logs').insert({
          producer_id: order.user_id, action: 'payment_processed',
          amount: charge.value / 100,
          description: `Pagamento Pix aprovado para pedido ${orderId}`,
          metadata: { woovi_correlation_id: charge.correlationID }
        })
      }
    }

    await supabaseAdmin.from('webhook_events').update({ status: 'processed' }).eq('event_id', idempotencyKey)
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error: any) {
    await supabaseAdmin.from('webhook_events').update({ status: 'failed' }).eq('event_id', idempotencyKey)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
```

---

### 5. check-in-validate

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { qrCode, eventId, operatorId } = await req.json()
    if (!qrCode || !eventId) {
      return new Response(JSON.stringify({ error: 'Missing qrCode or eventId' }), { status: 400, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets').select('*, ticket_types(name)').eq('qr_code', qrCode).eq('event_id', eventId).maybeSingle()

    if (ticketError) throw new Error(`Database query failed: ${ticketError.message}`)
    if (!ticket) {
      return new Response(JSON.stringify({ valid: false, message: 'Ingresso nao encontrado' }), { status: 404, headers: corsHeaders })
    }

    if (ticket.status === 'used') {
      return new Response(JSON.stringify({ valid: false, message: 'Ingresso ja foi utilizado!', checkedInAt: ticket.checked_in_at, buyerName: ticket.buyer_name }), { status: 200, headers: corsHeaders })
    }

    if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
      return new Response(JSON.stringify({ valid: false, message: `Ingresso indisponivel (Status: ${ticket.status})` }), { status: 200, headers: corsHeaders })
    }

    if (ticket.status === 'active') {
      const { data: updatedTicket, error: updateError } = await supabaseAdmin
        .from('tickets')
        .update({ status: 'used', checked_in_at: new Date().toISOString(), checked_in_by: operatorId || null })
        .eq('id', ticket.id).eq('status', 'active')
        .select().maybeSingle()

      if (updateError || !updatedTicket) throw new Error('Falha ao atualizar o status do ingresso.')

      await supabaseAdmin.from('check_ins').insert({
        event_id: eventId, ticket_id: ticket.id, user_id: ticket.user_id,
        checked_in_by: operatorId || null, checked_in_at: new Date().toISOString()
      })

      return new Response(JSON.stringify({ valid: true, message: 'Check-in realizado com sucesso!', buyerName: ticket.buyer_name, ticketType: ticket.ticket_types?.name }), { status: 200, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ valid: false, message: 'Estado desconhecido do ingresso' }), { status: 400, headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
```

---

### 6. send-email

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Resend API Key is not configured' }), { status: 500 })
    }

    const { orderId, emailType } = await req.json()
    if (!orderId || !emailType) {
      return new Response(JSON.stringify({ error: 'Missing orderId or emailType' }), { status: 400, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const { data: existingEmail } = await supabaseAdmin
      .from('email_logs').select('id').eq('order_id', orderId).eq('email_type', emailType).maybeSingle()

    if (existingEmail) {
      return new Response(JSON.stringify({ success: true, message: 'Email already sent' }), { status: 200, headers: corsHeaders })
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders').select('*, events(*)').eq('id', orderId).single()
    if (orderError || !order) throw new Error(`Order not found`)

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('tickets').select('*, ticket_types(name)').eq('order_id', orderId)
    if (ticketsError || !tickets || tickets.length === 0) throw new Error(`Tickets not found`)

    const recipientEmail = order.customer_email
    const recipientName = order.customer_name || 'Participante'
    const eventTitle = order.events?.title || 'Evento'
    const eventDate = order.events?.date || ''

    let subject = ''
    let htmlContent = ''

    if (emailType === 'order_confirmation') {
      subject = `Confirmacao de Compra - ${eventTitle}`
      htmlContent = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:8px;"><h2 style="color:#6366f1;">Ola, ${recipientName}!</h2><p>Seu pagamento para <strong>${eventTitle}</strong> foi processado.</p><p>Codigo: ${orderId} | Total: R$ ${Number(order.total||0).toFixed(2)}</p><hr/><p style="font-size:12px;color:#94a3b8;text-align:center;">Aura Platform</p></div>`
    } else if (emailType === 'ticket_delivery') {
      subject = `Seus Ingressos - ${eventTitle}`
      let ticketsHtml = ''
      for (const t of tickets || []) {
        ticketsHtml += `<div style="border:1px dashed #cbd5e1;padding:15px;margin-bottom:15px;"><h4>${t.ticket_types?.name||'Ingresso'}</h4><p>Codigo: ${t.qr_code}</p></div>`
      }
      htmlContent = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2 style="color:#6366f1;text-align:center;">Seus Ingressos!</h2><div>${ticketsHtml}</div><hr/><p style="font-size:12px;color:#94a3b8;text-align:center;">Aura Platform</p></div>`
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Aura Tickets <ingressos@aura.events>', to: [recipientEmail], subject, html: htmlContent })
    })

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json()
      throw new Error(errorData.message || 'Failed to send email')
    }

    await supabaseAdmin.from('email_logs').insert({ order_id: orderId, email_type: emailType, recipient: recipientEmail }).catch(() => {})

    return new Response(JSON.stringify({ success: true, message: 'Email sent successfully' }), { status: 200, headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
```

---

## Deploy via Supabase CLI (recomendado)

Se voce tiver o Supabase CLI instalado:

```bash
supabase login
supabase link --project-ref rwaezeqyuhxrssntcxdv
supabase functions deploy stripe-create-payment
supabase functions deploy stripe-webhook
supabase functions deploy woovi-create-pix
supabase functions deploy woovi-webhook
supabase functions deploy check-in-validate
supabase functions deploy send-email
```

## Configurar Webhooks Externos

1. **Stripe Dashboard** > Webhooks > Add endpoint:
   - URL: `https://rwaezeqyuhxrssntcxdv.supabase.co/functions/v1/stripe-webhook`
   - Events: `payment_intent.succeeded`

2. **Woovi/OpenPix Dashboard** > Webhooks:
   - URL: `https://rwaezeqyuhxrssntcxdv.supabase.co/functions/v1/woovi-webhook`
