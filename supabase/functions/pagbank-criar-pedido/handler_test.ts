import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
// Rodar: cd supabase && deno test --allow-env functions/_shared/pagbank_test.ts functions/pagbank-criar-pedido/handler_test.ts
import { handler, verificarRecaptcha, type Deps, type Pedido } from "./handler.ts";
import { PagbankErro } from "../_shared/pagbank.ts";

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
  const ev: string[] = [];
  const chamadas: { caminho: string; init: { method: string; body?: any; idempotencia?: string } }[] = [];
  const deps: Deps = {
    env: k => ENV[k] ?? "", limitar: () => Promise.resolve(null), autenticar: () => Promise.resolve({ id: "u1", email: "ana@x.com" }),
    limitarChave: (_r, pre, ch, max) => { ev.push(`lim:${pre}${ch.slice(0, 12)}:${max}`); return Promise.resolve(null); },
    trava: (id) => { ev.push("trava"); return Promise.resolve(true); }, destravar: () => { ev.push("destrava"); return Promise.resolve(); },
    liberarOrde: (_i, o) => { ev.push("libera:" + o); return Promise.resolve(); },
    trocar: (_i, p) => { ev.push("troca:" + p); return Promise.resolve(true); },
    esperar: () => Promise.resolve(), captcha: () => Promise.resolve(true), carregar: () => Promise.resolve(p), gravar: () => Promise.resolve(true),
    pagbank: (caminho, init) => { chamadas.push({ caminho, init }); return Promise.resolve(pagbankOk()); }, agora: () => AGORA, ...ov,
  };
  return { deps, chamadas, ev };
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
  assert(/^11111111-1111-4111-8111-111111111111-[0-9a-f]{12}$/.test(c.init.idempotencia!));
  assert(!c.init.idempotencia!.includes("52998224725"));
  assertEquals(c.init.body.reference_id, OID);
  assertEquals(c.init.body.charges[0].amount.value, 11000);
  assertEquals(c.init.body.charges[0].splits.receivers.map((x: any) => x.amount.value), [1000, 10000]);
  assertEquals(c.init.body.charges[0].payment_method.pix.expiration_date, "2026-10-08T12:09:45Z");
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
  const bom = { success: true, score: 0.9, action: "pagbank_checkout", hostname: "evokaa.com.br" };
  assertEquals(await verificarRecaptcha("t", "1.2.3.4", env, f(bom)), true);
  assertEquals(await verificarRecaptcha("t", null, env, f({ ...bom, score: 0.3 })), false);
  assertEquals(await verificarRecaptcha("t", null, env, f({ ...bom, action: "outra" })), false);
  assertEquals(await verificarRecaptcha("t", null, env, f({ ...bom, hostname: "evil.com" })), false);
  assertEquals(await verificarRecaptcha("t", null, env, f({ success: false })), false);
  // RECAPTCHA_MIN_SCORE fora de [0.3, 0.9] ou NaN vale 0.5 (nunca bypass)
  for (const m of ["0", "-1", "NaN", "9", "abc"]) {
    const e = (k: string) => ({ RECAPTCHA_SECRET: "s", RECAPTCHA_MIN_SCORE: m } as Record<string, string>)[k] ?? "";
    assertEquals(await verificarRecaptcha("t", null, e, f({ ...bom, score: 0.1 })), false, m);
    assertEquals(await verificarRecaptcha("t", null, e, f({ ...bom, score: 0.6 })), true, m);
  }
  assertEquals(await verificarRecaptcha("t", null, env, f(bom, false)), false);
  assertEquals(await verificarRecaptcha("t", null, env, (() => Promise.reject(new Error("rede"))) as unknown as typeof fetch), false);
  assertEquals(await verificarRecaptcha("t", null, () => "", f(bom)), false); // sem segredo
  assertEquals(await verificarRecaptcha("", null, env, f(bom)), false);
});

