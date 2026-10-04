// Explorar (V11b): as contas do catálogo. Dia no fuso de São Paulo, grupos por dia, cidades e categorias que existem
// de verdade nos eventos publicados, filtros e o preço "a partir de". Sem dependência (além do rótulo do formato).
import { calcularTaxa } from './taxa'
import { dataCurta, diaMais } from './visaoEvento'
import { CLASSIFICACOES, ESTILOS, rotuloFormato } from './tipoEvento'

export interface TipoIngresso { price: number | string; is_active?: boolean | null; sale_end?: string | null }

export interface EventoCatalogo {
  id: string
  title: string
  date?: string | null
  time?: string | null
  category?: string | null
  venue_name?: string | null
  venue_city?: string | null
  description?: string | null
  short_description?: string | null
  cover_image?: string | null
  image_url?: string | null
  accent_color?: string | null
  featured_carousel?: boolean | null
  estilos?: string[] | null
  classificacao?: string | null
  ticket_types?: TipoIngresso[] | null
}

export interface Filtros {
  cidade: string | null // chave da cidade (chaveDe)
  quando: '' | 'hoje' | 'amanha' | 'fds' | 'mes'
  categoria: string | null // chave da categoria
  estilo: string | null // slug em events.estilos
  gratis: boolean
  busca: string
}

export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const chaveDe = (s: string) => semAcento(s.trim()).replace(/\s+/g, ' ')

// ---- Datas (a coluna `date` do evento é o dia no relógio do local, sem fuso; "hoje" é o de São Paulo) --------------
const partes = (iso: string) => iso.split('-').map(Number) as [number, number, number]
const utc = (iso: string) => { const [a, m, d] = partes(iso); return new Date(Date.UTC(a, m - 1, d)) }

const SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const SEM_EXT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MES_EXT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export interface RotuloDia {
  sem: string // "Hoje", "Amanhã" ou "Sáb" (ladrilho)
  dia: string // "03"
  curto: string // "Sáb · 12 dez" (selo do destaque); "Hoje" e "Amanhã" quando for o caso
  cabecalho: string // "Hoje, sábado, 3 de outubro" (título do grupo, lido por leitor de tela)
  mes: string // chave do mês, para saber quando abrir um cabeçalho de mês novo
  mesNome: string // "outubro" (com o ano quando não é o ano de hoje)
  hoje: boolean
}

export function rotuloDia(data: string, hoje: string): RotuloDia {
  const [a, m, d] = partes(data)
  const w = utc(data).getUTCDay()
  const ehHoje = data === hoje
  const amanha = data === diaMais(hoje, 1)
  const quando = ehHoje ? 'Hoje' : amanha ? 'Amanhã' : ''
  return {
    sem: quando || SEM[w],
    dia: String(d).padStart(2, '0'),
    curto: quando || `${SEM[w]} · ${dataCurta(data)}`,
    cabecalho: `${quando ? quando + ', ' : ''}${SEM_EXT[w]}, ${d} de ${MES_EXT[m - 1]}`,
    mes: `${a}-${m}`,
    mesNome: MES_EXT[m - 1] + (a !== partes(hoje)[0] ? ` de ${a}` : ''),
    hoje: ehHoje,
  }
}

// Sábado e domingo da semana: de segunda a sexta, os próximos; no sábado, hoje e amanhã; no domingo, só hoje
export function fimDeSemana(hoje: string): string[] {
  const w = utc(hoje).getUTCDay()
  if (w === 0) return [hoje]
  if (w === 6) return [hoje, diaMais(hoje, 1)]
  const sab = diaMais(hoje, 6 - w)
  return [sab, diaMais(sab, 1)]
}

// Atalho de data como endereço (/events/hoje): slug da URL <-> chave do filtro
export const QUANDO_SLUG = { hoje: 'hoje', amanha: 'amanha', fds: 'fim-de-semana', mes: 'este-mes' } as const
export const quandoDoSlug = (slug?: string): Filtros['quando'] =>
  (Object.keys(QUANDO_SLUG) as (keyof typeof QUANDO_SLUG)[]).find(k => QUANDO_SLUG[k] === slug) ?? ''

// Dias do atalho ('mes' é conferido em passa(), pelo prefixo AAAA-MM)
const diasDe = (q: Filtros['quando'], hoje: string): string[] =>
  q === 'hoje' ? [hoje] : q === 'amanha' ? [diaMais(hoje, 1)] : q === 'fds' ? fimDeSemana(hoje) : []

// ---- Cidades e categorias: só as que os eventos publicados têm ---------------------------------------------------
export interface Opcao { chave: string; nome: string; qtd: number }

