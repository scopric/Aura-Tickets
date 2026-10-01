import { useState, useEffect, useRef, useId } from 'react'
import {
  Users, Activity, Globe, Eye, BarChart3, Clock, Loader2, ExternalLink, RefreshCw,
  Monitor, Smartphone, Tablet, Tv, HelpCircle, MousePointerClick, Search, Link2, Radio, UserCheck, Info,
  X, ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
import gsap from 'gsap'

// `valor` é o valor cru que a API aceita como filtro (null = não filtrável, ex.: "Outros")
type ItemTop = { nome: string; valor?: string | null; visitantes: number; paginas: number }
type Totais = { visitantes: number; paginas: number; sessoes?: number }
type Campo = 'pais' | 'aparelho' | 'pagina' | 'origem'
export type FiltroAtivo = { campo: Campo; valor: string; rotulo: string }
type Periodo = '7d' | '30d' | 'all' | { de: string; ate: string }
// Mesmo formato nas duas funções (vercel-analytics e ga4-analytics); sessoes e agora só no GA4
interface Trafego {
  chave: string
  de?: string
  ate?: string
  totais: Totais
  comparacao?: { atual: Totais; anterior: Totais; dias: number } | null
  semComparacao?: 'periodo' | 'falha' | null
  porDia: { dia: string; visitantes: number; paginas: number }[]
  paginas: ItemTop[]
  origens: ItemTop[]
  paises: ItemTop[]
  aparelhos: ItemTop[]
  agora?: number | null
}

const MOTIVOS_VERCEL: Record<string, string> = {
  nao_autorizado: 'sua conta não tem a permissão de ver Analytics.',
  sem_chave: 'a chave da Vercel ainda não foi configurada no servidor.',
  token_invalido: 'a chave da Vercel venceu ou perdeu o acesso ao projeto. Crie uma nova e troque no Supabase.',
  limite: 'a Vercel limitou as consultas por alguns minutos. Tente de novo daqui a pouco.',
  vercel_erro: 'a Vercel não respondeu. Tente de novo em instantes.',
  entrada_invalida: 'período ou filtro inválido.',
  fora_da_janela: 'a Vercel guarda só os últimos 30 dias no plano atual. Escolha datas mais recentes.',
}

const MOTIVOS_GA4: Record<string, string> = {
  nao_autorizado: 'sua conta não tem a permissão de ver Analytics.',
  sem_chave: 'a credencial do Google ainda não foi configurada no servidor.',
  credencial_invalida: 'a credencial do Google foi apagada ou perdeu o acesso à propriedade do GA4.',
  limite: 'o Google limitou as consultas por alguns minutos. Tente de novo daqui a pouco.',
  google_erro: 'o Google não respondeu. Tente de novo em instantes.',
  entrada_invalida: 'período ou filtro inválido.',
  fora_da_janela: 'o Google Analytics só tem dados desde 27/09/2026. Escolha datas a partir daí.',
}

// Nomes que a Vercel e o Google devolvem vazios ou em inglês
const nomeOrigem = (n: string) => n || 'Acesso direto'
const nomeAparelho = (n: string) => ({ desktop: 'Computador', mobile: 'Celular', tablet: 'Tablet', 'smart tv': 'TV' } as Record<string, string>)[n] || n || 'Outro'
const nomePais = (n: string) => {
  if (!n) return 'Desconhecido'
  try {
    return new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(n) || n
  } catch {
    return n
  }
}

// Busca de uma fonte de tráfego (função do Supabase), só com a aba aberta; sem atualização automática
function useFonteTrafego(funcao: string, periodo: Periodo, filtros: FiltroAtivo[], ativo: boolean, motivos: Record<string, string>) {
  // chave em texto: período e filtros viram objetos novos a cada render; a busca só refaz quando o conteúdo muda
  const corpo = { periodo, filtros: filtros.map(f => ({ campo: f.campo, valor: f.valor })) }
  const chave = JSON.stringify(corpo)
  const [dados, setDados] = useState<Trafego | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [hora, setHora] = useState<Date | null>(null)
  const pedidoAtual = useRef(0)

  const carregar = async () => {
    const pedido = ++pedidoAtual.current
    setCarregando(true)
    setErro(null)
    const { data, error } = await supabase.functions.invoke(funcao, { body: corpo })
    if (pedido !== pedidoAtual.current) return // resposta de um período antigo
    if (error || !data?.ok) {
      setDados(null)
      setErro(motivos[data?.motivo] ?? 'não foi possível falar com o servidor.')
    } else {
      setDados({ ...data, chave })
      setHora(new Date())
    }
    setCarregando(false)
  }

  useEffect(() => {
    if (ativo) carregar()
  }, [ativo, chave])

  // números de outro período ou filtro não ficam na tela enquanto o novo carrega
  return { dados: dados?.chave === chave ? dados : null, erro, carregando, hora, carregar }
}

// Cores do gráfico validadas no dataviz/validate_palette.js (claro e escuro, daltonismo e contraste)
const COR_PAGINAS = '#7c3aed'
const COR_PESSOAS = '#0d9488'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
const diaLongo = (dia: string) => new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })

