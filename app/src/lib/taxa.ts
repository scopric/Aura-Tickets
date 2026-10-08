// ponytail: taxa fixa no código e calculada no navegador (Decisão 88; platform_settings não tem a linha) — na F2 a venda passa ao servidor, que vira a fonte única do preço e da taxa.
export const TAXA_PERCENTUAL = 10
export const TAXA_MINIMA = 3

// Conta em centavos inteiros: 3 × 19,90 em ponto flutuante dá 59,6999…
// Meia (Decisão do Ricardo, 08/10/2026): 10% sobre o preço da meia, sem o mínimo de R$ 3 (espelho de evk_taxa_centavos)
function taxaCentavos(c: number, meia = false): number {
  const t = Math.round((c * TAXA_PERCENTUAL) / 100)
  return c <= 0 ? 0 : meia ? t : Math.max(t, TAXA_MINIMA * 100)
}

function centavos(preco: number): number {
  return Math.max(Math.round((Number(preco) || 0) * 100), 0)
}

export function calcularTaxa(preco: number, meia = false): { preco: number; taxa: number; total: number } {
  const c = centavos(preco)
  const t = taxaCentavos(c, meia)
  return { preco: c / 100, taxa: t / 100, total: (c + t) / 100 }
}

export function resumoCarrinho(itens: { preco: number; qtd: number; meia?: boolean }[]): { subtotal: number; taxa: number; total: number } {
  let sub = 0
  let tax = 0
  for (const { preco, qtd, meia } of itens) {
    const c = centavos(preco)
    const q = Number(qtd) || 0
    sub += c * q
    tax += taxaCentavos(c, meia) * q
  }
  return { subtotal: sub / 100, taxa: tax / 100, total: (sub + tax) / 100 }
}

export function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Valor gravado no pedido; zero é "Gratuito" (como textoPreco) (nunca um "0" solto)
export const brlOuGratis = (v: number | null | undefined): string => (Number(v) > 0 ? brl(Number(v)) : 'Gratuito')

// "R$ 50,00 + taxa R$ 5,00 = R$ 55,00" (Decreto 13.108, art. 7º: preço, taxa e total discriminados)
export function textoPreco(preco: number, qtd = 1, meia = false): string {
  const r = resumoCarrinho([{ preco, qtd, meia }])
  return r.subtotal > 0 ? `${brl(r.subtotal)} + taxa ${brl(r.taxa)} = ${brl(r.total)}` : 'Gratuito'
}
