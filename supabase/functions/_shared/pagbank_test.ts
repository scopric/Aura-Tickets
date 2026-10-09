import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { chaveIdempotencia, calcularExpiracao, calcularLiberacao, mascarar, montarSplit, pagbankFetch, PagbankErro, reaisParaCentavos, validarCpf } from "./pagbank.ts";

const A = "ACCO_" + "0123456789ABCDEF0123456789ABCDEF0123".slice(0, 36);
const B = "ACCO_" + "FEDCBA9876543210FEDCBA9876543210FEDC".slice(0, 36);

Deno.test("validarCpf: válido, inválido, repetido, tipo errado", () => {
  assert(validarCpf("529.982.247-25"));
  assert(validarCpf("52998224725"));
  assert(!validarCpf("52998224726"));
  assert(!validarCpf("11111111111"));
  assert(!validarCpf("123"));
  assert(!validarCpf(52998224725));
  assert(!validarCpf(null));
});

Deno.test("reaisParaCentavos: arredonda e rejeita lixo", () => {
  assertEquals(reaisParaCentavos(12.34), 1234);
  assertEquals(reaisParaCentavos("0.1"), 10);
  assertEquals(reaisParaCentavos(1.005), 101);
  assertEquals(reaisParaCentavos(19.999), 2000);
  assertEquals(reaisParaCentavos(0), 0);
  for (const v of [-1, NaN, null, undefined, "abc"]) assert(Number.isNaN(reaisParaCentavos(v as never)));
});

Deno.test("montarSplit: soma exata = total (centavos ímpares incluídos)", () => {
  for (const [total, taxa] of [[10000, 1000], [9999, 1001], [1, 0], [333, 111], [10001, 3333], [500, 499]]) {
    const s = montarSplit({ totalCentavos: total, taxaCentavos: taxa, plataformaId: A, produtorId: B, liberarEm: "x" });
    if (taxa === 0) { assertEquals(s, null); continue; }
    assertEquals(s!.receivers.reduce((n, r) => n + r.amount.value, 0), total);
    assertEquals(s!.receivers[0].amount.value, taxa);
    assertEquals(s!.receivers[0].configurations.custody.apply, false);
    assertEquals(s!.receivers[1].configurations.custody.apply, true);
  }
});

Deno.test("montarSplit: sem split quando não dá para dividir", () => {
  const base = { totalCentavos: 10000, taxaCentavos: 1000, plataformaId: A, produtorId: B, liberarEm: "x" };
  assertEquals(montarSplit({ ...base, produtorId: A }), null); // mesmo ID
  assertEquals(montarSplit({ ...base, produtorId: null }), null);
  assertEquals(montarSplit({ ...base, produtorId: "ACCO_curto" }), null);
  assertEquals(montarSplit({ ...base, taxaCentavos: 10000 }), null);
  assertEquals(montarSplit({ ...base, taxaCentavos: 10.5 }), null);
});

Deno.test("calcularExpiracao: reservado_ate - 15 s, segundos inteiros, sem relógio", () => {
  assertEquals(calcularExpiracao(new Date("2026-10-08T12:10:00Z")), "2026-10-08T12:09:45Z");
  const r = new Date("2026-10-08T12:05:00.999Z");
  assert(new Date(calcularExpiracao(r)) <= r);
});

Deno.test("calcularLiberacao: fim do evento + dias, teto de 364 dias a partir da base (reservado_ate)", () => {
  const base = new Date("2026-10-08T12:10:00Z");
  assertEquals(calcularLiberacao(new Date("2026-12-07T23:14:41Z"), 7, base), "2026-12-14T20:14:41.000-03:00");
  const teto = calcularLiberacao(new Date("2030-01-01T00:00:00Z"), 7, base);
  assert(new Date(teto).getTime() <= base.getTime() + 364 * 86_400_000);
});

Deno.test("chaveIdempotencia: HMAC estável, sem CPF, muda com CPF/telefone/segredo", async () => {
  const k = await chaveIdempotencia("O1", "52998224725", "11999999999", "seg");
  assertEquals(k, await chaveIdempotencia("O1", "52998224725", "11999999999", "seg"));
  assert(/^[\w-]+$/.test(await chaveIdempotencia("5b1f1a6c-0000-4000-8000-000000000001", "52998224725", "", "seg"))); // padrão do PagBank: sem ":"
  assert(!k.includes("52998224725") && /^O1-[0-9a-f]{12}$/.test(k));
  assert(k !== await chaveIdempotencia("O1", "11144477735", "11999999999", "seg"));
  assert(k !== await chaveIdempotencia("O1", "52998224725", "", "seg"));
  assert(k !== await chaveIdempotencia("O1", "52998224725", "11999999999", "outro"));
  await chaveIdempotencia("O1", "1", "", "").then(() => assert(false), () => {});
});

Deno.test("mascarar: token, Bearer, ACCO, CPF e e-mail somem", () => {
  const m = mascarar(`Bearer abc123 token=SEGREDO12345 ${A} cpf 52998224725 529.982.247-25 12.345.678/0001-95 tel 11999999999 a@b.com`, "SEGREDO12345");
  for (const proibido of ["abc123", "SEGREDO12345", A, "52998224725", "529.982.247-25", "12.345.678/0001-95", "11999999999", "a@b.com"]) assert(!m.includes(proibido), proibido);
});

Deno.test("pagbankFetch: erro não vaza corpo; timeout vira 504; sucesso devolve JSON", async () => {
  const cfg = { baseUrl: "https://x.test/", token: "TOKEN-SECRETO" };
  const ruim = (() => Promise.resolve(new Response('{"error_messages":[{"code":"40002","parameter_name":"customer.tax_id","description":"cpf 52998224725 Ana"}]}', { status: 400 }))) as unknown as typeof fetch;
  const e = await pagbankFetch(cfg, "/orders", { method: "POST", body: {} }, ruim).catch(x => x);
  assert(e instanceof PagbankErro && e.status === 400 && !e.message.includes("52998224725") && !e.message.includes("Ana"));
  assert(e.message.includes("40002") && e.message.includes("customer.tax_id"));
  const lento = ((_u: string, i: RequestInit) => new Promise((_, rej) => i.signal!.addEventListener("abort", () => rej(new Error("abort"))))) as unknown as typeof fetch;
  const t = await pagbankFetch(cfg, "/orders", { method: "GET" }, lento, 20).catch(x => x);
  assert(t instanceof PagbankErro && t.status === 504);
  let visto: Headers | undefined;
  const ok = ((u: string, i: RequestInit) => { visto = new Headers(i.headers); assertEquals(u, "https://x.test/orders"); return Promise.resolve(new Response('{"id":"ORDE_1"}')); }) as unknown as typeof fetch;
  assertEquals((await pagbankFetch(cfg, "/orders", { method: "POST", body: {}, idempotencia: "k" }, ok)).id, "ORDE_1");
  assertEquals(visto!.get("authorization"), "Bearer TOKEN-SECRETO");
  assertEquals(visto!.get("x-api-version"), "1.0");
});
