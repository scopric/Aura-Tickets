// Máscara do resumo que vai para o log (ai_usage.resumo). Função pura: roda na Edge Function
// (supabase/functions/agent) e no vitest (app/src/test/mascara.test.ts).
// ponytail: regex, não detector de dados pessoais; qualquer sequência de 8+ dígitos vira
// [número] (inclusive data AAAA-MM-DD e CEP), preferindo esconder demais a vazar.
export function resumir(s: string) {
  return s
    .replace(/[^\s@<>()]+@[^\s@]+\.[^\s@]+/g, '[email]') // \w não pega acento (joão@...)
    // (?<!\d)/(?!\d): não morder o meio de um número maior (cartão, CNPJ), que cai no [número]
    .replace(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, '[cpf]')
    .replace(/(?<!\d)(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}(?!\d)/g, '[telefone]')
    // 8+ dígitos com até 3 separadores quaisquer entre eles (não letras): CPF com espaços, CNPJ,
    // RG, cartão com espaço duplo, "123. 456. 789-09", "123,456,789-09"
    .replace(/\d(?:[^\p{L}\d\n]{0,3}\d){7,}/gu, '[número]')
    .slice(0, 200)
}
