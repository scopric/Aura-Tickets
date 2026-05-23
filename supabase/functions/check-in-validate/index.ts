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
      return new Response(
        JSON.stringify({ error: 'Missing qrCode or eventId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // 1. Buscar o ingresso correspondente
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('*, ticket_types(name)')
      .eq('qr_code', qrCode)
      .eq('event_id', eventId)
      .maybeSingle() // Evita exceções do single() e retorna nulo se não existir

    if (ticketError) {
      throw new Error(`Database query failed: ${ticketError.message}`)
    }

    if (!ticket) {
      return new Response(
        JSON.stringify({ valid: false, message: 'Ingresso não encontrado ou inválido para este evento' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Verificar o status do ingresso
    if (ticket.status === 'used') {
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'Ingresso já foi utilizado!',
          checkedInAt: ticket.checked_in_at,
          buyerName: ticket.buyer_name
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (ticket.status === 'cancelled' || ticket.status === 'refunded') {
      return new Response(
        JSON.stringify({ valid: false, message: `Ingresso indisponível (Status: ${ticket.status})` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Efetuar o check-in se estiver ativo
    if (ticket.status === 'active') {
      // Usar a cláusula eq('status', 'active') no UPDATE garante atomicidade e previne race conditions
      const { data: updatedTicket, error: updateError } = await supabaseAdmin
        .from('tickets')
        .update({
          status: 'used',
          checked_in_at: new Date().toISOString(),
          checked_in_by: operatorId || null
        })
        .eq('id', ticket.id)
        .eq('status', 'active') // Previne double check-in sob requests paralelos
        .select()
        .maybeSingle()

      if (updateError || !updatedTicket) {
        throw new Error('Falha ao atualizar o status do ingresso. Possível concorrência de rede.')
      }

      // Inserir registro na tabela check_ins para auditoria
      await supabaseAdmin
        .from('check_ins')
        .insert({
          event_id: eventId,
          ticket_id: ticket.id,
          user_id: ticket.user_id,
          checked_in_by: operatorId || null
        })

      return new Response(
        JSON.stringify({
          valid: true,
          message: 'Check-in realizado com sucesso!',
          buyerName: ticket.buyer_name,
          ticketType: ticket.ticket_types.name
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ valid: false, message: 'Estado desconhecido do ingresso' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