Deno.test("corpo e chave idênticos em instantes diferentes; CPF diferente = chave nova", async () => {
  const rodar = async (agora: string, cpf = "529.982.247-25") => {
    const { deps, chamadas } = montar({ agora: () => new Date(agora) });
    await handler(req({ order_id: OID, captcha_token: "t", customer: { tax_id: cpf, phone: "11999999999" } }), deps);
    return chamadas[0].init;
  };
  const a = await rodar("2026-10-08T12:00:00Z"), b = await rodar("2026-10-08T12:03:21Z");
  assertEquals(JSON.stringify(a.body), JSON.stringify(b.body));
  assertEquals(a.idempotencia, b.idempotencia);
  const c = await rodar("2026-10-08T12:00:00Z", "111.444.777-35");
  assert(a.idempotencia !== c.idempotencia);
  assert(!JSON.stringify(a).includes("idempotencia\":\"" + "52998224725"));
});

Deno.test("5xx no POST: 1 retry com mesma chave e corpo; depois 502", async () => {
  const visto: any[] = []; let esperou = 0;
  const { deps } = montar({
    esperar: (ms) => { esperou = ms; return Promise.resolve(); },
    pagbank: (c, i) => { visto.push(i); return visto.length === 1 ? Promise.reject(new PagbankErro(500, "x")) : Promise.resolve(pagbankOk()); },
  });
  assertEquals((await handler(req(), deps)).status, 200);
  assertEquals(visto.length, 2); assertEquals(esperou, 1500);
  assertEquals(JSON.stringify(visto[0]), JSON.stringify(visto[1]));
  let n = 0;
  const f = montar({ pagbank: () => { n++; return Promise.reject(new PagbankErro(500, "x")); } });
  assertEquals((await handler(req(), f.deps)).status, 502); assertEquals(n, 2);
  let m = 0;
  const g = montar({ pagbank: () => { m++; return Promise.reject(new PagbankErro(400, "x")); } });
  assertEquals((await handler(req(), g.deps)).status, 502); assertEquals(m, 1); // 4xx não repete
});

Deno.test("IDEMPOTENCY_CONFLICT vira 409 genérico", async () => {
  const { deps } = montar({ pagbank: () => Promise.reject(new PagbankErro(409, "PagBank POST /orders -> 409 code=IDEMPOTENCY_CONFLICT param=x-idempotency-key")) });
  const r = await handler(req(), deps);
  assertEquals(r.status, 409);
  assert(!(await r.text()).includes("IDEMPOTENCY"));
});

Deno.test("limite por usuário vem depois do login; anônimo não consome cota", async () => {
  const ids: string[] = [];
  const lim = (_r: Request, u: string) => { ids.push(u); return Promise.resolve(null); };
  await handler(req(undefined, {}), montar({ limitar: lim }).deps);
  await handler(req(), montar({ limitar: lim, autenticar: () => Promise.resolve(null) }).deps);
  assertEquals(ids.length, 0);
  await handler(req(), montar({ limitar: lim }).deps);
  assertEquals(ids, ["u1"]);
  const r = await handler(req(), montar({ limitar: () => Promise.resolve(new Response("{}", { status: 429 })) }).deps);
  assertEquals(r.status, 429);
});

Deno.test("carregar lançando erro: 502 com CORS; e-mail nulo: 400; Content-Length grande: 413", async () => {
  const r = await handler(req(undefined, { Authorization: "Bearer j", Origin: "https://evokaa.com.br" }), montar({ carregar: () => Promise.reject(new TypeError("x is null")) }).deps);
  assertEquals(r.status, 502);
  assertEquals(r.headers.get("Access-Control-Allow-Origin"), "https://evokaa.com.br");
  assert(!(await r.text()).includes("TypeError"));
  const sem = montar({ autenticar: () => Promise.resolve({ id: "u1", email: null }) }, pedido({ customer_email: null }));
  assertEquals((await handler(req(), sem.deps)).status, 400); assertEquals(sem.chamadas.length, 0);
  assertEquals((await handler(req(undefined, { Authorization: "Bearer j", "content-length": "99999" }), montar().deps)).status, 413);
});

