import { useState } from 'react'
import {
  Clock, Calendar, Plus, X, Trash2, CheckCircle2,
  MapPin, Users, Truck, Mic, Music, Utensils, Star
} from 'lucide-react'
import { toast } from 'sonner'

interface TimelineItem {
  id: string
  time: string
  title: string
  description: string
  type: 'soundcheck' | 'abertura' | 'show' | 'comida' | 'transporte' | 'decoracao' | 'vip' | 'encerramento'
  responsible: string
  status: 'concluido' | 'atual' | 'futuro'
  duration: string
  location: string
}

const mockTimeline: TimelineItem[] = [
  { id: 'tl1', time: '14:00', title: 'Chegada da equipe tecnica', description: 'Montagem de palco e testes iniciais', type: 'soundcheck', responsible: 'Rafael (Som)', status: 'concluido', duration: '2h', location: 'Palco Principal' },
  { id: 'tl2', time: '15:00', title: 'Montagem da decoracao', description: 'Luzes, banners e ambientacao', type: 'decoracao', responsible: 'Maria (Decor)', status: 'concluido', duration: '2h', location: 'Area toda' },
  { id: 'tl3', time: '16:00', title: 'Soundcheck completo', description: 'Teste de PA, microfones e monitores', type: 'soundcheck', responsible: 'Rafael (Som)', status: 'concluido', duration: '1h', location: 'Palco Principal' },
  { id: 'tl4', time: '17:00', title: 'Briefing da equipe', description: 'Reuniao com seguranca, bar e staff', type: 'abertura', responsible: 'Joao (Produtor)', status: 'concluido', duration: '30min', location: 'Backstage' },
  { id: 'tl5', time: '19:00', title: 'Abertura das portas', description: 'Inicio do check-in dos participantes', type: 'abertura', responsible: 'Equipe Check-in', status: 'atual', duration: '1h', location: 'Entrada' },
  { id: 'tl6', time: '20:00', title: 'DJ Warm-up', description: 'Ambientacao musical inicial', type: 'show', responsible: 'DJ Lucas', status: 'futuro', duration: '1h', location: 'Palco Principal' },
  { id: 'tl7', time: '21:00', title: 'Atracao principal', description: 'Show principal do evento', type: 'show', responsible: 'DJ Headliner', status: 'futuro', duration: '2h', location: 'Palco Principal' },
  { id: 'tl8', time: '21:30', title: 'Servico VIP Mesa Coletiva', description: 'Welcome drink e finger food', type: 'vip', responsible: 'Ana (Buffet)', status: 'futuro', duration: '1h30', location: 'Area VIP' },
  { id: 'tl10', time: '23:30', title: 'Encerramento', description: 'Desmontagem e limpeza', type: 'encerramento', responsible: 'Equipe Geral', status: 'futuro', duration: '2h', location: 'Area toda' },
]

const typeIcons: Record<string, typeof Mic> = {
  soundcheck: Mic,
  abertura: Users,
  show: Music,
  comida: Utensils,
  transporte: Truck,
  decoracao: Star,
  vip: Star,
  encerramento: CheckCircle2,
}

const typeLabels: Record<string, string> = {
  soundcheck: 'Soundcheck',
  abertura: 'Abertura',
  show: 'Show',
  comida: 'Alimentacao',
  transporte: 'Logistica',
  decoracao: 'Decoracao',
  vip: 'VIP',
  encerramento: 'Encerramento',
}

const typeColors: Record<string, string> = {
  soundcheck: 'bg-violet-50 text-violet-600',
  abertura: 'bg-green-50 text-green-600',
  show: 'bg-plum/10 text-plum',
  comida: 'bg-orange-50 text-orange-600',
  transporte: 'bg-blue-50 text-blue-600',
  decoracao: 'bg-pink-50 text-pink-600',
  vip: 'bg-amber-50 text-amber-600',
  encerramento: 'bg-gray-50 text-gray-600',
}

