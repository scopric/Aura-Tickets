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
      return new Response(
        JSON.stringify({ error: 'Missing orderId or emailType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Buscar informações do pedido, evento e ingressos direto no banco de dados para evitar spams
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, events(*)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`)
    }

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('tickets')
      .select('*, ticket_types(name)')
      .eq('order_id', orderId)

    if (ticketsError || !tickets || tickets.length === 0) {
      throw new Error(`Tickets not found for order ${orderId}: ${ticketsError?.message}`)
    }

    const recipientEmail = order.customer_email
    const recipientName = order.customer_name || 'Participante'
    const eventTitle = order.events.title
    const eventDate = order.events.date

    let subject = ''
    let htmlContent = ''

    if (emailType === 'order_confirmation') {
      subject = `Confirmação de Compra - ${eventTitle}`
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #6366f1; margin-bottom: 20px;">Olá, ${recipientName}!</h2>
          <p style="font-size: 16px; color: #1e293b; line-height: 1.5;">Seu pagamento para o evento <strong>${eventTitle}</strong> foi processado com sucesso.</p>
          <div style="background-color: #f8fafc; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Resumo do Pedido:</strong></p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #334155;">Código do Pedido: ${orderId}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #334155;">Valor Total: R$ ${order.total.toFixed(2)}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #334155;">Data do Evento: ${eventDate}</p>
          </div>
          <p style="font-size: 16px; color: #1e293b; line-height: 1.5;">Seus ingressos estão anexados e prontos para uso no seu painel "Meus Ingressos".</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Evokaa Platform — A engrenagem dos seus eventos.</p>
        </div>
      `
    } else if (emailType === 'ticket_delivery') {
      subject = `Seus Ingressos para - ${eventTitle}`
      
      let ticketsHtml = ''
      for (const ticket of tickets) {
        ticketsHtml += `
          <div style="border: 1px dashed #cbd5e1; border-radius: 6px; padding: 15px; margin-bottom: 15px; background-color: #ffffff;">
            <h4 style="margin: 0 0 10px 0; color: #1e293b;">${ticket.ticket_types.name}</h4>
            <p style="margin: 0 0 5px 0; font-size: 14px; color: #64748b;">Nome no Ingresso: ${ticket.buyer_name}</p>
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">Código: ${ticket.qr_code}</p>
            <div style="text-align: center; margin-top: 10px;">
              <div style="display: inline-block; padding: 10px; background-color: #f1f5f9; border-radius: 4px; font-weight: bold; font-family: monospace; letter-spacing: 2px;">
                ${ticket.qr_code.substring(0, 8).toUpperCase()}
              </div>
            </div>
          </div>
        `
      }

      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc;">
          <h2 style="color: #6366f1; margin-bottom: 20px; text-align: center;">Aqui estão seus Ingressos!</h2>
          <p style="font-size: 16px; color: #1e293b; line-height: 1.5; text-align: center;">Prepare-se para o evento <strong>${eventTitle}</strong>.</p>
          <div style="margin: 30px 0;">
            ${ticketsHtml}
          </div>
          <p style="font-size: 14px; color: #475569; text-align: center; line-height: 1.5;">Apresente estes códigos na entrada do evento para validação.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Evokaa Platform — A engrenagem dos seus eventos.</p>
        </div>
      `
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Evokaa Tickets <ingressos@evokaa.com.br>',
        to: [recipientEmail],
        subject: subject,
        html: htmlContent,
      })
    })

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json()
      throw new Error(errorData.message || 'Failed to send transactional email via Resend')
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
