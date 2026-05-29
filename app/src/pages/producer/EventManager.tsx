import { useRef, useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, Plus, Music, Heart, Mic, Building, Guitar, Cake, GraduationCap, Search, TrendingUp, DollarSign, Users, CalendarDays, ArrowRight, MoreHorizontal, Pencil, Copy, Archive, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import gsap from 'gsap'
import { useProducerEvents, useDeleteEvent, useCreateEvent, useUpdateEvent, type DbEvent } from '../../hooks/useEvents'
import { useAuth } from '../../hooks/useAuth'

const profileIcons: Record<string, typeof Music> = {
  balada: Music, casamento: Heart, festival: Mic,
  corporativo: Building, show: Guitar, aniversario: Cake, formatura: GraduationCap,
}

const profileColors: Record<string, string> = {
  balada: '#7a3b69', casamento: '#e11d48', festival: '#3b82f6',
  corporativo: '#64748b', show: '#f59e0b', aniversario: '#22c55e', formatura: '#8b5cf6',
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Planejando', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
  published: { label: 'Vendendo', cls: 'bg-green-50 text-green-600 border-green-100' },
  ready: { label: 'Pronto', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
  happening: { label: 'Acontecendo', cls: 'bg-plum/10 text-plum border-plum/20' },
  ended: { label: 'Finalizado', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-50 text-red-500 border-red-100' },
}

function detectProfile(event: DbEvent): string {
  const cat = (event.category || '').toLowerCase()
  if (cat.includes('casamento')) return 'casamento'
  if (cat.includes('formatura')) return 'formatura'
  if (cat.includes('aniversario') || cat.includes('birthday')) return 'aniversario'
  if (cat.includes('corporativo') || cat.includes('business') || cat.includes('networking')) return 'corporativo'
  if (cat.includes('festival')) return 'festival'
  if (cat.includes('balada') || cat.includes('party') || cat.includes('noite')) return 'balada'
  if (cat.includes('show') || cat.includes('musica') || cat.includes('concerto')) return 'show'
  return 'show'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Data a definir'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function eventLocation(event: DbEvent): string {
  const parts = [event.venue_name, event.venue_city, event.venue_state].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Local a definir'
}

export default function EventManager() {
  const ref = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [actionMenu, setActionMenu] = useState<string | null>(null)

  const { data: events, isLoading, error } = useProducerEvents()
  const deleteEvent = useDeleteEvent()
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()

  // Animação GSAP ao trocar filtros
  useEffect(() => {
    if (!ref.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.event-card', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'power3.out' })
    }, ref)
    return () => ctx.revert()
  }, [filter, search, events])

  const processedEvents = useMemo(() => {
    if (!events) return []
    return events.map(event => {
      const profile = detectProfile(event)
      const sold = (event.ticket_types || []).reduce((s, t) => s + (t.sold || 0), 0)
      const capacity = event.capacity || (event.ticket_types || []).reduce((s, t) => s + (t.capacity || 0), 0)
      const ticketRevenue = (event.ticket_types || []).reduce((s, t) => s + (t.price || 0) * (t.sold || 0), 0)
      return {
        ...event,
        profile,
        sold,
        capacity: capacity || 0,
        ticketRevenue,
      }
    })
  }, [events])

  const filtered = useMemo(() => {
    return processedEvents.filter(e => {
      const matchesFilter = filter === 'all' || e.status === filter
      const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
        eventLocation(e).toLowerCase().includes(search.toLowerCase())
      return matchesFilter && matchesSearch
    })
  }, [processedEvents, filter, search])

  const totalRevenue = processedEvents.reduce((s, e) => s + e.ticketRevenue, 0)
  const totalSold = processedEvents.reduce((s, e) => s + e.sold, 0)
  const totalCapacity = processedEvents.reduce((s, e) => s + e.capacity, 0)

  const handleDuplicate = async (event: DbEvent & { profile: string; sold: number; capacity: number; ticketRevenue: number }) => {
    try {
      await createEvent.mutateAsync({
        event: {
          title: `${event.title} (Copia)`,
          subtitle: event.subtitle,
          description: event.description,
          short_description: event.short_description,
          cover_image: event.cover_image,
          image_url: event.image_url,
          category: event.category,
          tags: event.tags,
          venue_name: event.venue_name,
          venue_address: event.venue_address,
          venue_city: event.venue_city,
          venue_state: event.venue_state,
          date: event.date,
          time: event.time,
          start_date: event.start_date,
          end_date: event.end_date,
          status: 'draft',
          visibility: event.visibility,
          capacity: event.capacity,
          branding: event.branding,
          settings: event.settings,
        },
        tickets: (event.ticket_types || []).map(t => ({
          name: t.name,
          description: t.description,
          price: t.price,
          capacity: t.capacity,
          type: t.type,
          perks: t.perks,
        })),
      })
      setActionMenu(null)
      toast.success('Evento duplicado com sucesso!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao duplicar evento')
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await updateEvent.mutateAsync({
        eventId: id,
        event: { status: 'ended' },
        tickets: [],
      })
      setActionMenu(null)
      toast.success('Evento arquivado!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao arquivar evento')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent.mutateAsync(id)
      setActionMenu(null)
      toast.success('Evento excluido!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir evento')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-7xl flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-plum animate-spin mx-auto mb-4" />
          <p className="text-sm text-espresso/50">Carregando seus eventos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 lg:p-10 max-w-7xl flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-2">Erro ao carregar eventos</p>
          <p className="text-xs text-espresso/40">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Gestor de Festas</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie todos os seus eventos em um so lugar</p>
        </div>
        <Link to="/producer/events/new" className="px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" /> Planejar Evento
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Eventos', value: processedEvents.length.toString(), icon: CalendarDays },
          { label: 'Vendidos', value: `${totalSold}/${totalCapacity}`, icon: Users },
          { label: 'Receita', value: `R$ ${(totalRevenue / 1000).toFixed(0)}K`, icon: DollarSign },
          { label: 'Ocupacao', value: totalCapacity > 0 ? `${Math.round((totalSold / totalCapacity) * 100)}%` : '0%', icon: TrendingUp },
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
            { key: 'draft', label: 'Planejando' },
            { key: 'published', label: 'Vendendo' },
            { key: 'ended', label: 'Finalizado' },
            { key: 'cancelled', label: 'Cancelado' },
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
          {processedEvents.length === 0 && (
            <Link to="/producer/events/new" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all">
              <Plus className="w-3.5 h-3.5" /> Criar primeiro evento
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(event => {
            const Icon = profileIcons[event.profile] || Music
            const color = profileColors[event.profile] || profileColors.show
            const status = statusLabels[event.status] || statusLabels.draft
            const progress = event.capacity > 0 ? Math.round((event.sold / event.capacity) * 100) : 0
            const location = eventLocation(event)

            return (
              <div key={event.id} className="event-card group relative p-5 rounded-2xl bg-white/60 border border-white/60 hover:shadow-elevated hover:-translate-y-1 transition-all duration-300">
                {/* Top */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-espresso truncate">{event.title}</div>
                      <div className="text-[10px] text-espresso/30 truncate">{event.category || 'Evento'} · {formatDate(event.date)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${status.cls}`}>{status.label}</span>
                    <div className="relative">
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActionMenu(actionMenu === event.id ? null : event.id) }} className="p-1 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {actionMenu === event.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-elevated border border-white/60 z-20 py-1 overflow-hidden">
                            <Link to={`/producer/events/${event.id}/edit`} onClick={() => setActionMenu(null)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-espresso hover:bg-canvas transition-colors">
                              <Pencil className="w-3.5 h-3.5 text-plum" /> Editar evento
                            </Link>
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDuplicate(event as any) }} disabled={createEvent.isPending} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-espresso hover:bg-canvas transition-colors disabled:opacity-50">
                              <Copy className="w-3.5 h-3.5 text-blue-500" /> Duplicar
                            </button>
                            {event.status !== 'ended' && (
                              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleArchive(event.id) }} disabled={updateEvent.isPending} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-espresso hover:bg-canvas transition-colors disabled:opacity-50">
                                <Archive className="w-3.5 h-3.5 text-amber-500" /> Arquivar
                              </button>
                            )}
                            <div className="border-t border-espresso/5 my-1" />
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(event.id) }} disabled={deleteEvent.isPending} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
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
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }} />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-2 rounded-lg bg-canvas text-center">
                    <div className="text-xs font-medium text-espresso">R$ {(event.ticketRevenue / 1000).toFixed(1)}K</div>
                    <div className="text-[9px] text-espresso/30">Receita</div>
                  </div>
                  <div className="p-2 rounded-lg bg-canvas text-center">
                    <div className="text-xs font-medium text-green-600">R$ 0K</div>
                    <div className="text-[9px] text-espresso/30">Lucro</div>
                  </div>
                  <div className="p-2 rounded-lg bg-canvas text-center">
                    <div className="text-xs font-medium text-espresso">0%</div>
                    <div className="text-[9px] text-espresso/30">Orcamento</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      <div className="w-5 h-5 rounded-full bg-plum/10 border border-white flex items-center justify-center">
                        <span className="text-[8px] text-plum font-medium">V</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-espresso/30">{location}</span>
                  </div>
                  <Link to={`/producer/event/${event.id}`} className="flex items-center gap-1 text-[10px] text-plum hover:underline">
                    Ver detalhes <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
