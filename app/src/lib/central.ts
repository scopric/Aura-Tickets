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
  if (d == null) return 'sem base para comparar'
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

/** Entradas por hora cheia de Brasília, em ordem e sem misturar dias: da primeira à última hora com entrada */
export function entradasPorHora(isos: string[]): { rotulos: string[]; valores: number[] } {
  const hs = isos.map(Date.parse).filter(t => !Number.isNaN(t)).map(t => Math.floor((t - BRT) / 3600000))
  if (!hs.length) return { rotulos: [], valores: [] }
  const ini = Math.min(...hs), fim = Math.max(...hs)
  const valores = Array<number>(fim - ini + 1).fill(0)
  for (const h of hs) valores[h - ini]++
  const varios = Math.floor(ini / 24) !== Math.floor(fim / 24)
  const rotulos = valores.map((_, i) => {
    const d = new Date((ini + i) * 3600000) // relógio de Brasília nos campos UTC
    return `${varios ? `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} ` : ''}${d.getUTCHours()}h`
  })
  return { rotulos, valores }
}

const virgula = (n: number) => (Number(n) || 0).toFixed(2).replace('.', ',')

/** CSV do período: total, por dia, por evento e por forma (valor bruto, vírgula decimal, mesmo padrão do Financeiro) */
export function csvCentral(v: VendasPagas, forma: string | null = null): string {
  if (forma) { // a RPC só quebra por forma: com filtro, o arquivo traz só o total daquela forma (nada de bruto geral rotulado como filtrado)
    const t = totais(v, forma)
    return toCsv([{ secao: 'Total', item: `Vendas pagas (bruto), ${nomeForma(forma)}`, pedidos: t.pedidos, valor_bruto: virgula(t.total) }], ['secao', 'item', 'pedidos', 'valor_bruto'])
  }
  const linhas: Record<string, unknown>[] = [
    { secao: 'Total', item: 'Vendas pagas (bruto)', pedidos: v.pedidos, valor_bruto: virgula(v.total) },
    ...v.por_dia.map(d => ({ secao: 'Por dia', item: d.dia.split('-').reverse().join('/'), pedidos: d.pedidos, valor_bruto: virgula(d.total) })),
    ...v.por_evento.map(e => ({ secao: 'Por evento', item: e.titulo, pedidos: e.pedidos, valor_bruto: virgula(e.total) })),
    ...v.por_forma.map(f => ({ secao: 'Por forma de pagamento', item: nomeForma(f.forma || null), pedidos: f.pedidos, valor_bruto: virgula(f.total) })),
  ]
  return toCsv(linhas, ['secao', 'item', 'pedidos', 'valor_bruto'])
}
