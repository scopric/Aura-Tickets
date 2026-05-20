import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Calendar, Users, DollarSign, Ticket, TrendingUp, Eye, ArrowUpRight, Plus, Palette, BarChart3 } from 'lucide-react'
import gsap from 'gsap'
import { events } from '../../data/mockData'

export default function ProducerDashboard() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.dash-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [])

  const stats = [
    { label: 'Eventos Ativos', value: '3', icon: Calendar, change: '+1 este mes', color: 'plum' },
    { label: 'Total de Vendas', value: 'R$ 45.680', icon: DollarSign, change: '+12% vs mes passado', color: 'green' },
    { label: 'Ingressos Vendidos', value: '1.420', icon: Ticket, change: '+8% vs mes passado', color: 'plum' },
    { label: 'Participantes', value: '892', icon: Users, change: '+15% vs mes passado', color: 'green' },
  ]

  const recentActivity = [
    { action: 'Novo ingresso vendido', event: 'Noite Eletro 2025', time: '2 minutos atras', type: 'sale' },
    { action: 'Novo interessado', event: 'Jazz Sunset Session', time: '5 minutos atras', type: 'interest' },
    { action: 'Mesa VIP reservada', event: 'Noite Eletro 2025', time: '12 minutos atras', type: 'reservation' },
    { action: 'Novo contato', event: 'Feira de Arte', time: '25 minutos atras', type: 'contact' },
  ]

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Dashboard</h1>
          <p className="text-sm text-espresso/50 mt-1">Visao geral dos seus eventos</p>
        </div>
        <Link
          to="/producer/events/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Evento
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="dash-card p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-${stat.color}/10 flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 text-${stat.color === 'plum' ? 'plum' : 'green-600'}`} />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="font-serif text-2xl text-espresso">{stat.value}</div>
            <div className="text-xs text-espresso/40 mt-1">{stat.label}</div>
            <div className="text-[10px] text-green-600 mt-2">{stat.change}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events */}
        <div className="lg:col-span-2">
          <div className="dash-card p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl text-espresso">Meus Eventos</h2>
              <Link to="/producer/events" className="text-xs text-plum hover:underline flex items-center gap-1">
                Ver todos <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {events.map((event) => (
                <Link
                  key={event.id}
                  to={`/producer/events`}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/40 border border-white/40 hover:border-plum/20 hover:bg-white/60 transition-all group"
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-espresso group-hover:text-plum transition-colors">{event.title}</h3>
                    <p className="text-xs text-espresso/40">{event.date} · {event.location}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-espresso">R$ {event.tickets.reduce((s, t) => s + t.price * t.sold, 0).toLocaleString()}</div>
                    <div className="text-[10px] text-espresso/40">{event.tickets.reduce((s, t) => s + t.sold, 0)} vendidos</div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-espresso/20 group-hover:text-plum transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className="dash-card p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
          <h2 className="font-serif text-xl text-espresso mb-6">Atividade Recente</h2>
          <div className="space-y-4">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  activity.type === 'sale' ? 'bg-green-100' :
                  activity.type === 'interest' ? 'bg-plum/10' :
                  activity.type === 'reservation' ? 'bg-amber-100' :
                  'bg-blue-100'
                }`}>
                  {activity.type === 'sale' ? <DollarSign className="w-3.5 h-3.5 text-green-600" /> :
                   activity.type === 'interest' ? <Eye className="w-3.5 h-3.5 text-plum" /> :
                   activity.type === 'reservation' ? <Ticket className="w-3.5 h-3.5 text-amber-600" /> :
                   <Users className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <div>
                  <p className="text-sm text-espresso">{activity.action}</p>
                  <p className="text-xs text-espresso/40">{activity.event}</p>
                  <p className="text-[10px] text-espresso/30 mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dash-card mt-6 p-6 rounded-2xl bg-void text-cream">
        <h2 className="font-serif text-xl mb-4">Acoes Rapidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Criar Evento', to: '/producer/events/new', icon: Plus },
            { label: 'Editar Marca', to: '/producer/brand', icon: Palette },
            { label: 'Ver Contatos', to: '/producer/crm', icon: Users },
            { label: 'Financeiro', to: '/producer/finance', icon: BarChart3 },
          ].map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-plum/30 transition-all group"
            >
              <action.icon className="w-5 h-5 text-plum" />
              <span className="text-sm">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
