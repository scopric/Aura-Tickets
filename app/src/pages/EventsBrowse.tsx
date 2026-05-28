import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Search, Calendar, MapPin, ArrowRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

const CATEGORIES = ['Todos', 'Festa', 'Corporativo', 'Workshop', 'Show', 'Palestra', 'Networking', 'Gastronomia', 'Esporte']

export default function EventsBrowse() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [dateFilter, setDateFilter] = useState('Todos') // 'Todos', 'hoje', 'fim-de-semana', 'mes', 'especifica', 'periodo'
  const [specificDate, setSpecificDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['browse-events', category, dateFilter, search, specificDate, startDate, endDate],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split('T')[0]
      let query = supabase
        .from('events')
        .select('*, ticket_types (*)')
        .eq('status', 'published')
        .eq('approval_status', 'approved')
        .gte('date', todayStr)

      if (category !== 'Todos') {
        query = query.eq('category', category)
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,venue_name.ilike.%${search}%`)
      }

      const { data, error } = await query.order('date', { ascending: true })
      if (error) throw error

      // Filtro de data local para maior flexibilidade
      return (data || []).map((evt: any) => ({
        ...evt,
        ticket_types: (evt.ticket_types || []).map((t: any) => ({
          ...t,
          price: Number(t.price) || 0
        }))
      })).filter(evt => {
        if (dateFilter === 'Todos') return true
        if (!evt.date) return false

        const evtDate = new Date(evt.date + 'T00:00:00')
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        
        if (dateFilter === 'hoje') {
          return evt.date === now.toISOString().split('T')[0]
        }
        
        if (dateFilter === 'fim-de-semana') {
          const nextSunday = new Date(now)
          nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7)
          const prevFriday = new Date(nextSunday)
          prevFriday.setDate(nextSunday.getDate() - 2)
          return evtDate >= prevFriday && evtDate <= nextSunday
        }

        if (dateFilter === 'mes') {
          return evtDate.getMonth() === now.getMonth() && evtDate.getFullYear() === now.getFullYear()
        }

        if (dateFilter === 'especifica' && specificDate) {
          return evt.date === specificDate
        }

        if (dateFilter === 'periodo' && startDate) {
          const start = new Date(startDate + 'T00:00:00')
          const end = endDate ? new Date(endDate + 'T23:59:59') : null
          if (end) {
            return evtDate >= start && evtDate <= end
          }
          return evtDate >= start
        }

        return true
      })
    }
  })

  return (
    <div className="min-h-screen bg-canvas pt-28 pb-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-12">
          <h1 className="font-serif text-4xl text-espresso">Catálogo de <em className="text-rose-500">Eventos</em></h1>
          <p className="text-sm text-espresso/50 mt-1">Explore e garanta seu ingresso para as melhores experiências da plataforma</p>
        </div>

        {/* Barra de Busca e Filtros */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-espresso/30" />
              <input
                type="text"
                placeholder="Buscar por nome, atração ou cidade..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/60 border border-white/80 rounded-2xl text-sm focus:outline-none focus:border-rose-500/30 transition-all text-espresso placeholder:text-espresso/30"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={dateFilter}
                onChange={e => {
                  setDateFilter(e.target.value)
                  if (e.target.value !== 'especifica') setSpecificDate('')
                  if (e.target.value !== 'periodo') {
                    setStartDate('')
                    setEndDate('')
                  }
                }}
                className="px-4 py-3 bg-white/60 border border-white/80 rounded-2xl text-sm focus:outline-none focus:border-rose-500/30 text-espresso/80 font-medium cursor-pointer"
                aria-label="Filtrar por data"
              >
                <option value="Todos">Todas as Datas</option>
                <option value="hoje">Hoje</option>
                <option value="fim-de-semana">Este Fim de Semana</option>
                <option value="mes">Este Mês</option>
                <option value="especifica">Escolher Dia Específico...</option>
                <option value="periodo">Escolher Período...</option>
              </select>

              {/* Data específica input */}
              {dateFilter === 'especifica' && (
                <div className="relative">
                  <input
                    type="date"
                    value={specificDate}
                    onChange={e => setSpecificDate(e.target.value)}
                    className="px-4 py-3 bg-white/60 border border-white/80 rounded-2xl text-sm focus:outline-none focus:border-rose-500/30 text-espresso/80 font-medium"
                    aria-label="Selecionar data específica"
                  />
                </div>
              )}

              {/* Período de datas inputs */}
              {dateFilter === 'periodo' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    placeholder="Início"
                    className="px-4 py-3 bg-white/60 border border-white/80 rounded-2xl text-sm focus:outline-none focus:border-rose-500/30 text-espresso/80 font-medium"
                    aria-label="Data inicial"
                  />
                  <span className="text-xs text-espresso/40">até</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    placeholder="Fim"
                    className="px-4 py-3 bg-white/60 border border-white/80 rounded-2xl text-sm focus:outline-none focus:border-rose-500/30 text-espresso/80 font-medium"
                    aria-label="Data final"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Categorias rápidas */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-10 scrollbar-thin">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                category === cat
                  ? 'bg-rose-500 text-white border-rose-500'
                  : 'bg-white/40 border-white/60 text-espresso/60 hover:border-rose-500/20 hover:text-rose-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Resultados */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 bg-white/40 border border-white/60 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 bg-white/30 border border-dashed border-white/60 rounded-3xl">
            <p className="text-sm text-espresso/40 italic">Nenhum evento encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.map(evt => (
              <div key={evt.id} className="bg-white/50 border border-white/60 rounded-3xl overflow-hidden hover:-translate-y-1 transition-all duration-300 flex flex-col group shadow-sm">
                <div className="h-44 overflow-hidden relative">
                  <img src={evt.cover_image || '/images/hero-bg.jpg'} alt={evt.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute top-4 left-4 px-2.5 py-1 bg-white/80 backdrop-blur-md rounded-full text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                    {evt.category || 'Geral'}
                  </span>
                </div>
                
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-serif text-lg text-espresso mb-2 line-clamp-1">{evt.title}</h3>
                  <p className="text-xs text-espresso/50 mb-4 line-clamp-2 flex-1">{evt.short_description || evt.description}</p>
                  
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-xs text-espresso/40">
                      <Calendar className="w-3.5 h-3.5 text-rose-400" />
                      {evt.date ? new Date(evt.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'A combinar'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-espresso/40">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      {evt.venue_name || 'Local não definido'}
                    </div>
                  </div>

                  <Link to={`/event/${evt.id}`} className="w-full flex items-center justify-between px-5 py-2.5 border border-rose-500/10 text-rose-500 text-xs font-semibold rounded-2xl hover:bg-rose-500 hover:text-white transition-all">
                    <span>Ver Ingressos</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
