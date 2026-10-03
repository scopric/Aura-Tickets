import type { DbEvent } from '../hooks/useEvents'
import { brl } from './taxa'

// Contas do Início da produtora (V5): períodos, séries por dia ou hora, variação e textos de data. Sem dependência.
// Tudo no horário do navegador (a produtora vê o dia dela).

export type Periodo = 'hoje' | '7d' | '30d' | 'tudo'
export const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'tudo', label: 'Tudo' },
]
export const ehPeriodo = (v: unknown): v is Periodo => PERIODOS.some(p => p.value === v)

// Vendido = ativo ou usado. Cancelado e reembolsado não contam; transferido também não, porque quem recebe
// fica com um ingresso ativo e o antigo (transferido) contaria a mesma venda duas vezes.
export const VENDIDO = ['active', 'used']

const HORA = 3600000
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// n baldes a partir de ini; passo = dias por balde (0 = uma hora)
export type Janela = { ini: number; n: number; passo: number }
export type Linha = { t: number; v: number }

const somaDias = (base: number, k: number) => { const d = new Date(base); d.setDate(d.getDate() + k); return d.getTime() }
const meiaNoite = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }

const inicioDoBalde = (j: Janela, k: number) => (j.passo === 0 ? j.ini + k * HORA : somaDias(j.ini, k * j.passo))

// Janela do período e a anterior, do mesmo tamanho e logo antes (null em "Tudo", que não tem anterior).
// primeira = data da venda mais antiga conhecida (só "Tudo" usa).
export function janelas(p: Periodo, agora: number, primeira?: number): { atual: Janela; anterior: Janela | null } {
  const hoje = meiaNoite(agora)
  if (p === 'hoje') return { atual: { ini: hoje, n: 24, passo: 0 }, anterior: { ini: somaDias(hoje, -1), n: 24, passo: 0 } }
  if (p === 'tudo') {
    const ini = meiaNoite(Math.min(primeira ?? agora, agora))
    const dias = Math.round((hoje - ini) / 86400000) + 1
    // ponytail: mais de 60 dias passa a baldes de semana; a conta de dias com mudança de horário só erra por 1 balde
    const passo = dias > 60 ? 7 : 1
    return { atual: { ini, n: Math.ceil(dias / passo), passo }, anterior: null }
  }
  const n = p === '7d' ? 7 : 30
  return { atual: { ini: somaDias(hoje, -(n - 1)), n, passo: 1 }, anterior: { ini: somaDias(hoje, -(2 * n - 1)), n, passo: 1 } }
}

const fimDaJanela = (j: Janela) => inicioDoBalde(j, j.n)

// Soma dentro da janela; `ate` (exclusivo) corta antes do fim, para comparar só o trecho que já aconteceu
export const total = (linhas: Linha[], j: Janela, ate = Infinity) => {
  const fim = Math.min(fimDaJanela(j), ate)
  return linhas.reduce((s, l) => (l.t >= j.ini && l.t < fim ? s + l.v : s), 0)
}

// Soma por balde. Com `ate`, os baldes que ainda não começaram ficam de fora (hoje não tem futuro).
export function serie(linhas: Linha[], j: Janela, ate = Infinity): number[] {
  const inicios: number[] = []
  for (let k = 0; k < j.n && inicioDoBalde(j, k) <= ate; k++) inicios.push(inicioDoBalde(j, k))
  const out = inicios.map(() => 0)
  const fim = fimDaJanela(j)
  for (const l of linhas) {
    if (l.t < j.ini || l.t >= fim || l.t > ate) continue
    let k = inicios.length - 1
    while (k > 0 && inicios[k] > l.t) k--
    out[k] += l.v
  }
  return out
}

// (atual − anterior) / anterior; null quando não há base de comparação
export const variacao = (atual: number, anterior: number | null) =>
  anterior != null && anterior > 0 ? (atual - anterior) / anterior : null

