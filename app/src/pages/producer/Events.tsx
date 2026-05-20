import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, Search, Pencil, Trash2, Eye, Copy } from 'lucide-react'
import { events } from '../../data/mockData'

export default function ProducerEvents() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = events.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' ? true : filter === e.status
    return matchSearch && matchFilter
  })

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
              {f === 'all' ? 'Todos' : f === 'upcoming' ? 'Futuros' : f === 'ongoing' ? 'Agora' : 'Passados'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
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
                const totalSold = event.tickets.reduce((s, t) => s + t.sold, 0)
                const totalCap = event.tickets.reduce((s, t) => s + t.capacity, 0)
                const totalRevenue = event.tickets.reduce((s, t) => s + t.price * t.sold, 0)

                return (
                  <tr key={event.id} className="border-b border-espresso/5 last:border-0 hover:bg-white/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={event.image} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-espresso">{event.title}</div>
                          <div className="text-xs text-espresso/40">{event.location}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-espresso/60">{event.date}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-espresso">{totalSold}/{totalCap}</div>
                      <div className="w-20 h-1 bg-espresso/5 rounded-full mt-1">
                        <div className="h-full bg-plum rounded-full" style={{ width: `${(totalSold / totalCap) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-espresso font-medium">R$ {totalRevenue.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        event.status === 'upcoming' ? 'bg-green-100 text-green-600' :
                        event.status === 'ongoing' ? 'bg-amber-100 text-amber-600' :
                        'bg-espresso/5 text-espresso/40'
                      }`}>
                        {event.status === 'upcoming' ? 'Futuro' : event.status === 'ongoing' ? 'Agora' : 'Passado'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button className="p-2 rounded-lg hover:bg-espresso/5 text-espresso/30 hover:text-espresso transition-colors" title="Ver">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-espresso/5 text-espresso/30 hover:text-espresso transition-colors" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-espresso/5 text-espresso/30 hover:text-espresso transition-colors" title="Duplicar">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors" title="Excluir">
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
    </div>
  )
}
