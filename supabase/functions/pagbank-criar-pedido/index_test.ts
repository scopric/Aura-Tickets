import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handler, verificarRecaptcha, type Deps, type Pedido } from "./index.ts";

const A = "ACCO_" + "0123456789ABCDEF0123456789ABCDEF0123".slice(0, 36);
const B = "ACCO_" + "FEDCBA9876543210FEDCBA9876543210FEDC".slice(0, 36);
const OID = "11111111-1111-4111-8111-111111111111";
const AGORA = new Date("2026-10-08T12:00:00Z");
const ENV: Record<string, string> = {
  PAGBANK_BASE_URL: "https://sandbox.api.pagseguro.com", PAGBANK_TOKEN: "TOK-123456789", PAGBANK_ACCOUNT_ID: A,
  RECAPTCHA_SECRET: "s", SUPABASE_URL: "https://p.supabase.co",
};
const pedido = (o: Partial<Pedido> = {}): Pedido => ({
  id: OID, user_id: "u1", status: "pending", reservado_ate: "2026-10-08T12:10:00Z", total: 110, subtotal: 100, discount: 0,
  service_fee: 10, processing_fee: 0, customer_name: "Ana", customer_email: "ana@x.com", gateway_payment_id: null,
  evento: { producer_id: "p1", start_date: "2026-12-01T22:00:00Z", end_date: null },
  itens: [{ nome: "Pista", quantity: 2, unit_price: 50 }], payout_account_id: B, ...o,
});
const pagbankOk = (id = "ORDE_1") => ({
  id, reference_id: OID,
  charges: [{ payment_method: { pix: { expiration_date: "2026-10-08T12:09:00Z" } }, qr_code: { text: "000201PIX" }, links: [] }],
});
function montar(ov: Partial<Deps> = {}, p: Pedido | null = pedido()) {
  const chamadas: { caminho: string; init: { method: string; body?: any; idempotencia?: string } }[] = [];
  const deps: Deps = {
    env: k => ENV[k] ?? "", limitar: () => Promise.resolve(null), autenticar: () => Promise.resolve({ id: "u1", email: "ana@x.com" }),
    captcha: () => Promise.resolve(true), carregar: () => Promise.resolve(p), gravar: () => Promise.resolve(true),
    pagbank: (caminho, init) => { chamadas.push({ caminho, init }); return Promise.resolve(pagbankOk()); }, agora: () => AGORA, ...ov,
  };
  return { deps, chamadas };
}
const req = (corpo: unknown = { order_id: OID, captcha_token: "t", customer: { tax_id: "529.982.247-25", phone: "(11) 99999-9999" } }, h: Record<string, string> = { Authorization: "Bearer jwt" }) =>
  new Request("https://p.supabase.co/functions/v1/pagbank-criar-pedido", { method: "POST", headers: h, body: JSON.stringify(corpo) });

Deno.test("caminho feliz: cria com split, grava e devolve só 3 campos", async () => {
  const { deps, chamadas } = montar();
  const r = await handler(req(), deps);
  assertEquals(r.status, 200);
  const j = await r.json();
  assertEquals(Object.keys(j).sort(), ["expira_em", "order_id", "pix_copia_e_cola"]);
  assertEquals(j.pix_copia_e_cola, "000201PIX");
  const c = chamadas[0];
  assertEquals(c.init.idempotencia, OID);
  assertEquals(c.init.body.reference_id, OID);
  assertEquals(c.init.body.charges[0].amount.value, 11000);
  assertEquals(c.init.body.charges[0].splits.receivers.map((x: any) => x.amount.value), [1000, 10000]);
  assertEquals(c.init.body.charges[0].payment_method.pix.expiration_date, "2026-10-08T12:09:00Z");
  assertEquals(c.init.body.items.reduce((n: number, i: any) => n + i.quantity * i.unit_amount, 0), 11000); // 2x50 + taxa
  assertEquals(c.init.body.customer.phones[0].area, "11");
  assertEquals(c.init.body.notification_urls, ["https://p.supabase.co/functions/v1/pagbank-webhook"]);
});

Deno.test("produtor sem conta PagBank: sem splits", async () => {
  const { deps, chamadas } = montar({}, pedido({ payout_account_id: null }));
  assertEquals((await handler(req(), deps)).status, 200);
  assertEquals(chamadas[0].init.body.charges[0].splits, undefined);
});

Deno.test("desconto: itens colapsam e a soma bate com o total", async () => {
  const { deps, chamadas } = montar({}, pedido({ discount: 20, total: 90 }));
  await handler(req(), deps);
  assertEquals(chamadas[0].init.body.items, [{ reference_id: `${OID}-1`, name: "Ingressos", quantity: 1, unit_amount: 9000 }]);
});

Deno.test("pedido de outro usuário e pedido inexistente: mesma resposta", async () => {
  const a = await handler(req(), montar({}, pedido({ user_id: "outro" })).deps);
  const b = await handler(req(), montar({}, null).deps);
  assertEquals(a.status, 404); assertEquals(b.status, 404);
  assertEquals(await a.text(), await b.text());
});