Deno.test("ordem dos itens vinda do banco não muda corpo nem chave", async () => {
  const its = [
    { id: "a1", ticket_type_id: "t1", nome: "Pista", quantity: 1, unit_price: 50 },
    { id: "b2", ticket_type_id: "t2", nome: "VIP", quantity: 2, unit_price: 30 },
    { id: "c3", ticket_type_id: "t3", nome: "Camarote", quantity: 1, unit_price: 20 },
  ];
  const rodar = async (itens: typeof its) => {
    const { deps, chamadas } = montar({}, pedido({ itens, subtotal: 130, total: 140, service_fee: 10 }));
    assertEquals((await handler(req(), deps)).status, 200);
    return chamadas[0].init;
  };
  const a = await rodar(its), b = await rodar([...its].reverse()), c = await rodar([its[1], its[2], its[0]]);
  assertEquals(JSON.stringify(a.body), JSON.stringify(b.body));
  assertEquals(JSON.stringify(a.body), JSON.stringify(c.body));
  assertEquals(a.idempotencia, b.idempotencia);
  assertEquals(a.body.items.map((i: any) => i.reference_id).slice(0, 3), ["a1", "b2", "c3"]);
});

Deno.test("reCAPTCHA: localhost só com RECAPTCHA_ALLOW_LOCALHOST=1", async () => {
  const f = (() => Promise.resolve(new Response(JSON.stringify({ success: true, score: 0.9, action: "pagbank_checkout", hostname: "localhost" })))) as unknown as typeof fetch;
  const e = (extra: Record<string, string>) => (k: string) => ({ RECAPTCHA_SECRET: "s", ...extra } as Record<string, string>)[k] ?? "";
  assertEquals(await verificarRecaptcha("t", null, e({}), f), false);
  assertEquals(await verificarRecaptcha("t", null, e({ RECAPTCHA_ALLOW_LOCALHOST: "1", PAGBANK_BASE_URL: "https://sandbox.api.pagseguro.com" }), f), true);
  const sub = (hostname: string) => (() => Promise.resolve(new Response(JSON.stringify({ success: true, score: 0.9, action: "pagbank_checkout", hostname })))) as unknown as typeof fetch;
  assertEquals(await verificarRecaptcha("t", null, e({}), sub("app.localhost")), false);
  assertEquals(await verificarRecaptcha("t", null, e({ RECAPTCHA_ALLOW_LOCALHOST: "1", PAGBANK_BASE_URL: "https://sandbox.api.pagseguro.com" }), sub("app.localhost")), true);
  assertEquals(await verificarRecaptcha("t", null, e({ RECAPTCHA_ALLOW_LOCALHOST: "1", PAGBANK_BASE_URL: "https://sandbox.api.pagseguro.com" }), sub("evil.localhost")), false);
  assertEquals(await verificarRecaptcha("t", null, e({ RECAPTCHA_ALLOW_LOCALHOST: "1", PAGBANK_BASE_URL: "https://api.pagseguro.com" }), sub("app.localhost")), false); // produção real: localhost nunca passa
  assertEquals(await verificarRecaptcha("t", null, e({ RECAPTCHA_ALLOW_LOCALHOST: "1", PAGBANK_BASE_URL: "https://sandbox.evil.com" }), sub("app.localhost")), false); // URL exata
  const agora = Date.now; Date.now = () => Date.parse("2026-10-16T00:00:01-03:00");
  try { assertEquals(await verificarRecaptcha("t", null, e({ RECAPTCHA_ALLOW_LOCALHOST: "1", PAGBANK_BASE_URL: "https://sandbox.api.pagseguro.com" }), sub("app.localhost")), false); } finally { Date.now = agora; } // vence no lançamento
});

