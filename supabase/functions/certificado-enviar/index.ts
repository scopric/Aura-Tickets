import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";
import { mfaOk } from "../_shared/mfa.ts";
import { sendMail } from "../_shared/email.ts";
import { emailCertificado } from "../_shared/emailCertificado.ts";
import { decidirLimite, horasValidas, semEmail, uuidValido } from "../_shared/certificadoEnvio.ts";
import { logoDoProdutor } from "../_shared/logoProdutor.ts";

// Envia o certificado emitido ao participante, por e-mail, com o link da página /certificado/<código>.
// Chamada pelo produtor (token no cabeçalho, verify_jwt ligado): o corpo só diz QUAL certificado emitido; quem é dono, o destinatário e o
// conteúdo vêm do banco. A mesma resposta de erro para "não existe" e "não é seu". Limite: 1 por certificado e 30 por produtor por hora.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APP_URL = "https://app.evokaa.com.br";
const FROM = "Evokaa Gestão de Eventos e Ingressos <ingressos@evokaa.com.br>";

serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token || !SUPABASE_URL || !SERVICE_KEY) return json({ error: "Não autenticado." }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: u, error: uerr } = await admin.auth.getUser(token);
    if (uerr || !u.user) return json({ error: "Não autenticado." }, 401);
    if (!(await mfaOk(req))) return json({ error: "Confirme o código do 2FA (saia e entre de novo) e tente de novo." }, 403);

    const corpo = await req.json().catch(() => null);
    const issuedId = corpo?.issuedId;
    if (!uuidValido(issuedId)) return json({ error: "Certificado inválido." }, 400);

    const { data: emitido } = await admin.from("issued_certificates").select("id, code, user_id, certificate_id, revoked_at").eq("id", issuedId).maybeSingle();
    const { data: modelo } = emitido ? await admin.from("certificates").select("event_id, template").eq("id", emitido.certificate_id).maybeSingle() : { data: null };
    const { data: ev } = modelo ? await admin.from("events").select("title, start_date, producer_id, approval_status").eq("id", modelo.event_id).maybeSingle() : { data: null };
    // Mesma resposta para "não existe" e "não é do seu evento"
    if (!emitido || !modelo || !ev || ev.producer_id !== u.user.id) return json({ error: "Você não tem acesso a este certificado." }, 403);
    // Revogado não se envia: o link só mostraria "revogado"
    if (emitido.revoked_at) return json({ error: "Este certificado foi revogado e não pode ser enviado." }, 409);
    // A página só valida certificado de evento aprovado: sem isso o participante receberia um link que diz "não encontramos"
    if (ev.approval_status !== "approved") return json({ error: "O evento ainda não foi aprovado. O certificado só pode ser conferido depois da aprovação." }, 409);

    const { data: ingresso } = await admin.from("tickets").select("buyer_name")
      .eq("event_id", modelo.event_id).eq("user_id", emitido.user_id).in("status", ["active", "used"])
      .order("checked_in_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    if (!ingresso) return json({ error: "Esta pessoa não tem mais ingresso válido neste evento: o certificado não vale e não foi enviado." }, 409);

    const { data: conta } = await admin.auth.admin.getUserById(emitido.user_id);
    const destino = conta?.user?.email;
    if (!destino) return json({ error: "Esta pessoa não tem e-mail cadastrado." }, 422);

    // Reserva ANTES de enviar e confere o limite contando a própria reserva (como o e-mail do ingresso)
    const { data: reserva, error: eReserva } = await admin.from("certificate_email_logs")
      .insert({ issued_certificate_id: emitido.id, producer_id: u.user.id, status: "pending" }).select("id").single();
    if (eReserva || !reserva) {
      console.error("[certificado-enviar] reserva:", eReserva?.message);
      return json({ error: "Não foi possível registrar o envio. Tente de novo em instantes." }, 500);
    }
    const falhou = (msg: string) => admin.from("certificate_email_logs").update({ status: "failed", error_message: semEmail(msg).slice(0, 300) }).eq("id", reserva.id);
    // Só 'pending' e 'sent' contam: tentativa barrada pelo limite ou que falhou na Resend não estende o bloqueio do produtor
    const desde = new Date(Date.now() - 3600_000).toISOString();
    const desdeDia = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [c1, c2, c3] = await Promise.all([
      admin.from("certificate_email_logs").select("id", { count: "exact", head: true }).eq("issued_certificate_id", emitido.id).in("status", ["pending", "sent"]).gte("created_at", desde),
      admin.from("certificate_email_logs").select("id", { count: "exact", head: true }).eq("producer_id", u.user.id).in("status", ["pending", "sent"]).gte("created_at", desde),
      admin.from("certificate_email_logs").select("id", { count: "exact", head: true }).eq("issued_certificate_id", emitido.id).in("status", ["pending", "sent"]).gte("created_at", desdeDia),
    ]);
    if (c1.error || c2.error || c3.error) { await falhou("não consegui conferir o limite"); return json({ error: "Não foi possível conferir o limite de envios. Tente de novo." }, 500); }
    const bloqueio = decidirLimite(c1.count ?? 0, c2.count ?? 0, c3.count ?? 0);
    if (bloqueio) { await falhou("limite de envios"); return json({ error: bloqueio.erro }, bloqueio.status); }

    const [{ data: perfil }, logo] = await Promise.all([
      admin.from("producer_profiles").select("company_name").eq("id", ev.producer_id).maybeSingle(),
      logoDoProdutor(admin, ev.producer_id),
    ]);
    const html = emailCertificado({
      nome: ingresso.buyer_name || "Participante", evento: ev.title, data: ev.start_date ? String(ev.start_date).slice(0, 10) : null,
      organizador: perfil?.company_name || null, horas: horasValidas(modelo.template?.horas), codigo: emitido.code,
      ctaHref: `${APP_URL}/certificado/${encodeURIComponent(emitido.code)}`, logo,
    });
    try {
      const r = await sendMail(destino, `Seu certificado — ${String(ev.title).replace(/[\r\n\t]+/g, " ").slice(0, 100)}`, html, FROM);
      await admin.from("certificate_email_logs").update({ status: "sent", resend_id: r?.id ?? null }).eq("id", reserva.id);
    } catch (e) {
      const msg = (e as Error)?.message || "erro ao enviar";
      console.error("[certificado-enviar] envio:", semEmail(msg));
      await falhou(msg);
      return json({ error: msg.includes("RESEND_API_KEY") ? "O envio de e-mail não está configurado." : "Não foi possível enviar o e-mail. Tente de novo em instantes." }, msg.includes("RESEND_API_KEY") ? 503 : 502);
    }
    return json({ ok: true }, 200);
  } catch (e) {
    console.error("[certificado-enviar] erro:", (e as Error)?.message);
    return json({ error: "Não foi possível enviar o certificado." }, 500);
  }
});
