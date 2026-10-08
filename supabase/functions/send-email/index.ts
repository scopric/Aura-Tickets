import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";
import { validarContato, validarEmail } from "../_shared/validar.ts";
import { colors, emailShell, escapeHtml, limitarPorIp, sendMail } from "../_shared/email.ts";
import { reenvioDoProdutor, TIPO_LOG_PRODUTOR, LIMITE_PRODUTOR_POR_PEDIDO, LIMITE_PRODUTOR_POR_HORA } from "../_shared/reenvioProdutor.ts";
import { adminCan, comoQuemChamou, mfaOk } from "../_shared/mfa.ts";
import { montarConviteEquipe } from "../_shared/conviteEquipe.ts";
import { gerarPdf, ingressosParaPdf } from "../_shared/ingressoPdf.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const TEAM_EMAIL = "contato@evokaa.com.br";

// Identifica quem está chamando pelo token da requisição — nunca confiar em `to`/`from` do
// corpo sem saber quem pediu, senão qualquer conta (autoconfirmada, trivial de criar) manda
// e-mail de phishing assinado pelo domínio evokaa.com.br para qualquer vítima.
async function getCaller(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email.toLowerCase() };
}

const APP_URL = "https://app.evokaa.com.br";

// Roteiro real do que já funciona hoje — nada de recurso prometido que ainda não está no ar
function getWelcomeHtml(rawName: string, role: "user" | "producer") {
  const name = escapeHtml(rawName);
  if (role === "producer") {
    const steps = `
      <div style="background-color: ${colors.canvas}; border-radius: 12px; padding: 20px; margin: 20px 0; font-size: 14px; line-height: 1.8; color: ${colors.textDark};">
        <p style="margin: 0 0 8px 0;"><strong>1.</strong> Crie seu primeiro evento em "Meus Eventos → Criar Evento".</p>
        <p style="margin: 0 0 8px 0;"><strong>2.</strong> Configure os tipos e preços de ingresso.</p>
        <p style="margin: 0 0 8px 0;"><strong>3.</strong> Convide afiliados ou membros da equipe, se precisar de ajuda na divulgação.</p>
        <p style="margin: 0;"><strong>4.</strong> No dia do evento, use o Check-in para validar os ingressos na portaria.</p>
      </div>
    `;
    return emailShell("Bem-vindo(a) à Evokaa!", `Olá, ${name}! Sua conta de produtor está pronta.`, steps, "Criar meu primeiro evento", `${APP_URL}/producer/events/new`);
  }
  const steps = `
    <div style="background-color: ${colors.canvas}; border-radius: 12px; padding: 20px; margin: 20px 0; font-size: 14px; line-height: 1.8; color: ${colors.textDark};">
      <p style="margin: 0 0 8px 0;"><strong>1.</strong> Explore o catálogo de eventos.</p>
      <p style="margin: 0 0 8px 0;"><strong>2.</strong> Complete seu perfil (telefone, cidade) para uma experiência melhor.</p>
      <p style="margin: 0;"><strong>3.</strong> Seus ingressos ficam disponíveis pelo Hub, em "Meus Ingressos".</p>
    </div>
  `;
  return emailShell("Bem-vindo(a) à Evokaa!", `Olá, ${name}! Sua conta está pronta.`, steps, "Ver eventos disponíveis", `${APP_URL}/events`);
}

function getSignupNotificationHtml(rawName: string, rawEmail: string, role: string) {
  const name = escapeHtml(rawName);
  const email = escapeHtml(rawEmail);
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
      <div style="background-color: ${colors.plum}; padding: 24px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 18px;">Novo cadastro na Evokaa</h2>
      </div>
      <div style="padding: 24px; font-size: 14px; color: ${colors.textDark}; line-height: 1.8;">
        <p style="margin: 0;"><strong>Nome:</strong> ${name}</p>
        <p style="margin: 0;"><strong>E-mail:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Papel:</strong> ${role === "producer" ? "Produtor" : "Participante"}</p>
      </div>
    </div>
  `;
}

function getContactHtml(rawName: string, rawEmail: string, rawPhone: string, rawMessage: string, rawSubject: string) {
  const name = escapeHtml(rawName);
  const email = escapeHtml(rawEmail);
  const phone = escapeHtml(rawPhone) || "Não informado";
  const message = escapeHtml(rawMessage);
  const subjectLine = escapeHtml(rawSubject) || "Contato geral";
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
      <div style="background-color: #0c2340; padding: 30px 24px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700;">Evokaa Eventos</h2>
        <p style="margin: 6px 0 0 0; opacity: 0.8; font-size: 14px;">Nova mensagem de suporte recebida pelo formulário do site</p>
      </div>
      <div style="padding: 30px 24px; color: #1c1917; font-size: 15px; line-height: 1.6;">
        <div style="background-color: #f5f5f4; border-radius: 12px; padding: 20px; margin: 0 0 25px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 8px 0; font-weight: bold; color: #78716c; width: 140px;">Nome:</td><td style="padding: 8px 0; font-weight: bold;">${name}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #78716c;">E-mail:</td><td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #1d68c4;">${email}</a></td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #78716c;">Telefone:</td><td style="padding: 8px 0;">${phone}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold; color: #78716c;">Assunto:</td><td style="padding: 8px 0; font-weight: bold;">${subjectLine}</td></tr>
          </table>
        </div>
        <div style="background-color: #faf8f5; border: 1px solid rgba(0,0,0,0.05); border-radius: 12px; padding: 20px;">
          <h4 style="margin: 0 0 10px 0; color: #0c2340; font-size: 14px;">Mensagem enviada:</h4>
          <p style="margin: 0; white-space: pre-wrap; font-size: 14px;">${message}</p>
        </div>
      </div>
      <div style="background-color: #0c2340; padding: 20px; text-align: center; color: rgba(255,255,255,0.6); font-size: 12px;">
        Evokaa — Gestão de Eventos e Ingressos
      </div>
    </div>
  `;
}

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
            <a href="${APP_URL}/app/tickets" style="background-color: ${colors.plum}; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px; box-shadow: 0 4px 6px rgba(126,34,206,0.2);">Acessar Meus Ingressos</a>
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

