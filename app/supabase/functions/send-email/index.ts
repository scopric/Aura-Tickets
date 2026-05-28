// Salvar em: supabase/functions/send-email/index.ts
// Deploy: npx supabase functions deploy send-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Paleta de cores premium Aura (Plum, Espresso, Cream, Canvas, Void)
const colors = {
  plum: "#581C87", // Ameixa Escuro
  plumLight: "#7E22CE",
  espresso: "#292524", // Cinza Escuro Quente
  cream: "#FAF8F5", // Off-white
  canvas: "#F5F5F4",
  void: "#0C0A09", // Preto Quente
  textDark: "#1C1917",
  textMuted: "#78716C",
  accent: "#D97706" // Ouro/Âmbar
};

// Função para gerar o HTML do e-mail de Confirmação de Compra
function getOrderConfirmationHtml(recipientName: string, eventTitle: string, orderId: string, createdDate: string, total: number) {
  return `
    <div style="background-color: ${colors.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: ${colors.textDark};">
      <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05);">
        <div style="background-color: ${colors.plum}; padding: 40px 30px; text-align: center; color: #FFFFFF;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Evokaa</h1>
          <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.8); font-size: 16px;">Seu pagamento foi confirmado com sucesso!</p>
        </div>
        <div style="padding: 30px;">
          <h2 style="font-size: 20px; margin-top: 0; color: ${colors.plum};">Olá, ${recipientName}!</h2>
          <p style="line-height: 1.6; font-size: 15px; color: ${colors.textDark};">Preparamos tudo para você. O pagamento do seu pedido foi processado e seus ingressos já estão ativos.</p>
          
          <div style="background-color: ${colors.canvas}; border-radius: 12px; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; font-size: 16px; color: ${colors.espresso}; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 10px;">Resumo do Pedido</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: ${colors.textMuted};">Evento:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold;">${eventTitle}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: ${colors.textMuted};">Código do Pedido:</td>
                <td style="padding: 6px 0; text-align: right; font-family: monospace;">${orderId.substring(0, 8).toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: ${colors.textMuted};">Data de Compra:</td>
                <td style="padding: 6px 0; text-align: right;">${createdDate}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0 6px 0; font-weight: bold; color: ${colors.textDark}; font-size: 16px; border-top: 1px dashed rgba(0,0,0,0.1);">Total Pago:</td>
                <td style="padding: 12px 0 6px 0; text-align: right; font-weight: bold; color: ${colors.plumLight}; font-size: 18px; border-top: 1px dashed rgba(0,0,0,0.1);">R$ ${total.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${SUPABASE_URL.replace(".supabase.co", "")}/app/tickets" style="background-color: ${colors.plum}; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px; box-shadow: 0 4px 6px rgba(126,34,206,0.2);">Acessar Meus Ingressos</a>
          </div>

          <p style="font-size: 13px; color: ${colors.textMuted}; text-align: center; line-height: 1.5;">Os ingressos em formato digital com QR Code foram enviados em um e-mail separado. Você também poderá acessá-los a qualquer momento pelo nosso app.</p>
        </div>
        <div style="background-color: ${colors.void}; padding: 20px; text-align: center; color: rgba(255,255,255,0.6); font-size: 12px;">
          <p style="margin: 0;">Evokaa — Gestão de Eventos e Ingressos</p>
          <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.4);">Dúvidas ou suporte? Entre em contato pelo e-mail contato@evokaa.com.br</p>
        </div>
      </div>
    </div>
  `;
}