Deno.test("reserva expirada ou com menos de 60 s: recusa sem chamar o PagBank", async () => {
  for (const ate of ["2026-10-08T11:59:00Z", "2026-10-08T12:00:50Z", null]) {
    const { deps, chamadas } = montar({}, pedido({ reservado_ate: ate }));
    const r = await handler(req(), deps);
    assertEquals(r.status, 409); assert((await r.json()).error.includes("Reserva expirada")); assertEquals(chamadas.length, 0);
  }
});

Deno.test("captcha ruim, sem login, CPF inválido, GET, corpo grande, config faltando", async () => {
  const c = montar({ captcha: () => Promise.resolve(false) });
  assertEquals((await handler(req(), c.deps)).status, 400); assertEquals(c.chamadas.length, 0);
  assertEquals((await handler(req(undefined, {}), montar().deps)).status, 401);
  assertEquals((await handler(req(), montar({ autenticar: () => Promise.resolve(null) }).deps)).status, 401);
  assertEquals((await handler(req({ order_id: OID, captcha_token: "t", customer: { tax_id: "111.111.111-11" } }), montar().deps)).status, 400);
  assertEquals((await handler(new Request("https://x/f", { method: "GET" }), montar().deps)).status, 405);
  assertEquals((await handler(req({ order_id: OID, captcha_token: "x".repeat(5000), customer: {} }), montar().deps)).status, 413);
  for (const k of ["PAGBANK_TOKEN", "PAGBANK_BASE_URL", "PAGBANK_ACCOUNT_ID", "RECAPTCHA_SECRET"]) {
    assertEquals((await handler(req(), montar({ env: x => (x === k ? "" : ENV[x] ?? "") }).deps)).status, 503, k);
  }
});

Deno.test("PagBank cai: 502 genérico, sem vazar detalhe, sem gravar", async () => {
  let gravou = false;
  const { deps } = montar({ pagbank: () => Promise.reject(new Error("boom TOK-123456789")), gravar: () => { gravou = true; return Promise.resolve(true); } });
  const r = await handler(req(), deps);
  assertEquals(r.status, 502);
  const t = await r.text();
  assert(!t.includes("boom") && !t.includes("TOK-") && !t.includes("ORDE_"));
  assert(!gravou);
});

Deno.test("gateway_payment_id já preenchido: consulta, não cria 2º pedido", async () => {
  const { deps, chamadas } = montar({}, pedido({ gateway_payment_id: "ORDE_1" }));
  const r = await handler(req(), deps);
  assertEquals(r.status, 200);
  assertEquals(chamadas.map(c => `${c.init.method} ${c.caminho}`), ["GET /orders/ORDE_1"]);
});

Deno.test("Pix já expirado no PagBank: 409", async () => {
  const velho = { ...pagbankOk(), charges: [{ payment_method: { pix: { expiration_date: "2026-10-08T11:00:00Z" } }, qr_code: { text: "x" } }] };
  const { deps } = montar({ pagbank: () => Promise.resolve(velho) }, pedido({ gateway_payment_id: "ORDE_1" }));
  assertEquals((await handler(req(), deps)).status, 409);
});

Deno.test("corrida: gravação perde, devolve o pedido já gravado", async () => {
  let n = 0;
  const { deps, chamadas } = montar({
    gravar: () => Promise.resolve(false),
    carregar: () => Promise.resolve(++n === 1 ? pedido() : pedido({ gateway_payment_id: "ORDE_1" })),
  });
  assertEquals((await handler(req(), deps)).status, 200);
  assertEquals(chamadas.map(c => c.init.method), ["POST", "GET"]);
});

Deno.test("resposta do PagBank de outro reference_id é recusada", async () => {
  const { deps } = montar({ pagbank: () => Promise.resolve({ ...pagbankOk(), reference_id: "outro" }) });
  assertEquals((await handler(req(), deps)).status, 502);
});

Deno.test("verificarRecaptcha: falha fechada", async () => {
  const f = (j: unknown, ok = true) => (() => Promise.resolve(new Response(JSON.stringify(j), { status: ok ? 200 : 500 }))) as unknown as typeof fetch;
  const env = (k: string) => ({ RECAPTCHA_SECRET: "s" } as Record<string, string>)[k] ?? "";
  const bom = { success: true, score: 0.9, action: "pagbank_checkout" };
  assertEquals(await verificarRecaptcha("t", "1.2.3.4", env, f(bom)), true);
  assertEquals(await verificarRecaptcha("t", null, env, f({ ...bom, score: 0.3 })), false);
  assertEquals(await verificarRecaptcha("t", null, env, f({ ...bom, action: "outra" })), false);
  assertEquals(await verificarRecaptcha("t", null, env, f({ success: false })), false);
  assertEquals(await verificarRecaptcha("t", null, env, f(bom, false)), false);
  assertEquals(await verificarRecaptcha("t", null, env, (() => Promise.reject(new Error("rede"))) as unknown as typeof fetch), false);
  assertEquals(await verificarRecaptcha("t", null, () => "", f(bom)), false); // sem segredo
  assertEquals(await verificarRecaptcha("", null, env, f(bom)), false);
});