Deno.test("custódia: evento a 400 dias = sem split; a 30 dias = com split e custódia", async () => {
  const longe = montar({}, pedido({ evento: { producer_id: "p1", start_date: "2027-11-12T22:00:00Z", end_date: null } }));
  assertEquals((await handler(req(), longe.deps)).status, 200);
  assertEquals(longe.chamadas[0].init.body.charges[0].splits, undefined);
  const perto = montar({}, pedido({ evento: { producer_id: "p1", start_date: "2026-11-07T22:00:00Z", end_date: null } }));
  await handler(req(), perto.deps);
  assertEquals(perto.chamadas[0].init.body.charges[0].splits.receivers[1].configurations.custody.apply, true);
});

// ---- ramo do cartão (C2) ----
const ENC = "A".repeat(340) + "==";
const TDS = "3DS_" + "0123456789abcdef0123456789abcdef0123";
const cartao = (o: Record<string, unknown> = {}) => ({ encrypted: ENC, three_ds_id: TDS, holder_name: "ANA SILVA", ...o });
const reqC = (c: unknown = cartao(), h?: Record<string, string>) => req({ order_id: OID, captcha_token: "t", customer: { tax_id: "529.982.247-25", phone: "11999999999" }, cartao: c }, h);
const COM_IP = { Authorization: "Bearer jwt", "x-real-ip": "1.2.3.4" };
const pagoCartao = (status = "PAID") => ({ id: "ORDE_C1", reference_id: OID, charges: [{ id: "CHAR_1", status, payment_method: { type: "CREDIT_CARD" } }] });
const cartaoDeps = (st: string, ov: Partial<Deps> = {}, p: Pedido | null = pedido()) => {
  const m = montar(ov, p);
  m.deps.pagbank = (caminho, init) => { m.chamadas.push({ caminho, init }); return Promise.resolve(pagoCartao(st)); };
  return m;
};

Deno.test("cartão: PAID = 200 pago; trava, cobra com valor do banco/store:false/3DS/split e troca a trava pelo ORDE_", async () => {
  const acoes: (string | undefined)[] = [];
  const m = cartaoDeps("PAID", { captcha: (_t, _ip, a) => { acoes.push(a); return Promise.resolve(true); } });
  const r = await handler(reqC(), m.deps);
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { ok: true, status: "pago" });
  assertEquals(acoes, ["pagbank_cartao"]);
  assertEquals(m.ev.filter(e => !e.startsWith("lim:")), ["trava", "troca:ORDE_C1"]);
  assertEquals(m.ev.filter(e => e.startsWith("lim:")), [`lim:pagbank-cartao-pedido:${OID.slice(0, 12)}:5`, "lim:pagbank-3ds:" + TDS.slice(0, 12) + ":1"]); // sem IP identificado: sem limite por IP
  const ci = cartaoDeps("PAID"); await handler(reqC(undefined, COM_IP), ci.deps);
  assert(ci.ev.includes("lim:pagbank-cartao-ip:1.2.3.4:30"));
  const c = m.chamadas[0].init.body.charges[0];
  assertEquals(c.amount.value, 11000);
  assertEquals(c.payment_method, {
    type: "CREDIT_CARD", installments: 1, capture: true, soft_descriptor: "EVOKAA",
    card: { encrypted: ENC, store: false }, holder: { name: "ANA SILVA", tax_id: "52998224725" },
    authentication_method: { type: "THREEDS", id: TDS },
  });
  assertEquals(c.splits.receivers.map((x: any) => x.amount.value), [1000, 10000]);
  const pix = montar(); await handler(req(), pix.deps);
  assertEquals(m.chamadas[0].init.body.items, pix.chamadas[0].init.body.items);
  assertEquals(m.chamadas[0].init.body.notification_urls, pix.chamadas[0].init.body.notification_urls);
});