function contar(valores: (string | null | undefined)[]): Opcao[] {
  const mapa = new Map<string, Opcao>()
  for (const v of valores) {
    const nome = v?.trim()
    if (!nome) continue
    const chave = chaveDe(nome)
    const o = mapa.get(chave)
    if (o) o.qtd++
    else mapa.set(chave, { chave, nome, qtd: 1 })
  }
  return [...mapa.values()].sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export const cidadesDoCatalogo = (eventos: EventoCatalogo[]) => contar(eventos.map(e => e.venue_city))

// A categoria é o formato (slug em events.category; texto antigo passa como está): o chip mostra o rótulo.
export const categoriasDoCatalogo = (eventos: EventoCatalogo[]) => contar(eventos.map(e => rotuloFormato(e.category)))

// Estilos musicais que os eventos publicados têm (rótulo do vocabulário; slug desconhecido fica de fora)
export function estilosDoCatalogo(eventos: EventoCatalogo[]): Opcao[] {
  const qtd = new Map<string, number>()
  for (const e of eventos) for (const s of new Set(e.estilos ?? [])) qtd.set(s, (qtd.get(s) ?? 0) + 1)
  return ESTILOS.filter(x => qtd.has(x.valor)).map(x => ({ chave: x.valor, nome: x.rotulo, qtd: qtd.get(x.valor)! }))
    .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export const rotuloClassificacao = (c?: string | null) => CLASSIFICACOES.find(x => x.valor === c)?.rotulo ?? null

// ---- Filtro ---------------------------------------------------------------------------------------------------------
const texto = (e: EventoCatalogo) =>
  semAcento([e.title, e.venue_name, e.venue_city, rotuloFormato(e.category), e.short_description, e.description].filter(Boolean).join(' '))

// `ignorar` tira um filtro da conta (para dizer, no vazio, qual deles esvaziou a lista)
export function passa(e: EventoCatalogo, f: Filtros, hoje: string, ignorar?: keyof Filtros): boolean {
  if (ignorar !== 'cidade' && f.cidade && chaveDe(e.venue_city ?? '') !== f.cidade) return false
  if (ignorar !== 'categoria' && f.categoria && chaveDe(rotuloFormato(e.category)) !== f.categoria) return false
  if (ignorar !== 'quando' && f.quando) {
    if (!e.date) return false
    if (f.quando === 'mes' ? e.date.slice(0, 7) !== hoje.slice(0, 7) : !diasDe(f.quando, hoje).includes(e.date)) return false
  }
  if (ignorar !== 'estilo' && f.estilo && !e.estilos?.includes(f.estilo)) return false
  if (ignorar !== 'gratis' && f.gratis && aPartirDe(e) !== 0) return false
  if (ignorar !== 'busca') {
    const palavras = semAcento(f.busca).split(/\s+/).filter(Boolean)
    if (palavras.length) {
      const t = texto(e)
      if (!palavras.every(p => t.includes(p))) return false
    }
  }
  return true
}

// ---- Agrupar por dia -------------------------------------------------------------------------------------------------
export interface GrupoDia { data: string; rotulo: RotuloDia; novoMes: boolean; eventos: EventoCatalogo[] }

// Só entra evento com data (a lista é por dia); data e depois hora
export const ordenarPorData = (eventos: EventoCatalogo[]) =>
  eventos.filter(e => e.date).sort((a, b) => a.date!.localeCompare(b.date!) || (a.time ?? '').localeCompare(b.time ?? ''))

// `eventos` já vem de ordenarPorData
export function agruparPorDia(eventos: EventoCatalogo[], hoje: string): GrupoDia[] {
  const grupos: GrupoDia[] = []
  for (const e of eventos) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.data === e.date) { ultimo.eventos.push(e); continue }
    const rotulo = rotuloDia(e.date!, hoje)
    grupos.push({ data: e.date!, rotulo, novoMes: !ultimo || ultimo.rotulo.mes !== rotulo.mes, eventos: [e] })
  }
  return grupos
}

// ---- Preço "a partir de", já com a taxa (taxa.ts é a única regra) -------------------------------------------------------
// null = o evento não tem ingresso à venda cadastrado (não afirmamos preço); 0 = gratuito
export function aPartirDe(e: EventoCatalogo, agora = Date.now()): number | null {
  const abertos = (e.ticket_types ?? []).filter(t => t.is_active !== false && !(t.sale_end && new Date(t.sale_end).getTime() < agora))
  if (!abertos.length) return null
  const pagos = abertos.map(t => Number(t.price) || 0).filter(p => p > 0)
  return pagos.length ? calcularTaxa(Math.min(...pagos)).total : 0
}
