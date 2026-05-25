import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Mail, Users, TrendingUp, Bell, Send, Clock,
  CheckCircle2, MailOpen, Trash2
} from 'lucide-react'
import { toast } from 'sonner'

interface Interested {
  id: string
  name: string
  email: string
  phone: string
  city: string
  date: string
  notified: boolean
  source: string
}

const mockInterested: Interested[] = [
  { id: '1', name: 'Ana Beatriz', email: 'ana@email.com', phone: '(11) 98765-4321', city: 'Sao Paulo', date: '2025-05-20', notified: true, source: 'Landing Page' },
  { id: '2', name: 'Pedro Costa', email: 'pedro@email.com', phone: '(21) 91234-5678', city: 'Rio de Janeiro', date: '2025-05-21', notified: false, source: 'Instagram' },
  { id: '3', name: 'Mariana Silva', email: 'mariana@email.com', phone: '(31) 99876-5432', city: 'Belo Horizonte', date: '2025-05-22', notified: false, source: 'Indicacao' },
  { id: '4', name: 'Lucas Mendes', email: 'lucas@email.com', phone: '(11) 95678-1234', city: 'Sao Paulo', date: '2025-05-23', notified: false, source: 'Google' },
  { id: '5', name: 'Julia Ramos', email: 'julia@email.com', phone: '(47) 98877-6655', city: 'Florianopolis', date: '2025-05-24', notified: false, source: 'Landing Page' },
  { id: '6', name: 'Carlos Lima', email: 'carlos@email.com', phone: '(11) 93456-7890', city: 'Campinas', date: '2025-05-25', notified: true, source: 'Email' },
]

export default function InterestList() {
  const [list, setList] = useState(import.meta.env.DEV ? mockInterested : [])
  const [filter, setFilter] = useState<'all' | 'notified' | 'pending'>('all')
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [notifyMessage, setNotifyMessage] = useState('As vendas ja comecaram! Garanta seu ingresso antes que acabe.')

  const filtered = list.filter(i => {
    if (filter === 'notified') return i.notified
    if (filter === 'pending') return !i.notified
    return true
  })

  const total = list.length
  const notified = list.filter(i => i.notified).length
  const pending = list.filter(i => !i.notified).length
  const cities = [...new Set(list.map(i => i.city))].length

  const handleNotify = () => {
    setList(list.map(i => !i.notified ? { ...i, notified: true } : i))
    setShowNotifyModal(false)
    toast.success(`${pending} pessoas notificadas!`)
  }

  const handleNotifyOne = (id: string) => {
    setList(list.map(i => i.id === id ? { ...i, notified: true } : i))
    toast.success('Notificado!')
  }

  const handleDelete = (id: string) => {
    setList(list.filter(i => i.id !== id))
    toast.success('Removido!')
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/event-manager" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Lista de Interesse</h1>
          <p className="text-sm text-espresso/50 mt-1">Pessoas interessadas antes das vendas abrirem</p>
        </div>
        {pending > 0 && (
          <button onClick={() => setShowNotifyModal(true)} className="px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2">
            <Bell className="w-4 h-4" /> Notificar {pending}
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Interessados', value: total.toString(), icon: Users },
          { label: 'Notificados', value: notified.toString(), icon: CheckCircle2 },
          { label: 'Pendentes', value: pending.toString(), icon: Clock },
          { label: 'Cidades', value: cities.toString(), icon: TrendingUp },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 text-plum mb-3" />
            <div className="font-serif text-2xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'notified'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filter === f ? 'bg-plum text-cream' : 'bg-white/60 border border-white/60 text-espresso/40 hover:text-espresso'}`}>
            {f === 'all' ? 'Todos' : f === 'pending' ? `Pendentes (${pending})` : `Notificados (${notified})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/60 text-[10px] uppercase tracking-wider text-espresso/30">
          <div className="col-span-3">Nome / Email</div>
          <div className="col-span-2">Telefone</div>
          <div className="col-span-2">Cidade</div>
          <div className="col-span-2">Origem</div>
          <div className="col-span-2">Data</div>
          <div className="col-span-1"></div>
        </div>
        {filtered.map(item => (
          <div key={item.id} className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/60 last:border-0 hover:bg-white/40 transition-colors items-center">
            <div className="col-span-3">
              <div className="text-xs font-medium text-espresso">{item.name}</div>
              <div className="text-[10px] text-espresso/30">{item.email}</div>
            </div>
            <div className="col-span-2 text-xs text-espresso/50">{item.phone}</div>
            <div className="col-span-2 text-xs text-espresso/50">{item.city}</div>
            <div className="col-span-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/60 text-espresso/50">{item.source}</span>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <span className="text-xs text-espresso/40">{item.date}</span>
              {item.notified && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
            </div>
            <div className="col-span-1 flex items-center justify-end gap-1">
              {!item.notified && (
                <button onClick={() => handleNotifyOne(item.id)} title="Notificar" className="p-1.5 rounded-lg hover:bg-plum/10 text-espresso/30 hover:text-plum transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Notify Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowNotifyModal(false)} />
          <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated">
            <div className="w-14 h-14 rounded-full bg-plum/10 flex items-center justify-center mx-auto mb-4">
              <MailOpen className="w-6 h-6 text-plum" />
            </div>
            <h3 className="font-serif text-xl text-espresso text-center mb-2">Notificar Interessados</h3>
            <p className="text-xs text-espresso/50 text-center mb-4">{pending} pessoas serao notificadas que as vendas comecaram.</p>
            <div className="mb-4">
              <label className="text-xs text-espresso/50 mb-1 block">Mensagem</label>
              <textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)}
                rows={3} className="w-full px-3 py-2 bg-white/50 border border-white/60 rounded-lg text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNotifyModal(false)} className="flex-1 py-2.5 border border-espresso/15 text-espresso text-sm rounded-full hover:bg-espresso/5 transition-all">
                Cancelar
              </button>
              <button onClick={handleNotify} className="flex-1 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