// E-mail de entrega: o ingresso vai no PDF em anexo (QR gerado no servidor); o corpo não repete
// dado pessoal (CPF) nem o código, porque o e-mail pode ser encaminhado.
function getTicketDeliveryHtml(recipientName: string, eventTitle: string, ticketCount: number, venueName: string, eventDate: string, eventTime: string) {
  const body = `
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: ${colors.textDark}; margin: 16px 0;">
      <tr><td style="padding: 6px 0; color: ${colors.textMuted};">Evento</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${eventTitle}</td></tr>
      <tr><td style="padding: 6px 0; color: ${colors.textMuted};">Data e horário</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${[eventDate, eventTime && `às ${eventTime}`].filter(Boolean).join(" ") || "A definir"}</td></tr>
      <tr><td style="padding: 6px 0; color: ${colors.textMuted};">Local</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${venueName}</td></tr>
      <tr><td style="padding: 6px 0; color: ${colors.textMuted};">Ingressos</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${ticketCount}</td></tr>
    </table>
    <ul style="padding-left: 20px; margin: 0; font-size: 13px; color: ${colors.textMuted}; line-height: 1.6;">
      <li>Abra o PDF em anexo e apresente o QR na entrada, pelo celular ou impresso.</li>
      <li>O ingresso é nominal e pessoal. Não compartilhe o PDF com quem não vai ao evento.</li>
      <li>Você também encontra o ingresso em "Meus ingressos", com a opção de baixar o PDF de novo.</li>
    </ul>`;
  return emailShell("Seus ingressos chegaram!", `Olá, ${recipientName}! ${ticketCount > 1 ? "Seus ingressos" : "Seu ingresso"} para <strong>${eventTitle}</strong> ${ticketCount > 1 ? "estão" : "está"} em anexo (um PDF com uma página por ingresso).`, body, "Ver meus ingressos", `${APP_URL}/app/tickets`);
}

// Tipos que só existem para mandar e-mail: sem RESEND_API_KEY, 503 antes de qualquer efeito (inclusive
// antes de marcar a flag do boas-vindas). `contact` grava a mensagem mesmo assim; `newsletter_subscribe` e
// `unsubscribe` não mandam e-mail.
const MANDA_EMAIL = ["welcome", "signup_notification", "newsletter", "order_confirmation", "ticket_delivery", "team_invite"];

