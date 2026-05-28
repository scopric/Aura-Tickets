// Salvar em: supabase/functions/check-in-validate/index.ts
// Deploy: npx supabase functions deploy check-in-validate

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { qr_code, event_id, operator_id } = await req.json();

    if (!qr_code || !event_id) {
      return new Response(JSON.stringify({
        valid: false, message: "QR code e event_id são obrigatórios"
      }), { headers: { "Content-Type": "application/json" } });
    }

    // Buscar ticket pelo QR code
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*, ticket_types(name, event_id), events(producer_id, title)")
      .eq("qr_code", qr_code)
      .eq("event_id", event_id)
      .single();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({
        valid: false, message: "Ingresso não encontrado"
      }), { headers: { "Content-Type": "application/json" } });
    }

    if (ticket.status === "used") {
      return new Response(JSON.stringify({
        valid: false, message: "Ingresso já utilizado",
        checked_in_at: ticket.checked_in_at,
        ticket: { name: ticket.buyer_name, type: ticket.ticket_types?.name }
      }), { headers: { "Content-Type": "application/json" } });
    }

    if (ticket.status === "cancelled") {
      return new Response(JSON.stringify({
        valid: false, message: "Ingresso cancelado"
      }), { headers: { "Content-Type": "application/json" } });
    }

    if (ticket.status === "refunded") {
      return new Response(JSON.stringify({
        valid: false, message: "Ingresso reembolsado"
      }), { headers: { "Content-Type": "application/json" } });
    }

    // Realizar check-in
    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from("tickets").update({
      status: "used",
      checked_in_at: now,
      checked_in_by: operator_id || null,
    }).eq("id", ticket.id);

    if (updateError) {
      return new Response(JSON.stringify({
        valid: false, message: "Erro ao atualizar ingresso: " + updateError.message
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    // Registrar check-in
    const { error: checkInError } = await supabase.from("check_ins").insert({
      ticket_id: ticket.id,
      event_id,
      operator_id: operator_id || null,
      method: "qr_scan",
    });

    if (checkInError) {
      console.error("Erro ao registrar check-in:", checkInError);
    }

    return new Response(JSON.stringify({
      valid: true,
      message: "Check-in realizado com sucesso!",
      ticket: {
        name: ticket.buyer_name,
        type: ticket.ticket_types?.name,
        event: ticket.events?.title,
        checked_in_at: now,
      },
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
