// ponytail: taxa fixa no código e calculada no navegador (Decisão 88; platform_settings não tem a linha) — na F2 a venda passa ao servidor, que vira a fonte única do preço e da taxa.
export const TAXA_PERCENTUAL = 10
export const TAXA_MINIMA = 3

// Conta em centavos inteiros: 3 × 19,90 em ponto flutuante dá 59,6999…
function taxaCentavos(c: number): number {
  return c <= 0 ? 0 : Math.max(Math.round((c * TAXA_PERCENTUAL) / 100), TAXA_MINIMA * 100)
}

function centavos(preco: number): number {
  return Math.max(Math.round((Number(preco) || 0) * 100), 0)
}

export function calcularTaxa(preco: number): { preco: number; taxa: number; total: number } {
  const c = centavos(preco)
  const t = taxaCentavos(c)
  return { preco: c / 100, taxa: t / 100, total: (c + t) / 100 }
}

export function resumoCarrinho(itens: { preco: number; qtd: number }[]): { subtotal: number; taxa: number; total: number } {
  let sub = 0
  let tax = 0
  for (const { preco, qtd } of itens) {
    const c = centavos(preco)
    const q = Number(qtd) || 0
    sub += c * q
    tax += taxaCentavos(c) * q
  }
  return { subtotal: sub / 100, taxa: tax / 100, total: (sub + tax) / 100 }
}

export function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