Deno.test("cartão: chave = pedido+3DS+cpf (sem cartão cifrado e sem telefone); Pix segue igual", async () => {
  const chave = async (c: unknown, fone = "11999999999") => {
    const m = cartaoDeps("PAID");
    await handler(req({ order_id: OID, captcha_token: "t", customer: { tax_id: "529.982.247-25", phone: fone }, cartao: c }), m.deps);
    return m.chamadas[0].init.idempotencia;
  };
  const a = await chave(cartao()), b = await chave(cartao({ encrypted: "B".repeat(340) + "==" }), "21988887777"), c = await chave(cartao({ three_ds_id: "3DS_" + "f".repeat(36) }));
  assertEquals(a, b); assert(a !== c);
  let acao: string | undefined = "x";
  const p = montar({ captcha: (_t, _ip, a) => { acao = a; return Promise.resolve(true); } });
  assertEquals((await handler(req(), p.deps)).status, 200);
  assertEquals(acao, "pagbank_checkout");
  assertEquals(p.chamadas[0].init.body.charges[0].payment_method.type, "PIX");
  assertEquals(p.ev.filter(e => e === "trava" || e.startsWith("lim:pagbank-3ds")).length, 0); // Pix não trava nem usa limite do cartão
});

Deno.test("cartão: status em lista fechada; recusa/desconhecido = 402, sem trocar e soltando a trava", async () => {
  for (const s of ["IN_ANALYSIS", "WAITING", "AUTHORIZED"]) {
    const m = cartaoDeps(s);
    const r = await handler(reqC(), m.deps);
    assertEquals(r.status, 200); assertEquals(await r.json(), { ok: true, status: "processando" });
    assert(m.ev.includes("troca:ORDE_C1"));
  }
  for (const s of ["DECLINED", "CANCELED", "NOVO_STATUS"]) {
    const m = cartaoDeps(s);
    const r = await handler(reqC(), m.deps);
    assertEquals(r.status, 402);
    assertEquals((await r.json()).error, "Cartão recusado pelo banco. Confira os dados ou tente outro cartão.");
    assert(m.ev.includes("destrava") && !m.ev.some(e => e.startsWith("troca")), s);
  }
});

Deno.test("cartão: trava negada (0 linhas) = 409 sem chamar o PagBank; 3DS reusado = 409; tabela do 3DS falhando = 503", async () => {
  const a = montar({ trava: () => Promise.resolve(false) });
  const ra = await handler(reqC(), a.deps);
  assertEquals(ra.status, 409); assertEquals((await ra.json()).error, "Já existe um pagamento em andamento para este pedido."); assertEquals(a.chamadas.length, 0);
  const lim = (st: number) => (_r: Request, pre: string) => Promise.resolve(pre === "pagbank-3ds:" ? new Response("{}", { status: st }) : null);
  const b = montar({ limitarChave: lim(429) });
  const rb = await handler(reqC(), b.deps);
  assertEquals(rb.status, 409); assertEquals((await rb.json()).error, "A verificação do cartão já foi usada. Tente de novo."); assertEquals(b.chamadas.length, 0);
  const c = montar({ limitarChave: lim(500) });
  assertEquals((await handler(reqC(), c.deps)).status, 503); assertEquals(c.chamadas.length, 0);
});

Deno.test("cartão: limite por pedido ou por IP estourado devolve 429 antes de cobrar", async () => {
  for (const alvo of ["pagbank-cartao-pedido:", "pagbank-cartao-ip:"]) {
    const m = montar({ limitarChave: (_r, pre) => Promise.resolve(pre === alvo ? new Response("{}", { status: 429 }) : null) });
    assertEquals((await handler(reqC(undefined, COM_IP), m.deps)).status, 429); assertEquals(m.chamadas.length, 0);
  }
});