// Bandeira em emoji a partir do código ISO de 2 letras (mesmo padrão do PhoneInput); no Windows aparece como as letras
const bandeira = (iso: string) =>
  /^[A-Za-z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65)) : null

const iconeAparelho = (n: string) => {
  const Icone = ({ desktop: Monitor, mobile: Smartphone, tablet: Tablet, 'smart tv': Tv } as Record<string, typeof Monitor>)[n] ?? HelpCircle
  return <Icone className="w-4 h-4 text-muted-foreground" />
}
const iconeOrigem = (n: string) => {
  const Icone = !n ? MousePointerClick : /google|bing|duckduckgo|yahoo/i.test(n) ? Search : Link2
  return <Icone className="w-4 h-4 text-muted-foreground" />
}
const iconePais = (n: string) => {
  const b = bandeira(n)
  return b ? <span className="text-base leading-none" aria-hidden>{b}</span> : <Globe className="w-4 h-4 text-muted-foreground" />
}

// Variação contra o período anterior (dias completos); seta e texto, não só cor
function Variacao({ atual, anterior, dias }: { atual: number; anterior: number; dias: number }) {
  if (anterior === 0) return <div className="text-xs text-muted-foreground mt-1">{atual === 0 ? 'sem mudança' : 'novo no período'} · {dias} dias completos</div>
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  const contra = <span className="text-muted-foreground">vs {dias} {dias === 1 ? 'dia anterior' : 'dias anteriores'} (dias completos)</span>
  if (pct === 0) return <div className="text-xs mt-1 text-muted-foreground">estável {contra}</div>
  const sobe = atual > anterior
  const Seta = sobe ? ArrowUpRight : ArrowDownRight
  return (
    <div className={`text-xs mt-1 flex flex-wrap items-center gap-1 ${sobe ? 'text-emerald-600' : 'text-red-600'}`}>
      <Seta className="w-3.5 h-3.5" aria-hidden />
      <span>{sobe ? '+' : ''}{pct}%</span>
      {contra}
    </div>
  )
}

function Numero({ icone: Icone, rotulo, valor, apoio, destaque, variacao }: { icone: typeof Users; rotulo: string; valor: string; apoio?: string; destaque?: boolean; variacao?: React.ReactNode }) {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${destaque ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
          <Icone className="w-4 h-4" />
        </span>
        <span className="text-sm text-muted-foreground">{rotulo}</span>
      </div>
      <div className="font-serif text-3xl text-foreground mt-4 tabular-nums">{valor}</div>
      {apoio && <div className="text-xs text-muted-foreground mt-1">{apoio}</div>}
      {variacao}
    </div>
  )
}

function DicaGrafico({ active, payload, label, pessoas }: { active?: boolean; payload?: { payload: Trafego['porDia'][number] }[]; label?: string; pessoas: string }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="font-medium text-foreground mb-1 first-letter:uppercase">{diaLongo(label ?? '')}</div>
      <div className="flex items-center gap-2 text-foreground"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_PAGINAS }} />Páginas vistas <b className="ml-auto pl-3 tabular-nums">{fmtNum(d.paginas)}</b></div>
      <div className="flex items-center gap-2 text-foreground"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_PESSOAS }} />{pessoas} <b className="ml-auto pl-3 tabular-nums">{fmtNum(d.visitantes)}</b></div>
    </div>
  )
}

