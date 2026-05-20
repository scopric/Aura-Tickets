import { useState } from 'react'
import {
  Star, Bug, Lightbulb, HelpCircle, ThumbsUp, Search,
  CheckCircle2, Mail, Trash2, Eye, MessageSquare,
  Clock, X
} from 'lucide-react'
import { toast } from 'sonner'
import { feedbackMock } from '../../components/FeedbackButton'

type FeedbackType = 'melhoria' | 'bug' | 'duvida' | 'sugestao' | 'elogio'
type FeedbackRole = 'cliente' | 'produtor' | 'admin'
type FeedbackStatus = 'novo' | 'lido' | 'respondido' | 'resolvido'

interface FeedbackItem {
  id: string
  type: FeedbackType
  role: FeedbackRole
  name: string
  email: string
  message: string
  rating: number
  page: string
  status: FeedbackStatus
  createdAt: string
}

const typeConfig: Record<FeedbackType, { icon: typeof Star; label: string; color: string; bg: string }> = {
  melhoria: { icon: Lightbulb, label: 'Melhoria', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  bug: { icon: Bug, label: 'Bug', color: 'text-red-500', bg: 'bg-red-50 border-red-100' },
  duvida: { icon: HelpCircle, label: 'Duvida', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
  sugestao: { icon: Star, label: 'Sugestao', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100' },
  elogio: { icon: ThumbsUp, label: 'Elogio', color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
}

const statusConfig: Record<FeedbackStatus, { label: string; color: string; bg: string }> = {
  novo: { label: 'Novo', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
  lido: { label: 'Lido', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  respondido: { label: 'Respondido', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100' },
  resolvido: { label: 'Resolvido', color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
}

export default function AdminFeedback() {
  const [items, setItems] = useState<FeedbackItem[]>(feedbackMock)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<FeedbackType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | 'all'>('all')
  const [filterRole, setFilterRole] = useState<FeedbackRole | 'all'>('all')
  const [selected, setSelected] = useState<FeedbackItem | null>(null)

  const filtered = items
    .filter(i => !search || i.message.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase()))
    .filter(i => filterType === 'all' || i.type === filterType)
    .filter(i => filterStatus === 'all' || i.status === filterStatus)
    .filter(i => filterRole === 'all' || i.role === filterRole)

  const stats = {
    total: items.length,
    novo: items.filter(i => i.status === 'novo').length,
    bug: items.filter(i => i.type === 'bug').length,
    resolvido: items.filter(i => i.status === 'resolvido').length,
    avgRating: items.filter(i => i.rating > 0).length > 0 ? (items.filter(i => i.rating > 0).reduce((s, i) => s + i.rating, 0) / items.filter(i => i.rating > 0).length).toFixed(1) : '-',
  }

  const updateStatus = (id: string, status: FeedbackStatus) => {
    setItems(items.map(i => i.id === id ? { ...i, status } : i))
    toast.success(`Status atualizado: ${statusConfig[status].label}`)
    if (selected?.id === id) setSelected({ ...selected, status })
  }

  const deleteItem = (id: string) => {
    setItems(items.filter(i => i.id !== id))
    setSelected(null)
    toast.success('Removido')
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Feedback</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie sugestoes, bugs e duvidas dos usuarios</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total', value: stats.total.toString(), icon: MessageSquare, color: 'text-plum' },
          { label: 'Novos', value: stats.novo.toString(), icon: Clock, color: 'text-blue-600' },
          { label: 'Bugs', value: stats.bug.toString(), icon: Bug, color: 'text-red-500' },
          { label: 'Resolvidos', value: stats.resolvido.toString(), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Nota Media', value: stats.avgRating.toString(), icon: Star, color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm text-center">
            <k.icon className={`w-4 h-4 ${k.color} mx-auto mb-2`} />
            <div className={`font-serif text-xl ${k.color}`}>{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* By Type Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4">Por Tipo</h3>
          <div className="space-y-3">
            {(Object.entries(typeConfig) as [FeedbackType, typeof typeConfig['melhoria']][]).map(([key, cfg]) => {
              const count = items.filter(i => i.type === key).length
              const max = Math.max(...Object.keys(typeConfig).map(k => items.filter(i => i.type === k as FeedbackType).length), 1)
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-espresso/60 w-24 flex items-center gap-1.5"><cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} /> {cfg.label}</span>
                  <div className="flex-1 h-5 bg-canvas rounded-lg overflow-hidden">
                    <div className={`h-full ${cfg.bg.split(' ')[0]} rounded-lg flex items-center px-2 transition-all`} style={{ width: `${(count / max) * 100}%` }}>
                      <span className="text-[10px] font-medium text-espresso/60">{count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4">Por Origem</h3>
          <div className="space-y-3">
            {(['cliente', 'produtor', 'admin'] as FeedbackRole[]).map(role => {
              const count = items.filter(i => i.role === role).length
              const max = Math.max(...(['cliente', 'produtor', 'admin'] as FeedbackRole[]).map(r => items.filter(i => i.role === r).length), 1)
              return (
                <div key={role} className="flex items-center gap-3">
                  <span className="text-xs text-espresso/60 w-24 capitalize">{role}s</span>
                  <div className="flex-1 h-5 bg-canvas rounded-lg overflow-hidden">
                    <div className="h-full bg-plum/10 rounded-lg flex items-center px-2 transition-all" style={{ width: `${(count / max) * 100}%` }}>
                      <span className="text-[10px] font-medium text-plum">{count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar feedback..." className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
        </div>
        <div className="flex items-center gap-2">
          <select value={filterType} onChange={e => setFilterType(e.target.value as FeedbackType | 'all')} className="px-3 py-2 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso/60 focus:outline-none">
            <option value="all">Todos tipos</option>
            {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as FeedbackStatus | 'all')} className="px-3 py-2 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso/60 focus:outline-none">
            <option value="all">Todos status</option>
            {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value as FeedbackRole | 'all')} className="px-3 py-2 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso/60 focus:outline-none">
            <option value="all">Todas origens</option>
            <option value="cliente">Clientes</option>
            <option value="produtor">Produtores</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-espresso/5">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Mensagem</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Autor</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Pagina</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const tc = typeConfig[item.type]
                const sc = statusConfig[item.status]
                const TIcon = tc.icon
                return (
                  <tr key={item.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${tc.bg} ${tc.color}`}>
                        <TIcon className="w-3 h-3" /> {tc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-espresso line-clamp-2 max-w-xs">{item.message}</div>
                      {item.rating > 0 && (
                        <div className="flex items-center gap-0.5 mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < item.rating ? 'text-amber-400 fill-amber-400' : 'text-espresso/10'}`} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-xs text-espresso font-medium capitalize">{item.name}</div>
                      <div className="text-[10px] text-espresso/30 capitalize">{item.role}</div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-[10px] text-espresso/30 bg-canvas px-2 py-0.5 rounded-md">{item.page}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${sc.bg} ${sc.color}`}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setSelected(item)} className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/20 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-canvas border-l border-espresso/10 h-full overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeConfig[selected.type].bg}`}>
                    {(() => { const I = typeConfig[selected.type].icon; return <I className={`w-5 h-5 ${typeConfig[selected.type].color}`} /> })()}
                  </div>
                  <div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeConfig[selected.type].bg} ${typeConfig[selected.type].color}`}>
                      {typeConfig[selected.type].label}
                    </span>
                    <p className="text-[10px] text-espresso/30 mt-0.5">{selected.createdAt}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 rounded-full bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="mb-6">
                <h4 className="text-xs font-medium text-espresso/40 uppercase tracking-wider mb-2">Mensagem</h4>
                <p className="text-sm text-espresso/70 leading-relaxed p-4 bg-white/60 border border-white/60 rounded-xl">{selected.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 bg-white/60 border border-white/60 rounded-xl">
                  <div className="text-[10px] text-espresso/30 mb-0.5">Autor</div>
                  <div className="text-xs text-espresso font-medium">{selected.name}</div>
                  <div className="text-[10px] text-espresso/30">{selected.email}</div>
                </div>
                <div className="p-3 bg-white/60 border border-white/60 rounded-xl">
                  <div className="text-[10px] text-espresso/30 mb-0.5">Origem</div>
                  <div className="text-xs text-espresso font-medium capitalize">{selected.role}</div>
                  <div className="text-[10px] text-espresso/30">{selected.page}</div>
                </div>
              </div>

              {selected.rating > 0 && (
                <div className="mb-6 p-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                  <div className="text-[10px] text-amber-600/60 mb-1">Avaliacao</div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < selected.rating ? 'text-amber-400 fill-amber-400' : 'text-amber-200'}`} />
                    ))}
                    <span className="text-xs text-amber-600 ml-2">{selected.rating}/5</span>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h4 className="text-xs font-medium text-espresso/40 uppercase tracking-wider mb-2">Alterar Status</h4>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(statusConfig) as [FeedbackStatus, typeof statusConfig['novo']][]).map(([key, cfg]) => (
                    <button key={key} onClick={() => updateStatus(selected.id, key)} className={`px-2 py-2 rounded-xl text-[10px] font-medium border transition-all ${selected.status === key ? cfg.bg + ' ' + cfg.color : 'bg-white/40 border-white/60 text-espresso/40 hover:text-espresso/60'}`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => { navigator.clipboard.writeText(selected.email); toast.success('Email copiado!') }} className="w-full py-2.5 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
                <Mail className="w-3.5 h-3.5" /> Responder por Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
