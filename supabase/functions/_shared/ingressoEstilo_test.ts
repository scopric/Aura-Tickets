import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { ESTILO_PADRAO, estiloDoEvento, estiloValido, rgbDeHex, textoSobre } from "./ingressoEstilo.ts";
import { gerarPdf, type IngressoPdf } from "./ingressoPdf.ts";

Deno.test("estiloValido: aceita o formato do banco e normaliza a cor", () => {
  assertEquals(estiloValido({ cor: "#A55C65", logo: "centro" }), { cor: "#a55c65", logo: "centro" });
  assertEquals(estiloValido({}), ESTILO_PADRAO);
  assertEquals(estiloValido({ cor: " #FFFFFF " }).cor, "#ffffff");
});

Deno.test("estiloValido: o que não é reconhecido vira o padrão", () => {
  for (const ruim of [null, undefined, "x", 5, [], { cor: "vermelho" }, { cor: "#fff" }, { cor: 5 }, { cor: "#a55c6" }, { cor: "javascript:1" }]) {
    assertEquals(estiloValido(ruim).cor, null);
  }
  assertEquals(estiloValido({ logo: "direita" }).logo, "esquerda");
  assertEquals(estiloValido({ logo: null }).logo, "esquerda");
});

Deno.test("estiloDoEvento: lê a coluna da linha do evento e ignora texto livre que apareça nela", () => {
  assertEquals(estiloDoEvento({ ticket_style: { cor: "#1d68c4", rodape: "www.golpe.com" } }), { cor: "#1d68c4", logo: "esquerda" });
  assertEquals(estiloDoEvento(null), ESTILO_PADRAO);
});

Deno.test("textoSobre: claro sobre cor escura, escuro sobre cor clara", () => {
  assertEquals(textoSobre("#0c2340"), "claro");
  assertEquals(textoSobre("#1d68c4"), "claro");
  assertEquals(textoSobre("#f5e663"), "escuro");
  assertEquals(textoSobre("#ffffff"), "escuro");
  // meio-tom (nenhum chega a 4,5:1): vence o de maior contraste
  assertEquals(textoSobre("#7a7a7a"), "claro");
  assertEquals(textoSobre("#a0a0a0"), "escuro");
});

Deno.test("rgbDeHex", () => assertEquals(rgbDeHex("#ff0000"), [1, 0, 0]));

const ingresso: IngressoPdf = { evento: "Noite de Forró com Banda Sertão Vivo e convidados especiais", data: "12 de dezembro de 2026", hora: "22h", local: "Espaço Torres", tipo: "Pista", portador: "Ana Souza", codigo: "EVK-TESTE-1" };
// PNG 1x1 válido
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

Deno.test("gerarPdf: gera com estilo, com e sem logo, nas duas posições", async () => {
  for (const estilo of [undefined, ESTILO_PADRAO, { cor: "#f5e663", logo: "centro" as const }, { cor: "#a55c65", logo: "esquerda" as const }]) {
    for (const logo of [null, { bytes: png, ext: "png" as const }]) {
      const bytes = await gerarPdf([ingresso, ingresso], logo, estilo);
      assertEquals(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
    }
  }
});
