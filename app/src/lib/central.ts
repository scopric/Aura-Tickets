import { janelaDoPeriodo, type VendasPagas } from './vendasPagas'
import { forma as nomeForma } from './bordero'
import { toCsv } from './exportCsv'
import type { Periodo } from './inicioProdutor'

// Central de comando: contas puras (janela anterior, deltas, séries por dia, CSV). Sem rede, para testar sem banco.
const DIA = 86400000
const BRT = 3 * 3600000 // Brasília sem horário de verão (desde 2019): UTC-3, igual ao banco (por_dia em America/Sao_Paulo)
const DIAS: Record<Exclude<Periodo, 'tudo'>, number> = { hoje: 1, '7d': 7, '30d': 30 }

/** Dia AAAA-MM-DD em Brasília */
export const diaBr = (ms: number) => new Date(ms - BRT).toISOString().slice(0, 10)
/** Hora cheia (0 a 23) em Brasília */
export const horaBr = (ms: number) => new Date(ms - BRT).getUTCHours()

/**
 * Janela [de, ate) anterior, do mesmo tamanho do trecho já decorrido do período atual e alinhada por dia
 * (hoje 15h x ontem 0h a 15h). 'tudo' não tem anterior (null).
 */
export function janelaAnterior(p: Periodo, agora = Date.now()): { de: string; ate: string } | null {
  if (p === 'tudo') return null
  const de = Date.parse(janelaDoPeriodo(p, agora).de!)
  const ini = de - DIAS[p] * DIA
  return { de: new Date(ini).toISOString(), ate: new Date(ini + (agora - de)).toISOString() }
}

/** Variação (0,12 = +12%). Anterior zero não tem base de comparação: null (a tela diz "sem base", nunca "infinito") */
export const delta = (atual: number, anterior: number | null | undefined): number | null =>
  anterior ? (atual - anterior) / anterior : null

/** "+12%", "−5%", "0%" (menos tipográfico) */
export function textoDelta(d: number | null): string {
  if (d == null) return 'sem período anterior para comparar'
  const p = Math.round(Math.abs(d) * 100)
  return p === 0 ? '0%' : `${d > 0 ? '+' : '−'}${p}%`
}

/** n dias seguidos a partir de um dia AAAA-MM-DD */
export function diasA(inicio: string, n: number): string[] {
  const t0 = Date.parse(inicio)
  return Array.from({ length: n }, (_, i) => new Date(t0 + i * DIA).toISOString().slice(0, 10))
}

/** Dias do período atual até hoje (Brasília). 'tudo' começa no primeiro dia com venda */
export function diasDoPeriodo(p: Periodo, agora: number, porDia: VendasPagas['por_dia']): string[] {
  const hoje = diaBr(agora)
  const ini = p === 'tudo' ? porDia[0]?.dia ?? hoje : diaBr(agora - (DIAS[p] - 1) * DIA)
  return diasA(ini, Math.round((Date.parse(hoje) - Date.parse(ini)) / DIA) + 1)
}

/** Valor por dia, zero nos dias sem venda */
export const porDiaEm = (porDia: VendasPagas['por_dia'], dias: string[], campo: 'total' | 'pedidos' = 'total'): number[] =>
  dias.map(d => Number(porDia.find(x => x.dia === d)?.[campo]) || 0)

/** Total e pedidos; com forma, os dessa forma de pagamento (a RPC só quebra por forma, não filtra) */
export function totais(v: VendasPagas, forma: string | null): { total: number; pedidos: number } {
  if (!forma) return { total: Number(v.total) || 0, pedidos: Number(v.pedidos) || 0 }
  const f = v.por_forma.find(x => x.forma === forma)
  return { total: Number(f?.total) || 0, pedidos: Number(f?.pedidos) || 0 }
}

/** Entradas por hora cheia (24 posições) a partir dos instantes de check-in */
export function entradasPorHora(isos: string[]): number[] {
  const h = Array<number>(24).fill(0)
  for (const iso of isos) { const t = Date.parse(iso); if (!Number.isNaN(t)) h[horaBr(t)]++ }
  return h
}

const virgula = (n: number) => (Number(n) || 0).toFixed(2).replace('.', ',')

/** CSV do período: total, por dia, por evento e por forma (valor bruto, vírgula decimal, mesmo padrão do Financeiro) */
export function csvCentral(v: VendasPagas): string {
  const linhas: Record<string, unknown>[] = [
    { secao: 'Total', item: 'Vendas pagas (bruto)', pedidos: v.pedidos, valor_bruto: virgula(v.total) },
    ...v.por_dia.map(d => ({ secao: 'Por dia', item: d.dia.split('-').reverse().join('/'), pedidos: d.pedidos, valor_bruto: virgula(d.total) })),
    ...v.por_evento.map(e => ({ secao: 'Por evento', item: e.titulo, pedidos: e.pedidos, valor_bruto: virgula(e.total) })),
    ...v.por_forma.map(f => ({ secao: 'Por forma de pagamento', item: nomeForma(f.forma || null), pedidos: f.pedidos, valor_bruto: virgula(f.total) })),
  ]
  return toCsv(linhas, ['secao', 'item', 'pedidos', 'valor_bruto'])
}
