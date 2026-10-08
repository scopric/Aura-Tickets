import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";
import { gerarPdf, ingressosParaPdf } from "../_shared/ingressoPdf.ts";
import { estiloDoEvento } from "../_shared/ingressoEstilo.ts";
import { logoDoProdutor } from "../_shared/logoProdutor.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Quem pede é identificado pelo token da requisição; o corpo só diz qual pedido.
async function getCaller(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data, error } = await createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).auth.getUser(token);
  return error || !data.user ? null : data.user;
}

serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Não autenticado." }, 401);

    const { orderId } = await req.json();
    if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "Pedido inválido." }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error: erroPedido } = await admin
      .from("orders")
      .select("user_id, status, customer_name, events(id, title, date, time, venue_name, producer_id, ticket_style)")
      .eq("id", orderId)
      .maybeSingle();
    if (erroPedido) console.error("[ticket-pdf] consulta do pedido falhou:", erroPedido.message); // ex.: coluna ausente em ambiente sem o SQL

    // Mesma resposta para "não existe" e "não é seu": não revela pedido de outra pessoa.
    if (!order || order.user_id !== caller.id) return json({ error: "Você não tem acesso a este pedido." }, 403);
    // Pedido estornado ou pendente não gera PDF, mesmo que algum ingresso ainda esteja 'active'.
    if (order.status !== "paid") return json({ error: "Este pedido não está pago." }, 400);

    const { data: tickets } = await admin
      .from("tickets")
      .select("buyer_name, status, ticket_types(name)")
      .eq("order_id", orderId)
      .eq("status", "active")
      .limit(50); // teto de páginas do PDF (e do anexo do e-mail)
    const paginas = ingressosParaPdf(order, tickets ?? []);
    if (paginas.length === 0) return json({ error: "Nenhum ingresso ativo neste pedido." }, 404);

    const ev = Array.isArray(order.events) ? order.events[0] : order.events;
    return new Response(await gerarPdf(paginas, await logoDoProdutor(admin, ev?.producer_id), estiloDoEvento(ev)), {
      headers: { ...cors, "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="ingresso-evokaa.pdf"' },
    });
  } catch (e) {
    console.error("[ticket-pdf] erro:", (e as Error)?.message);
    return json({ error: "Não foi possível gerar o PDF." }, 500);
  }
});
