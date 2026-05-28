// Salvar em: supabase/functions/generate-certificate/index.ts
// Deploy: npx supabase functions deploy generate-certificate

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
    const { event_id, user_id, template_id } = await req.json();

    if (!event_id || !user_id) {
      return new Response(JSON.stringify({
        error: "event_id e user_id são obrigatórios"
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Verificar se o usuário tem ticket para o evento
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("id, buyer_name, buyer_email, ticket_types(name)")
      .eq("event_id", event_id)
      .eq("user_id", user_id)
      .eq("status", "active")
      .single();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({
        error: "Usuário não possui ingresso válido para este evento"
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Buscar template
    const { data: template } = await supabase
      .from("certificate_templates")
      .select("*")
      .eq("id", template_id)
      .single();

    // Buscar evento
    const { data: event } = await supabase
      .from("events")
      .select("title, start_date, venue_name")
      .eq("id", event_id)
      .single();

    // Gerar dados do certificado
    const certificateData = {
      participant_name: ticket.buyer_name,
      event_name: event?.title || "Evento",
      event_date: event?.start_date,
      venue: event?.venue_name,
      ticket_type: ticket.ticket_types?.name,
      issue_date: new Date().toISOString(),
      certificate_id: crypto.randomUUID(),
      template: template?.config || {},
    };

    // Inserir certificado no banco
    const { data: certificate, error: certError } = await supabase
      .from("certificates")
      .insert({
        event_id,
        user_id,
        template_id: template_id || null,
        data: certificateData,
      })
      .select()
      .single();

    if (certError) {
      return new Response(JSON.stringify({
        error: "Erro ao gerar certificado: " + certError.message
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: true,
      certificate: {
        id: certificate.id,
        data: certificateData,
        pdf_url: null, // Em produção, geraria PDF via Puppeteer ou similar
      },
      message: "Certificado gerado com sucesso!"
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