// A lista (da mais nova para a mais velha) foi cortada antes de chegar ao começo da janela? Então a soma dela é parcial.
const parcialEm = (linhas: Linha[], cortado: boolean, ini: number) => cortado && (linhas.length ? linhas[linhas.length - 1].t : Infinity) > ini

// Valor do período e variação sobre o anterior. A variação compara o mesmo trecho: com o período em curso (hoje, ou
// o dia de hoje nos 7 e 30 dias), o anterior só entra até o mesmo ponto; `ant` é o anterior inteiro (vazio ou não).
export function resumoDe(linhas: Linha[], cortado: boolean, atual: Janela, anterior: Janela | null, agora: number) {
  const valor = total(linhas, atual)
  const ant = anterior ? total(linhas, anterior) : null
  const parcial = parcialEm(linhas, cortado, atual.ini)
  const antParcial = !!anterior && parcialEm(linhas, cortado, anterior.ini)
  const mesmoTrecho = anterior ? total(linhas, anterior, agora - (atual.ini - anterior.ini)) : null
  return { valor, ant, parcial, variacao: parcial || antParcial ? null : variacao(valor, mesmoTrecho) }
}

export function rotuloDoBalde(j: Janela, k: number): string {
  const d = new Date(inicioDoBalde(j, k))
  return j.passo === 0 ? `${d.getHours()}h` : `${d.getDate()} ${MES[d.getMonth()]}`
}

// "sáb, 12 dez"
export const dataCurta = (d: Date) => `${SEMANA[d.getDay()]}, ${d.getDate()} ${MES[d.getMonth()]}`

// "Sáb, 3 de outubro" (título do Início)
export function dataPorExtenso(d: Date): string {
  const sem = SEMANA[d.getDay()]
  return `${sem[0].toUpperCase()}${sem.slice(1)}, ${d.getDate()} de ${d.toLocaleDateString('pt-BR', { month: 'long' })}`
}

// Data do evento: date (dia) ou, sem ela, o início
export const dataDoEvento = (e: { date: string | null; start_date: string }) =>
  e.date ? new Date(`${e.date}T00:00:00`) : new Date(e.start_date)

// "22h" ou "22h30" a partir de "22:00" ou "22:00:00"
export function horaCurta(t?: string | null): string | null {
  const m = t?.match(/^(\d{1,2}):(\d{2})/)
  return m ? `${+m[1]}h${m[2] === '00' ? '' : m[2]}` : null
}

// "em 70 dias", "amanhã", "hoje"
export function emQuantosDias(data: Date, agora: number): string {
  const n = Math.round((meiaNoite(data.getTime()) - meiaNoite(agora)) / 86400000)
  return n <= 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`
}

// "há 5 min", "há 3 h", "ontem, 19h", "28 set"
export function haQuanto(t: number, agora: number): string {
  const min = Math.floor((agora - t) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  if (t >= meiaNoite(agora)) return `há ${Math.floor(min / 60)} h`
  const d = new Date(t)
  if (t >= somaDias(meiaNoite(agora), -1)) return `ontem, ${d.getHours()}h`
  return `${d.getDate()} ${MES[d.getMonth()]}`
}

export const inteiro = (n: number) => Math.round(n).toLocaleString('pt-BR')
// Número que é piso, não valor exato (lista cortada em 1.000 linhas). Fica no módulo: a Contagem reanima se a função mudar.
const mais = (f: (n: number) => string) => (n: number) => `${f(n)}+`
export const brlMais = mais(brl)
export const inteiroMais = mais(inteiro)

// Lugares: do tipo de ingresso (quantity_total é a coluna real; capacity é legado) e do evento (soma dos tipos ou, sem tipos, a do evento)
export const capacidadeDoTipo = (t: { quantity_total?: number | null; capacity: number | null }) => t.quantity_total || t.capacity || 0
export const capacidadeDe = (e: DbEvent) => (e.ticket_types ?? []).reduce((s, t) => s + capacidadeDoTipo(t), 0) || e.capacity || 0
export const editarEvento = (e: { id: string }) => `/producer/events/${e.id}/edit`