Deno.test("cartão: falha definitiva (3DS, idempotência, outro 4xx) solta a trava; incerta (5xx, rede, resposta ilegível) mantém e alerta", async () => {
  const falha = (e: unknown) => montar({ pagbank: () => Promise.reject(e) });
  const a = falha(new PagbankErro(400, "PagBank POST /orders -> 400 code=40002 param=authentication_method.id"));
  const ra = await handler(reqC(), a.deps);
  assertEquals(ra.status, 409); assertEquals((await ra.json()).error, "A verificação do cartão não confere com o valor do pedido. Tente de novo."); assert(a.ev.includes("destrava"));
  const b = falha(new PagbankErro(409, "code=IDEMPOTENCY_CONFLICT"));
  const rb = await handler(reqC(), b.deps);
  assertEquals(rb.status, 409); assert(!(await rb.text()).includes("IDEMPOTENCY")); assert(b.ev.includes("destrava"));
  const c = falha(new PagbankErro(400, "code=40002 param=outro"));
  assertEquals((await handler(reqC(), c.deps)).status, 502); assert(c.ev.includes("destrava"));
  const alertas: string[] = [];
  const orig = console.error; console.error = (...x: unknown[]) => { alertas.push(x.map(String).join(" ")); };
  try {
    const incertos = [
      falha(new PagbankErro(500, "x")), falha(new PagbankErro(504, "timeout")), falha(new Error("rede")),
      montar({ pagbank: () => Promise.resolve({ id: "ORDE_1", reference_id: OID, charges: [] }) }),
      montar({ pagbank: () => Promise.resolve({ id: "ORDE_1", reference_id: "outro", charges: [{ status: "PAID" }] }) }),
    ];
    for (const m of incertos) {
      const r = await handler(reqC(), m.deps);
      assertEquals(r.status, 502);
      assertEquals((await r.json()).error, "Não conseguimos confirmar o pagamento. Aguarde alguns minutos e confira Meus ingressos antes de tentar de novo.");
      assert(!m.ev.includes("destrava") && !m.ev.some(e => e.startsWith("troca")));
    }
  } finally { console.error = orig; }
  assertEquals(alertas.filter(l => l.includes("ALERTA_PAGBANK") && l.includes("pedido=") && !l.includes(OID)).length, 5);
});

Deno.test("cartão: troca da trava perdida: se o pedido já está com o mesmo ORDE_ segue; se é outro, cancela a cobrança e alerta", async () => {
  const igual = cartaoDeps("PAID", { trocar: () => Promise.resolve(false), carregar: () => Promise.resolve(pedido({ gateway_payment_id: "ORDE_C1" })) });
  igual.deps.carregar = (() => { let n = 0; return () => Promise.resolve(++n === 1 ? pedido() : pedido({ gateway_payment_id: "ORDE_C1" })); })();
  assertEquals((await handler(reqC(), igual.deps)).status, 200);
  assertEquals(igual.chamadas.length, 1);
  let n = 0;
  const outro = cartaoDeps("PAID", { trocar: () => Promise.resolve(false), carregar: () => Promise.resolve(++n === 1 ? pedido() : pedido({ gateway_payment_id: "ORDE_BEEF-0001" })) });
  const orig = console.error; const logs: string[] = []; console.error = (...x: unknown[]) => { logs.push(x.join(" ")); };
  let r: Response;
  try { r = await handler(reqC(), outro.deps); } finally { console.error = orig; }
  assertEquals(r.status, 409);
  assertEquals(outro.chamadas.map(c => c.caminho), ["/orders", "/charges/CHAR_1/cancel"]);
  assert(logs.some(l => l.includes("ALERTA_PAGBANK")));
});

