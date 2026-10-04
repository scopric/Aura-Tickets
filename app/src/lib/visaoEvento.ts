// Contas da Visão geral do evento (V7): datas na hora de Brasília e a série "vendas por dia até o evento".
// ponytail: fuso fixo America/Sao_Paulo, o mesmo critério de lib/eventoProdutor.ts.
const FUSO = 'America/Sao_Paulo'
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }) // AAAA-MM-DD

/** Dia (AAAA-MM-DD) de um instante, na hora de Brasília */
export const diaBR = (d: string | number | Date): string => formato.format(new Date(d))

/** Dias entre duas datas AAAA-MM-DD (negativo se `b` vem antes) */
export const diasEntre = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

/** "12 dez" */
export const dataCurta = (dia: string): string => `${+dia.slice(8, 10)} ${MES[+dia.slice(5, 7) - 1]}`

/** "sáb, 12 dez" */
export const dataComSemana = (dia: string): string => `${SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()]}, ${dataCurta(dia)}`

/** "22h" ou "22h30" a partir de "22:00" ou "22:30:00"; null se não houver hora legível */
export function horaCurta(time?: string | null): string | null {
  const m = time?.match(/^(\d{1,2}):(\d{2})/)
  return m ? `${+m[1]}h${m[2] === '00' ? '' : m[2]}` : null
}

/** Dia do evento (AAAA-MM-DD). Só `date`: start_date de evento criado pelo começo rápido ou pelo Evo é a hora da criação, não a do evento */
export const diaDoEvento = (e: { date?: string | null }): string | null => e.date || null

export const diaMais = (dia: string, n: number): string => new Date(Date.parse(dia) + n * 86400000).toISOString().slice(0, 10)

/** Começo da série: o 1º ingresso ou a abertura de venda mais cedo (nunca antes de 120 dias do fim, se não houver venda
 *  anterior a isso). Sem nenhum dos dois, o próprio fim. */
export function inicioDaSerie(ingressos: { created_at: string }[], aberturas: (string | null)[], fim: string): string {
  const limite = diaMais(fim, -120)
  const vendas = ingressos.map(t => diaBR(t.created_at))
  const abertura = aberturas.filter((a): a is string => !!a).map(a => diaBR(a)).map(d => (d < limite ? limite : d))
  const inicio = [...vendas, ...abertura].reduce((a, b) => (b < a ? b : a), fim)
  return inicio > fim ? fim : inicio
}

export interface Serie {
  /** dias do começo ao fim (AAAA-MM-DD) */
  dias: string[]
  /** [dia][tipo]: ingressos vendidos */
  porDia: number[][]
}

/** Ingressos por dia e por tipo (venda depois do fim cai no último dia) */
export function serieDiaria(
  ingressos: { ticket_type_id: string; created_at: string }[],
  tipos: string[],
  inicio: string,
  fim: string,
): Serie {
  const n = Math.max(diasEntre(inicio, fim), 0) + 1
  const porDia = Array.from({ length: n }, () => tipos.map(() => 0))
  for (const t of ingressos) {
    const col = tipos.indexOf(t.ticket_type_id)
    if (col >= 0) porDia[Math.min(Math.max(diasEntre(inicio, diaBR(t.created_at)), 0), n - 1)][col]++
  }
  return { dias: Array.from({ length: n }, (_, i) => diaMais(inicio, i)), porDia }
}

export interface Coluna {
  /** índices do 1º e do último dia da coluna em `dias` */
  de: number
  ate: number
  porTipo: number[]
}

/** Junta a série em colunas de `passo` dias, contando do fim (a última coluna termina no dia do evento) */
export function colunas(serie: Serie, passo: number): Coluna[] {
  const n = serie.dias.length
  const total = Math.ceil(n / passo)
  return Array.from({ length: total }, (_, b) => {
    const de = Math.max(n - (total - b) * passo, 0)
    const ate = n - 1 - (total - 1 - b) * passo
    const porTipo = serie.porDia[0].map((_, c) => serie.porDia.slice(de, ate + 1).reduce((s, d) => s + d[c], 0))
    return { de, ate, porTipo }
  })
}
