import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FolderOpen, Plus, Music, Heart, Mic, Building, Guitar, Cake, GraduationCap, Search, TrendingUp, DollarSign, Users, CalendarDays, ArrowRight, MoreHorizontal, Pencil, Copy, Archive, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import gsap from 'gsap'
import { managedEvents, eventProfiles } from '../../data/eventManagerData'
import type { EventProfile } from '../../data/eventManagerData'

const profileIcons: Record<EventProfile, typeof Music> = {
  balada: Music, casamento: Heart, festival: Mic,
  corporativo: Building, show: Guitar, aniversario: Cake, formatura: GraduationCap,
}

const profileColors: Record<EventProfile, string> = {
  balada: '#7a3b69', casamento: '#e11d48', festival: '#3b82f6',
  corporativo: '#64748b', show: '#f59e0b', aniversario: '#22c55e', formatura: '#8b5cf6',
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  planning: { label: 'Planejando', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
  selling: { label: 'Vendendo', cls: 'bg-green-50 text-green-600 border-green-100' },
  ready: { label: 'Pronto', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
  happening: { label: 'Acontecendo', cls: 'bg-plum/10 text-plum border-plum/20' },
  finished: { label: 'Finalizado', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-50 text-red-500 border-red-100' },
}

export default function EventManager() {
  const ref = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [events, setEvents] = useState(managedEvents)
  const [actionMenu, setActionMenu] = useState<string | null>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.event-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [filter, search])

  const filtered = events.filter(e => {
    const matchesFilter = filter === 'all' || e.status === filter
    const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase()) || e.location.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const totalRevenue = events.reduce((s, e) => s + e.ticketRevenue + e.foodRevenue + e.merchRevenue, 0)
  const totalSold = events.reduce((s, e) => s + e.sold, 0)
  const totalCapacity = events.reduce((s, e) => s + e.capacity, 0)

  const handleDuplicate = (id: string) => {
    const event = events.find(e => e.id === id)
    if (!event) return
    const dup = { ...event, id: `dup-${Date.now()}`, title: `${event.title} (Copia)`, status: 'planning' as const, sold: 0 }
    setEvents([dup, ...events])
    setActionMenu(null)
    toast.success('Evento duplicado!')
  }

  const handleArchive = (id: string) => {
    setEvents(events.map(e => e.id === id ? { ...e, status: 'finished' as const } : e))
    setActionMenu(null)
    toast.success('Evento arquivado!')
  }

  const handleDelete = (id: string) => {
    setEvents(events.filter(e => e.id !== id))
    setActionMenu(null)
    toast.success('Evento excluido!')
  }

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Gestor de Festas</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie todos os seus eventos em um so lugar</p>
        </div>
        <Link to="/producer/planner" className="px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" /> Planejar Evento
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Eventos', value: managedEvents.length.toString(), icon: CalendarDays },
          { label: 'Vendidos', value: `${totalSold}/${totalCapacity}`, icon: Users },
          { label: 'Receita', value: `R$ ${(totalRevenue / 1000).toFixed(0)}K`, icon: DollarSign },
          { label: 'Ocupacao', value: `${Math.round((totalSold / totalCapacity) * 100)}%`, icon: TrendingUp },
        ].map(k => (
          <div key={k.label} className="event-card p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="event-card flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar eventos..." className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'planning', label: 'Planejando' },
            { key: 'selling', label: 'Vendendo' },
            { key: 'ready', label: 'Pronto' },
            { key: 'finished', label: 'Finalizado' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${filter === f.key ? 'bg-plum text-cream' : 'bg-white/60 border border-white/60 text-espresso/60 hover:text-espresso'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen className="w-12 h-12 text-espresso/10 mx-auto mb-4" />
          <p className="text-espresso/30 text-sm">Nenhum evento encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(event => {
            const profile = eventProfiles[event.profile]
            const Icon = profileIcons[event.profile]
            const color = profileColors[event.profile]
            const status = statusLabels[event.status]
            const totalRev = event.ticketRevenue + event.foodRevenue + event.merchRevenue
            const totalBudget = event.budget.reduce((s, b) => s + b.estimated, 0)
            const totalPaid = event.budget.reduce((s, b) => s + b.paid, 0)
            const profit = totalRev - totalPaid
            const progress = Math.round((event.sold / event.capacity) * 100)
            return (
              <Link to={`/producer/event/${event.id}`} key={event.id} className="event-card group p-5 rounded-2xl bg-white/60 border border-white/60 hover:shadow-elevated hover:-translate-y-1 transition-all duration-300">
                {/* Top */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-espresso">{event.title}</div>
                      <div className="text-[10px] text-espresso/30">{profile.label} · {event.date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${status.cls}`}>{status.label}</span>
                    <div className="relative">
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActionMenu(actionMenu === event.id ? null : event.id) }} className="p-1 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {actionMenu === event.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-elevated border border-white/60 z-20 py-1 overflow-hidden">
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActionMenu(null) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-espresso hover:bg-canvas transition-colors">
                              <Pencil className="w-3.5 h-3.5 text-plum" /> Editar evento
                            </button>
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDuplicate(event.id) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-espresso hover:bg-canvas transition-colors">
                              <Copy className="w-3.5 h-3.5 text-blue-500" /> Duplicar
                            </button>
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleArchive(event.id) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-espresso hover:bg-canvas transition-colors">
                              <Archive className="w-3.5 h-3.5 text-amber-500" /> Arquivar
                            </button>
                            <div className="border-t border-espresso/5 my-1" />
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(event.id) }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-espresso/30">Vendas</span>
                    <span className="text-[10px] text-espresso/50">{event.sold}/{event.capacity}</span>
                  </div>
                  <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, backgroundColor: color }} />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-canvas text-center">
                    <div className="text-xs font-medium text-espresso">R$ {(totalRev / 1000).toFixed(0)}K</div>
                    <div className="text-[9px] text-espresso/30">Receita</div>
                  </div>
                  <div className="p-2 rounded-lg bg-canvas text-center">
                    <div className={`text-xs font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>R$ {(profit / 1000).toFixed(0)}K</div>
                    <div className="text-[9px] text-espresso/30">Lucro</div>
                  </div>
                  <div className="p-2 rounded-lg bg-canvas text-center">
                    <div className="text-xs font-medium text-espresso">{Math.round((totalPaid / totalBudget) * 100)}%</div>
                    <div className="text-[9px] text-espresso/30">Orcamento</div>
                  </div>
                </div>

                {/* Tasks */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      {event.team.slice(0, 3).map(t => (
                        <div key={t.id} className="w-5 h-5 rounded-full bg-plum/10 border border-white flex items-center justify-center">
                          <span className="text-[8px] text-plum font-medium">{t.name[0]}</span>
                        </div>
                      ))}
                      {event.team.length > 3 && <div className="w-5 h-5 rounded-full bg-canvas border border-white flex items-center justify-center"><span className="text-[8px] text-espresso/30">+{event.team.length - 3}</span></div>}
                    </div>
                    <span className="text-[10px] text-espresso/30">{event.tasks.filter(t => t.status === 'done').length}/{event.tasks.length} tarefas</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-espresso/10 group-hover:text-plum transition-all group-hover:translate-x-1" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
