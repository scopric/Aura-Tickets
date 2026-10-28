import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
// Rodar: cd supabase && deno test --allow-env functions/pagbank-cartao-preparar/handler_test.ts
import { handler, hostSdk, type Deps } from "./handler.ts";
import type { Pedido } from "../pagbank-criar-pedido/handler.ts";

const OID = "11111111-1111-4111-8111-111111111111";
const AGORA = new Date("2026-10-08T12:00:00Z");
const ENV: Record<string, string> = { PAGBANK_BASE_URL: "https://sandbox.api.pagseguro.com", PAGBANK_TOKEN: "TOK-123456789", RECAPTCHA_SECRET: "s" };
const pedido = (o: Partial<Pedido> = {}): Pedido => ({
  id: OID, user_id: "u1", status: "pending", reservado_ate: "2026-10-08T12:10:00Z", total: 110.5, subtotal: 100, discount: 0,
  service_fee: 10, processing_fee: 0, customer_name: "Ana", customer_email: "a@x.com", gateway_payment_id: null,
  evento: { producer_id: "p", start_date: "2026-12-01T22:00:00Z", end_date: null }, itens: [], payout_account_id: null, ...o,
});
function montar(ov: Partial<Deps> = {}, p: Pedido | null = pedido()) {
  const lims: string[] = [], pb: { caminho: string; body: unknown }[] = [], sdk: { baseUrl: string; caminho: string; body: unknown }[] = [], acoes: string[] = [];
  const deps: Deps = {
    limitarChave: (_r, pre, ch, max) => { lims.push(`${pre}${ch}:${max}`); return Promise.resolve(null); },
    env: k => ENV[k] ?? "", limitar: () => Promise.resolve(null), autenticar: () => Promise.resolve({ id: "u1", email: null }),
    captcha: (_t, _ip, a) => { acoes.push(a); return Promise.resolve(true); }, carregar: () => Promise.resolve(p),
    pagbank: (caminho, init) => { pb.push({ caminho, body: init.body }); return Promise.resolve({ public_key: "PK-SECRETA" }); },
    sdk: (baseUrl, caminho, body) => { sdk.push({ baseUrl, caminho, body }); return Promise.resolve({ session: "SESSAO-SECRETA" }); },
    agora: () => AGORA, ...ov,
  };
  return { deps, pb, sdk, acoes, lims };
}
const req = (corpo: unknown = { order_id: OID, captcha_token: "t" }, h: Record<string, string> = { Authorization: "Bearer jwt" }) =>
  new Request("https://p.supabase.co/functions/v1/pagbank-cartao-preparar", { method: "POST", headers: h, body: JSON.stringify(corpo) });

Deno.test("sucesso: public_key, session, total do banco em centavos, ambiente; captcha com ação pagbank_cartao", async () => {
  const m = montar();
  const r = await handler(req(), m.deps);
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { public_key: "PK-SECRETA", session: "SESSAO-SECRETA", total_centavos: 11050, ambiente: "SANDBOX" });
  assertEquals(m.acoes, ["pagbank_cartao"]);
  assertEquals(m.pb, [{ caminho: "/public-keys/card", body: undefined }]); // GET, só leitura
  assertEquals(m.lims, [`pagbank-cartao-pedido:${OID}:5`, "pagbank-cartao-ip::15"]);
  assertEquals(m.sdk, [{ baseUrl: "https://sandbox.sdk.pagseguro.com", caminho: "/checkout-sdk/sessions", body: {} }]);
});

Deno.test("hostSdk: sandbox, produção (não verificado) e qualquer outra base = null", () => {
  assertEquals(hostSdk("https://sandbox.api.pagseguro.com/")?.ambiente, "SANDBOX");
  assertEquals(hostSdk("https://api.pagseguro.com")?.host, "https://sdk.pagseguro.com");
  for (const b of ["", "https://sandbox.evil.com", "https://api.pagseguro.com.evil.com", "http://api.pagseguro.com"]) assertEquals(hostSdk(b), null, b);
});

