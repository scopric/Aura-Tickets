import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { emailCertificado } from "./emailCertificado.ts";

const COD = "3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f";
const base = { nome: "Ana Beatriz", evento: "Workshop de Design", data: "2026-12-12", organizador: "Produtora X", horas: "8", codigo: COD, ctaHref: `https://app.evokaa.com.br/certificado/${COD}` };
const visivel = (h: string) => h.replace(/<[^>]+>/g, " ");

Deno.test("e-mail do certificado: logo da Evokaa, marinho e azul royal, sem violeta, sem exclamação", () => {
  const h = emailCertificado(base);
  assert(h.includes("https://app.evokaa.com.br/images/logo-evokaa-sm.png") && h.includes('alt="Evokaa"'));
  assert(h.includes("#0c2340") && h.includes("#1d68c4"));
  assertFalse(/#8f33f5|#4a60e3|#581C87|#7E22CE|box-shadow|gradient/i.test(h));
  assertFalse(visivel(h).includes("!"));
  assert(h.includes("Seu certificado está pronto") && h.includes("Certificado emitido"));
  assert(h.includes(`href="https://app.evokaa.com.br/certificado/${COD}"`) && h.includes("Ver meu certificado"));
  assert(h.includes(COD) && h.includes("Produtora X") && h.includes("8 h") && h.includes(">12<") && h.includes("dez 2026"));
  assertFalse(h.includes("Organizado por")); // sem logo do organizador, o bloco some
});

Deno.test("e-mail do certificado: logo do organizador, sem data, sem horas e sem organizador", () => {
  const h = emailCertificado({ ...base, data: null, horas: null, organizador: null,
    logo: { url: "https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/u/abcdefgh.png", w: 300, h: 80 } });
  assert(h.includes("Organizado por") && h.includes("logos-produtor") && h.includes('width="180" height="48"'));
  assert(h.includes("a definir"));
  assertFalse(h.includes("Carga horária") || h.includes(">Organizador<"));
  assertFalse(visivel(h).includes("!"));
});

Deno.test("e-mail do certificado: tudo que vem de fora é escapado", () => {
  const h = emailCertificado({ ...base, nome: "<img src=x onerror=alert(1)>", evento: '"><script>x</script>', organizador: "<b>Org</b>", codigo: "<i>c</i>", ctaHref: 'https://x/"onmouseover="y' });
  assertFalse(/<script|<img src=x|<b>Org|<i>c|"onmouseover/.test(h));
});

Deno.test("e-mail do certificado: horas inválidas nem entram (a regra é do chamador) e o resto segue", () => {
  assertEquals(emailCertificado({ ...base, horas: null }).includes("Carga horária"), false);
});
