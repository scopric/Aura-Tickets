import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { blocoLogoProdutor, emailShell } from "./email.ts";
import { montarConviteEquipe } from "./conviteEquipe.ts";
import { gerarPdf, ingressosParaPdf } from "./ingressoPdf.ts";
import { emailIngresso, partesDaData, resumoDosTipos } from "./emailIngresso.ts";

const textoVisivel = (html: string) => html.replace(/<[^>]+>/g, " ");

Deno.test("molde do e-mail: paleta da marca, sem roxo, sem sombra e sem exclamação", () => {
  const html = emailShell("Seus ingressos estão em anexo", "Olá, Ana.", "<p>corpo</p>", "Ver meus ingressos", "https://app.evokaa.com.br/app/tickets");
  assert(html.includes("#1d68c4"));
  assert(html.includes('<a href="mailto:contato@evokaa.com.br" style="color: #1d68c4;">'), "link do rodapé na cor da marca");
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

Deno.test("PDF do ingresso: o QR é o link do evento, sem código de entrada", async () => {
  const order = { customer_name: "Ana", events: { id: "11111111-2222-3333-4444-555555555555", title: "Show", date: "2026-12-15", time: "20:00", venue_name: "Casa" } };
  const qr = "9f1c2e3a-0000-4000-8000-abcdefabcdef";
  const [pagina] = ingressosParaPdf(order, [{ status: "active", qr_code: qr, id: "id-do-ingresso", buyer_name: "Ana", ticket_types: { name: "Pista" } }]);
  assertEquals(pagina.link, "https://app.evokaa.com.br/app/tickets?evento=11111111-2222-3333-4444-555555555555&qr=1");
  assertFalse(JSON.stringify(pagina).includes(qr));
  const texto = await textoDoPdf(await gerarPdf([pagina]));
  const maiusc = (t: string) => hex(t).toUpperCase(); // pdf-lib grava o hexadecimal em maiúsculas
  assert(texto.includes(maiusc("Abra no celular: o QR de entrada aparece lá e muda a cada 30 segundos.")));
  assertFalse(texto.includes(maiusc("Apresente")) || texto.includes(maiusc(qr)));
  // sem id do evento, cai na lista de ingressos
  assertEquals(ingressosParaPdf({ events: {} }, [{ status: "active" }])[0].link, "https://app.evokaa.com.br/app/tickets");
});

Deno.test("logo do produtor no e-mail: só entra com URL, escapada, e sem URL o e-mail sai como antes", () => {
  assertEquals(blocoLogoProdutor(null), "");
  assertEquals(blocoLogoProdutor(undefined), "");
  assertEquals(blocoLogoProdutor(""), "");
  const html = blocoLogoProdutor("https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/u/abcdefgh.png");
  assert(html.includes('<img src="https://rwaezeqyuhxrssntcxdv.supabase.co/'));
  assert(html.includes('alt="Logo do organizador"'));
  assert(html.includes("max-height: 48px"));
  // medidas reais: 300x80 cabe em 180x48; atributos width/height para o Outlook
  const m = blocoLogoProdutor("https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/u/abcdefgh.png", { w: 300, h: 80 });
  assert(m.includes('width="180" height="48"'));
  assert(blocoLogoProdutor("https://x/a.png", { w: 100, h: 20 }).includes('width="100" height="20"')); // nunca amplia
  // defesa em profundidade: mesmo uma URL fora do padrão não escapa do atributo
  assert(!blocoLogoProdutor('x" onerror="alert(1)').includes('" onerror="'));
});

Deno.test("e-mail do ingresso: logo da Evokaa, cores da marca, sem exclamação, sem azul/roxo antigos", () => {
  const html = emailIngresso({ nome: "Ana", evento: "Noite de Forró", data: "2026-10-16", hora: "22:00", local: "Casa Torres", tipos: ["Pista", "Pista", "Camarote"], ctaHref: "https://app.evokaa.com.br/app/tickets" });
  assert(html.includes("https://app.evokaa.com.br/images/logo-evokaa-sm.png"));
  assert(html.includes('alt="Evokaa"'));
  assert(html.includes("#0c2340") && html.includes("#1d68c4"));
  assertFalse(/#8f33f5|#4a60e3/i.test(html)); // o violeta fica só na logo
  assertFalse(/#581C87|#7E22CE|#0C0A09|box-shadow|gradient/i.test(html));
  assertFalse(textoVisivel(html).includes("!"));
  assert(html.includes("2 × Pista · 1 × Camarote"));
  assert(html.includes("Seus ingressos estão prontos") && html.includes("Ingressos (3)"));
  assert(html.includes("O PDF vai em anexo neste e-mail, uma página por ingresso") && !html.includes("Os PDFs")); // o anexo é UM arquivo
  assert(html.includes("Sexta-feira, às 22:00") && html.includes(">16<"));
  assertFalse(html.includes("Organizado por")); // sem logo do produtor, o bloco some
});

Deno.test("e-mail do ingresso: um ingresso fica no singular, com logo do produtor e sem data", () => {
  const html = emailIngresso({ nome: "Ana", evento: "Show", data: null, hora: "", local: "Local a definir", tipos: ["Pista"], ctaHref: "https://x/y",
    logo: { url: "https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/u/abcdefgh.png", w: 300, h: 80 } });
  assert(html.includes("Seu ingresso está pronto") && html.includes("Organizado por") && html.includes("logos-produtor"));
  assert(html.includes("a definir"));
  assertFalse(textoVisivel(html).includes("!"));
});

Deno.test("e-mail do ingresso: tudo que vem de fora é escapado", () => {
  const html = emailIngresso({ nome: '<img src=x onerror=alert(1)>', evento: '"><script>x</script>', data: "2026-10-16", hora: "", local: "<b>Local</b>", tipos: ["<i>Pista</i>"], ctaHref: 'https://x/"onmouseover="y' });
  assertFalse(/<script|<img src=x|<b>Local|<i>Pista|"onmouseover/.test(html));
});

Deno.test("e-mail do ingresso: partes da data e resumo dos tipos", () => {
  assertEquals(partesDaData("2026-10-16"), { ano: 2026, mes: "out", dia: 16, semana: "sexta-feira" });
  assertEquals(partesDaData("2026-13-40"), null);
  assertEquals(partesDaData("2026-02-31"), null); // dia que não existe
  assertEquals(partesDaData("2028-02-29")?.dia, 29); // bissexto vale
  assertEquals(partesDaData(null), null);
  assertEquals(resumoDosTipos(["B", "A", "B"]), "2 × B · 1 × A");
});
