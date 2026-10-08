import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";
import { montarBordero } from "../_shared/borderoXlsx.ts";
import { buscarLogo } from "../_shared/logoProdutor.ts";
import { mfaOk } from "../_shared/mfa.ts";
import { dataSP, unicos, type Ingresso, type Pedido, type Tipo } from "../_shared/borderoDados.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const PAGINA = 1000;
const MAX_PAGINAS = 30; // 30.000 linhas por tabela: acima disso o arquivo não cabe na memória da função

// octet-stream de propósito: o supabase.functions.invoke só devolve Blob (sem corromper o binário) para esse tipo e para PDF
const XLSX = "application/octet-stream";
const STATUS: Record<string, string> = { draft: "Rascunho", published: "Publicado", ended: "Encerrado", cancelled: "Cancelado" };

serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token || !SUPABASE_URL || !ANON_KEY) return json({ error: "Não autenticado." }, 401);
    // Cliente COM o token de quem pede: a RLS (inclusive a exigência de 2FA) vale como no painel. Sem chave de serviço.
    const db = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
    const { data: u, error: uerr } = await db.auth.getUser(token);
    if (uerr || !u.user) return json({ error: "Não autenticado." }, 401);

    const corpo = await req.json().catch(() => null);
    const eventId = corpo?.eventId;
    const pessoais = corpo?.pessoais === true; // só o booleano de verdade liga nome e e-mail
    if (typeof eventId !== "string" || !/^[0-9a-f-]{36}$/i.test(eventId)) return json({ error: "Evento inválido." }, 400);

    if (!(await mfaOk(req))) return json({ error: "Confirme o código do 2FA (saia e entre de novo) e tente de novo." }, 403);

    const { data: ev } = await db.from("events").select("title, venue_name, venue_city, date, start_date, status, producer_id").eq("id", eventId).maybeSingle();
    // Mesma resposta para "não existe" e "não é seu"
    if (!ev || ev.producer_id !== u.user.id) return json({ error: "Você não tem acesso a este evento." }, 403);

    const todas = async <T>(q: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>) => {
      const all: T[] = [];
      for (let p = 0; p < MAX_PAGINAS; p++) {
        const { data, error } = await q(p * PAGINA, p * PAGINA + PAGINA - 1);
        if (error) throw error;
        all.push(...(data ?? []));
        if ((data ?? []).length < PAGINA) return all;
      }
      throw new Error("limite");
    };

    // Nome e e-mail só vão para o arquivo se o produtor pediu; CPF e telefone nunca (o banco nem deixa ler)
    const colPed = "id, status, created_at, payment_method, coupon_id, subtotal, discount, service_fee, processing_fee, total" + (pessoais ? ", customer_name, customer_email" : "");
    const colIng = "id, order_id, ticket_type_id, status, checked_in_at, created_at" + (pessoais ? ", buyer_name, buyer_email" : "");
    const [pedidos, ingressos, tiposR, perfil, rpc] = await Promise.all([
      todas<Pedido>((de, ate) => db.from("orders").select(colPed).eq("event_id", eventId).eq("status", "paid").order("created_at").order("id").range(de, ate) as never),
      todas<Ingresso>((de, ate) => db.from("tickets").select(colIng).eq("event_id", eventId).in("status", ["active", "used"]).order("created_at").order("id").range(de, ate) as never),
      db.from("ticket_types").select("id, name, price, quantity_total, is_active").eq("event_id", eventId).order("sort_order"),
      db.from("producer_profiles").select("company_name, logo_url").eq("id", ev.producer_id).maybeSingle(),
      db.rpc("produtor_vendas_pagas", { p_de: null, p_ate: null, p_event_id: eventId }),
    ]);
    if (tiposR.error || rpc.error) throw (tiposR.error || rpc.error);
    // Se a consulta do perfil falhou (por exemplo, coluna logo_url ainda ausente), o nome da produtora não pode sumir: busca só ele
    let nomeProdutora = perfil.data?.company_name;
    if (perfil.error && !nomeProdutora) nomeProdutora = (await db.from("producer_profiles").select("company_name").eq("id", ev.producer_id).maybeSingle()).data?.company_name;
    const resumo = rpc.data as { total: number; pedidos: number; reembolsados: { pedidos: number; total: number } };

    const ids = [...new Set(pedidos.map((p) => p.coupon_id).filter(Boolean))] as string[];
    const cupons: Record<string, string> = {};
    if (ids.length) {
      const { data } = await db.from("coupons").select("id, code").in("id", ids);
      for (const c of data ?? []) cupons[c.id] = c.code;
    }

    const bytes = await montarBordero({
      evento: { titulo: ev.title, local: [ev.venue_name, ev.venue_city].filter(Boolean).join(" · "), data: ev.date || (ev.start_date ? dataSP(ev.start_date).dia : ""), status: STATUS[ev.status] ?? ev.status },
      produtora: nomeProdutora || "Produtora",
      logoProdutor: await buscarLogo(perfil.data?.logo_url, ev.producer_id),
      geradoEm: new Date().toISOString(),
      pessoais,
      pedidos: unicos(pedidos), ingressos: unicos(ingressos), tipos: (tiposR.data ?? []) as Tipo[], cupons,
      reembolsados: { pedidos: Number(resumo.reembolsados?.pedidos) || 0, total: Number(resumo.reembolsados?.total) || 0 },
      totalBanco: { pedidos: Number(resumo.pedidos) || 0, total: Number(resumo.total) || 0 },
    });
    return new Response(bytes as unknown as BodyInit, { headers: { ...cors, "Content-Type": XLSX, "Content-Disposition": 'attachment; filename="bordero-evokaa.xlsx"' } });
  } catch (e) {
    console.error("[bordero-xlsx] erro:", (e as Error)?.message);
    return json({ error: (e as Error)?.message === "limite" ? "Evento com vendas demais para uma planilha só. Use o CSV." : "Não foi possível gerar a planilha." }, 500);
  }
});
