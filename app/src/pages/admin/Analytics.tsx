import { useState, useEffect, useRef } from 'react'
import { 
  Users, Calendar, DollarSign, TrendingUp, Activity, PieChart, 
  Globe, Laptop, Smartphone, Tablet, Percent, Eye, ShoppingCart, 
  CheckCircle, ArrowUpRight, BarChart3, Info, Award,
  UserCheck, UserX, Clock
} from 'lucide-react'
import gsap from 'gsap'

// Monthly detailed stats
const statsHistory = [
  { month: 'Jan', activeUsers: 620, producers: 45, events: 12, converted: 180, pageViews: 4800 },
  { month: 'Fev', activeUsers: 840, producers: 62, events: 15, converted: 260, pageViews: 6500 },
  { month: 'Mar', activeUsers: 1050, producers: 88, events: 21, converted: 340, pageViews: 8200 },
  { month: 'Abr', activeUsers: 1180, producers: 104, events: 26, converted: 420, pageViews: 9900 },
  { month: 'Mai', activeUsers: 1280, producers: 120, events: 32, converted: 510, pageViews: 11400 },
]

// Popular categories with capacity analysis
const categoryDetails = [
  { name: 'Shows', sold: 480, capacity: 600, percentage: 80, color: '#7c3aed' }, // Plum
  { name: 'Festivais', sold: 850, capacity: 1000, percentage: 85, color: '#f43f5e' }, // Rose
  { name: 'Gastronomia', sold: 210, capacity: 300, percentage: 70, color: '#10b981' }, // Emerald
  { name: 'Corporativo', sold: 180, capacity: 250, percentage: 72, color: '#3b82f6' }, // Blue
  { name: 'Teatro', sold: 90, capacity: 150, percentage: 60, color: '#f59e0b' }, // Amber
]

// Funnel conversion steps
const funnelSteps = [
  { step: 'Visualizações de Evento', count: 11400, percentage: 100, color: 'bg-violet-500/20 text-violet-700 border-violet-200' },
  { step: 'Adições ao Carrinho', count: 4800, percentage: 42.1, color: 'bg-indigo-500/20 text-indigo-700 border-indigo-200' },
  { step: 'Checkouts Iniciados', count: 1950, percentage: 17.1, color: 'bg-blue-500/20 text-blue-700 border-blue-200' },
  { step: 'Vendas Concluídas (Pago)', count: 510, percentage: 4.47, color: 'bg-emerald-500/20 text-emerald-700 border-emerald-200' },
]

// Traffic Sources
const trafficSources = [
  { source: 'Acesso Direto', count: 3990, share: 35, color: '#7c3aed' },
  { source: 'Busca Orgânica (Google)', count: 3420, share: 30, color: '#3b82f6' },
  { source: 'Redes Sociais (Instagram/FB)', count: 2280, share: 20, color: '#f43f5e' },
  { source: 'E-mail Marketing & News', count: 1710, share: 15, color: '#10b981' },
]

// Event performance details for admin overview
const eventPerformanceDetails = [
  { id: 'ev-101', title: 'Festival Sunset Evokaa 2026', producer: 'Joao Eventos', sold: 480, capacity: 500, rate: 96, status: 'Lotação Máxima', statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'ev-102', title: 'Jazz & Blues Night', producer: 'Bruno Costa', sold: 180, capacity: 250, rate: 72, status: 'Estável', statusColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'ev-103', title: 'Workshop de Growth & Inovação', producer: 'Diego Lima', sold: 90, capacity: 150, rate: 60, status: 'Estável', statusColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'ev-104', title: 'Gastronomia Gourmet', producer: 'Elisa Nakamura', sold: 210, capacity: 400, rate: 52, status: 'Abaixo da Meta', statusColor: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'ev-105', title: 'Stand Up Comedy - Tour 2026', producer: 'Mariana Costa', sold: 240, capacity: 250, rate: 96, status: 'Lotação Máxima', statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'ev-106', title: 'Teatro Central Especial', producer: 'Teatro Central', sold: 40, capacity: 200, rate: 20, status: 'Crítico', statusColor: 'bg-red-100 text-red-800 border-red-200' },
]