Deno.test("trava do cartão ou valor não-ORDE_: Pix e cartão respondem 409 sem consultar o PagBank", async () => {
  for (const q of [req, reqC]) {
    for (const gid of [`CARTAO-${OID}`, "qualquer-coisa"]) {
      const m = montar({}, pedido({ gateway_payment_id: gid }));
      const r = await handler(q(), m.deps);
      assertEquals(r.status, 409); assertEquals((await r.json()).error, "Já existe um pagamento em andamento para este pedido."); assertEquals(m.chamadas.length, 0);
    }
  }
  // Pix em pedido que já tem cobrança de cartão (ORDE_ gravado): 409, não 502
  const pix = montar({ pagbank: () => Promise.resolve(pagoCartao()) }, pedido({ gateway_payment_id: "ORDE_C1" }));
  assertEquals((await handler(req(), pix.deps)).status, 409);
  // cartão em pedido com Pix gravado: 409
  const c = montar({ pagbank: () => Promise.resolve(pagbankOk()) }, pedido({ gateway_payment_id: "ORDE_1" }));
  assertEquals((await handler(reqC(), c.deps)).status, 409);
  // cartão já gravado: devolve o status
  const ja = montar({ pagbank: () => Promise.resolve(pagoCartao()) }, pedido({ gateway_payment_id: "ORDE_C1" }));
  assertEquals((await handler(reqC(), ja.deps)).status, 200);
});

Deno.test("cartão: validações de entrada", async () => {
  const ruins = [
    cartao({ encrypted: "A".repeat(199) }), cartao({ encrypted: "A".repeat(601) }), cartao({ encrypted: "A".repeat(300) + "!!" }),
    cartao({ encrypted: 5 }), cartao({ three_ds_id: "3DS_curto" }), cartao({ three_ds_id: "XXX_" + "0".repeat(36) }),
    cartao({ holder_name: "A" }), cartao({ holder_name: "A".repeat(61) }), cartao({ holder_name: "  " }), cartao({ holder_name: 7 }),
    cartao({ holder_name: "Ana <script>" }), cartao({ holder_name: "Ana 123" }), null, "x",
  ];
  for (const c of ruins) {
    const m = montar();
    assertEquals((await handler(reqC(c), m.deps)).status, 400, JSON.stringify(c).slice(0, 60)); assertEquals(m.chamadas.length, 0);
  }
  for (const nome of ["José D'Ávila-Souza Jr.", "  Ana Silva  "]) assertEquals((await handler(reqC(cartao({ holder_name: nome })), cartaoDeps("PAID").deps)).status, 200, nome);
  assertEquals((await handler(req({ order_id: OID, captcha_token: "t", customer: { tax_id: "111.111.111-11" }, cartao: cartao() }), montar().deps)).status, 400);
});

Deno.test("cartão: pedido de outro usuário, vencido e captcha ruim", async () => {
  assertEquals((await handler(reqC(), montar({}, pedido({ user_id: "outro" })).deps)).status, 404);
  const v = montar({}, pedido({ reservado_ate: "2026-10-08T11:59:00Z" }));
  assertEquals((await handler(reqC(), v.deps)).status, 409); assertEquals(v.chamadas.length, 0);
  assertEquals((await handler(reqC(), montar({ captcha: () => Promise.resolve(false) }).deps)).status, 400);
});

Deno.test("cartão: nenhum log nem resposta contém o cartão cifrado ou o 3DS, mesmo com erro que os ecoa", async () => {
  const logs: string[] = [];
  const orig = console.error; console.error = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
  try {
    const eco = `code=${ENC.slice(0, 60)} param=${TDS} value=${ENC} id=${TDS} body={"encrypted":"${ENC}","id":"${TDS}"}`;
    const falhas = [
      new PagbankErro(500, eco), new PagbankErro(400, `${eco} code=40002 param=authentication_method.id`), new PagbankErro(409, `${eco} code=IDEMPOTENCY_CONFLICT`),
      new PagbankErro(422, eco), new Error(eco), new TypeError(eco),
    ];
    for (const e of falhas) {
      const r = await handler(reqC(), montar({ pagbank: () => Promise.reject(e) }).deps);
      const t = await r.text();
      assert(!t.includes(ENC.slice(0, 30)) && !t.includes(TDS));
    }
    // erro fora do POST (carregar) também
    await handler(reqC(), montar({ carregar: () => Promise.reject(new Error(eco)) }).deps);
    await handler(reqC(), cartaoDeps("DECLINED").deps);
  } finally { console.error = orig; }
  const todo = logs.join("\n");
  assert(logs.length > 0);
  assert(!todo.includes(ENC.slice(0, 20)) && !todo.includes(TDS) && !todo.includes(TDS.slice(4, 24)));
});

