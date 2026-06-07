import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Calendar, MapPin, Heart, Loader2, Star,
  Filter, ArrowRight, Clock, Ticket
} from 'lucide-react'
import { usePublicEvents } from '../../hooks/useEvents'
import { cn } from '../../lib/utils'

const categories = [
  'Todos',
  'Música',
  'Negócios',
  'Networking',
  'Arte',
  'Esporte',
  'Gastronomia',
  'Tecnologia',
]

function formatEventDate(dateStr: string | null, timeStr: string | null) {
  if (!dateStr) return 'Data a definir'
  const d = new Date(dateStr + 'T00:00:00')
  const formatted = d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return timeStr ? `${formatted} às ${timeStr}` : formatted
}

function getMinPrice(ticketTypes: any[]) {
  if (!ticketTypes || ticketTypes.length === 0) return null
  const prices = ticketTypes.map((t) => Number(t.price) || 0).filter((p) => p > 0)
  if (prices.length === 0) return 'Gratuito'
  const min = Math.min(...prices)
  return `R$ ${min.toFixed(0)}`
}

export default function AppEvents() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const { data: events = [], isLoading } = usePublicEvents()

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        !search ||
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        (e.venue_city || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.category || '').toLowerCase().includes(search.toLowerCase())
      const matchesCategory =
        activeCategory === 'Todos' || e.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [events, search, activeCategory])

  const featured = filtered[0]
  const rest = filtered.slice(1)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-12 h-12 text-plum animate-spin mb-6" />
        <p className="text-espresso/50 text-base">Carregando eventos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-cream font-bold">Descubra Eventos</h1>
          <p className="text-white/60 mt-2 text-base">
            Encontre os melhores eventos perto de você
          </p>
        </div>
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, cidade ou categoria..."
            className="w-full pl-12 pr-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-base text-cream placeholder:text-white/30 focus:outline-none focus:border-plum/30 focus:bg-white/[0.05] transition-all"
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <Filter className="w-4 h-4 text-white/30 flex-shrink-0 mr-1" />
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              activeCategory === cat
                ? 'bg-plum text-cream shadow-md'
                : 'bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-cream border border-white/[0.04]'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Featured Event */}
      {featured && (
        <div className="relative rounded-3xl overflow-hidden group">
          <img
            src={featured.cover_image || featured.image_url || '/images/hero-bg.jpg'}
            alt={featured.title}
            className="w-full h-[360px] object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-plum/90 text-cream text-xs font-semibold">
                {featured.category || 'Evento'}
              </span>
              {getMinPrice(featured.ticket_types) && (
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur text-cream text-xs font-semibold">
                  A partir de {getMinPrice(featured.ticket_types)}
                </span>
              )}
            </div>
            <h2 className="font-serif text-3xl text-white mb-2">{featured.title}</h2>
            <p className="text-white/70 text-base max-w-xl line-clamp-2 mb-4">
              {featured.short_description || featured.description}
            </p>
            <div className="flex items-center gap-6 mb-5">
              <span className="flex items-center gap-2 text-white/60 text-sm">
                <Calendar className="w-4 h-4" />
                {formatEventDate(featured.date, featured.time)}
              </span>
              <span className="flex items-center gap-2 text-white/60 text-sm">
                <MapPin className="w-4 h-4" />
                {featured.venue_city || featured.venue_name || 'Local a definir'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/event/${featured.slug || featured.id}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-plum text-cream rounded-full text-sm font-semibold hover:shadow-glow transition-all"
              >
                Ver detalhes
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => toggleFavorite(featured.id)}
                className={cn(
                  'p-3 rounded-full backdrop-blur transition-all',
                  favorites.has(featured.id)
                    ? 'bg-red-500/80 text-white'
                    : 'bg-white/[0.05] text-white/60 hover:bg-white/[0.1]'
                )}
              >
                <Heart className={cn('w-5 h-5', favorites.has(featured.id) && 'fill-current')} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events Grid */}
      {rest.length === 0 && !featured ? (
        <div className="text-center py-24">
          <div className="w-20 h-20 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto mb-6">
            <Star className="w-10 h-10 text-white/10" />
          </div>
          <h3 className="font-serif text-xl text-cream mb-2">Nenhum evento encontrado</h3>
          <p className="text-white/40 text-base">
            Tente ajustar os filtros ou a busca para encontrar o que procura.
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-2xl text-cream">
              {rest.length > 0 ? 'Próximos eventos' : 'Eventos'}
            </h3>
            <span className="text-sm text-white/45">
              {filtered.length} evento{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {rest.map((event) => (
              <div
                key={event.id}
                className="group rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-plum/25 hover:shadow-glow backdrop-blur-md transition-all overflow-hidden flex flex-col"
              >
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={event.cover_image || event.image_url || '/images/hero-bg.jpg'}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur text-xs font-medium text-cream border border-white/[0.05]">
                      {event.category || 'Evento'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      toggleFavorite(event.id)
                    }}
                    className={cn(
                      'absolute top-3 right-3 p-2 rounded-full backdrop-blur transition-all',
                      favorites.has(event.id)
                        ? 'bg-red-500/90 text-white'
                        : 'bg-white/[0.05] text-white/40 hover:text-red-400'
                    )}
                  >
                    <Heart className={cn('w-4 h-4', favorites.has(event.id) && 'fill-current')} />
                  </button>
                  {getMinPrice(event.ticket_types) && (
                    <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-plum/90 text-cream text-sm font-semibold">
                      {getMinPrice(event.ticket_types)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex flex-col flex-1">
                  <Link
                    to={`/event/${event.slug || event.id}`}
                    className="font-semibold text-cream text-base group-hover:text-plum-light transition-colors line-clamp-1"
                  >
                    {event.title}
                  </Link>
                  <p className="text-sm text-white/45 mt-1 line-clamp-2 flex-1">
                    {event.short_description || event.description}
                  </p>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-white/30">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatEventDate(event.date, event.time)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/30">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">
                        {event.venue_city || event.venue_name || 'Local a definir'}
                      </span>
                    </div>
                    {event.capacity && (
                      <div className="flex items-center gap-2 text-xs text-white/30">
                        <Ticket className="w-3.5 h-3.5" />
                        <span>{event.capacity} vagas</span>
                      </div>
                    )}
                  </div>

                  <Link
                    to={`/event/${event.slug || event.id}`}
                    className="mt-4 inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-plum/20 text-plum-light text-sm font-medium hover:bg-plum hover:text-cream transition-all border border-plum/30"
                  >
                    Ver detalhes
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="rounded-2xl bg-gradient-to-r from-plum/10 to-transparent border border-plum/20 p-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl text-cream font-bold">Não encontrou o que procura?</h3>
          <p className="text-white/60 text-sm mt-1">
            Explore todos os eventos disponíveis na plataforma Evokaa.
          </p>
        </div>
        <button
          onClick={() => {
            setSearch('')
            setActiveCategory('Todos')
          }}
          className="px-6 py-2.5 bg-plum text-cream rounded-full text-sm font-semibold hover:shadow-glow transition-all whitespace-nowrap"
        >
          Ver todos os eventos
        </button>
      </div>
    </div>
  )
}