// Recent platform access logs (simulation)
const recentAccessLogs = [
  { id: 'log-001', name: 'Ana Carolina Silva', email: 'ana.silva@gmail.com', role: 'Participante', time: 'Há 2 min', device: 'Mobile', action: 'Visualizou ingresso', status: 'Ativo' },
  { id: 'log-002', name: 'Joao Eventos', email: 'joao@eventos.com.br', role: 'Produtor', time: 'Há 5 min', device: 'Desktop', action: 'Criou novo lote', status: 'Ativo' },
  { id: 'log-003', name: 'Bruno Costa', email: 'bruno@costa.com.br', role: 'Produtor', time: 'Há 12 min', device: 'Desktop', action: 'Editou dados do evento', status: 'Ativo' },
  { id: 'log-004', name: 'Carlos Admin', email: 'carlos@evokaa.com.br', role: 'Admin', time: 'Há 15 min', device: 'Desktop', action: 'Aprovou saque produtor', status: 'Ativo' },
  { id: 'log-005', name: 'Mariana Souza', email: 'mari@gmail.com', role: 'Participante', time: 'Há 28 min', device: 'Mobile', action: 'Solicitou reembolso', status: 'Ativo' },
  { id: 'log-006', name: 'Roberto Santos', email: 'roberto.s@gmail.com', role: 'Participante', time: 'Há 2 dias', device: 'Mobile', action: 'Nenhuma ação (Inativo)', status: 'Inativo' },
  { id: 'log-007', name: 'Luana Fernandes', email: 'luana.fer@gmail.com', role: 'Participante', time: 'Há 10 dias', device: 'Tablet', action: 'Nenhuma ação (Inativo)', status: 'Inativo' },
]

// Detailed user engagement metrics
const userEngagementMetrics = {
  total: 1280,
  active7d: 870,
  active30d: 1120,
  inactive: 160,
  bounceRate: '12.4%',
  sessionDuration: '4m 15s'
}

