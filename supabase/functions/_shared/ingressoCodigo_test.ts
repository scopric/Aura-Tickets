import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { createHmac } from "node:crypto";
import { chaveDoIngresso, codigoDaJanela, janelaDe, lerQr, listaDeCodigos, prefixoDoQr, verificar } from "./ingressoCodigo.ts";

const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres-ok";
const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const T0 = Date.UTC(2026, 9, 8, 21, 0, 0); // instante fixo

Deno.test("derivação bate com uma implementação independente (node:crypto)", async () => {
  const chave = await chaveDoIngresso(SEGREDO, ID, 0);
  const esperada = createHmac("sha256", SEGREDO).update(`evk1|${ID}|0`).digest();
  assertEquals(Array.from(chave), Array.from(esperada));
  const w = janelaDe(T0);
  const h = createHmac("sha256", esperada).update(String(w)).digest();
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let n = 0n;
  for (let i = 0; i < 5; i++) n = (n << 8n) | BigInt(h[i]);
  let esperado = "";
  for (let i = 7; i >= 0; i--) esperado += B32[Number((n >> BigInt(i * 5)) & 31n)];
  assertEquals(await codigoDaJanela(chave, w), esperado);
});

Deno.test("código tem 8 caracteres base32, é estável e muda com janela, ingresso e transferência", async () => {
  const c = await chaveDoIngresso(SEGREDO, ID, 0);
  const w = janelaDe(T0);
  const a = await codigoDaJanela(c, w);
  assert(/^[A-Z2-7]{8}$/.test(a));
  assertEquals(await codigoDaJanela(c, w), a);
  assert((await codigoDaJanela(c, w + 1)) !== a);
  assert((await codigoDaJanela(await chaveDoIngresso(SEGREDO, "3f2504e0-4f89-41d3-9a0c-0305e82c3302", 0), w)) !== a);
  assert((await codigoDaJanela(await chaveDoIngresso(SEGREDO, ID, 1), w)) !== a);
  assert((await codigoDaJanela(await chaveDoIngresso(SEGREDO + "x", ID, 0), w)) !== a);
});

Deno.test("verificar: janela atual e ±1 valem; ±2 não", async () => {
  const c = await chaveDoIngresso(SEGREDO, ID, 0);
  const w = janelaDe(T0);
  for (const d of [-1, 0, 1]) assert(await verificar(SEGREDO, ID, 0, await codigoDaJanela(c, w + d), T0), `janela ${d}`);
  for (const d of [-2, 2, 10]) assert(!(await verificar(SEGREDO, ID, 0, await codigoDaJanela(c, w + d), T0)), `janela ${d}`);
});

Deno.test("verificar: aceita minúsculas e recusa adulterado, de outro ingresso e após transferência", async () => {
  const c = await chaveDoIngresso(SEGREDO, ID, 0);
  const cod = await codigoDaJanela(c, janelaDe(T0));
  assert(await verificar(SEGREDO, ID, 0, cod.toLowerCase(), T0));
  const errado = (cod[0] === "A" ? "B" : "A") + cod.slice(1);
  assert(!(await verificar(SEGREDO, ID, 0, errado, T0)));
  assert(!(await verificar(SEGREDO, ID, 0, "", T0)));
  assert(!(await verificar(SEGREDO, "3f2504e0-4f89-41d3-9a0c-0305e82c3302", 0, cod, T0)));
  assert(!(await verificar(SEGREDO, ID, 1, cod, T0))); // ingresso transferido: a lista antiga morre
});

Deno.test("segredo curto ou ingresso inválido falham alto", async () => {
  await assertRejects(() => chaveDoIngresso("curto", ID, 0));
  await assertRejects(() => chaveDoIngresso("", ID, 0));
  await assertRejects(() => chaveDoIngresso(SEGREDO, "nao-e-uuid", 0));
  await assertRejects(() => chaveDoIngresso(SEGREDO, ID, -1));
  await assertRejects(() => chaveDoIngresso(SEGREDO, ID, 1.5));
});

Deno.test("lista: janelas seguidas, 12 h = 1.440 códigos, primeira bate com a janela do instante", async () => {
  const c = await chaveDoIngresso(SEGREDO, ID, 0);
  const { primeiraJanela, codigos } = await listaDeCodigos(c, T0, 1440);
  assertEquals(primeiraJanela, janelaDe(T0));
  assertEquals(codigos.length, 1440);
  assertEquals(codigos[0], await codigoDaJanela(c, primeiraJanela));
  assertEquals(codigos[1439], await codigoDaJanela(c, primeiraJanela + 1439));
  assertEquals(new Set(codigos).size, 1440); // sem repetição na prática (40 bits)
});

Deno.test("QR: monta e lê E1.<id>.<código>; recusa formatos errados", async () => {
  const cod = await codigoDaJanela(await chaveDoIngresso(SEGREDO, ID, 0), janelaDe(T0));
  const qr = prefixoDoQr(ID) + cod;
  assertEquals(qr.length, 44);
  assertEquals(lerQr(qr), { ticketId: ID, codigo: cod });
  assertEquals(lerQr(qr.toLowerCase())?.codigo, cod); // minúsculas na leitora
  assertEquals(lerQr(` ${qr} `)?.ticketId, ID);
  for (const ruim of [ID, "", "E2." + qr.slice(3), qr.slice(0, -1), qr + "A", "E1." + "g".repeat(32) + ".ABCDEFGH", "E1." + ID.replaceAll("-", "") + ".ABCDEF18", null, 5, "x".repeat(200)]) {
    assertEquals(lerQr(ruim), null, String(ruim));
  }
});

Deno.test("verificar: entradas que não são texto não derrubam; transfer_count nulo vale 0", async () => {
  const cod = await codigoDaJanela(await chaveDoIngresso(SEGREDO, ID, 0), janelaDe(T0));
  assertEquals(await verificar(SEGREDO, ID, 0, undefined, T0), false);
  assertEquals(await verificar(SEGREDO, ID, 0, null, T0), false);
  assertEquals(await verificar(SEGREDO, ID, 0, 12345678, T0), false);
  assert(await verificar(SEGREDO, ID, null, cod, T0)); // coluna sem NOT NULL
});

Deno.test("lerQr: aceita espaço e quebra de linha em volta (leitoras costumam mandar CR/LF)", async () => {
  const qr = prefixoDoQr(ID) + (await codigoDaJanela(await chaveDoIngresso(SEGREDO, ID, 0), janelaDe(T0)));
  assertEquals(lerQr("\r\n" + " ".repeat(30) + qr + "\r\n")?.ticketId, ID);
});