// Função para gerar o HTML do e-mail de Entrega de Ingressos
function getTicketDeliveryHtml(recipientName: string, eventTitle: string, tickets: any[], venueName: string, eventDate: string, eventTime: string) {
  let ticketsHtmlList = "";
  for (const ticket of tickets) {
    ticketsHtmlList += `
      <div style="border: 2px dashed ${colors.plumLight}; border-radius: 12px; background-color: #FFFFFF; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid ${colors.canvas}; padding-bottom: 10px; margin-bottom: 15px;">
          <div>
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${colors.accent}; font-weight: bold;">Ingresso</span>
            <h4 style="margin: 4px 0 0 0; font-size: 18px; color: ${colors.plum};">${ticket.ticket_types?.name || "Ingresso Individual"}</h4>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${colors.textMuted};">Código</span>
            <h4 style="margin: 4px 0 0 0; font-size: 16px; font-family: monospace; color: ${colors.textDark};">${ticket.qr_code.substring(0, 10).toUpperCase()}</h4>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: ${colors.textDark};">
          <tr>
            <td style="padding: 4px 0; color: ${colors.textMuted};">Nome do Portador:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: bold;">${ticket.buyer_name || recipientName}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: ${colors.textMuted};">CPF:</td>
            <td style="padding: 4px 0; text-align: right; font-family: monospace;">${ticket.buyer_cpf ? ticket.buyer_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "Não informado"}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: ${colors.textMuted};">Local do Evento:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: bold;">${venueName}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: ${colors.textMuted};">Data e Horário:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: bold; color: ${colors.accent};">${eventDate} às ${eventTime}</td>
          </tr>
        </table>
        <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px dashed ${colors.canvas};">
          <p style="font-size: 12px; color: ${colors.textMuted}; margin-bottom: 10px;">Apresente o QR Code abaixo na entrada do evento pelo celular:</p>
          <div style="background-color: ${colors.canvas}; padding: 15px; display: inline-block; border-radius: 8px; font-family: monospace; font-size: 14px; font-weight: bold; letter-spacing: 2px; color: ${colors.textDark}; border: 1px solid rgba(0,0,0,0.08);">
            ${ticket.qr_code}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div style="background-color: ${colors.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: ${colors.textDark};">
      <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05);">
        <div style="background-color: ${colors.plum}; padding: 40px 30px; text-align: center; color: #FFFFFF;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Seus Ingressos Disponíveis!</h1>
          <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.8); font-size: 16px;">Prepare o celular e bom evento!</p>
        </div>
        <div style="padding: 30px; background-color: ${colors.canvas};">
          <h2 style="font-size: 20px; margin-top: 0; color: ${colors.plum};">Olá, ${recipientName}!</h2>
          <p style="line-height: 1.5; font-size: 14px; color: ${colors.textDark}; margin-bottom: 20px;">Aqui estão os seus ingressos digitais para <strong>${eventTitle}</strong>. Salve este e-mail ou faça o download dos ingressos na plataforma.</p>
          
          ${ticketsHtmlList}

          <div style="background-color: #FFFFFF; border-radius: 12px; padding: 20px; border: 1px solid rgba(0,0,0,0.05); margin-top: 25px;">
            <h4 style="margin-top: 0; color: ${colors.espresso}; font-size: 14px;">⚠️ Instruções Importantes:</h4>
            <ul style="padding-left: 20px; margin: 5px 0 0 0; font-size: 13px; color: ${colors.textMuted}; line-height: 1.6;">
              <li>Chegue com antecedência ao local para evitar filas na portaria.</li>
              <li>Deixe o brilho da tela do celular no máximo ao validar seu QR Code.</li>
              <li>Cada QR Code é único e garante apenas um acesso. Não compartilhe esta imagem.</li>
            </ul>
          </div>
        </div>
        <div style="background-color: ${colors.void}; padding: 20px; text-align: center; color: rgba(255,255,255,0.6); font-size: 12px;">
          <p style="margin: 0;">Evokaa — Gestão de Eventos e Ingressos</p>
        </div>
      </div>
    </div>
  `;
}

// Função auxiliar para disparar o e-mail real ou simular
async function sendMail(to: string, subject: string, html: string, from: string) {
  if (!RESEND_API_KEY) {
    console.log(`[DEMO EMAIL] Para: ${to} | Assunto: ${subject}`);
    return { id: "demo-" + crypto.randomUUID(), demo: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    let { orderId, emailType, to, subject, html, from } = payload;

    if (!from) {
      if (emailType === "order_confirmation" || emailType === "ticket_delivery" || !emailType) {
        from = "Evokaa Gestão de Eventos e Ingressos <ingressos@evokaa.com.br>";
      } else if (emailType.startsWith("newsletter") || emailType === "info") {
        from = "Evokaa <info@evokaa.com.br>";
      } else if (emailType.startsWith("auth") || emailType === "cadastro") {
        from = "Evokaa <cadastro@evokaa.com.br>";
      } else if (emailType.startsWith("contact") || emailType === "support" || emailType === "contato") {
        from = "Evokaa <contato@evokaa.com.br>";
      } else {
        from = "Evokaa <contato@evokaa.com.br>";
      }
    }

    // DETECÇÃO DE DATABASE WEBHOOK DO SUPABASE
    // Se a requisição veio de um webhook de update da tabela orders para status 'paid'
    if (payload.record && payload.table === "orders") {
      const record = payload.record;
      const oldRecord = payload.old_record;

      // Só dispara se o status mudou para 'paid'
      if (record.status === "paid" && (!oldRecord || oldRecord.status !== "paid")) {
        orderId = record.id;
        
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error("Variáveis de ambiente do Supabase não configuradas para processar o webhook");
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Buscar detalhes do pedido, do evento e dos ingressos
        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .select("*, events(*)")
          .eq("id", orderId)
          .single();

        if (orderError || !order) throw new Error(`Webhook Error: Pedido ${orderId} não encontrado.`);

        const { data: tickets, error: ticketsError } = await supabaseAdmin
          .from("tickets")
          .select("*, ticket_types(name)")
          .eq("order_id", orderId);

        if (ticketsError || !tickets || tickets.length === 0) {
          throw new Error(`Webhook Error: Ingressos do pedido ${orderId} não encontrados.`);
        }

        const recipientEmail = order.customer_email || order.buyer_email;
        const recipientName = order.customer_name || "Participante";
        const eventTitle = order.events?.title || "Evento Evokaa";
        const eventDate = order.events?.date ? new Date(order.events.date).toLocaleDateString("pt-BR") : "";
        const eventTime = order.events?.time || "";
        const venueName = order.events?.venue_name || "Local a definir";

        if (!recipientEmail) throw new Error("Webhook Error: E-mail do cliente não configurado.");

        const results = [];

        // 1. Enviar E-mail de Confirmação de Compra (se não enviado)
        const { data: existingConf } = await supabaseAdmin
          .from("email_logs")
          .select("id")
          .eq("order_id", orderId)
          .eq("email_type", "order_confirmation")
          .maybeSingle();

        if (!existingConf) {
          try {
            const confSubject = `Compra Confirmada! — ${eventTitle}`;
            const confHtml = getOrderConfirmationHtml(recipientName, eventTitle, orderId, new Date(order.created_at).toLocaleDateString("pt-BR"), Number(order.total || 0));
            const mailRes = await sendMail(recipientEmail, confSubject, confHtml, from);
            
            await supabaseAdmin.from("email_logs").insert({
              order_id: orderId,
              email_type: "order_confirmation",
              recipient: recipientEmail,
              status: mailRes.demo ? "simulated_demo" : "sent",
              resend_id: mailRes.id
            });
            results.push({ email: "order_confirmation", success: true });
          } catch (e) {
            console.error("Erro ao enviar confirmação de compra:", e);
            await supabaseAdmin.from("email_logs").insert({
              order_id: orderId,
              email_type: "order_confirmation",
              recipient: recipientEmail,
              status: "failed",
              error_message: e.message
            });
            results.push({ email: "order_confirmation", success: false, error: e.message });
          }
        }

        // 2. Enviar E-mail com os Ingressos (se não enviado)
        const { data: existingDeliv } = await supabaseAdmin
          .from("email_logs")
          .select("id")
          .eq("order_id", orderId)
          .eq("email_type", "ticket_delivery")
          .maybeSingle();

        if (!existingDeliv) {
          try {
            const delivSubject = `Seus Ingressos Chegaram! — ${eventTitle}`;
            const delivHtml = getTicketDeliveryHtml(recipientName, eventTitle, tickets, venueName, eventDate, eventTime);
            const mailRes = await sendMail(recipientEmail, delivSubject, delivHtml, from);

            await supabaseAdmin.from("email_logs").insert({
              order_id: orderId,
              email_type: "ticket_delivery",
              recipient: recipientEmail,
              status: mailRes.demo ? "simulated_demo" : "sent",
              resend_id: mailRes.id
            });
            results.push({ email: "ticket_delivery", success: true });
          } catch (e) {
            console.error("Erro ao enviar entrega de ingressos:", e);
            await supabaseAdmin.from("email_logs").insert({
              order_id: orderId,
              email_type: "ticket_delivery",
              recipient: recipientEmail,
              status: "failed",
              error_message: e.message
            });
            results.push({ email: "ticket_delivery", success: false, error: e.message });
          }
        }

        return new Response(JSON.stringify({ success: true, trigger: "orders_update_paid", results }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ success: true, message: "Ignorado. Pedido não foi alterado para status 'paid'." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ENVIO MANUAL GENÉRICO (to + subject + html)
    if (to && subject && html) {
      try {
        const mailRes = await sendMail(to, subject, html, from);
        return new Response(JSON.stringify({ success: true, message: "E-mail genérico enviado com sucesso.", ...mailRes }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ENVIO TRANSACIONAL UNITÁRIO MANUAL (orderId + emailType)
    if (orderId && emailType) {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Variáveis de ambiente do Supabase não configuradas na Edge Function");
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Evitar reenvio
      const { data: existingEmail } = await supabaseAdmin
        .from("email_logs")
        .select("id")
        .eq("order_id", orderId)
        .eq("email_type", emailType)
        .maybeSingle();

      if (existingEmail) {
        return new Response(JSON.stringify({ success: true, message: "E-mail já enviado anteriormente para este pedido." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar detalhes do pedido, do evento e dos ingressos
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("*, events(*)")
        .eq("id", orderId)
        .single();

      if (orderError || !order) throw new Error(`Pedido ${orderId} não encontrado.`);

      const { data: tickets, error: ticketsError } = await supabaseAdmin
        .from("tickets")
        .select("*, ticket_types(name)")
        .eq("order_id", orderId);

      if (ticketsError || !tickets || tickets.length === 0) {
        throw new Error(`Nenhum ingresso encontrado para o pedido ${orderId}.`);
      }

      const recipientEmail = order.customer_email || order.buyer_email;
      const recipientName = order.customer_name || "Participante";
      const eventTitle = order.events?.title || "Evento Evokaa";
      const eventDate = order.events?.date ? new Date(order.events.date).toLocaleDateString("pt-BR") : "";
      const eventTime = order.events?.time || "";
      const venueName = order.events?.venue_name || "Local a definir";

      if (!recipientEmail) throw new Error("E-mail do cliente não configurado.");

      let mailSubject = "";
      let mailHtml = "";

      if (emailType === "order_confirmation") {
        mailSubject = `Compra Confirmada! — ${eventTitle}`;
        mailHtml = getOrderConfirmationHtml(recipientName, eventTitle, orderId, new Date(order.created_at).toLocaleDateString("pt-BR"), Number(order.total || 0));
      } else if (emailType === "ticket_delivery") {
        mailSubject = `Seus Ingressos Chegaram! — ${eventTitle}`;
        mailHtml = getTicketDeliveryHtml(recipientName, eventTitle, tickets, venueName, eventDate, eventTime);
      } else {
        throw new Error(`Tipo de e-mail ${emailType} não suportado para e-mails de pedido.`);
      }

      try {
        const mailRes = await sendMail(recipientEmail, mailSubject, mailHtml, from);
        
        await supabaseAdmin.from("email_logs").insert({
          order_id: orderId,
          email_type: emailType,
          recipient: recipientEmail,
          status: mailRes.demo ? "simulated_demo" : "sent",
          resend_id: mailRes.id
        });

        return new Response(JSON.stringify({ success: true, message: "E-mail enviado.", resendId: mailRes.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        await supabaseAdmin.from("email_logs").insert({
          order_id: orderId,
          email_type: emailType,
          recipient: recipientEmail,
          status: "failed",
          error_message: e.message
        });
        throw e;
      }
    }

    throw new Error("Payload inválido. Envie um formato suportado.");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