Deno.test("ambiente inválido ou config faltando: 503 sem chamar o PagBank", async () => {
  for (const [k, v] of [["PAGBANK_BASE_URL", "https://outro.com"], ["PAGBANK_BASE_URL", ""], ["PAGBANK_TOKEN", ""], ["RECAPTCHA_SECRET", ""]]) {
    const m = montar({ env: x => (x === k ? v : ENV[x] ?? "") });
    assertEquals((await handler(req(), m.deps)).status, 503, k); assertEquals(m.pb.length + m.sdk.length, 0);
  }
});

Deno.test("login, entrada, captcha, método e tamanho", async () => {
  assertEquals((await handler(req(undefined, {}), montar().deps)).status, 401);
  assertEquals((await handler(req(), montar({ autenticar: () => Promise.resolve(null) }).deps)).status, 401);
  assertEquals((await handler(req({ order_id: "x", captcha_token: "t" }), montar().deps)).status, 400);
  assertEquals((await handler(req({ order_id: OID }), montar().deps)).status, 400);
  const c = montar({ captcha: () => Promise.resolve(false) });
  assertEquals((await handler(req(), c.deps)).status, 400); assertEquals(c.pb.length, 0);
  assertEquals((await handler(new Request("https://x/f", { method: "GET" }), montar().deps)).status, 405);
  assertEquals((await handler(req({ order_id: OID, captcha_token: "x".repeat(5000) }), montar().deps)).status, 413);
});

Deno.test("limite por pedido ou IP estourado: devolve o 429 e não chama o PagBank", async () => {
  for (const alvo of ["pagbank-cartao-pedido:", "pagbank-cartao-ip:"]) {
    const m = montar({ limitarChave: (_r, pre) => Promise.resolve(pre === alvo ? new Response("{}", { status: 429 }) : null) });
    assertEquals((await handler(req(), m.deps)).status, 429); assertEquals(m.pb.length + m.sdk.length, 0);
  }
});

Deno.test("limite por usuário só depois do login", async () => {
  const ids: string[] = [];
  const lim = (_r: Request, u: string) => { ids.push(u); return Promise.resolve(null); };
  await handler(req(undefined, {}), montar({ limitar: lim }).deps);
  assertEquals(ids.length, 0);
  await handler(req(), montar({ limitar: lim }).deps);
  assertEquals(ids, ["u1"]);
  assertEquals((await handler(req(), montar({ limitar: () => Promise.resolve(new Response("{}", { status: 429 })) }).deps)).status, 429);
});

Deno.test("pedido de outro usuário/inexistente 404; não pendente e vencido 409; sem chamar o PagBank", async () => {
  const a = await handler(req(), montar({}, pedido({ user_id: "outro" })).deps);
  const b = await handler(req(), montar({}, null).deps);
  assertEquals(a.status, 404); assertEquals(await a.text(), await b.text());
  for (const p of [pedido({ status: "paid" }), pedido({ reservado_ate: "2026-10-08T12:00:30Z" }), pedido({ reservado_ate: null }), pedido({ total: 0 })]) {
    const m = montar({}, p);
    assertEquals((await handler(req(), m.deps)).status, 409); assertEquals(m.pb.length + m.sdk.length, 0);
  }
});

Deno.test("PagBank cai ou devolve sem campos: 502 e nem log nem resposta vazam token, session ou public_key", async () => {
  const logs: string[] = [];
  const orig = console.error; console.error = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
  const tudo: string[] = [];
  try {
    for (const ov of [
      { pagbank: () => Promise.reject(new Error("boom TOK-123456789")) },
      { sdk: () => Promise.resolve({}) },
      { sdk: () => Promise.reject(new Error("falhou SESSAO-SECRETA")) },
    ] as Partial<Deps>[]) {
      const r = await handler(req(), montar(ov).deps);
      assertEquals(r.status, 502); tudo.push(await r.text());
    }
  } finally { console.error = orig; }
  const s = tudo.join() + logs.join();
  assert(logs.length === 3);
  assert(!s.includes("TOK-123456789") && !s.includes("PK-SECRETA"));
});
