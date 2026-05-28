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

    // Se for envio direto de e-mail genérico (passando to, subject, html)
    if (to && subject && html) {
      if (!RESEND_API_KEY) {
        console.log(`[DEMO EMAIL GENÉRICO] Para: ${to} | Assunto: ${subject}`);
        return new Response(JSON.stringify({
          id: "demo-" + crypto.randomUUID(),
          demo: true,
          message: "E-mail simulado com sucesso (Modo Demo)."
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      if (!response.ok) throw new Error(JSON.stringify(data));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se for e-mail transacional baseado em pedido (orderId + emailType)
    if (orderId && emailType) {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Variáveis de ambiente do Supabase não configuradas na Edge Function");
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // 1. Evitar reenvio em duplicidade
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

      // 2. Buscar detalhes da compra e do evento
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("*, events(*)")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        throw new Error(`Pedido ${orderId} não encontrado no banco de dados.`);
      }

      // 3. Buscar ingressos vinculados ao pedido
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

      if (!recipientEmail) {
        throw new Error(`E-mail do destinatário não configurado para o pedido ${orderId}`);
      }

      let emailSubject = "";
      let emailHtml = "";

      // 4. Paleta de cores premium Aura (Plum, Espresso, Cream, Canvas, Void)
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

      // Template de Confirmação de Compra
      if (emailType === "order_confirmation") {
        emailSubject = `Compra Confirmada! — ${eventTitle}`;
        emailHtml = `
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
                      <td style="padding: 6px 0; text-align: right;">${new Date(order.created_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0 6px 0; font-weight: bold; color: ${colors.textDark}; font-size: 16px; border-top: 1px dashed rgba(0,0,0,0.1);">Total Pago:</td>
                      <td style="padding: 12px 0 6px 0; text-align: right; font-weight: bold; color: ${colors.plumLight}; font-size: 18px; border-top: 1px dashed rgba(0,0,0,0.1);">R$ ${Number(order.total || 0).toFixed(2)}</td>
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
      // Template de Entrega de Ingressos
      else if (emailType === "ticket_delivery") {
        emailSubject = `Seus Ingressos Chegaram! — ${eventTitle}`;
        
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

        emailHtml = `
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
      } else {
        throw new Error(`Tipo de e-mail ${emailType} não suportado para e-mails de pedido.`);
      }

      // 5. Realizar o envio real ou simulação
      if (!RESEND_API_KEY) {
        console.log(`[DEMO EMAIL TRANSACIONAL] Enviado para ${recipientEmail} | Assunto: ${emailSubject}`);
        
        // Registrar logs de e-mail localmente em modo demo
        await supabaseAdmin.from("email_logs").insert({
          order_id: orderId,
          email_type: emailType,
          recipient: recipientEmail,
          status: "simulated_demo"
        }).catch((err) => console.error("Erro ao registrar log demo:", err));

        return new Response(JSON.stringify({
          success: true,
          demo: true,
          message: "E-mail transacional simulado com sucesso (Modo Demo)."
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from,
          to: [recipientEmail],
          subject: emailSubject,
          html: emailHtml,
        }),
      });

      const resendData = await resendResponse.json();

      if (!resendResponse.ok) {
        // Gravar log de falha
        await supabaseAdmin.from("email_logs").insert({
          order_id: orderId,
          email_type: emailType,
          recipient: recipientEmail,
          status: "failed",
          error_message: resendData.message || "Erro desconhecido ao chamar API Resend"
        }).catch((err) => console.error("Erro ao gravar log de falha:", err));

        throw new Error(resendData.message || "Falha ao enviar e-mail via API do Resend");
      }

      // Gravar log de sucesso
      await supabaseAdmin.from("email_logs").insert({
        order_id: orderId,
        email_type: emailType,
        recipient: recipientEmail,
        status: "sent",
        resend_id: resendData.id
      }).catch((err) => console.error("Erro ao gravar log de sucesso:", err));

      return new Response(JSON.stringify({
        success: true,
        message: "E-mail transacional enviado com sucesso.",
        resendId: resendData.id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Payload inválido. Envie orderId + emailType OU to + subject + html.");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