// Comparação em tempo constante (SHA-256 dos dois lados, byte a byte): mesma do chat-notify.
async function mesmoSegredo(a: string, b: string) {
  const hash = async (v: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)));
  const [x, y] = await Promise.all([hash(a), hash(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    // Corpo acima de 64 KB é recusado antes de interpretar (o maior uso legítimo, o contato, tem até ~5,6 mil caracteres).
    // Sem content-length (envio em partes), lê em pedaços e corta ao passar do limite (não guarda tudo na memória).
    const MAX_CORPO = 65536;
    const tamanho = req.headers.get("content-length");
    if (tamanho !== null && !(Number(tamanho) <= MAX_CORPO)) return json({ error: "Requisição grande demais." }, 413);
    const partes: Uint8Array[] = [];
    let lidos = 0;
    if (req.body) {
      const leitor = req.body.getReader();
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        lidos += value.length;
        if (lidos > MAX_CORPO) { await leitor.cancel(); return json({ error: "Requisição grande demais." }, 413); }
        partes.push(value);
      }
    }
    const bytes = new Uint8Array(lidos);
    let pos = 0;
    for (const p of partes) { bytes.set(p, pos); pos += p.length; }
    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(bytes)); } catch { return json({ error: "Requisição inválida." }, 400); }
    // AVISO "AVISE-ME" (tipo interesse_aviso, P4): chamado só pelo pg_cron (docs/sql/20261016_interesse.sql, job
    // "interesse_email"), com o cabeçalho x-interesse-secret lido do Vault. Publicar com --no-verify-jwt. Não recebe
    // destinatário nem texto: a fila (interesse_email_due) e o e-mail do login vêm do banco. Responde só contagens.
    if (payload?.tipo === "interesse_aviso") {
      const recebido = req.headers.get("x-interesse-secret") ?? "";
      if (!recebido) return json({ ok: false }, 401);
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: segredo, error: segredoError } = await admin.rpc("interesse_notify_secret");
      if (segredoError) { console.error("[interesse] segredo:", segredoError.message); return json({ ok: false }, 500); }
      if (typeof segredo !== "string" || !segredo || !(await mesmoSegredo(recebido, segredo))) return json({ ok: false }, 401);
      if (!RESEND_API_KEY) return json({ ok: false, motivo: "sem_chave" }, 503); // a fila espera
      const { data: fila, error: filaError } = await admin.rpc("interesse_email_due");
      if (filaError) { console.error("[interesse] fila:", filaError.message); return json({ ok: false }, 500); }
      let enviados = 0;
      let falhas = 0;
      for (const a of (fila ?? []) as { id: string; email: string; nome: string; evento: string; event_id: string }[]) {
        let ok = true;
        try {
          const html = emailShell(
            "As vendas abriram",
            `Olá, ${escapeHtml(a.nome)}! Você pediu para ser avisado: as vendas de <strong>${escapeHtml(a.evento)}</strong> abriram.`,
            `<p style="line-height: 1.6; font-size: 14px; color: ${colors.textMuted};">Você recebe este e-mail porque se inscreveu no "Avise-me" deste evento. Para sair da lista, abra o evento e toque em "Remover aviso".</p>`,
            "Ver o evento",
            `${APP_URL}/event/${encodeURIComponent(a.event_id)}`,
          );
          await sendMail(a.email, `As vendas abriram: ${a.evento.replace(/[\r\n\t]+/g, " ").slice(0, 100)}`, html, "Evokaa <contato@evokaa.com.br>");
        } catch {
          ok = false; // sem o texto do erro no log: a Resend costuma repetir o e-mail
        }
        const { error } = await admin.rpc("interesse_email_mark", { p_ids: [a.id], p_ok: ok });
        if (error) console.error("[interesse] mark falhou:", a.id, error.message);
        if (ok) enviados++; else falhas++;
      }
      return json({ ok: true, enviados, falhas });
    }

    // `from` nunca vem do chamador — só o roteamento abaixo, por `emailType`, decide o
    // remetente. Aceitar `from` do corpo permitiria assinar e-mail como qualquer endereço.
    let { orderId, emailType } = payload;
    let from: string;

    if (emailType === "order_confirmation" || emailType === "ticket_delivery" || !emailType) {
      from = "Evokaa Gestão de Eventos e Ingressos <ingressos@evokaa.com.br>";
    } else if (emailType === "welcome" || emailType === "signup_notification") {
      from = "Evokaa <cadastro@evokaa.com.br>";
    } else if (emailType === "newsletter") {
      from = "Evokaa Eventos <contato@evokaa.com.br>";
    } else {
      from = "Evokaa <contato@evokaa.com.br>";
    }

    if (!RESEND_API_KEY && MANDA_EMAIL.includes(emailType)) {
      return json({ error: "Envio de e-mail indisponível no momento." }, 503);
    }

    // O branch de webhook de `orders` (que existia numa versão anterior deste arquivo) foi
    // tirado: nada no repositório configura um Database Webhook do Supabase apontando para cá,
    // ele não pedia autenticação nenhuma, e a proteção contra reenvio dependia de `email_logs`,
    // tabela que não existe em produção — um payload forjado (`{table:'orders', record:{id,
    // status:'paid'}}`) conseguiria bombardear o e-mail do cliente de um pedido pago real, sem
    // limite. Quando a Fase 4 (gateway de pagamento de verdade) precisar desse aviso automático,
    // desenhar com segredo compartilhado no header e a tabela de log criada por migration.

    // BOAS-VINDAS NO CADASTRO (emailType: 'welcome') e AVISO INTERNO (emailType: 'signup_notification')
    // Nenhum dos dois aceita `to`/`subject`/`html` do cliente: com `mailer_autoconfirm` ligado,
    // qualquer um cria uma conta com o e-mail de outra pessoa e ganha um JWT dessa conta — um
    // caminho que confiasse em "to === e-mail do chamador" ainda seria um relay de phishing.
    // O servidor busca nome/papel em `profiles` (nunca do corpo da requisição) e monta o HTML;
    // o destinatário do boas-vindas é sempre `caller.email`, e o aviso interno vai sempre para
    // `TEAM_EMAIL` — nenhum dos dois é parâmetro. Envia só uma vez por conta (marcado em
    // `app_metadata`, que o usuário não consegue editar): sem isso, a mesma conta forjada
    // acima poderia chamar em loop e despejar e-mail sem limite na caixa da vítima.
    if (emailType === "welcome" || emailType === "signup_notification") {
      const caller = await getCaller(req);
      if (!caller) {
        return new Response(JSON.stringify({ error: "Não autenticado." }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Variáveis de ambiente do Supabase não configuradas na Edge Function");
      }
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const sentFlag = emailType === "welcome" ? "welcome_email_sent" : "signup_notification_sent";
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(caller.id);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Não foi possível confirmar a conta." }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (userData.user.app_metadata?.[sentFlag]) {
        return new Response(JSON.stringify({ success: true, message: "Já enviado para esta conta." }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Marca ANTES de mandar, não depois: entre "checar a flag" e "gravar a flag" existe uma
      // janela — sem isso, um script chamando em paralelo com o mesmo JWT passa pela checagem
      // várias vezes antes de qualquer gravação acontecer (a checagem por si só não impede
      // duas chamadas simultâneas). Se o envio falhar, a marca fica e o e-mail não é reenviado (ver o catch).
      const { error: markError } = await supabaseAdmin.auth.admin.updateUserById(caller.id, {
        app_metadata: { [sentFlag]: true },
      });
      if (markError) {
        return new Response(JSON.stringify({ error: "Não foi possível reservar o envio." }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, role")
        .eq("id", caller.id)
        .maybeSingle();

      // Nome digitado no cadastro: cortado (e-mail não é lugar para texto longo); o escape de
      // HTML acontece dentro de getWelcomeHtml/getSignupNotificationHtml.
      const name = (profile?.full_name || "Participante").slice(0, 60);
      const role = profile?.role === "producer" ? "producer" : "user";

      try {
        const mailRes = emailType === "welcome"
          ? await sendMail(caller.email, "Bem-vindo(a) à Evokaa!", getWelcomeHtml(name, role), from)
          : await sendMail(TEAM_EMAIL, `[Novo cadastro] ${name} (${role === "producer" ? "Produtor" : "Participante"})`, getSignupNotificationHtml(name, caller.email, role), from);

        return new Response(JSON.stringify({ success: true, ...mailRes }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      } catch (e) {
        // Não desmarca a flag: reservar-enviar-desmarcar-se-falhar tem a mesma janela de
        // corrida que reservar depois de enviar (uma rajada em paralelo derruba a marcação de
        // todo mundo antes de qualquer envio terminar). Um boas-vindas que falhe simplesmente
        // não é reenviado — aceitável para um e-mail de cortesia.
        console.error(`[${emailType}] envio falhou:`, e.message);
        return json({ error: "Não foi possível enviar o e-mail." }, 502);
      }
    }

    // CONVITE DA EQUIPE (emailType: 'team_invite') — o TeamManager chama logo depois de team_convidar. Não recebe destinatário,
    // id nem texto: o banco (team_convite_email_reservar, com o JWT de quem chamou) diz quem receber, só vínculos pendentes
    // DESTE produtor, convidados nos últimos 10 min e uma vez por par a cada 7 dias (docs/sql/20261030c_equipe_convite_email.sql).
    // Exige 2FA lá. A reserva já conta como enviada; só a falha desfaz (com a marca da reserva), então um resultado perdido
    // não reenvia. Resposta só {ok, enviados}/{ok:false}; o log não tem endereço nem o texto da Resend (ela costuma repeti-lo).
    if (emailType === "team_invite") {
      const caller = await getCaller(req);
      if (!caller) return json({ ok: false }, 401);
      const { data: fila, error: filaError } = await comoQuemChamou(req).rpc("team_convite_email_reservar");
      if (filaError) {
        console.error("[team_invite] reservar falhou:", filaError.code);
        return json({ ok: false }, filaError.code === "42501" ? 403 : 500);
      }
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      // Em paralelo (no máximo 5 convites): um por vez estouraria o tempo da função se a Resend demorar.
      const resultados = await Promise.allSettled(((fila ?? []) as { user_id: string; email: string; role: string; produtor: string; reserva: string }[]).map(async (c) => {
        try {
          const { subject, html } = montarConviteEquipe(c.produtor, c.role, APP_URL);
          await sendMail(c.email, subject, html, from);
        } catch (e) {
          const { error } = await admin.rpc("team_convite_email_resultado", { p_producer: caller.id, p_user: c.user_id, p_reserva: c.reserva, p_ok: false });
          if (error) console.error("[team_invite] resultado falhou:", error.code);
          throw e;
        }
      }));
      const enviados = resultados.filter((r) => r.status === "fulfilled").length;
      return enviados < resultados.length ? json({ ok: false }, 502) : json({ ok: true, enviados });
    }

    // FORMULÁRIO DE CONTATO (emailType: 'contact') — canal público, sem login. Também não
    // aceita `html` pronto do cliente: só os campos estruturados do formulário, escapados e
    // montados no servidor; o destino é sempre TEAM_EMAIL, nunca `to` do corpo.
    // A gravação em `contact_messages` é só daqui (service role, depois do limite e da validação):
    // o visitante não tem mais INSERT direto na tabela (docs/sql/20261001_seg5_entrada_limites.sql).
    if (emailType === "contact") {
      const v = validarContato(payload);
      if (!v.ok) return json({ error: v.erro }, 400);
      const c = v.dados;

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Variáveis de ambiente do Supabase não configuradas na Edge Function");
      }
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const recusa = await limitarPorIp(req, supabaseAdmin, json);
      if (recusa) return recusa;

      const { error: insertError } = await supabaseAdmin.from("contact_messages").insert({
        name: c.name,
        email: c.email,
        phone: c.phone || null,
        subject: c.subject || "Contato via site",
        message: c.message,
        page: c.page || null,
      });
      if (insertError) {
        console.error("[contact] gravação falhou:", insertError.message);
        return json({ error: "Não foi possível enviar a mensagem. Tente de novo." }, 500);
      }

      // A mensagem já está gravada (a equipe vê no admin): falha do aviso por e-mail só vai para o log,
      // senão a pessoa tentaria de novo e a mensagem entraria duplicada.
      try {
        await sendMail(
          TEAM_EMAIL,
          `[Contato Site] ${c.subject || "Nova Mensagem"} - ${c.name}`,
          getContactHtml(c.name, c.email, c.phone, c.message, c.subject),
          from
        );
      } catch (e) {
        console.error("[contact] aviso por e-mail falhou:", e.message);
      }
      return json({ success: true });
    }

    // INSCRIÇÃO NA NEWSLETTER (emailType: 'newsletter_subscribe') — rodapé do site, sem login. Grava só
    // pela função (visitante não tem INSERT na tabela). Mesma resposta exista ou não o e-mail: não revela
    // quem já é assinante. Quem se descadastrou e se inscreve de novo continua descadastrado (a linha é a
    // prova LGPD do opt-out); reativar fica para a dupla confirmação (plano N1).
    if (emailType === "newsletter_subscribe") {
      const email = validarEmail(payload.email);
      if (!email) return json({ error: "Informe um e-mail válido." }, 400);

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Variáveis de ambiente do Supabase não configuradas na Edge Function");
      }
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const recusa = await limitarPorIp(req, supabaseAdmin, json);
      if (recusa) return recusa;

      // ponytail: teto global de 50/h — trocar pela dupla confirmação (N1)
      const { count: naHora, error: tetoError } = await supabaseAdmin
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true })
        .gt("created_at", new Date(Date.now() - 60 * 60_000).toISOString());
      if (tetoError) {
        console.error("[newsletter_subscribe] contagem do teto falhou:", tetoError.message);
        return json({ error: "Não foi possível concluir a inscrição. Tente de novo." }, 500);
      }
      if ((naHora ?? 0) >= 50) {
        console.warn(`[newsletter_subscribe] teto global: ${naHora} inscrições na última hora`);
        return json({ error: "Muitas inscrições agora. Tente mais tarde." }, 429);
      }

      // "on conflict do nothing" pelos dois índices únicos (email e lower(email)): o PostgREST só aceita
      // coluna em on_conflict, não expressão, então a duplicata (23505) é tratada como sucesso aqui.
      const { error: insertError } = await supabaseAdmin.from("newsletter_subscribers").insert({ email });
      if (insertError && insertError.code !== "23505") {
        console.error("[newsletter_subscribe] gravação falhou:", insertError.message);
        return json({ error: "Não foi possível concluir a inscrição. Tente de novo." }, 500);
      }
      return json({ success: true, message: "Inscrição recebida" });
    }

    // DESCADASTRO DA NEWSLETTER (emailType: 'unsubscribe') — público, sem login. Chega por POST
    // a partir da página /newsletter/sair do app, depois de um clique do assinante: um GET direto
    // no link do e-mail seria disparado sozinho pelos robôs de segurança (Outlook Safe Links,
    // antivírus corporativos) e descadastraria gente que não pediu.
    if (emailType === "unsubscribe") {
      const token = String(payload.unsubscribeToken || "");
      // uuid tem formato fixo: recusar antes de ir ao banco evita erro de cast virando 500
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
        return new Response(JSON.stringify({ error: "Link de descadastro inválido." }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Variáveis de ambiente do Supabase não configuradas na Edge Function");
      }
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: sub, error: subError } = await supabaseAdmin
        .from("newsletter_subscribers")
        .select("id, unsubscribed_at")
        .eq("unsubscribe_token", token)
        .maybeSingle();
      if (subError) throw subError;
      if (!sub) {
        return new Response(JSON.stringify({ error: "Link de descadastro inválido." }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      // 2º clique no mesmo link não sobrescreve o carimbo original (registro LGPD do opt-out)
      if (!sub.unsubscribed_at) {
        const { error: updError } = await supabaseAdmin
          .from("newsletter_subscribers")
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq("id", sub.id)
          .is("unsubscribed_at", null);
        if (updError) throw updError;
      }
      return new Response(JSON.stringify({ success: true, alreadyUnsubscribed: !!sub.unsubscribed_at }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // CAMPANHA DE NEWSLETTER (emailType: 'newsletter') — só admin com a permissão
    // `manage_newsletter` (ou `super_admin`) dispara, a mesma regra da rota /admin/newsletter.
    // O HTML foi montado pelo próprio admin no construtor, então é confiado como conteúdo
    // institucional — mas o link de descadastro nunca vem do corpo: é sempre trocado aqui pelo
    // token real de cada assinante.
    if (emailType === "newsletter") {
      const { campaignId } = payload;
      if (!campaignId) return json({ error: "campaignId é obrigatório." }, 400);
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Variáveis de ambiente do Supabase não configuradas na Edge Function");
      }
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const caller = await getCaller(req);
      if (!caller) return json({ error: "Não autenticado." }, 401);
      // o banco decide (gf_admin_can: admin só com 2FA e o código, Decisão 99)
      if ((await adminCan(req, "manage_newsletter")) !== true) {
        return json({ error: "Sem permissão para disparar campanhas (manage_newsletter). Entre com o código do 2FA." }, 403);
      }

      // ponytail: envio sequencial, 1 chamada à Resend por assinante; ~150 s de limite da Edge
      // Function dá folga até uns 300. Acima disso, recusa em vez de cortar a base calada —
      // trocar pelo endpoint de lote da Resend quando a base crescer.
      const SEND_LIMIT = 300;
      const { count: activeCount, error: countError } = await supabaseAdmin
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true })
        .is("unsubscribed_at", null);
      if (countError) throw countError;
      if ((activeCount ?? 0) > SEND_LIMIT) {
        return json({ error: `A base tem ${activeCount} assinantes ativos, acima do limite de ${SEND_LIMIT} do envio atual. É preciso implementar o envio em lote antes de disparar.` }, 400);
      }
      if (!activeCount) return json({ error: "Nenhum assinante ativo para receber a campanha." }, 400);

      // Reserva atômica: só um disparo passa do draft para sent. Sem isso, duas abas (ou um
      // novo clique depois de um 504) liam 'draft' ao mesmo tempo e mandavam a campanha 2x.
      const { data: campaign, error: reserveError } = await supabaseAdmin
        .from("newsletters")
        // recipient_count null = "em andamento": se a função morrer no meio do laço, a tela
        // mostra envio interrompido em vez de "enviado para 0"
        .update({ status: "sent", sent_at: new Date().toISOString(), recipient_count: null })
        .eq("id", campaignId)
        .eq("status", "draft")
        .select("id, title, content")
        .maybeSingle();
      if (reserveError) throw reserveError;
      if (!campaign) return json({ error: "Campanha não encontrada ou já enviada." }, 409);

      const { data: subscribers, error: subsError } = await supabaseAdmin
        .from("newsletter_subscribers")
        .select("email, unsubscribe_token")
        .is("unsubscribed_at", null)
        .order("created_at", { ascending: true })
        .limit(SEND_LIMIT);
      if (subsError) {
        await supabaseAdmin.from("newsletters").update({ status: "draft", sent_at: null }).eq("id", campaignId);
        throw subsError;
      }

      // Rede de segurança para linhas antigas com o mesmo e-mail em caixas diferentes
      // (o índice em lower(email) passa a impedir novas)
      const vistos = new Set<string>();
      let sentCount = 0;
      let falhas = 0;
      for (const sub of (subscribers || [])) {
        const chave = String(sub.email).trim().toLowerCase();
        if (vistos.has(chave)) continue;
        vistos.add(chave);

        const unsubscribeUrl = `${APP_URL}/newsletter/sair?token=${sub.unsubscribe_token}`;
        const personalizedHtml = campaign.content.includes("%%UNSUBSCRIBE_URL%%")
          ? campaign.content.replaceAll("%%UNSUBSCRIBE_URL%%", unsubscribeUrl)
          : `${campaign.content}<p style="text-align:center;font-size:11px;color:#8e7a72;margin-top:16px;"><a href="${unsubscribeUrl}" style="color:#8e7a72;">Descadastrar-se</a></p>`;
        try {
          await sendMail(chave, campaign.title, personalizedHtml, from);
          sentCount++;
        } catch {
          // sem o e-mail do assinante no log (nem a mensagem da Resend, que costuma repeti-lo)
          falhas++;
        }
      }
      if (falhas) console.error(`[newsletter] ${falhas} de ${vistos.size} envios falharam`);

      // Nenhum envio saiu (cota da Resend, chave inválida...): devolve a campanha a rascunho em
      // vez de deixá-la "enviada" para sempre sem ninguém ter recebido
      if (sentCount === 0) {
        await supabaseAdmin.from("newsletters").update({ status: "draft", sent_at: null }).eq("id", campaignId);
        return json({ error: "Nenhum e-mail foi enviado (a Resend recusou todos). A campanha voltou a rascunho." }, 502);
      }

      const { error: finalError } = await supabaseAdmin
        .from("newsletters")
        .update({ recipient_count: sentCount })
        .eq("id", campaignId);
      if (finalError) console.error("[newsletter] envio feito, mas recipient_count não gravou:", finalError.message);

      return json({ success: true, sentCount, total: vistos.size, failed: falhas });
    }

    // ENVIO TRANSACIONAL UNITÁRIO MANUAL (orderId + emailType)
    if (orderId && emailType) {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Variáveis de ambiente do Supabase não configuradas na Edge Function");
      }

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Autenticar ANTES de tocar no banco — senão um `orderId` chutado, sem login nenhum,
      // já revela se aquele pedido existe (oráculo de UUID) pela diferença entre as respostas.
      const caller = await getCaller(req);
      if (!caller) {
        return new Response(JSON.stringify({ error: "Não autenticado." }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Buscar detalhes do pedido, do evento e dos ingressos
      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("*, events(*)")
        .eq("id", orderId)
        .single();

      // Mesma resposta para "não existe" e "existe mas não é seu" — senão dá pra descobrir,
      // testando UUIDs com uma conta qualquer, quais pedidos de outra pessoa existem de verdade.
      // Também pode pedir a ENTREGA o produtor dono do evento do pedido (tela Participantes), com a mesma regra de 2FA do banco (conta sem fator verificado passa). O dono vem do
      // banco (events.producer_id), nunca do corpo. O e-mail vai para a conta de quem comprou, não para o produtor.
      const doProdutor = !orderError && !!order && order.user_id !== caller.id && reenvioDoProdutor({
        orderUserId: order.user_id, producerId: order.events?.producer_id, callerId: caller.id, emailType,
        mfa: order.events?.producer_id === caller.id && emailType === "ticket_delivery" ? await mfaOk(req) : false,
      });
      if (orderError || !order || (order.user_id !== caller.id && !doProdutor)) {
        return new Response(JSON.stringify({ error: "Você não tem acesso a este pedido." }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Só se o pedido estiver mesmo pago no banco (nada de reenviar "Compra Confirmada" de um
      // pedido pendente).
      if (order.status !== "paid") {
        return new Response(JSON.stringify({ error: "Este pedido ainda não está pago." }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      // Evitar reenvio (best-effort: se `email_logs` não existir, só deixa de bloquear). A confirmação sai uma vez
      // por pedido; a entrega pode ser pedida de novo (botão "Enviar por e-mail"), no máximo 3 vezes por hora.
      const entrega = emailType === "ticket_delivery";
      // O reenvio do produtor tem registro e limite próprios: não gasta as 3 entregas por hora do comprador.
      const tipoLog = doProdutor ? TIPO_LOG_PRODUTOR : emailType;
      // Produtor: reserva ANTES de qualquer trabalho e conta de novo já com a própria reserva (se duas chamadas chegam juntas,
      // ao menos uma enxerga a outra). Falha na contagem = recusa (falha fechada). Reserva que passou do limite vira failed.
      let reservaProdutor: string | null = null;
      const soltarProdutor = async () => { if (reservaProdutor) await supabaseAdmin.from("email_logs").update({ status: "failed", error_message: "recusado ou falhou antes do envio" }).eq("id", reservaProdutor); };
      if (doProdutor) {
        const umaHora = new Date(Date.now() - 3600_000).toISOString();
        const { data: r, error: erroReserva } = await supabaseAdmin.from("email_logs")
          .insert({ order_id: orderId, email_type: TIPO_LOG_PRODUTOR, status: "pending" }).select("id").single();
        if (erroReserva || !r) { console.error("[send-email] reserva do produtor falhou:", erroReserva?.message); return json({ error: "Não foi possível processar agora. Tente de novo." }, 500); }
        reservaProdutor = r.id;
        const conta = ["sent", "pending"];
        const { count: doPedido, error: e1 } = await supabaseAdmin.from("email_logs").select("id", { count: "exact", head: true })
          .eq("order_id", orderId).eq("email_type", TIPO_LOG_PRODUTOR).in("status", conta).gte("created_at", umaHora);
        const { count: dele, error: e2 } = await supabaseAdmin.from("email_logs")
          .select("id, orders!inner(events!inner(producer_id))", { count: "exact", head: true })
          .eq("email_type", TIPO_LOG_PRODUTOR).in("status", conta).eq("orders.events.producer_id", caller.id).gte("created_at", umaHora);
        if (e1 || e2 || doPedido === null || dele === null) {
          console.error("[send-email] contagem do produtor falhou:", (e1 ?? e2)?.message);
          await soltarProdutor();
          return json({ error: "Não foi possível processar agora. Tente de novo." }, 500);
        }
        if (doPedido > LIMITE_PRODUTOR_POR_PEDIDO) { await soltarProdutor(); return json({ error: "Você já reenviou o ingresso deste pedido na última hora (limite: 1 por hora por pedido). Tente de novo mais tarde." }, 429); }
        if (dele > LIMITE_PRODUTOR_POR_HORA) { await soltarProdutor(); return json({ error: `Limite de ${LIMITE_PRODUTOR_POR_HORA} reenvios por hora atingido. Tente de novo mais tarde.` }, 429); }
      }

      let enviados = 0;
      if (!doProdutor) {
      let jaEnviados = supabaseAdmin
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId)
        .eq("email_type", tipoLog)
        // reserva que nunca fechou (falha da função) só conta por 1 hora
        .or(`status.eq.sent,and(status.eq.pending,created_at.gte.${new Date(Date.now() - 3600_000).toISOString()})`);
      if (entrega) jaEnviados = jaEnviados.gte("created_at", new Date(Date.now() - 3600_000).toISOString());
      const { count, error: erroContagem } = await jaEnviados;
      enviados = count ?? 0;
      // Sem a tabela (SQL 20261030e não aplicado) não há limite: segue, mas deixa rastro no log.
      if (erroContagem) console.error("[send-email] email_logs indisponível, sem limite de reenvio:", erroContagem.message);
      // ponytail: no comprador, a contagem e a reserva (mais abaixo, depois de montar o PDF) não são atômicas: chamadas simultâneas podem passar do limite de 3. O produtor já reserva antes de contar. Se pesar: função SQL com pg_advisory_xact_lock.

      if (entrega && enviados >= 3) {
        return json({ error: "Você já pediu este e-mail 3 vezes na última hora. Tente de novo mais tarde ou baixe o PDF." }, 429);
      }
      }
      if (!entrega && enviados > 0) {
        return new Response(JSON.stringify({ success: true, message: "E-mail já enviado anteriormente para este pedido." }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: tickets, error: ticketsError } = await supabaseAdmin
        .from("tickets")
        .select("qr_code, buyer_name, status, ticket_types(name)")
        .eq("order_id", orderId);

      if (ticketsError || !tickets || tickets.length === 0) {
        await soltarProdutor();
        throw new Error(`Nenhum ingresso encontrado para o pedido ${orderId}.`);
      }

      // Nome do comprador e título/local do evento vêm de quem comprou e de quem criou o
      // evento — escapados antes de entrar no HTML do e-mail (o mesmo vale para o branch acima).
      // O assunto usa o título cru: é texto puro, não HTML, então "Rock & Roll" não deveria
      // virar "Rock &amp; Roll" na caixa de entrada.
      // O e-mail vai para quem está logado (dono confirmado do pedido acima), nunca para
      // `order.customer_email` — essa coluna é gravada pelo próprio cliente no checkout
      // (`useCheckout.ts`, sem policy que confira o valor), então um pedido forjado poderia
      // apontar para o e-mail de outra pessoa e usar este caminho como relay.
      let recipientEmail = caller.email;
      if (doProdutor) {
        if (!order.user_id) { await soltarProdutor(); return json({ error: "Este pedido não tem conta de comprador com e-mail." }, 422); }
        const { data: comprador, error: erroConta } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
        if (erroConta) { console.error("[send-email] conta do comprador:", erroConta.message); await soltarProdutor(); return json({ error: "Não consegui buscar o e-mail do comprador. Tente de novo." }, 502); }
        if (!comprador?.user?.email) { await soltarProdutor(); return json({ error: "Este pedido não tem conta de comprador com e-mail." }, 422); }
        recipientEmail = comprador.user.email.toLowerCase();
      }
      const eventTitleRaw = order.events?.title || "Evento Evokaa";
      const recipientName = escapeHtml(order.customer_name || "Participante");
      const eventTitle = escapeHtml(eventTitleRaw);
      const eventDate = order.events?.date ? new Date(order.events.date + "T00:00:00").toLocaleDateString("pt-BR") : "";
      const eventTime = escapeHtml(order.events?.time || "");
      const venueName = escapeHtml(order.events?.venue_name || "Local a definir");

      if (!recipientEmail) throw new Error("E-mail do cliente não configurado.");

      let mailSubject = "";
      let mailHtml = "";
      let mailAttachments: { filename: string; content: string }[] | undefined;

      if (emailType === "order_confirmation") {
        mailSubject = `Compra Confirmada! — ${eventTitleRaw}`;
        mailHtml = getOrderConfirmationHtml(recipientName, eventTitle, orderId, new Date(order.created_at).toLocaleDateString("pt-BR"), Number(order.total || 0));
      } else if (emailType === "ticket_delivery") {
        mailSubject = `Seus Ingressos Chegaram! — ${eventTitleRaw}`;
        const paginas = ingressosParaPdf(order, tickets).slice(0, 50); // só ingresso ativo; teto de 50 páginas
        if (paginas.length === 0) { await soltarProdutor(); return json({ error: "Este pedido não tem ingresso ativo." }, 404); }
        mailHtml = getTicketDeliveryHtml(recipientName, eventTitle, paginas.length, venueName, eventDate, eventTime);
        // btoa em pedaços: spread de um PDF inteiro estoura a pilha.
        const bytes = await gerarPdf(paginas);
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        mailAttachments = [{ filename: "ingresso-evokaa.pdf", content: btoa(bin) }];
      } else {
        throw new Error(`Tipo de e-mail ${emailType} não suportado para e-mails de pedido.`);
      }

      // Reserva o registro ANTES de enviar (conta no limite mesmo com o envio ainda em andamento); sem a tabela, não reserva.
      // (o produtor já reservou lá em cima: aqui só grava o destinatário)
      const { data: reserva } = reservaProdutor
        ? (await supabaseAdmin.from("email_logs").update({ recipient: recipientEmail }).eq("id", reservaProdutor), { data: { id: reservaProdutor } })
        : await supabaseAdmin.from("email_logs").insert({ order_id: orderId, email_type: tipoLog, recipient: recipientEmail, status: "pending" }).select("id").maybeSingle();
      const fechar = (campos: Record<string, unknown>) => reserva?.id
        ? supabaseAdmin.from("email_logs").update(campos).eq("id", reserva.id)
        : supabaseAdmin.from("email_logs").insert({ order_id: orderId, email_type: tipoLog, recipient: recipientEmail, ...campos });

      try {
        const mailRes = await sendMail(recipientEmail, mailSubject, mailHtml, from, mailAttachments);
        await fechar({ status: "sent", resend_id: mailRes.id });

        return new Response(JSON.stringify({ success: true, message: "E-mail enviado.", resendId: mailRes.id }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      } catch (e) {
        // texto genérico: a mensagem da Resend costuma repetir o e-mail do destinatário (o detalhe vai só ao log do servidor)
        await fechar({ status: "failed", error_message: "falha no envio" });
        throw e;
      }
    }

    return json({ error: "Payload inválido. Envie um formato suportado." }, 400);
  } catch (error) {
    // detalhe só no log: a mensagem crua pode trazer id de pedido, e-mail ou texto da Resend
    console.error("[send-email] erro:", error?.message);
    return json({ error: "Erro interno ao processar o e-mail." }, 500);
  }
});