function GraficoDias({ dados, pessoas, nota }: { dados: Trafego; pessoas: string; nota: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{ background: COR_PAGINAS }} />Páginas vistas</span>
        <span className="flex items-center gap-2"><span className="w-3 h-0.5 rounded" style={{ background: COR_PESSOAS }} />{pessoas}</span>
      </div>
      <div className="h-64 -ml-2" role="img" aria-label={`Gráfico de páginas vistas e ${pessoas.toLowerCase()} por dia`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dados.porDia} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COR_PAGINAS} stopOpacity={0.22} />
                <stop offset="100%" stopColor={COR_PAGINAS} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeWidth={1} vertical={false} />
            <XAxis dataKey="dia" tickFormatter={diaCurto} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
            <Tooltip content={<DicaGrafico pessoas={pessoas} />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeOpacity: 0.4 }} />
            <Area type="monotone" dataKey="paginas" stroke={COR_PAGINAS} strokeWidth={2} fill={`url(#g${id})`} dot={false} activeDot={{ r: 5, stroke: 'hsl(var(--background))', strokeWidth: 2 }} />
            <Area type="monotone" dataKey="visitantes" stroke={COR_PESSOAS} strokeWidth={2} fill="none" dot={false} activeDot={{ r: 5, stroke: 'hsl(var(--background))', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{nota}</p>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Ver dados em tabela</summary>
          <table className="mt-2 w-full max-w-sm text-left">
            <thead><tr><th className="py-1 pr-4 font-medium">Dia</th><th className="py-1 pr-4 font-medium text-right">Páginas</th><th className="py-1 font-medium text-right">{pessoas}</th></tr></thead>
            <tbody>
              {dados.porDia.map(d => (
                <tr key={d.dia} className="border-t border-border"><td className="py-1 pr-4">{diaCurto(d.dia)}</td><td className="py-1 pr-4 text-right tabular-nums">{fmtNum(d.paginas)}</td><td className="py-1 text-right tabular-nums">{fmtNum(d.visitantes)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </div>
  )
}

const NOME_CAMPO: Record<Campo, string> = { pais: 'País', aparelho: 'Aparelho', pagina: 'Página', origem: 'Origem' }

function PainelTrafego({ fonte, legenda, titulo, deQuem, periodoTexto, personalizado, linkPainel, pessoas, abrev, nota, extras = [], filtros, onFiltros }: {
  fonte: ReturnType<typeof useFonteTrafego>
  personalizado: boolean
  filtros: FiltroAtivo[]
  onFiltros: (f: FiltroAtivo[]) => void
  legenda: string
  titulo: string
  deQuem: string
  periodoTexto: string
  linkPainel: string
  pessoas: string
  abrev: string
  nota: string
  extras?: [string, number][]
}) {
  const { dados, erro, carregando, hora, carregar } = fonte
  const icones = [Users, Eye, Activity, Radio]
  // um filtro por campo: clicar noutro país troca o país; no máximo os 4 campos
  const filtrar = (campo: Campo, valor: string, rotulo: string, tirar?: boolean) =>
    onFiltros([...filtros.filter(f => f.campo !== campo), ...(tirar ? [] : [{ campo, valor, rotulo }])])
  const comp = dados?.comparacao
  const chaveComp: Record<string, keyof Totais> = { [pessoas]: 'visitantes', 'Páginas vistas': 'paginas', 'Sessões': 'sessoes' }
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{legenda}</span>
          <h2 className="font-serif text-2xl text-foreground mt-1">{titulo}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {personalizado && dados?.de && dados?.ate ? `De ${dados.de.split('-').reverse().join('/')} a ${dados.ate.split('-').reverse().join('/')}` : periodoTexto}
            {dados && hora && ` · atualizado às ${hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={carregar}
            disabled={carregando}
            className="py-2 px-3 bg-card border border-border text-foreground hover:border-primary/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          <a href={linkPainel} target="_blank" rel="noreferrer" className="py-2 px-3 text-primary hover:underline text-xs font-semibold flex items-center gap-1.5">
            Painel completo <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {filtros.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
          {filtros.map(f => (
            <span key={f.campo} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {NOME_CAMPO[f.campo]}: {f.rotulo}
              <button onClick={() => onFiltros(filtros.filter(x => x.campo !== f.campo))} aria-label={`Tirar o filtro ${NOME_CAMPO[f.campo]}: ${f.rotulo}`} className="p-0.5 rounded-full hover:bg-primary/20">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button onClick={() => onFiltros([])} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Limpar filtros</button>
        </div>
      )}

      {erro ? (
        <div role="alert" className="p-4 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300">
          Não foi possível carregar os dados {deQuem}: {erro}
        </div>
      ) : !dados ? (
        <div className="flex items-center justify-center py-16 rounded-2xl bg-card border border-border">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className={`grid gap-4 sm:gap-5 ${extras.length === 2 ? 'grid-cols-2 xl:grid-cols-4' : extras.length === 1 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
            {([[pessoas, dados.totais.visitantes], ['Páginas vistas', dados.totais.paginas], ...extras] as [string, number][]).map(([l, v], i) => (
              <Numero
                key={l}
                icone={icones[i] ?? Activity}
                rotulo={l}
                valor={fmtNum(v)}
                destaque={l.startsWith('Agora')}
                apoio={l.startsWith('Agora') ? 'Últimos 30 minutos' : undefined}
                variacao={
                  l.startsWith('Agora') ? undefined
                    : comp && chaveComp[l] ? <Variacao atual={comp.atual[chaveComp[l]] ?? 0} anterior={comp.anterior[chaveComp[l]] ?? 0} dias={comp.dias} />
                      : <div className="text-xs text-muted-foreground mt-1">{dados?.semComparacao === 'falha' ? 'comparação indisponível agora' : 'sem comparação neste período'}</div>
                }
              />
            ))}
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-sm">
            {dados.totais.paginas === 0 ? (
              <p className="text-sm text-muted-foreground italic py-10 text-center">Nenhuma visita no período.</p>
            ) : (
              <GraficoDias dados={dados} pessoas={pessoas} nota={nota} />
            )}
          </div>

          {dados.totais.paginas > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              <ListaTop titulo="Páginas mais vistas" campo="pagina" itens={dados.paginas} rotulo={n => n || '/'} abrev={abrev} mono filtros={filtros} onFiltrar={filtrar} />
              <ListaTop titulo="De onde vêm" campo="origem" itens={dados.origens} rotulo={nomeOrigem} icone={iconeOrigem} abrev={abrev} filtros={filtros} onFiltrar={filtrar} />
              <ListaTop titulo="Países" campo="pais" itens={dados.paises} rotulo={nomePais} icone={iconePais} abrev={abrev} filtros={filtros} onFiltrar={filtrar} />
              <ListaTop titulo="Aparelhos" campo="aparelho" itens={dados.aparelhos} rotulo={nomeAparelho} icone={iconeAparelho} abrev={abrev} filtros={filtros} onFiltrar={filtrar} />
            </div>
          )}
        </>
      )}
    </section>
  )
}

function ListaTop({ titulo, campo, itens, rotulo, icone, abrev, mono, filtros, onFiltrar }: {
  titulo: string
  campo: Campo
  filtros: FiltroAtivo[]
  onFiltrar: (campo: Campo, valor: string, rotulo: string, tirar?: boolean) => void
  itens: ItemTop[]
  rotulo: (n: string) => string
  icone?: (n: string) => React.ReactNode
  abrev: string
  mono?: boolean
}) {
  // ordena pelo mesmo número que desenha a barra (o GA4 manda alguns tops ordenados por usuários)
  const ordem = [...itens].sort((a, b) => Number(a.nome === 'Outros') - Number(b.nome === 'Outros') || b.paginas - a.paginas)
  const maior = Math.max(1, ...itens.map(i => i.paginas))
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-sm">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        <span className="text-[11px] text-muted-foreground">clique para filtrar · páginas · {abrev.replace('.', '')}</span>
      </div>
      {itens.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sem dados no período.</p>
      ) : (
        <ul className="space-y-3.5">
          {ordem.map(i => {
            // filtrável quando a API aceita o valor (o servidor manda null para "Outros" e valores fora do formato);
            // clicar no item ativo tira o filtro
            const ativo = filtros.some(f => f.campo === campo && f.valor === i.valor)
            const filtravel = typeof i.valor === 'string'
            const Elemento = filtravel ? 'button' : 'div'
            return (
            <li key={i.valor ?? i.nome}>
              <Elemento
                {...(filtravel ? {
                  type: 'button' as const,
                  'aria-pressed': ativo,
                  onClick: () => (ativo ? onFiltrar(campo, '', '', true) : onFiltrar(campo, i.valor as string, rotulo(i.nome))),
                  title: ativo ? 'Tirar este filtro' : `Filtrar por ${rotulo(i.nome)}`,
                } : {})}
                className={`block w-full text-left rounded-lg -mx-2 px-2 py-1 transition-colors ${filtravel ? 'hover:bg-muted/60 cursor-pointer' : ''} ${ativo ? 'bg-primary/10' : ''}`}
              >
              <span className="flex items-center gap-3 text-sm">
                {icone && <span className="w-5 flex justify-center shrink-0">{icone(i.nome)}</span>}
                <span className={`text-foreground truncate min-w-0 ${mono ? 'font-mono text-xs' : ''}`} title={rotulo(i.nome)}>{rotulo(i.nome)}</span>
                <span className="ml-auto shrink-0 tabular-nums text-foreground font-medium">{fmtNum(i.paginas)}</span>
                <span className="w-12 shrink-0 text-right tabular-nums text-xs text-muted-foreground">{fmtNum(i.visitantes)}</span>
              </span>
              <span className={`block mt-1.5 h-1.5 rounded-full bg-muted/60 overflow-hidden ${icone ? 'ml-8' : ''}`}>
                {/* "Outros" é a soma do resto: barra neutra para não parecer o primeiro lugar */}
                <span className={`block h-full rounded-full ${i.nome === 'Outros' ? 'bg-muted-foreground/40' : ''}`} style={{ width: `${(i.paginas / maior) * 100}%`, ...(i.nome === 'Outros' ? {} : { background: COR_PAGINAS, opacity: 0.55 }) }} />
              </span>
              </Elemento>
            </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

interface ActivityLog {
  id: string
  name: string
  email: string
  role: string
  time: string
  device: string
  action: string
  status: string
}

export default function AdminAnalytics() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'users_engagement' | 'traffic' | 'funnel'>('overview')
  const [period, setPeriod] = useState<'7d' | '30d' | 'all' | 'custom'>('7d')
  // período personalizado (só na aba Tráfego); datas em AAAA-MM-DD, aplicadas pelo botão
  const hojeIso = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const [rascunho, setRascunho] = useState({ de: '', ate: '' })
  const [personalizado, setPersonalizado] = useState<{ de: string; ate: string } | null>(null)
  const [filtrosVercel, setFiltrosVercel] = useState<FiltroAtivo[]>([])
  const [filtrosGa4, setFiltrosGa4] = useState<FiltroAtivo[]>([])

  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([])
  const [totalUsers, setTotalUsers] = useState<number | null>(0)
  const [activityStats, setActivityStats] = useState<{
    sessoes: number
    visualizacoes: number
    logins: number
    contas_ativas: number
  }>({
    sessoes: 0,
    visualizacoes: 0,
    logins: 0,
    contas_ativas: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadAnalyticsData = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      // 1. Logs de acessos reais
      const { data: logs, error: logsError } = await supabase
        .from('user_activities')
        .select(`
          id,
          event_type,
          path,
          created_at,
          metadata,
          session_id,
          profiles (
            id,
            email,
            full_name,
            role
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (logsError) {
        console.warn('Erro ao carregar logs:', logsError)
      } else if (logs) {
        const formattedLogs: ActivityLog[] = logs.map((l: any) => {
          const userProfile = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles
          const diffMs = Date.now() - new Date(l.created_at).getTime()
          const diffMin = Math.floor(diffMs / 60000)
          let timeString = 'Agora'
          if (diffMin > 0 && diffMin < 60) {
            timeString = `Há ${diffMin} min`
          } else if (diffMin >= 60 && diffMin < 1440) {
            timeString = `Há ${Math.floor(diffMin / 60)}h`
          } else if (diffMin >= 1440) {
            timeString = `Há ${Math.floor(diffMin / 1440)} dias`
          }

          let actionString = 'Navegou na plataforma'
          if (l.event_type === 'login') actionString = 'Efetuou login'
          else if (l.event_type === 'logout') actionString = 'Efetuou logout'
          else if (l.event_type === 'session_start') actionString = 'Iniciou sessão'
          else if (l.event_type === 'add_to_cart') actionString = 'Adicionou ingresso ao carrinho'
          else if (l.event_type === 'purchase') actionString = 'Comprou ingresso'
          else if (l.event_type === 'page_view' && l.path) {
            if (l.path.startsWith('/event/')) actionString = 'Visualizou evento'
            else if (l.path === '/') actionString = 'Acessou a Home'
            else if (l.path.startsWith('/producer')) actionString = 'Acessou Painel Produtor'
            else if (l.path.startsWith('/admin')) actionString = 'Acessou Painel Admin'
            else actionString = `Acessou ${l.path}`
          }

          return {
            id: l.id,
            name: userProfile?.full_name || 'Visitante Anônimo',
            email: userProfile?.email || '—',
            role: userProfile?.role ? (userProfile.role === 'admin' ? 'Admin' : userProfile.role === 'producer' ? 'Produtor' : 'Participante') : 'Visitante',
            time: timeString,
            device: l.metadata?.device || 'Navegador Web',
            action: actionString,
            status: userProfile ? 'Autenticado' : 'Anônimo'
          }
        })
        setRecentLogs(formattedLogs)
      }

      // 2. Contagem real de contas no sistema
      const { count: profilesCount, error: profilesError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
      if (profilesError) {
        console.warn('Erro ao contar profiles:', profilesError)
        setLoadError(prev => prev || profilesError.message)
        setTotalUsers(null)
      } else {
        setTotalUsers(profilesCount || 0)
      }

      // 3. Execução da RPC admin_activity_stats
      // 'all' manda uma data bem antiga em vez de 365 dias, que não é "todo período"
      const desdeDate = period === '7d'
        ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        : period === '30d'
          ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          : new Date('2020-01-01').toISOString()

      const { data: statsData, error: statsError } = await supabase.rpc('admin_activity_stats', {
        desde: desdeDate
      })

      if (statsError) {
        console.warn('Erro ao chamar RPC admin_activity_stats:', statsError)
        setLoadError(prev => prev || statsError.message)
        // não deixa o número do período anterior parecer válido para o período novo
        setActivityStats({ sessoes: 0, visualizacoes: 0, logins: 0, contas_ativas: 0 })
      } else if (statsData && statsData.length > 0) {
        const row = statsData[0]
        setActivityStats({
          sessoes: Number(row.sessoes || 0),
          visualizacoes: Number(row.visualizacoes || 0),
          logins: Number(row.logins || 0),
          contas_ativas: Number(row.contas_ativas || 0),
        })
      }
    } catch (err) {
      console.error('[Analytics] Erro geral:', err)
      setLoadError(err instanceof Error ? err.message : 'erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (period !== 'custom') loadAnalyticsData() // o personalizado é só do Tráfego
  }, [period])

  // Tráfego: cada fonte busca só com a aba aberta. A Vercel (Hobby) guarda 1 mês: "Todo período" = 30 dias.
  const custom = period === 'custom' && personalizado ? personalizado : null
  const vercel = useFonteTrafego('vercel-analytics', custom ?? (period === '7d' || period === 'custom' ? '7d' : '30d'), filtrosVercel, activeSubTab === 'traffic', MOTIVOS_VERCEL)
  const ga4 = useFonteTrafego('ga4-analytics', custom ?? (period === 'custom' ? '7d' : period), filtrosGa4, activeSubTab === 'traffic', MOTIVOS_GA4)
  const textoCustom = custom ? `De ${custom.de.split('-').reverse().join('/')} a ${custom.ate.split('-').reverse().join('/')}` : ''

  useEffect(() => {
    // a aba Tráfego não anima (não pisca ao trocar o período)
    if (!isLoading && activeSubTab !== 'traffic') {
      const ctx = gsap.context(() => {
        gsap.fromTo('.an-anim', 
          { y: 15, opacity: 0 }, 
          { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
        )
      }, containerRef)
      return () => ctx.revert()
    }
  }, [isLoading, activeSubTab])

  const abas = [
    { id: 'overview' as const, rotulo: 'Visão geral', icone: BarChart3 },
    { id: 'users_engagement' as const, rotulo: 'Atividades recentes', icone: Users },
    { id: 'traffic' as const, rotulo: 'Tráfego e audiência', icone: Globe },
  ]
  const periodos = [
    { id: '7d' as const, rotulo: '7 dias' },
    { id: '30d' as const, rotulo: '30 dias' },
    { id: 'all' as const, rotulo: 'Todo período' },
  ]

  return (
    <div ref={containerRef} className="p-6 lg:p-10 max-w-7xl space-y-8">
      <header className="space-y-5">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Tráfego, audiência e registros de atividade da plataforma.</p>
        </div>

        <div className="space-y-3">
          <div role="group" aria-label="Seções do Analytics" className="inline-flex flex-wrap gap-1 p-1 bg-card border border-border rounded-2xl">
            {abas.map(a => (
              <button
                key={a.id}
                aria-pressed={activeSubTab === a.id}
                onClick={() => {
                  setActiveSubTab(a.id)
                  if (a.id !== 'traffic' && period === 'custom') setPeriod('7d') // o personalizado é só do Tráfego
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                  activeSubTab === a.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <a.icone className="w-4 h-4" /> {a.rotulo}
              </button>
            ))}
          </div>

          {activeSubTab !== 'users_engagement' && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
              <span className="text-xs text-muted-foreground mr-1">Período</span>
              {[...periodos, ...(activeSubTab === 'traffic' ? [{ id: 'custom' as const, rotulo: 'Personalizado' }] : [])].map(p => (
                <button
                  key={p.id}
                  aria-pressed={period === p.id}
                  onClick={() => {
                    if (p.id === 'custom') setRascunho(personalizado ?? { de: '', ate: hojeIso })
                    setPeriod(p.id)
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    period === p.id ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
                  }`}
                >
                  {p.rotulo}
                </button>
              ))}
            </div>
          )}

          {activeSubTab === 'traffic' && period === 'custom' && (
            <form
              className="flex flex-wrap items-end gap-3 p-3 rounded-2xl bg-card border border-border w-fit"
              onSubmit={e => {
                e.preventDefault()
                if (rascunho.de && rascunho.ate && rascunho.de <= rascunho.ate) setPersonalizado({ ...rascunho })
              }}
            >
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                De
                <input type="date" required max={rascunho.ate || hojeIso} value={rascunho.de} onChange={e => setRascunho(r => ({ ...r, de: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm" />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Até
                <input type="date" required min={rascunho.de || undefined} max={hojeIso} value={rascunho.ate} onChange={e => setRascunho(r => ({ ...r, ate: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm" />
              </label>
              <button type="submit" className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">Aplicar</button>
              <span className="text-[11px] text-muted-foreground basis-full">A Vercel guarda só os últimos 30 dias; o Google, desde 27/09/2026.</span>
            </form>
          )}
        </div>
      </header>

      {loadError && activeSubTab === 'overview' && (
        <div role="alert" className="p-4 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300">
          Não foi possível carregar todos os dados de analytics: {loadError}. Os números abaixo podem estar incompletos.
        </div>
      )}

      {activeSubTab === 'traffic' ? (
        <div className="space-y-10">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30 border border-border text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <span>A Vercel conta todos os acessos, sem cookies; o Google conta só quem aceitou os cookies. Os dois medem coisas diferentes e os números não se comparam.</span>
          </div>
          <PainelTrafego
            fonte={vercel}
            legenda="Sem cookies · todos os visitantes"
            titulo="Vercel Web Analytics"
            deQuem="da Vercel"
            periodoTexto={custom ? textoCustom : period === '7d' || period === 'custom' ? 'Últimos 7 dias' : period === '30d' ? 'Últimos 30 dias' : 'Últimos 30 dias (limite do plano da Vercel)'}
            personalizado={!!custom}
            filtros={filtrosVercel}
            onFiltros={setFiltrosVercel}
            linkPainel="https://vercel.com/scoprics-projects/aura-tickets-pypy/analytics"
            pessoas="Visitantes"
            abrev="vis."
            nota="Dias contados no horário UTC (3 h à frente de Brasília)."
          />
          <PainelTrafego
            fonte={ga4}
            legenda="Com consentimento · só quem aceitou cookies"
            titulo="Google Analytics 4"
            deQuem="do Google"
            periodoTexto={custom ? textoCustom : period === '7d' || period === 'custom' ? 'Últimos 7 dias' : period === '30d' ? 'Últimos 30 dias' : 'Desde 27/09/2026, quando o GA4 entrou no ar'}
            personalizado={!!custom}
            filtros={filtrosGa4}
            onFiltros={setFiltrosGa4}
            linkPainel="https://analytics.google.com"
            pessoas="Usuários ativos"
            abrev="usu."
            nota="Dias no horário de Brasília. O Google pode levar até 48 h para fechar os números de um dia."
            extras={ga4.dados ? [['Sessões', ga4.dados.totais.sessoes ?? 0], ...(ga4.dados.agora == null ? [] : [['Agora no site', ga4.dados.agora] as [string, number]])] : []}
          />
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : activeSubTab === 'overview' ? (
        <div className="space-y-6">
          <div className="an-anim grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
            <Numero icone={Users} rotulo="Contas" valor={totalUsers === null ? '—' : fmtNum(totalUsers)} apoio="Perfis registrados (total)" />
            <Numero icone={Activity} rotulo="Sessões" valor={fmtNum(activityStats.sessoes)} apoio="No período escolhido" />
            <Numero icone={Eye} rotulo="Páginas vistas" valor={fmtNum(activityStats.visualizacoes)} apoio="No período escolhido" />
            <Numero icone={Clock} rotulo="Logins" valor={fmtNum(activityStats.logins)} apoio="No período escolhido" />
          </div>

          <div className="an-anim p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Métricas de Engajamento Real</h2>
            <p className="text-xs text-muted-foreground mt-1 mb-5">Métricas calculadas dinamicamente pela função analítica interna do Supabase.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icone: UserCheck, rotulo: 'Contas ativas no período', valor: fmtNum(activityStats.contas_ativas), apoio: 'Usuários únicos com ações registradas' },
                { icone: Eye, rotulo: 'Páginas por sessão', valor: activityStats.sessoes > 0 ? (activityStats.visualizacoes / activityStats.sessoes).toFixed(1).replace('.', ',') : '—', apoio: 'Média de páginas vistas' },
                { icone: Clock, rotulo: 'Logins por conta', valor: activityStats.contas_ativas > 0 ? (activityStats.logins / activityStats.contas_ativas).toFixed(1).replace('.', ',') : '—', apoio: 'Média de entradas por conta ativa' },
              ].map(m => (
                <div key={m.rotulo} className="p-4 rounded-xl bg-muted/40 border border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><m.icone className="w-3.5 h-3.5" />{m.rotulo}</div>
                  <div className="font-serif text-2xl text-foreground mt-2 tabular-nums">{m.valor}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{m.apoio}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="an-anim p-5 rounded-2xl bg-muted/30 border border-border flex items-start gap-3">
            <Globe className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground block">Telemetria e Privacidade (LGPD):</span>
              <span>
                A plataforma utiliza uma política rigorosa de consentimento. O tráfego geral sem cookies é medido pelo <strong className="text-foreground font-medium">Vercel Web Analytics</strong>. Eventos detalhados e dados do Google Analytics 4 são gravados apenas após consentimento expresso do visitante no banner de cookies.
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="an-anim bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 sm:p-6 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Registro de acessos recentes</h2>
            <p className="text-xs text-muted-foreground mt-1">As últimas 20 ações registradas no histórico de atividades.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-[11px] font-semibold text-muted-foreground">Usuário</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-muted-foreground">Ação</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-muted-foreground hidden sm:table-cell">Dispositivo</th>
                  <th className="px-5 py-3 text-[11px] font-semibold text-muted-foreground hidden md:table-cell">Papel</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-muted-foreground">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center text-sm text-muted-foreground italic">
                      Nenhuma atividade registrada ainda.
                    </td>
                  </tr>
                ) : (
                  recentLogs.map(log => (
                    <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-foreground">{log.name}</div>
                        <div className="text-xs text-muted-foreground">{log.email}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground">{log.action}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground hidden sm:table-cell">{log.device}</td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">{log.role}</span>
                      </td>
                      <td className="px-5 py-4 text-right text-xs text-muted-foreground whitespace-nowrap">{log.time}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
