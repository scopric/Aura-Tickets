import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { emailShell } from "./email.ts";
import { montarConviteEquipe } from "./conviteEquipe.ts";
import { gerarPdf, ingressosParaPdf } from "./ingressoPdf.ts";

const textoVisivel = (html: string) => html.replace(/<[^>]+>/g, " ");

Deno.test("molde do e-mail: paleta da marca, sem roxo, sem sombra e sem exclamação", () => {
  const html = emailShell("Seus ingressos estão em anexo", "Olá, Ana.", "<p>corpo</p>", "Ver meus ingressos", "https://app.evokaa.com.br/app/tickets");
  assert(html.includes("#1d68c4"));
  assertFalse(/#581C87|#7E22CE|#0C0A09|box-shadow|gradient/i.test(html));
  assertFalse(textoVisivel(html).includes("!"));
  assertFalse(textoVisivel(montarConviteEquipe("Produtora X", "editor", "https://app.evokaa.com.br").html).includes("!"));
});

Deno.test("código-fonte das funções de borda: nenhum resquício da paleta antiga", async () => {
  const raiz = new URL("../", import.meta.url);
  const achados: string[] = [];
  async function varrer(dir: URL) {
    for await (const e of Deno.readDir(dir)) {
      const u = new URL(e.name + (e.isDirectory ? "/" : ""), dir);
      if (e.isDirectory) await varrer(u);
      else if (e.name.endsWith(".ts") && !e.name.endsWith("_test.ts") && /#581C87|#7E22CE|#0C0A09|#4a60e3|\bplum\b|colors\.void/i.test(await Deno.readTextFile(u))) achados.push(u.pathname);
    }
  }
  await varrer(raiz);
  assertEquals(achados, []);
});

// Texto das páginas do PDF: os fluxos vêm comprimidos (deflate), então descomprime cada um antes de procurar.
async function textoDoPdf(pdf: Uint8Array): Promise<string> {
  const bruto = Array.from(pdf, (b) => String.fromCharCode(b)).join(""); // 1 byte = 1 caractere (o "latin1" do TextDecoder é windows-1252 e estraga o deflate)
  let saida = "";
  for (const m of bruto.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const bytes = Uint8Array.from(m[1], (c) => c.charCodeAt(0));
    try {
      saida += new TextDecoder("latin1").decode(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());
    } catch { /* fluxo que não é texto (fonte, imagem) */ }
  }
  return saida;
}

// pdf-lib grava o texto em hexadecimal: <5049535441> Tj
const hex = (t: string) => `<${Array.from(t, (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("")}>`;

Deno.test("PDF do ingresso: horário sem segundos e o código só dentro do QR", async () => {
  const order = { customer_name: "Ana", events: { title: "Show", date: "2026-12-15", time: "20:00:00", venue_name: "Casa" } };
  const [pagina] = ingressosParaPdf(order, [{ status: "active", qr_code: "TESTE-ABC123", buyer_name: "Ana", ticket_types: { name: "Pista" } }]);
  assertEquals(pagina.hora, "20h");
  const texto = await textoDoPdf(await gerarPdf([pagina]));
  assert(texto.includes(hex("20h")), "o horário tem de aparecer no PDF");
  assertFalse(texto.includes(hex("20:00:00")) || texto.includes(hex("20:00")));
  assert(texto.includes(hex("Pista".toUpperCase())), "o texto do PDF é legível pelo teste");
  assertFalse(texto.includes(hex("TESTE-ABC123")));
});