export default function ProducerTimeline() {
  const [items, setItems] = useState<TimelineItem[]>(mockTimeline)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ time: '', title: '', description: '', type: 'show' as TimelineItem['type'], responsible: '', duration: '', location: '' })
  const [activeEvent, setActiveEvent] = useState('Noite Eletro 2025')

  const addItem = () => {
    if (!form.time || !form.title) { toast.error('Hora e titulo obrigatorios'); return }
    const newItem: TimelineItem = {
      id: `tl${Date.now()}`,
      time: form.time,
      title: form.title,
      description: form.description,
      type: form.type,
      responsible: form.responsible || 'Nao definido',
      status: 'futuro',
      duration: form.duration || '-',
      location: form.location || '-',
    }
    const sorted = [...items, newItem].sort((a, b) => a.time.localeCompare(b.time))
    setItems(sorted)
    setForm({ time: '', title: '', description: '', type: 'show', responsible: '', duration: '', location: '' })
    setShowForm(false)
    toast.success('Item adicionado!')
  }

  const toggleStatus = (id: string) => {
    setItems(items.map(i => {
      if (i.id !== id) return i
      const flow: TimelineItem['status'][] = ['futuro', 'atual', 'concluido']
      const idx = flow.indexOf(i.status)
      return { ...i, status: flow[(idx + 1) % 3] }
    }))
  }

  const deleteItem = (id: string) => {
    setItems(items.filter(i => i.id !== id))
    toast.success('Removido')
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Cronograma</h1>
          <p className="text-sm text-espresso/50 mt-1">Linha do tempo completa do evento</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <Plus className="w-4 h-4" /> Adicionar Item
        </button>
      </div>

      {/* Event selector */}
      <div className="mb-8 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-plum" />
        <select value={activeEvent} onChange={e => setActiveEvent(e.target.value)} className="px-4 py-2 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
          <option>Noite Eletro 2025</option>
          <option>Jazz Sunset Session</option>
          <option>Workshop UX</option>
        </select>
        <span className="text-xs text-espresso/30">20 de Maio, 2025</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-espresso/10" />

        <div className="space-y-0">
          {items.map((item) => {
            const Icon = typeIcons[item.type]
            return (
              <div key={item.id} className="relative flex items-start gap-4 py-4 group">
                {/* Dot */}
                <button onClick={() => toggleStatus(item.id)} className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  item.status === 'concluido' ? 'bg-green-100 text-green-600' :
                  item.status === 'atual' ? 'bg-plum text-cream shadow-glow scale-110' :
                  'bg-canvas text-espresso/30'
                }`}>
                  {item.status === 'concluido' ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </button>

                {/* Card */}
                <div className={`flex-1 p-4 rounded-2xl border transition-all ${
                  item.status === 'atual' ? 'bg-plum/5 border-plum/20 shadow-sm' :
                  item.status === 'concluido' ? 'bg-green-50/30 border-green-100/30 opacity-60' :
                  'bg-white/60 border-white/60'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold font-mono ${item.status === 'atual' ? 'text-plum' : 'text-espresso/50'}`}>{item.time}</span>
                        <span className={`px-2 py-0.5 text-[9px] font-medium rounded-full ${typeColors[item.type]}`}>{typeLabels[item.type]}</span>
                        {item.status === 'atual' && <span className="px-2 py-0.5 text-[9px] font-medium rounded-full bg-plum text-cream animate-pulse">AO VIVO</span>}
                      </div>
                      <h3 className={`text-sm font-medium ${item.status === 'concluido' ? 'text-espresso/30 line-through' : 'text-espresso'}`}>{item.title}</h3>
                      <p className="text-xs text-espresso/30 mt-0.5">{item.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-espresso/20">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{item.responsible}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.duration}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.location}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Novo Item</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none" />
                <input value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="Duracao" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titulo *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descricao" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as TimelineItem['type'] })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso/60 focus:outline-none">
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} placeholder="Responsavel" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Local" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-espresso/50 hover:text-espresso transition-colors">Cancelar</button>
              <button onClick={addItem} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
