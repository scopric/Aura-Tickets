import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Users, DollarSign, Ticket, TrendingUp, ArrowUpRight, Plus, Palette, BarChart3, AlertTriangle } from 'lucide-react'
import gsap from 'gsap'
import { useProducerEvents } from '../../hooks/useEvents'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

// Helper: envolve uma promise com timeout
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export default function ProducerDashboard() {
  const ref = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const { data: events, isLoading: isEventsLoading, error: eventsError } = useProducerEvents()

  // Buscar pedidos recentes reais
  const { data: recentOrders, isLoading: isOrdersLoading, error: ordersError } = useQuery({
    queryKey: ['producer-recent-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const fetchPromise = async () => {
        const { data: producerEvents } = await supabase
          .from('events')
          .select('id')
          .eq('producer_id', user.id)

        if (!producerEvents || producerEvents.length === 0) return []
        const eventIds = producerEvents.map(e => e.id)

        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id,
            created_at,
            total,
            user_id,
            event_id,
            events (title),
            profiles (full_name)
          `)
          .in('event_id', eventIds)
          .order('created_at', { ascending: false })
          .limit(5)

        if (error) throw error
        return orders || []
      }

      return withTimeout(fetchPromise(), 6000, [])
    },
    enabled: !!user?.id,
  })

  // Buscar consolidado financeiro real via orders + tickets
  const { data: financeSummary, isLoading: isFinanceLoading, error: financeError } = useQuery({
    queryKey: ['producer-finance-summary', user?.id],
    queryFn: async () => {
      const fallbackVal = { tickets_sold: 0, total_revenue: 0, unique_buyers: 0 }
      if (!user?.id) return fallbackVal

      const fetchPromise = async () => {
        const { data: producerEvents } = await supabase
          .from('events')
          .select('id')
          .eq('producer_id', user.id)

        if (!producerEvents || producerEvents.length === 0) return fallbackVal
        const eventIds = producerEvents.map(e => e.id)

        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('total, user_id')
          .in('event_id', eventIds)

        if (ordersError) throw ordersError

        const { data: tickets, error: ticketsError } = await supabase
          .from('tickets')
          .select('id')
          .in('event_id', eventIds)

        if (ticketsError) throw ticketsError

        const totalRevenue = orders?.reduce((acc, o) => acc + (Number(o.total) || 0), 0) || 0
        const ticketsSold = tickets?.length || 0
        const uniqueBuyers = new Set(orders?.map(o => o.user_id) || []).size

        return {
          tickets_sold: ticketsSold,
          total_revenue: totalRevenue,
          unique_buyers: uniqueBuyers,
        }
      }

      return withTimeout(fetchPromise(), 6000, fallbackVal)
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (!isEventsLoading && !isFinanceLoading) {
      const ctx = gsap.context(() => {
        gsap.fromTo('.dash-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out' })
      }, ref)
      return () => ctx.revert()
    }
  }, [isEventsLoading, isFinanceLoading])

  const activeEventsCount = events?.filter(e => e.status === 'published').length || 0
  const totalTicketsSold = financeSummary?.tickets_sold ?? 0
  const totalRevenue = financeSummary?.total_revenue ?? 0
  const totalCapacity = events?.reduce((total, event) => {
    return total + (event.ticket_types?.reduce((sum, t) => sum + (t.capacity || 0), 0) || 0)
  }, 0) || 0
  const uniqueBuyers = financeSummary?.unique_buyers ?? 0

  const stats = [
    { label: 'Eventos Ativos', value: activeEventsCount.toString(), icon: Calendar, change: 'Eventos no ar', color: 'plum' },
    { label: 'Total de Vendas', value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, change: 'Receita acumulada', color: 'green' },
    { label: 'Ingressos Vendidos', value: totalTicketsSold.toLocaleString('pt-BR'), icon: Ticket, change: `${totalCapacity > 0 ? Math.round((totalTicketsSold / totalCapacity) * 100) : 0}% ocupação média`, color: 'plum' },
    { label: 'Compradores Únicos', value: uniqueBuyers.toLocaleString('pt-BR'), icon: Users, change: 'Participantes individuais', color: 'green' },
  ]

  const formatTimeElapsed = (dateStr: string) => {
    try {
      const diffMs = new Date().getTime() - new Date(dateStr).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Agora mesmo'
      if (diffMins < 60) return `Há ${diffMins} minutos`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `Há ${diffHours} horas`
      return new Date(dateStr).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
    } catch {
      return ''
    }
  }

  const hasAnyError = eventsError || ordersError || financeError
  const isLoading = isEventsLoading || isFinanceLoading || isOrdersLoading

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Dashboard</h1>
          <p className="text-sm text-espresso/50 mt-1">Visão geral dos seus eventos com dados reais</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/producer/finance"
            className="flex items-center gap-2 px-5 py-2.5 bg-plum/10 text-plum text-sm font-medium rounded-full hover:bg-plum/20 transition-all"
          >
            <BarChart3 className="w-4 h-4" />
            Ver Financeiro
          </Link>
          <Link
            to="/producer/planner"
            className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Evento
          </Link>
        </div>
      </div>

      {hasAnyError && (
        <div className="p-6 mb-6 bg-red-50/50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Erro ao carregar dados do dashboard: {(eventsError as any)?.message || (ordersError as any)?.message || (financeError as any)?.message || 'Erro desconhecido'}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          [1, 2, 3, 4].map(n => (
            <div key={n} className="dash-card p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md animate-pulse h-[142px]">
              <div className="w-10 h-10 bg-white/[0.05] rounded-xl mb-3" />
              <div className="h-6 bg-white/[0.05] rounded w-24 mb-2" />
              <div className="h-4 bg-white/[0.05] rounded w-16" />
            </div>
          ))
        ) : (
          stats.map((stat) => (
            <div key={stat.label} className="dash-card p-5 rounded-2xl surface">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-${stat.color === 'plum' ? 'plum' : 'green-600'}/10 flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color === 'plum' ? 'plum' : 'green-600'}`} />
                </div>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div className="font-serif text-xl lg:text-2xl text-espresso break-words">{stat.value}</div>
              <div className="text-xs text-espresso/40 mt-1">{stat.label}</div>
              <div className="text-[10px] text-green-400 mt-2">{stat.change}</div>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events list */}
        <div className="lg:col-span-2">
          <div className="dash-card p-6 rounded-2xl surface">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl text-espresso">Meus Eventos Recentes</h2>
              <Link to="/producer/events" className="text-xs text-plum hover:underline flex items-center gap-1">
                Ver todos <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {isEventsLoading ? (
              <div className="space-y-3">
                {[1, 2].map(n => (
                  <div key={n} className="h-20 bg-white/[0.02] border border-white/[0.05] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : !events || events.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-espresso/50 mb-4">Você ainda não tem eventos cadastrados.</p>
                <Link
                  to="/producer/planner"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all"
                >
                  <Plus className="w-3 h-3" /> Criar meu primeiro evento
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {events.slice(0, 4).map((event) => {
                  const ticketTypes = event.ticket_types || []
                  const eventSold = ticketTypes.reduce((s, t) => s + (t.sold || 0), 0)
                  const eventRevenue = ticketTypes.reduce((s, t) => s + (t.price * (t.sold || 0)), 0)

                  return (
                    <Link
                      key={event.id}
                      to={`/producer/events`}
                      className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-plum/20 hover:bg-white/[0.04] transition-all group"
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={event.cover_image || '/images/hero-bg.jpg'} alt={event.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-espresso group-hover:text-plum transition-colors truncate">{event.title}</h3>
                        <p className="text-xs text-espresso/40 truncate">
                          {event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : 'Sem data'} · {event.venue_name || 'Sem local'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-espresso">R$ {eventRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className="text-[10px] text-espresso/40">{eventSold} vendidos</div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-espresso/20 group-hover:text-plum transition-colors" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Activity list */}
        <div className="dash-card p-6 rounded-2xl surface">
          <h2 className="font-serif text-xl text-espresso mb-6">Atividade Recente</h2>

          {isOrdersLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map(n => (
                <div key={n} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/[0.05]" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 bg-white/[0.05] rounded w-32" />
                    <div className="h-3 bg-white/[0.05] rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : !recentOrders || recentOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xs text-espresso/40">Nenhuma venda registrada recentemente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order: any, i) => (
                <div key={order.id || i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500/10">
                    <DollarSign className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-espresso">
                      Ingresso vendido para <span className="font-medium">{order.profiles?.full_name || 'Cliente'}</span>
                    </p>
                    <p className="text-xs text-espresso/40 truncate max-w-[180px]">{order.events?.title || 'Evento'}</p>
                    <p className="text-[10px] text-espresso/30 mt-0.5">{formatTimeElapsed(order.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dash-card mt-6 p-6 rounded-2xl surface text-espresso">
        <h2 className="font-serif text-xl mb-4 text-espresso">Ações Rápidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Planejar Evento', to: '/producer/planner', icon: Plus },
            { label: 'Editar Marca', to: '/producer/brand', icon: Palette },
            { label: 'Ver Contatos', to: '/producer/crm', icon: Users },
            { label: 'Financeiro', to: '/producer/finance', icon: BarChart3 },
          ].map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="flex items-center gap-3 p-4 rounded-xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-plum/30 dark:hover:border-plum/30 transition-all group"
            >
              <action.icon className="w-5 h-5 text-plum" />
              <span className="text-sm text-espresso/80 group-hover:text-plum transition-colors">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
