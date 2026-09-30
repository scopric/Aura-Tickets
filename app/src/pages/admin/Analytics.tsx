import { useState, useEffect, useRef } from 'react'
import {
  Users, Activity, Globe, Eye, BarChart3, Clock, Loader2, ExternalLink, RefreshCw
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
import gsap from 'gsap'

type ItemTop = { nome: string; visitantes: number; paginas: number }
// Mesmo formato nas duas funções (vercel-analytics e ga4-analytics); sessoes e agora só no GA4
interface Trafego {
  periodo: string
  totais: { visitantes: number; paginas: number; sessoes?: number }
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
  entrada_invalida: 'período inválido.',
}

const MOTIVOS_GA4: Record<string, string> = {
  nao_autorizado: 'sua conta não tem a permissão de ver Analytics.',
  sem_chave: 'a credencial do Google ainda não foi configurada no servidor.',
  credencial_invalida: 'a credencial do Google foi apagada ou perdeu o acesso à propriedade do GA4.',
  limite: 'o Google limitou as consultas por alguns minutos. Tente de novo daqui a pouco.',
  google_erro: 'o Google não respondeu. Tente de novo em instantes.',
  entrada_invalida: 'período inválido.',
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
function useFonteTrafego(funcao: string, periodo: string, ativo: boolean, motivos: Record<string, string>) {
  const [dados, setDados] = useState<Trafego | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [hora, setHora] = useState<Date | null>(null)
  const pedidoAtual = useRef(0)

  const carregar = async () => {
    const pedido = ++pedidoAtual.current
    setCarregando(true)
    setErro(null)
    const { data, error } = await supabase.functions.invoke(funcao, { body: { periodo } })
    if (pedido !== pedidoAtual.current) return // resposta de um período antigo
    if (error || !data?.ok) {
      setDados(null)
      setErro(motivos[data?.motivo] ?? 'não foi possível falar com o servidor.')
    } else {
      setDados({ ...data, periodo })
      setHora(new Date())
    }
    setCarregando(false)
  }

  useEffect(() => {
    if (ativo) carregar()
  }, [ativo, periodo])

  // números de outro período não ficam na tela enquanto o novo carrega
  return { dados: dados?.periodo === periodo ? dados : null, erro, carregando, hora, carregar }
}

function PainelTrafego({ fonte, legenda, titulo, deQuem, periodoTexto, linkPainel, pessoas, abrev, nota, extras = [] }: {
  fonte: ReturnType<typeof useFonteTrafego>
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
  return (
    <>
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{legenda}</span>
            <h3 className="font-serif text-xl text-foreground mt-1">{titulo}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {periodoTexto}
              {dados && hora && ` · atualizado às ${hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={carregar}
              disabled={carregando}
              className="py-2 px-3 bg-background border border-border text-foreground hover:bg-muted rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            <a href={linkPainel} target="_blank" rel="noreferrer" className="py-2 px-3 text-primary hover:underline text-xs font-semibold flex items-center gap-1.5">
              Painel completo <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {erro ? (
          <div role="alert" className="p-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300">
            Não foi possível carregar os dados {deQuem}: {erro}
          </div>
        ) : !dados ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <>
            <div className={`grid gap-4 ${extras.length ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
              {([[pessoas, dados.totais.visitantes], ['Páginas vistas', dados.totais.paginas], ...extras] as [string, number][]).map(([l, v]) => (
                <div key={l} className="p-4 rounded-xl bg-muted/40 border border-border">
                  <div className="text-xs text-muted-foreground">{l}</div>
                  <div className="font-serif text-2xl text-foreground mt-1">{v}</div>
                </div>
              ))}
            </div>

            {dados.totais.paginas === 0 ? (
              <p className="text-xs text-muted-foreground italic py-6 text-center">Nenhuma visita no período.</p>
            ) : (
              <div>
                <div className="h-56" role="img" aria-label={`Gráfico de ${pessoas.toLowerCase()} e páginas vistas por dia`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dados.porDia.map(d => ({ ...d, rotulo: d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                      <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        formatter={(v: number, nome: string) => [v, nome === 'paginas' ? 'Páginas vistas' : pessoas]}
                        cursor={{ fill: 'rgba(128,128,128,0.12)' }}
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Bar dataKey="paginas" fill="#8f33f5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="visitantes" fill="#c084fc" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Barras escuras: páginas vistas · claras: {pessoas.toLowerCase()}. {nota}</p>
              </div>
            )}
          </>
        )}
      </div>

      {dados && !erro && dados.totais.paginas > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ListaTop titulo="Páginas mais vistas" itens={dados.paginas} rotulo={n => n || '/'} abrev={abrev} />
          <ListaTop titulo="De onde vêm" itens={dados.origens} rotulo={nomeOrigem} abrev={abrev} />
          <ListaTop titulo="Países" itens={dados.paises} rotulo={nomePais} abrev={abrev} />
          <ListaTop titulo="Aparelhos" itens={dados.aparelhos} rotulo={nomeAparelho} abrev={abrev} />
        </div>
      )}
    </>
  )
}

function ListaTop({ titulo, itens, rotulo, abrev }: { titulo: string; itens: ItemTop[]; rotulo: (n: string) => string; abrev: string }) {
  return (
    <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
      <h4 className="text-xs font-semibold text-foreground mb-3">{titulo}</h4>
      {itens.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sem dados no período.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map(i => (
            <li key={i.nome} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-foreground truncate min-w-0" title={rotulo(i.nome)}>{rotulo(i.nome)}</span>
              <span className="text-muted-foreground tabular-nums flex-shrink-0">{i.visitantes} {abrev} · {i.paginas} pág.</span>
            </li>
          ))}
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
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('7d')

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
    loadAnalyticsData()
  }, [period])

  // Tráfego: cada fonte busca só com a aba aberta. A Vercel (Hobby) guarda 1 mês: "Todo período" = 30 dias.
  const vercel = useFonteTrafego('vercel-analytics', period === '7d' ? '7d' : '30d', activeSubTab === 'traffic', MOTIVOS_VERCEL)
  const ga4 = useFonteTrafego('ga4-analytics', period, activeSubTab === 'traffic', MOTIVOS_GA4)

  useEffect(() => {
    if (!isLoading) {
      const ctx = gsap.context(() => {
        gsap.fromTo('.an-anim', 
          { y: 15, opacity: 0 }, 
          { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
        )
      }, containerRef)
      return () => ctx.revert()
    }
  }, [isLoading, activeSubTab])

  return (
    <div ref={containerRef} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Estatísticas reais de tráfego, audiência e registros de atividade na plataforma.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro de período */}
          <div className="flex bg-card p-1 border border-border rounded-xl">
            {(['7d', '30d', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === p ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : 'Todo período'}
              </button>
            ))}
          </div>

          {/* Sub-tabs */}
          <div className="flex bg-card p-1 border border-border rounded-xl">
            <button 
              onClick={() => setActiveSubTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeSubTab === 'overview' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Visão Geral
            </button>
            <button 
              onClick={() => setActiveSubTab('users_engagement')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeSubTab === 'users_engagement' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Atividades Recentes
            </button>
            <button 
              onClick={() => setActiveSubTab('traffic')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeSubTab === 'traffic' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Tráfego & Audiência
            </button>
          </div>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
          Não foi possível carregar todos os dados de analytics: {loadError}. Os números abaixo podem estar incompletos.
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs reais consolidados */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total de Contas', value: totalUsers === null ? '—' : totalUsers.toString(), icon: Users, desc: 'Perfis registrados', color: 'text-primary' },
              { label: 'Sessões Ativas', value: activityStats.sessoes.toString(), icon: Activity, desc: `Período: ${period}`, color: 'text-emerald-600' },
              { label: 'Visualizações de Página', value: activityStats.visualizacoes.toString(), icon: Eye, desc: 'Páginas acessadas', color: 'text-blue-600' },
              { label: 'Logins no Período', value: activityStats.logins.toString(), icon: Clock, desc: 'Autenticações', color: 'text-violet-600' },
            ].map(k => (
              <div key={k.label} className="an-anim p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{k.desc}</span>
                </div>
                <div>
                  <div className="font-serif text-2xl text-foreground">{k.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          {activeSubTab === 'overview' && (
            <div className="space-y-6">
              <div className="an-anim p-6 rounded-2xl bg-card border border-border shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-1">Métricas de Engajamento Real</h3>
                <p className="text-xs text-muted-foreground mb-6">Métricas calculadas dinamicamente pela função analítica interna do Supabase.</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border">
                    <div className="text-xs text-muted-foreground font-medium">Contas Ativas no Período</div>
                    <div className="font-serif text-2xl text-foreground mt-1">{activityStats.contas_ativas}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Usuários únicos com ações registradas</div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border">
                    <div className="text-xs text-muted-foreground font-medium">Visualizações por Sessão</div>
                    <div className="font-serif text-2xl text-foreground mt-1">
                      {activityStats.sessoes > 0 ? (activityStats.visualizacoes / activityStats.sessoes).toFixed(1) : '—'}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Média de páginas vistas</div>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/40 border border-border">
                    <div className="text-xs text-muted-foreground font-medium">Logins por Conta</div>
                    <div className="font-serif text-2xl text-foreground mt-1">
                      {activityStats.contas_ativas > 0 ? (activityStats.logins / activityStats.contas_ativas).toFixed(1) : '—'}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Média de sessões autenticadas</div>
                  </div>
                </div>
              </div>

              {/* Informações sobre telemetria e privacidade */}
              <div className="an-anim p-5 rounded-2xl bg-muted/30 border border-border flex items-start gap-3">
                <Globe className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <span className="font-semibold text-foreground block">Telemetria e Privacidade (LGPD):</span>
                  <span>
                    A plataforma utiliza uma política rigorosa de consentimento. O tráfego geral sem cookies é medido pelo **Vercel Web Analytics**. Eventos detalhados e dados do Google Analytics 4 são gravados apenas após consentimento expresso do visitante no banner de cookies.
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'users_engagement' && (
            <div className="an-anim bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border bg-muted/20">
                <h3 className="text-sm font-semibold text-foreground">Registro de Acessos Recentes</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Últimas 20 ações auditadas na tabela de atividades de usuários.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Usuário</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Ação Realizada</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase hidden sm:table-cell">Dispositivo</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase hidden md:table-cell">Papel</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">Horário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-16 text-center text-xs text-muted-foreground italic">
                          Nenhum registro de atividade recente no banco de dados.
                        </td>
                      </tr>
                    ) : (
                      recentLogs.map(log => (
                        <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-xs font-semibold text-foreground">{log.name}</div>
                            <div className="text-[11px] text-muted-foreground">{log.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-foreground font-medium">{log.action}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{log.device}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                              {log.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground">{log.time}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === 'traffic' && (
            <div className="space-y-6 an-anim">
              <p className="text-xs text-muted-foreground">
                A Vercel conta todos os acessos, sem cookies; o Google conta só quem aceitou os cookies. Os dois medem coisas diferentes e os números não se comparam.
              </p>
              <PainelTrafego
                fonte={vercel}
                legenda="Sem cookies · todos os visitantes"
                titulo="Vercel Web Analytics"
                deQuem="da Vercel"
                periodoTexto={period === '7d' ? 'Últimos 7 dias' : period === '30d' ? 'Últimos 30 dias' : 'Últimos 30 dias (limite do plano da Vercel)'}
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
                periodoTexto={period === '7d' ? 'Últimos 7 dias' : period === '30d' ? 'Últimos 30 dias' : 'Desde 27/09/2026, quando o GA4 entrou no ar'}
                linkPainel="https://analytics.google.com"
                pessoas="Usuários ativos"
                abrev="usu."
                nota="Dias no horário de Brasília. O Google pode levar até 48 h para fechar os números de um dia."
                extras={ga4.dados ? [['Sessões', ga4.dados.totais.sessoes ?? 0], ...(ga4.dados.agora == null ? [] : [['Agora no site (últimos 30 min)', ga4.dados.agora] as [string, number]])] : []}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
