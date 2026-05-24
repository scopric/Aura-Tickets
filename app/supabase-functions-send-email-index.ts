// Salvar em: supabase/functions/send-email/index.ts
// Deploy: npx supabase functions deploy send-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { to, subject, html, from = "Aura <noreply@aura.events>" } = await req.json();

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      // Modo demo: simula envio sem API key
      console.log(`[DEMO EMAIL] To: ${to} | Subject: ${subject}`);
      return new Response(JSON.stringify({
        id: "demo-" + crypto.randomUUID(),
        demo: true,
        message: "Email simulado (modo demo - configure RESEND_API_KEY para envio real)"
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
