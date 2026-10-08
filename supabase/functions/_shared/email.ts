// E-mail e limite por IP das Edge Functions (send-email e admin-invite): o visual dos e-mails da Evokaa
// (emailShell, colors), o escape do que vem de fora (escapeHtml), o envio pela Resend (sendMail) e o limite
// dos canais públicos sem login (limitarPorIp).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { chaveIp } from "./validar.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Nome/e-mail/mensagem digitados por quem quer que seja vão dentro de HTML de e-mail — sem
// escapar, um nome tipo `<a href="...">Confirme sua conta</a>` vira link ativo no e-mail.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// Paleta da marca (mesma do app: azul #1d68c4 e marinho #0c2340). Sem degradê, sombra nem brilho (Guia de estilo, Decisão 198).
export const colors = {
  marca: "#1d68c4", // azul royal; branco por cima passa de 5:1
  marinho: "#0c2340",
  cream: "#FAF8F5", // fundo do e-mail
  canvas: "#F5F5F4",
  rodape: "#F4F6F9",
  textDark: "#1C1917",
  textMuted: "#78716C",
  accent: "#D97706" // aviso (urgente)
};

export function emailShell(title: string, intro: string, body: string, ctaLabel: string, ctaHref: string) {
  return `
    <div style="background-color: ${colors.cream}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; color: ${colors.textDark};">
      <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid rgba(0,0,0,0.08);">
        <div style="background-color: ${colors.marca}; padding: 32px 30px; text-align: center; color: #FFFFFF;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Evokaa</h1>
          <p style="margin: 10px 0 0 0; color: #FFFFFF; font-size: 16px;">${title}</p>
        </div>
        <div style="padding: 30px;">
          <p style="line-height: 1.6; font-size: 15px; color: ${colors.textDark};">${intro}</p>
          ${body}
          <div style="text-align: center; margin: 30px 0 10px 0;">
            <a href="${ctaHref}" style="background-color: ${colors.marca}; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 15px;">${ctaLabel}</a>
          </div>
        </div>
        <div style="background-color: ${colors.rodape}; border-top: 1px solid rgba(0,0,0,0.06); padding: 20px; text-align: center; color: ${colors.textMuted}; font-size: 12px;">
          <p style="margin: 0;">Evokaa — Gestão de Eventos e Ingressos</p>
          <p style="margin: 5px 0 0 0;">Dúvidas? contato@evokaa.com.br</p>
        </div>
      </div>
    </div>
  `;
}

// Sem modo "demo": sem chave não há envio, e quem chama responde 503 (ver MANDA_EMAIL abaixo). Fingir
// envio fazia a tela dizer "enviado" sem ninguém receber nada.
export async function sendMail(to: string, subject: string, html: string, from: string, attachments?: { filename: string; content: string }[]) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY ausente");

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
      ...(attachments ? { attachments } : {}),
    }),
    // Resend travada não prende a função. 60 s: send-email (newsletter em lote) e admin-invite usam.
    signal: AbortSignal.timeout(60000),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

// Em produção a Cloudflare fica na frente do Supabase: o IP real do visitante vem em `cf-connecting-ip`. O FIM do
// x-forwarded-for é o gateway (não o visitante) e o COMEÇO o cliente inventa; fica só como último recurso, com
// aviso no log. Devolve a chave do limite (IPv4 inteiro ou prefixo /64 do IPv6, ver chaveIp).
function clientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip");
  if (!cf) console.warn("[limite por IP] sem cf-connecting-ip; usando x-forwarded-for/x-real-ip");
  return chaveIp(cf ?? headers.get("x-forwarded-for")?.split(",").at(-1) ?? headers.get("x-real-ip") ?? "");
}

// Canais públicos sem login (contato, inscrição na newsletter e criar-conta do convite): 5 chamadas a cada 10 minutos por IP,
// contadas juntas na mesma tabela. Sem IP identificável não há como limitar, então recusa.
// Registra ANTES de contar (a própria chamada entra na conta): contar e depois gravar deixava uma rajada
// em paralelo passar inteira pela contagem. A tentativa recusada apaga o próprio registro (senão quem insiste
// ficaria bloqueado para sempre, e com ele o /64 inteiro); a aceita nunca é apagada, então a rajada segue barrada.
// Devolve a resposta de recusa, ou null para seguir.
// prefixo: chave separada por canal (ex. 'convite-conta:'), na mesma tabela e com o mesmo limite.
export async function limitarPorIp(req: Request, supabaseAdmin: SupabaseClient, json: (b: unknown, s?: number) => Response, prefixo = "") {
  const chave = clientIp(req.headers);
  const ip = chave && prefixo + chave;
  if (!ip) return json({ error: "Não foi possível identificar a origem da requisição." }, 400);
  const { data: hit, error: hitError } = await supabaseAdmin.from("contact_rate_limit_hits").insert({ ip }).select("id").single();
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count, error } = hitError ? { count: null, error: hitError } : await supabaseAdmin
    .from("contact_rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if (error) {
    console.error("[limite por IP] falhou:", error.message);
    return json({ error: "Não foi possível processar agora. Tente de novo." }, 500);
  }
  if ((count ?? 0) > 5) {
    const { error: delError } = await supabaseAdmin.from("contact_rate_limit_hits").delete().eq("id", hit!.id);
    if (delError) console.error("[limite por IP] recusa não apagou o registro:", delError.message);
    return json({ error: "Muitas tentativas. Tente de novo em alguns minutos." }, 429);
  }
  return null;
}
