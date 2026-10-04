// Contas das calculadoras do produtor (preço e mesas), em funções puras.

export type Origem = 'markup' | 'margem' | 'preco'
export interface Preco { preco: number; markup: number | null; margem: number | null }

const r1 = (n: number) => Math.round(n * 10) / 10

// Parte do custo e de um dos três valores (o que o produtor digitou) e acha os outros dois.
// Aceita markup/margem negativos (venda no prejuízo); margem de 100% ou mais não existe.
export function precificar(custo: number, origem: Origem, valor: number): Preco | null {
  if (!(custo > 0) || !Number.isFinite(valor)) return null
  let preco: number
  if (origem === 'markup') {
    if (valor <= -100) return null
    preco = custo * (1 + valor / 100)
  } else if (origem === 'margem') {
    if (valor >= 100) return null
    preco = custo / (1 - valor / 100)
  } else {
    if (valor < 0) return null
    preco = valor
  }
  return {
    preco: Math.round(preco * 100) / 100,
    markup: r1(((preco - custo) / custo) * 100),
    margem: preco > 0 ? r1(((preco - custo) / preco) * 100) : null,
  }
}

export interface Projecao {
  receita: number; lucro: number; margem: number; ocupacao: number
  equilibrio: number; equilibrioAcimaDaCapacidade: boolean
}

// Ingressos e capacidade são inteiros; dinheiro fecha em centavos.
export function projetar(ingressos: number, preco: number, custos: number, capacidade: number): Projecao {
  const n = Math.max(Math.floor(ingressos) || 0, 0)
  const cap = Math.max(Math.floor(capacidade) || 0, 0)
  const pc = Math.max(Math.round((Number(preco) || 0) * 100), 0)
  const cc = Math.max(Math.round((Number(custos) || 0) * 100), 0)
  const rc = n * pc
  const equilibrio = pc > 0 ? Math.ceil(cc / pc) : 0
  return {
    receita: rc / 100,
    lucro: (rc - cc) / 100,
    margem: rc > 0 ? r1(((rc - cc) / rc) * 100) : 0,
    ocupacao: cap > 0 ? Math.round((n / cap) * 100) : 0,
    equilibrio,
    equilibrioAcimaDaCapacidade: cap > 0 && equilibrio > cap,
  }
}

export interface Mesa { capacity: number; pricePerSeat: number; filled: number; qty: number }

// Totais de várias mesas, cada linha valendo `qty` mesas iguais. Ocupados nunca passam dos lugares.
export function totaisMesas(mesas: Mesa[]) {
  let mesasN = 0, lugares = 0, ocupados = 0, receita = 0, maximo = 0
  for (const m of mesas) {
    const q = Math.max(Math.floor(m.qty) || 0, 0)
    const cap = Math.max(Math.floor(m.capacity) || 0, 0)
    const fil = Math.min(Math.max(Math.floor(m.filled) || 0, 0), cap)
    const pc = Math.max(Math.round((Number(m.pricePerSeat) || 0) * 100), 0)
    mesasN += q
    lugares += q * cap
    ocupados += q * fil
    receita += q * fil * pc
    maximo += q * cap * pc
  }
  return {
    mesas: mesasN, lugares, ocupados, receita: receita / 100, maximo: maximo / 100,
    ocupacao: lugares > 0 ? Math.round((ocupados / lugares) * 100) : 0,
  }
}
