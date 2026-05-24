import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Eye, Copy, Calendar, AlertTriangle } from 'lucide-react'
import { useProducerEvents, useDeleteEvent } from '../../hooks/useEvents'
import { toast } from 'sonner'

export default function ProducerEvents() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const { data: events, isLoading, error } = useProducerEvents()
  const deleteMutation = useDeleteEvent()

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o evento "${title}"? Esta ação é irreversível e excluirá todos os ingressos associados.`)) {
      try {
        await deleteMutation.mutateAsync(id)
        toast.success('Evento excluído com sucesso!')
      } catch (err: any) {
        toast.error(err.message || 'Erro ao excluir evento')
      }
    }
  }

  // Filtragem dos eventos em runtime
  const filtered = (events || []).filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase())
    
    // Mapear status do banco de dados para os filtros do frontend
    // Banco: 'draft' | 'published' | 'cancelled' | 'ended'
    // Filtro: 'all' | 'upcoming' (published) | 'ongoing' (published/draft) | 'past' (ended)
    let statusMatch = true
    if (filter === 'upcoming') {
      statusMatch = e.status === 'published'
    } else if (filter === 'ongoing') {
      statusMatch = e.status === 'draft' || e.status === 'published'
    } else if (filter === 'past') {
      statusMatch = e.status === 'ended' || e.status === 'cancelled'
    }

    return matchSearch && statusMatch
  })

  // Formatador de data elegante
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Sem data definida'
    try {
      // Forçar interpretação local para evitar problemas de fuso horário
      const date = new Date(dateStr + 'T00:00:00')
      return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Eventos</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie todos os seus eventos</p>
        </div>
        <Link
          to="/producer/planner"
          className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Evento
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar eventos..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-full text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30"
          />
        </div>
        <div className="flex items-center gap-2">
          {['all', 'upcoming', 'ongoing', 'past'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs font-medium rounded-full transition-all ${
                filter === f
                  ? 'bg-plum text-cream'
                  : 'bg-white/40 text-espresso/50 hover:bg-white/60'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'upcoming' ? 'Ativos' : f === 'ongoing' ? 'Rascunhos' : 'Passados/Cancelados'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 bg-white/40 border border-white/60 rounded-2xl animate-pulse flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-espresso/5 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-4 bg-espresso/5 rounded w-36" />
                  <div className="h-3 bg-espresso/5 rounded w-24" />
                </div>
              </div>
              <div className="h-4 bg-espresso/5 rounded w-20" />
              <div className="h-4 bg-espresso/5 rounded w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-6 bg-red-50/50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Erro ao carregar seus eventos: {error.message || 'Houve um erro desconhecido'}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filtered.length === 0 && (
        <div className="bg-white/60 border border-white/60 rounded-3xl p-12 text-center backdrop-blur-sm">
          <div className="w-16 h-16 rounded-full bg-plum/10 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-plum" />
          </div>
          <h3 className="font-serif text-xl text-espresso mb-2">Nenhum evento encontrado</h3>
          <p className="text-sm text-espresso/50 max-w-sm mx-auto mb-6">
            Você ainda não possui eventos cadastrados nesta categoria ou a sua busca não retornou resultados.
          </p>
          <Link
            to="/producer/planner"
            className="inline-flex items-center gap-2 px-6 py-3 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            Planejar Primeiro Evento
          </Link>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && filtered.length > 0 && (
        <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-espresso/5">
                  <th className="text-left px-6 py-4 text-xs font-medium text-espresso/40 uppercase tracking-wider">Evento</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-espresso/40 uppercase tracking-wider">Data</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-espresso/40 uppercase tracking-wider">Ingressos</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-espresso/40 uppercase tracking-wider">Vendas</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-espresso/40 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => {
                  const ticketTypes = event.ticket_types || []
                  const totalSold = ticketTypes.reduce((s, t) => s + (t.sold || 0), 0)
                  const totalCap = ticketTypes.reduce((s, t) => s + (t.capacity || 0), 0)
                  const totalRevenue = ticketTypes.reduce((s, t) => s + (t.price * (t.sold || 0)), 0)

                  return (
                    <tr key={event.id} className="border-b border-espresso/5 last:border-0 hover:bg-white/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                            <img src={event.cover_image || '/images/hero-bg.jpg'} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-espresso">{event.title}</div>
                            <div className="text-xs text-espresso/40">{event.venue_name || 'Sem local cadastrado'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-espresso/60">{formatDate(event.date)}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-espresso">
                          {totalSold} {totalCap > 0 ? `/ ${totalCap}` : ''}
                        </div>
                        {totalCap > 0 && (
                          <div className="w-20 h-1 bg-espresso/5 rounded-full mt-1">
                            <div className="h-full bg-plum rounded-full" style={{ width: `${Math.min(100, (totalSold / totalCap) * 100)}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-espresso font-medium">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          event.status === 'published' ? 'bg-green-100 text-green-600' :
                          event.status === 'draft' ? 'bg-amber-100 text-amber-600' :
                          'bg-espresso/5 text-espresso/40'
                        }`}>
                          {event.status === 'published' ? 'Ativo' :
                           event.status === 'draft' ? 'Rascunho' :
                           event.status === 'cancelled' ? 'Cancelado' : 'Encerrado'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button className="p-2 rounded-lg hover:bg-espresso/5 text-espresso/30 hover:text-espresso transition-colors" title="Ver">
                            <Eye className="w-4 h-4" />
                          </button>
                          <Link to={`/producer/events/${event.id}/edit`} className="p-2 rounded-lg hover:bg-espresso/5 text-espresso/30 hover:text-espresso transition-colors" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button className="p-2 rounded-lg hover:bg-espresso/5 text-espresso/30 hover:text-espresso transition-colors" title="Duplicar">
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(event.id, event.title)}
                            disabled={deleteMutation.isPending}
                            className="p-2 rounded-lg hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