Deno.test("cartão: troca perdida com a leitura do pedido falhando = sem cancelar nada, alerta e resposta normal", async () => {
  let n = 0;
  const m = cartaoDeps("PAID", { trocar: () => Promise.resolve(false), carregar: () => ++n === 1 ? Promise.resolve(pedido()) : Promise.reject(new Error("banco fora")) });
  const orig = console.error; const logs: string[] = []; console.error = (...x: unknown[]) => { logs.push(x.join(" ")); };
  let r: Response;
  try { r = await handler(reqC(), m.deps); } finally { console.error = orig; }
  assertEquals(r.status, 200); assertEquals(await r.json(), { ok: true, status: "pago" });
  assertEquals(m.chamadas.map(c => c.caminho), ["/orders"]);
  assert(logs.some(l => l.includes("ALERTA_PAGBANK")));
});

Deno.test("cartão: ORDE_ gravado que virou DECLINED libera o pedido e a próxima tentativa passa; PAID segue 'pago'", async () => {
  const m = montar({ pagbank: () => Promise.resolve(pagoCartao("DECLINED")) }, pedido({ gateway_payment_id: "ORDE_C1" }));
  const r = await handler(reqC(), m.deps);
  assertEquals(r.status, 402);
  assertEquals((await r.json()).error, "Cartão recusado pelo banco. Confira os dados ou tente outro cartão.");
  assert(m.ev.includes("libera:ORDE_C1"));
  for (const s of ["CANCELED", "OUTRO"]) {
    const x = montar({ pagbank: () => Promise.resolve(pagoCartao(s)) }, pedido({ gateway_payment_id: "ORDE_C1" }));
    assertEquals((await handler(reqC(), x.deps)).status, 402); assert(x.ev.includes("libera:ORDE_C1"), s);
  }
  // pedido liberado (gateway_payment_id nulo): nova tentativa cobra normalmente
  const nova = cartaoDeps("PAID");
  assertEquals((await handler(reqC(), nova.deps)).status, 200);
  const pago = montar({ pagbank: () => Promise.resolve(pagoCartao("PAID")) }, pedido({ gateway_payment_id: "ORDE_C1" }));
  const rp = await handler(reqC(), pago.deps);
  assertEquals(rp.status, 200); assertEquals(await rp.json(), { ok: true, status: "pago" });
  assert(!pago.ev.some(e => e.startsWith("libera")));
  const proc = montar({ pagbank: () => Promise.resolve(pagoCartao("IN_ANALYSIS")) }, pedido({ gateway_payment_id: "ORDE_C1" }));
  assertEquals((await handler(reqC(), proc.deps)).status, 200); assert(!proc.ev.some(e => e.startsWith("libera")));
});

Deno.test("cartão: 5xx no POST e depois QUALQUER erro na retentativa (até 4xx) = incerto, mantém a trava", async () => {
  const orig = console.error; console.error = () => {};
  try {
    for (const segundo of [new PagbankErro(400, "code=40002 param=x"), new PagbankErro(409, "code=IDEMPOTENCY_CONFLICT"), new PagbankErro(500, "x"), new Error("rede")]) {
      let n = 0;
      const m = montar({ pagbank: () => Promise.reject(++n === 1 ? new PagbankErro(500, "x") : segundo) });
      const r = await handler(reqC(), m.deps);
      assertEquals(r.status, 502);
      assertEquals((await r.json()).error, "Não conseguimos confirmar o pagamento. Aguarde alguns minutos e confira Meus ingressos antes de tentar de novo.");
      assertEquals(n, 2); assert(!m.ev.includes("destrava"));
    }
  } finally { console.error = orig; }
});