export default function AdminAnalytics() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'users_engagement' | 'traffic' | 'funnel'>('overview')

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.an-anim', 
        { y: 15, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' }
      )
    }, containerRef)
    return () => ctx.revert()
  }, [activeSubTab])

  // Aggregate stats calculations
  const totalUsers = 1280
  const participantUsers = 1160
  const producerUsers = 120
  const totalEventsThisMonth = 32
  const platformRevenueThisMonth = 72000
  const globalConversionRate = '4.47'

  const averageTicketsPerEvent = Math.round(
    categoryDetails.reduce((sum, c) => sum + c.sold, 0) / categoryDetails.length
  )
  const averageCapacityPerEvent = Math.round(
    categoryDetails.reduce((sum, c) => sum + c.capacity, 0) / categoryDetails.length
  )
  const platformOccupancyRate = Math.round(
    (categoryDetails.reduce((sum, c) => sum + c.sold, 0) / 
     categoryDetails.reduce((sum, c) => sum + c.capacity, 0)) * 100
  )

  return (
    <div ref={containerRef} className="p-6 lg:p-10 max-w-7xl">
      {/* Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Analytics</h1>
          <p className="text-sm text-espresso/50 mt-1">Análise detalhada de crescimento, conversões e tráfego da plataforma Evokaa.</p>
        </div>

        {/* Sub-tabs selector */}
        <div className="flex flex-wrap bg-white/60 p-1 border border-white/60 rounded-xl gap-1 sm:gap-0">
          <button 
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'overview' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Visão Geral
          </button>
          <button 
            onClick={() => setActiveSubTab('users_engagement')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'users_engagement' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Usuários & Engajamento
          </button>
          <button 
            onClick={() => setActiveSubTab('traffic')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'traffic' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Tráfego & Audiência
          </button>
          <button 
            onClick={() => setActiveSubTab('funnel')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'funnel' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <Percent className="w-3.5 h-3.5" /> Funil de Conversão
          </button>
        </div>
      </div>

      {/* Main KPIs (Visible always for context) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Usuários Cadastrados', value: totalUsers.toLocaleString(), icon: Users, change: '+18% vs mês ant.', color: 'text-plum' },
          { label: 'Eventos Ativos (Mês)', value: totalEventsThisMonth.toString(), icon: Calendar, change: '+12% vs mês ant.', color: 'text-rose-500' },
          { label: 'Volume de Vendas (GMV)', value: `R$ ${platformRevenueThisMonth.toLocaleString()}`, icon: DollarSign, change: '+22% vs mês ant.', color: 'text-emerald-600' },
          { label: 'Conversão de Checkout', value: `${globalConversionRate}%`, icon: TrendingUp, change: '+0.5% este mês', color: 'text-blue-500' },
        ].map(k => (
          <div key={k.label} className="an-anim p-5 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <span className="text-[9px] text-green-600 font-semibold">{k.change}</span>
            </div>
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Detailed Platform Demographics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Growth curve mock (Vertical bars) */}
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-espresso">Crescimento de Cadastros e Audiência</h3>
                  <p className="text-[10px] text-espresso/40">Evolução do engajamento mensal na plataforma.</p>
                </div>
                <div className="text-xs font-bold text-plum bg-plum/5 border border-plum/10 px-2.5 py-1 rounded-lg">
                  Evokaa 2026
                </div>
              </div>
              
              <div className="space-y-4">
                {statsHistory.map(d => (
                  <div key={d.month} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-espresso/70">{d.month}</span>
                      <div className="space-x-3 text-espresso/40 text-[10px]">
                        <span>{d.activeUsers} Usuários</span>
                        <span>•</span>
                        <span>{d.pageViews} Visualizações</span>
                      </div>
                    </div>
                    <div className="w-full h-5 bg-canvas rounded-lg overflow-hidden relative flex items-center">
                      <div 
                        className="h-full bg-plum/10 border-l-4 border-plum transition-all rounded-r-md flex items-center pl-2" 
                        style={{ width: `${(d.activeUsers / 1500) * 100}%` }}
                      >
                        <span className="text-[9px] font-bold text-plum">{d.activeUsers}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Event Occupancy Analytics */}
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-espresso">Média de Público por Categoria (Taxa de Ocupação)</h3>
                  <p className="text-[10px] text-espresso/40">Percentual de ingressos vendidos em relação à capacidade total dos locais.</p>
                </div>
                <div className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                  Média: {platformOccupancyRate}%
                </div>
              </div>

              <div className="space-y-4">
                {categoryDetails.map(cat => (
                  <div key={cat.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-espresso/70">{cat.name}</span>
                      <span className="text-espresso/40 text-[10px]">
                        <strong>{cat.sold}</strong> vendidos / {cat.capacity} capacidade ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-canvas rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all" 
                        style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desempenho de Eventos e Público */}
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-espresso">Desempenho de Eventos e Público</h3>
                  <p className="text-[10px] text-espresso/40">Análise de vendas, ocupação e status de público por evento ativo.</p>
                </div>
                <div className="text-xs font-bold text-plum bg-plum/5 border border-plum/10 px-2.5 py-1 rounded-lg">
                  Eventos do Mês
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-espresso/5 text-espresso/40 text-[9px] uppercase tracking-wider bg-white/30">
                      <th className="px-3 py-2 font-bold">Evento / Produtor</th>
                      <th className="px-3 py-2 font-bold text-right">Vendidos</th>
                      <th className="px-3 py-2 font-bold text-right">Capacidade</th>
                      <th className="px-3 py-2 font-bold text-right">Ocupação</th>
                      <th className="px-3 py-2 font-bold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-espresso/3 text-xs">
                    {eventPerformanceDetails.map((evt) => (
                      <tr key={evt.id} className="hover:bg-white/40 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-espresso">{evt.title}</div>
                          <div className="text-[9px] text-espresso/40">{evt.producer}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-espresso">{evt.sold}</td>
                        <td className="px-3 py-2.5 text-right text-espresso/60">{evt.capacity}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-bold text-espresso">{evt.rate}%</span>
                            <div className="w-10 h-1 bg-canvas rounded-full overflow-hidden hidden sm:block">
                              <div className="h-full bg-plum rounded-full" style={{ width: `${evt.rate}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${evt.statusColor}`}>
                            {evt.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Quick Demographics Cards (Right Col) */}
          <div className="space-y-6">
            {/* User types Distribution */}
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm flex flex-col justify-between h-48">
              <div>
                <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider">Perfil de Usuários</h3>
                <div className="flex items-baseline gap-2 mt-4">
                  <span className="font-serif text-3xl text-espresso">{totalUsers}</span>
                  <span className="text-[10px] text-espresso/40">Totais Cadastrados</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-espresso/60 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-plum" /> Participantes</span>
                  <span className="font-bold text-espresso">{participantUsers} ({Math.round((participantUsers/totalUsers)*100)}%)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-espresso/60 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Produtores</span>
                  <span className="font-bold text-espresso">{producerUsers} ({Math.round((producerUsers/totalUsers)*100)}%)</span>
                </div>
              </div>
            </div>

            {/* Performance Averages */}
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider">Médias Operacionais</h3>
              
              <div className="divide-y divide-espresso/5">
                <div className="py-3 flex justify-between items-center">
                  <div className="text-xs text-espresso/60">Média de Público / Evento</div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-espresso">{averageTicketsPerEvent} pessoas</div>
                    <div className="text-[9px] text-espresso/30">Vendido por evento</div>
                  </div>
                </div>
                <div className="py-3 flex justify-between items-center">
                  <div className="text-xs text-espresso/60">Capacidade Média Locais</div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-espresso">{averageCapacityPerEvent} lugares</div>
                    <div className="text-[9px] text-espresso/30">Média de locais alugados</div>
                  </div>
                </div>
                <div className="py-3 flex justify-between items-center">
                  <div className="text-xs text-espresso/60">Satisfação Média</div>
                  <div className="text-right flex items-center gap-1">
                    <span className="text-sm font-bold text-espresso">4.8</span>
                    <span className="text-amber-500 text-xs">★</span>
                    <span className="text-[9px] text-espresso/30">(Avaliações)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Health Alert */}
            <div className="an-anim p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-emerald-800">Saúde da Plataforma</h4>
                <p className="text-[9px] text-emerald-700 leading-normal mt-0.5">
                  Taxas de rejeição em 1.4% e servidores operando com tempo de resposta médio de 120ms. Nenhuma anomalia financeira ou de segurança detectada nas últimas 24h.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'users_engagement' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
          {/* Usuários Ativos vs Inativos e logs de acesso */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bloco de Atividade de Usuários */}
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <h3 className="text-sm font-semibold text-espresso mb-1">Engajamento e Atividade de Usuários</h3>
              <p className="text-[10px] text-espresso/40 mb-6">Comparativo de retenção de usuários ativos vs usuários sem acessos recentes.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Ativos (Últimos 7 dias)', value: userEngagementMetrics.active7d, percent: Math.round((userEngagementMetrics.active7d/userEngagementMetrics.total)*100), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: UserCheck },
                  { label: 'Ativos (Últimos 30 dias)', value: userEngagementMetrics.active30d, percent: Math.round((userEngagementMetrics.active30d/userEngagementMetrics.total)*100), color: 'text-plum', bg: 'bg-plum/5 border-plum/10', icon: Users },
                  { label: 'Inativos (+30 dias)', value: userEngagementMetrics.inactive, percent: Math.round((userEngagementMetrics.inactive/userEngagementMetrics.total)*100), color: 'text-rose-500', bg: 'bg-rose-50 border-rose-100', icon: UserX },
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-xl border bg-white/30 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${item.bg}`}>
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div>
                      <div className="text-lg font-serif text-espresso font-bold">{item.value}</div>
                      <div className="text-[9px] text-espresso/40 uppercase tracking-wider leading-none mt-0.5">{item.label}</div>
                      <div className="text-[9px] font-bold text-espresso/60 mt-1">{item.percent}% do total</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra de distribuição */}
              <div className="space-y-1.5 mb-2">
                <div className="flex justify-between text-xs text-espresso/60 font-semibold">
                  <span>Proporção de Engajamento</span>
                  <span>Total: {userEngagementMetrics.total} usuários</span>
                </div>
                <div className="w-full h-4 bg-canvas rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-emerald-500" 
                    style={{ width: `${(userEngagementMetrics.active7d / userEngagementMetrics.total) * 100}%` }}
                    title="Ativos 7 dias"
                  />
                  <div 
                    className="h-full bg-plum" 
                    style={{ width: `${((userEngagementMetrics.active30d - userEngagementMetrics.active7d) / userEngagementMetrics.total) * 100}%` }}
                    title="Ativos 30 dias (excluindo 7 dias)"
                  />
                  <div 
                    className="h-full bg-rose-500" 
                    style={{ width: `${(userEngagementMetrics.inactive / userEngagementMetrics.total) * 100}%` }}
                    title="Inativos"
                  />
                </div>
                <div className="flex items-center gap-4 text-[9px] text-espresso/40 font-bold uppercase mt-2 flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Ativos 7d ({Math.round((userEngagementMetrics.active7d/userEngagementMetrics.total)*100)}%)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-plum" /> Ativos 30d ({Math.round(((userEngagementMetrics.active30d - userEngagementMetrics.active7d)/userEngagementMetrics.total)*100)}%)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Inativos ({Math.round((userEngagementMetrics.inactive/userEngagementMetrics.total)*100)}%)</span>
                </div>
              </div>
            </div>

            {/* Histórico de Acessos Recentes (Logs de Auditoria) */}
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-espresso">Histórico de Acessos Recentes</h3>
                  <p className="text-[10px] text-espresso/40">Visualização de quem está entrando e saindo da plataforma em tempo real.</p>
                </div>
                <div className="text-xs font-bold text-plum bg-plum/5 border border-plum/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-pulse text-rose-500" /> Monitor Ativo
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-espresso/5 text-espresso/40 text-[9px] uppercase tracking-wider bg-white/30">
                      <th className="px-3 py-2 font-bold">Usuário / E-mail</th>
                      <th className="px-3 py-2 font-bold">Tipo</th>
                      <th className="px-3 py-2 font-bold">Última Ação</th>
                      <th className="px-3 py-2 font-bold hidden sm:table-cell">Dispositivo</th>
                      <th className="px-3 py-2 font-bold text-right">Horário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-espresso/3 text-xs">
                    {recentAccessLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/40 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-espresso">{log.name}</div>
                          <div className="text-[9px] text-espresso/40">{log.email}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            log.role === 'Admin' 
                              ? 'bg-rose-100 text-rose-800' 
                              : log.role === 'Produtor' 
                              ? 'bg-plum/10 text-plum' 
                              : 'bg-canvas text-espresso/60'
                          }`}>
                            {log.role}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-espresso/80 font-medium">{log.action}</td>
                        <td className="px-3 py-2.5 hidden sm:table-cell text-espresso/40 font-semibold">{log.device}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[10px] text-espresso/50">{log.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Demographics / Engajamento lateral */}
          <div className="space-y-6">
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider">Métricas de Sessão</h3>
              
              <div className="divide-y divide-espresso/5">
                <div className="py-3 flex justify-between items-center">
                  <div className="text-xs text-espresso/60">Duração Média da Sessão</div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-espresso">{userEngagementMetrics.sessionDuration}</div>
                    <div className="text-[9px] text-espresso/30">Navegando no site</div>
                  </div>
                </div>
                <div className="py-3 flex justify-between items-center">
                  <div className="text-xs text-espresso/60">Taxa de Rejeição de Sessão</div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-rose-500">{userEngagementMetrics.bounceRate}</div>
                    <div className="text-[9px] text-espresso/30">Saídas rápidas na home</div>
                  </div>
                </div>
                <div className="py-3 flex justify-between items-center">
                  <div className="text-xs text-espresso/60">Taxa de Conversão Diária</div>
                  <div className="text-right flex items-center gap-1">
                    <span className="text-sm font-bold text-emerald-600">4.5%</span>
                    <span className="text-green-600 text-xs">▲</span>
                    <span className="text-[9px] text-espresso/30 font-semibold">Estável</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="an-anim p-5 rounded-2xl border border-white bg-white/40 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Dica de Engajamento
              </h3>
              <p className="text-[10px] text-espresso/60 leading-relaxed font-semibold">
                Usuários marcados como **Inativos** (+30 dias) são ótimos alvos para campanhas de remarketing. Experimente criar uma **Newsletter** com cupons de desconto na aba correspondente para reativá-los.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'traffic' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Traffic Sources detailed graph */}
          <div className="lg:col-span-2 space-y-6">
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <h3 className="text-sm font-semibold text-espresso mb-1">Origem do Tráfego (Canais de Aquisição)</h3>
              <p className="text-[10px] text-espresso/40 mb-6">De onde vêm os participantes que compram na plataforma.</p>

              <div className="space-y-4">
                {trafficSources.map(src => (
                  <div key={src.source}>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-semibold text-espresso/70 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: src.color }} />
                        {src.source}
                      </span>
                      <span className="text-espresso/40 text-[10px]">
                        <strong>{src.count.toLocaleString()}</strong> visitas ({src.share}%)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-canvas rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all" 
                        style={{ width: `${src.share}%`, backgroundColor: src.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily visits estimate chart bars */}
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <h3 className="text-sm font-semibold text-espresso mb-1">Visitas Semanais (Estimativas)</h3>
              <p className="text-[10px] text-espresso/40 mb-6">Volume médio diário de acessos à página `/events` e checkout.</p>
              
              <div className="flex items-end gap-3 h-36 pt-4">
                {[
                  { day: 'Seg', visits: 1200, percentage: 40 },
                  { day: 'Ter', visits: 1500, percentage: 50 },
                  { day: 'Qua', visits: 1400, percentage: 46 },
                  { day: 'Qui', visits: 1800, percentage: 60 },
                  { day: 'Sex', visits: 2800, percentage: 93 },
                  { day: 'Sáb', visits: 3000, percentage: 100 },
                  { day: 'Dom', visits: 2100, percentage: 70 },
                ].map(item => (
                  <div key={item.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="text-[9px] font-bold text-plum opacity-0 group-hover:opacity-100 transition-opacity">
                      {(item.visits / 1000).toFixed(1)}k
                    </div>
                    <div className="w-full bg-plum/5 rounded-t-lg relative" style={{ height: '70%' }}>
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-plum/20 hover:bg-plum/30 rounded-t-lg transition-all" 
                        style={{ height: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-[9.5px] font-semibold text-espresso/40">{item.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Devices and Browsers distribution (Right Col) */}
          <div className="space-y-6">
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider mb-5">Acesso por Dispositivo</h3>

              <div className="space-y-4">
                {[
                  { label: 'Mobile (Smartphones)', icon: Smartphone, share: 72, color: 'text-plum', bg: 'bg-plum/5 border-plum/10' },
                  { label: 'Desktop (Computadores)', icon: Laptop, share: 24, color: 'text-rose-500', bg: 'bg-rose-50 border-rose-100' },
                  { label: 'Tablet (iPads/Outros)', icon: Tablet, share: 4, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-100' },
                ].map(dev => (
                  <div key={dev.label} className="flex items-center gap-3 p-3 rounded-xl border border-white bg-white/30">
                    <div className={`p-2 rounded-lg ${dev.bg}`}>
                      <dev.icon className={`w-4.5 h-4.5 ${dev.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-espresso/70 truncate">{dev.label}</div>
                      <div className="w-full h-1.5 bg-canvas rounded-full mt-1.5 overflow-hidden">
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${dev.share}%`, 
                            backgroundColor: dev.color.includes('plum') ? 'var(--plum)' : dev.color.includes('rose') ? '#f43f5e' : '#3b82f6' 
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-espresso">{dev.share}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider mb-4">Métricas de Rejeição</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs pb-3 border-b border-espresso/5">
                  <span className="text-espresso/60">Tempo Médio na Sessão</span>
                  <span className="font-bold text-espresso">3m 42s</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-3 border-b border-espresso/5">
                  <span className="text-espresso/60">Visualizações por Sessão</span>
                  <span className="font-bold text-espresso">4.8 páginas</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-espresso/60">Taxa de Rejeição (Bounce)</span>
                  <span className="font-bold text-espresso">38.4%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'funnel' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Funnel chart (Left/Center Col) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-espresso">Funil de Vendas de Ingressos (Conversão Geral)</h3>
                  <p className="text-[10px] text-espresso/40">Porcentagem de conversão a cada etapa do participante na Evokaa.</p>
                </div>
                <div className="text-xs font-bold text-plum bg-plum/5 border border-plum/10 px-2.5 py-1 rounded-lg">
                  Taxa Global: {globalConversionRate}%
                </div>
              </div>

              {/* Visual Funnel Blocks */}
              <div className="space-y-3">
                {funnelSteps.map((step, idx) => {
                  const maxCount = funnelSteps[0].count
                  const widthPercent = (step.count / maxCount) * 100
                  return (
                    <div key={step.step} className="flex flex-col md:flex-row md:items-center gap-2">
                      <div className="w-40 text-xs font-semibold text-espresso/60 md:text-right">{step.step}</div>
                      <div className="flex-1">
                        <div className="w-full bg-canvas rounded-xl overflow-hidden h-9 relative border border-espresso/3">
                          <div 
                            className={`h-full rounded-r-xl transition-all duration-700 flex items-center px-4 justify-between border-l-4 ${step.color.split(' ')[0]} ${step.color.split(' ')[2]}`}
                            style={{ width: `${widthPercent}%` }}
                          >
                            <span className="text-[10px] font-bold">{step.count.toLocaleString()}</span>
                            <span className="text-[9px] font-bold opacity-80">{step.percentage}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Funnel Insights (Right Col) */}
          <div className="space-y-6">
            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider mb-4">Gargalos do Funil</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                  <div>
                    <h4 className="text-xs font-bold text-espresso/80">Abandono no Checkout (59.3%)</h4>
                    <p className="text-[9px] text-espresso/50 leading-normal mt-0.5">
                      A maioria dos usuários desiste na etapa de inserção dos dados de cartão. Recomendamos otimizar a clareza do Pix e parcelamento.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                  <div>
                    <h4 className="text-xs font-bold text-espresso/80">Descoberta em Catálogo (42.1%)</h4>
                    <p className="text-[9px] text-espresso/50 leading-normal mt-0.5">
                      42.1% dos visitantes que entram na home clicam para ver um evento. A nova barra de busca inteligente deve elevar este índice.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="an-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider">Métricas de Carrinho</h3>
              <div className="flex justify-between items-center text-xs pb-3 border-b border-espresso/5">
                <span className="text-espresso/60">Ticket Médio das Compras</span>
                <span className="font-bold text-espresso">R$ 141,17</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-espresso/60">Ingressos por Compra</span>
                <span className="font-bold text-espresso">1.8 ingressos</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
