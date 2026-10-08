import { assertEquals, assert, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
// Rodar: cd supabase && deno test --allow-env functions/pagbank-webhook/handler_test.ts
import { assinatura, handler, type Deps } from "./handler.ts";
import { PagbankErro } from "../_shared/pagbank.ts";

const TOKEN = "TOK-123456789";
const ENV: Record<string, string> = { PAGBANK_TOKEN: TOKEN, PAGBANK_BASE_URL: "https://sandbox.api.pagseguro.com" };
const OID = "11111111-1111-4111-8111-111111111111";
const ORDE = "ORDE_052C2EE2-E469-47CD-8815-F0CF04D24FE6";
const CHAR = "CHAR_63D0ADD3-AEEF-4E15-97F7-CD54DE47E3F9";
const PAID_AT = "2026-10-08T17:15:02.988-03:00";
const consulta = (status = "PAID", o: Record<string, unknown> = {}) => ({
  id: ORDE, reference_id: OID,
  charges: [{ id: CHAR, status, paid_at: PAID_AT, amount: { value: 10000, summary: { total: 10000, paid: 10000, refunded: 0 } } }], ...o,
});
// corpo como o PagBank manda (mesmo formato da consulta), com CPF e e-mail para provar que não vazam no log
const CORPO = JSON.stringify({ ...consulta(), customer: { email: "ana@x.com", tax_id: "52998224725" } });

function montar(o: { rpc?: string | Error; consulta?: unknown; falhaConsulta?: boolean; falhaCancel?: boolean; env?: Record<string, string> } = {}) {
  const pagbank: { caminho: string; init: any }[] = [];
  const rpc: Record<string, unknown>[] = [];
  const logs: string[] = [];
  const deps: Deps = {
    env: k => (o.env ?? ENV)[k] ?? "",
    pagbank: (caminho, init) => {
      pagbank.push({ caminho, init });
      if (caminho.startsWith("/orders/")) return o.falhaConsulta ? Promise.reject(new PagbankErro(504, "timeout")) : Promise.resolve((o.consulta ?? consulta()) as any);
      return o.falhaCancel ? Promise.reject(new PagbankErro(400, `PagBank POST -> 400 Bearer ${TOKEN}`)) : Promise.resolve({ status: "CANCELED" });
    },
    confirmar: args => { rpc.push(args); return o.rpc instanceof Error ? Promise.reject(o.rpc) : Promise.resolve(o.rpc ?? "pago"); },
    log: m => logs.push(m),
  };
  return { deps, pagbank, rpc, logs };
}
const req = async (corpo = CORPO, h: Record<string, string> | null = null, method = "POST") =>
  new Request("https://p.supabase.co/functions/v1/pagbank-webhook", {
    method, body: method === "POST" ? corpo : undefined,
    headers: h ?? { "content-type": "application/json", "x-authenticity-token": await assinatura(TOKEN, corpo) },
  });

Deno.test("assinatura: vetor do algoritmo documentado (sha256 hex de token-corpo)", async () => {
  // printf 'abc-{}' | shasum -a 256
  assertEquals(await assinatura("abc", "{}"), "28e2e3eecfecef0d66e742963bbd4f2b54213e1d414dcd88a0c4ff8b30da1bdf");
});

Deno.test("assinatura: corpo com espaços e quebras vale como veio; reformatar quebra", async () => {
  const cru = '{ "id" : "' + ORDE + '",\n  "x": 1 }';
  const { deps, pagbank } = montar();
  assertEquals((await handler(await req(cru), deps)).status, 200);
  assertEquals(pagbank.length, 1); // assinatura aceita, consultou
  assertNotEquals(await assinatura(TOKEN, cru), await assinatura(TOKEN, JSON.stringify(JSON.parse(cru))));
});

for (const [nome, h] of [
  ["ausente", { "content-type": "application/json" }],
  ["errada", { "x-authenticity-token": "0".repeat(64) }],
] as const) {
  Deno.test(`assinatura ${nome} -> 401 sem PagBank nem banco`, async () => {
    const m = montar();
    assertEquals((await handler(await req(CORPO, { ...h }), m.deps)).status, 401);
    assertEquals([m.pagbank.length, m.rpc.length], [0, 0]);
  });
}
Deno.test("corpo adulterado depois de assinado -> 401", async () => {
  const m = montar();
  const sig = await assinatura(TOKEN, CORPO);
  const r = await handler(await req(CORPO.replace("10000", "1"), { "x-authenticity-token": sig }), m.deps);
  assertEquals(r.status, 401);
  assertEquals([m.pagbank.length, m.rpc.length], [0, 0]);
});

Deno.test("sem PAGBANK_TOKEN -> 503", async () => {
  const m = montar({ env: { PAGBANK_BASE_URL: "x" } });
  assertEquals((await handler(await req(), m.deps)).status, 503);
  assertEquals(m.pagbank.length, 0);
});
Deno.test("só POST", async () => {
  assertEquals((await handler(await req(CORPO, {}, "GET"), montar().deps)).status, 405);
});
Deno.test("corpo acima de 64 KB -> 413", async () => {
  const m = montar();
  assertEquals((await handler(await req("x".repeat(70_000)), m.deps)).status, 413);
  assertEquals(m.pagbank.length, 0);
});

Deno.test("form pós-transação (assinado) -> 200 ignorado", async () => {
  const m = montar();
  const r = await handler(await req("notificationCode=ABC-123&notificationType=transaction"), m.deps);
  assertEquals(r.status, 200);
  assertEquals([m.pagbank.length, m.rpc.length], [0, 0]);
  assert(m.logs.some(l => l.includes("notificationType=transaction")));
});
Deno.test("id do corpo fora do formato ORDE_ -> 200 sem consultar", async () => {
  const m = montar();
  assertEquals((await handler(await req(JSON.stringify({ id: "../charges/x" })), m.deps)).status, 200);
  assertEquals(m.pagbank.length, 0);
});
Deno.test("reference_id da consulta não é UUID -> ignorado, sem RPC", async () => {
  const m = montar({ consulta: consulta("PAID", { reference_id: "evokaa-teste" }) });
  assertEquals((await handler(await req(), m.deps)).status, 200);
  assertEquals(m.rpc.length, 0);
});
Deno.test("consulta ao PagBank falha -> 5xx sem RPC", async () => {
  const m = montar({ falhaConsulta: true });
  assert((await handler(await req(), m.deps)).status >= 500);
  assertEquals(m.rpc.length, 0);
});
for (const st of ["WAITING", "DECLINED", "IN_ANALYSIS", "CANCELED", "AUTHORIZED"]) {
  Deno.test(`status ${st} -> 200 sem RPC`, async () => {
    const m = montar({ consulta: consulta(st) });
    assertEquals((await handler(await req(), m.deps)).status, 200);
    assertEquals(m.rpc.length, 0);
  });
}

for (const res of ["pago", "ja_pago"]) {
  Deno.test(`PAID + ${res} -> 200, RPC com dados da CONSULTA, sem estorno`, async () => {
    // corpo mente o valor; vale a consulta
    const corpo = JSON.stringify({ id: ORDE, reference_id: "22222222-2222-4222-8222-222222222222", charges: [{ amount: { summary: { paid: 1 } } }] });
    const m = montar({ rpc: res });
    const r = await handler(await req(corpo), m.deps);
    assertEquals(r.status, 200);
    assertEquals(await r.json(), { ok: true });
    assertEquals(m.rpc, [{ p_order_id: OID, p_gateway_payment_id: ORDE, p_valor_pago_centavos: 10000, p_event_id: `${CHAR}:PAID:${PAID_AT}`, p_pago_em: PAID_AT }]);
    assertEquals(m.pagbank.map(p => p.caminho), [`/orders/${ORDE}`]);
  });
}
for (const res of ["estorno", "valor_divergente"]) {
  Deno.test(`PAID + ${res} -> cancela a charge com o valor pago inteiro, 200`, async () => {
    const m = montar({ rpc: res });
    assertEquals((await handler(await req(), m.deps)).status, 200);
    const c = m.pagbank[1];
    assertEquals(c.caminho, `/charges/${CHAR}/cancel`);
    assertEquals(c.init, { method: "POST", body: { amount: { value: 10000 } }, idempotencia: `estorno:${CHAR}` });
  });
}
Deno.test("estorno falhando -> 5xx com alerta mascarado", async () => {
  const m = montar({ rpc: "estorno", falhaCancel: true });
  assert((await handler(await req(), m.deps)).status >= 500);
  assert(m.logs.some(l => l.includes("ALERTA")));
});
for (const res of ["conflito", "nao_encontrado"]) {
  Deno.test(`PAID + ${res} -> NÃO estorna, 200 com alerta`, async () => {
    const m = montar({ rpc: res });
    assertEquals((await handler(await req(), m.deps)).status, 200);
    assertEquals(m.pagbank.length, 1);
    assert(m.logs.some(l => l.includes("ALERTA") && l.includes(res)));
  });
}
Deno.test("exceção da RPC -> 5xx com alerta, sem estorno", async () => {
  const m = montar({ rpc: new Error("P0001 boom") });
  assert((await handler(await req(), m.deps)).status >= 500);
  assertEquals(m.pagbank.length, 1);
  assert(m.logs.some(l => l.includes("ALERTA")));
});
Deno.test("logs não têm corpo, token, CPF nem e-mail", async () => {
  const todos: string[] = [];
  for (const o of [{}, { rpc: "estorno", falhaCancel: true }, { rpc: new Error(`x ${TOKEN}`) }, { falhaConsulta: true }] as const) {
    const m = montar(o as any);
    await handler(await req(), m.deps);
    todos.push(...m.logs);
  }
  const t = todos.join("\n");
  for (const proibido of [TOKEN, "52998224725", "ana@x.com", OID, CORPO.slice(0, 40)]) assert(!t.includes(proibido), proibido);
});
