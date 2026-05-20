import { useState } from 'react'
import {
  Mail, MessageSquare, Send, Bell,
  X, TrendingUp, Eye, Trash2, Copy
} from 'lucide-react'
import { toast } from 'sonner'

interface Campaign {
  id: string
  name: string
  type: 'email' | 'sms' | 'push'
  subject: string
  audience: string
  sent: number
  openRate: number
  clickRate: number
  status: 'enviada' | 'agendada' | 'rascunho'
  date: string
  eventName: string
}

const mockCampaigns: Campaign[] = [
  { id: 'c1', name: 'Lembrete Noite Eletro', type: 'email', subject: 'Faltam 2 dias! Preparado?', audience: 'Compradores VIP', sent: 243, openRate: 68, clickRate: 32, status: 'enviada', date: '15 Mai 2025', eventName: 'Noite Eletro 2025' },
  { id: 'c2', name: 'Promocao Early Bird', type: 'email', subject: '50% OFF - Somente hoje', audience: 'Lista geral', sent: 1200, openRate: 45, clickRate: 18, status: 'enviada', date: '10 Mai 2025', eventName: 'Noite Eletro 2025' },
  { id: 'c3', name: 'SMS - Ultimas Mesas', type: 'sms', subject: 'Apenas 5 mesas VIP restantes!', audience: 'Clientes VIP', sent: 89, openRate: 92, clickRate: 45, status: 'enviada', date: '14 Mai 2025', eventName: 'Noite Eletro 2025' },
  { id: 'c4', name: 'Push - Jazz Sunset', type: 'push', subject: 'Ingressos liberados!', audience: 'App Users', sent: 456, openRate: 34, clickRate: 12, status: 'agendada', date: '20 Mai 2025', eventName: 'Jazz Sunset' },
  { id: 'c5', name: 'Lembrete Palestra', type: 'email', subject: 'Nao esqueca da palestra', audience: 'Registrados', sent: 0, openRate: 0, clickRate: 0, status: 'rascunho', date: '-', eventName: 'Workshop UX' },
]

const templates = [
  { id: 'tp1', name: 'Lembrete de Evento', type: 'email' as const },
  { id: 'tp2', name: 'Promocao de Ingressos', type: 'email' as const },
  { id: 'tp3', name: 'Agradecimento Pos-Evento', type: 'email' as const },
  { id: 'tp4', name: 'Alerta SMS - Ultimos Ingressos', type: 'sms' as const },
  { id: 'tp5', name: 'Push - Ingressos Liberados', type: 'push' as const },
]

export default function ProducerCommunications() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'email' as Campaign['type'], subject: '', message: '', audience: 'Todos', eventName: '', schedule: false, date: '', time: '' })
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'email' | 'sms' | 'push'>('all')

  const filtered = campaigns
    .filter(c => activeTab === 'all' || c.type === activeTab)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))

  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0)
  const avgOpen = campaigns.filter(c => c.openRate > 0).length > 0 ? Math.round(campaigns.filter(c => c.openRate > 0).reduce((s, c) => s + c.openRate, 0) / campaigns.filter(c => c.openRate > 0).length) : 0
  const avgClick = campaigns.filter(c => c.clickRate > 0).length > 0 ? Math.round(campaigns.filter(c => c.clickRate > 0).reduce((s, c) => s + c.clickRate, 0) / campaigns.filter(c => c.clickRate > 0).length) : 0

  const addCampaign = () => {
    if (!form.name || !form.subject) { toast.error('Preencha nome e assunto'); return }
    const newC: Campaign = {
      id: `c${Date.now()}`,
      name: form.name,
      type: form.type,
      subject: form.subject,
      audience: form.audience,
      sent: 0,
      openRate: 0,
      clickRate: 0,
      status: form.schedule ? 'agendada' : 'rascunho',
      date: form.schedule ? `${form.date} ${form.time}` : '-',
      eventName: form.eventName || 'Geral',
    }
    setCampaigns([newC, ...campaigns])
    setForm({ name: '', type: 'email', subject: '', message: '', audience: 'Todos', eventName: '', schedule: false, date: '', time: '' })
    setShowForm(false)
    toast.success(form.schedule ? 'Campanha agendada!' : 'Rascunho salvo!')
  }

  const deleteCampaign = (id: string) => {
    setCampaigns(campaigns.filter(c => c.id !== id))
    toast.success('Campanha removida')
  }

  const typeIcons = {
    email: Mail,
    sms: MessageSquare,
    push: Bell,
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Comunicacao</h1>
          <p className="text-sm text-espresso/50 mt-1">Email marketing, SMS e notificacoes push</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <Send className="w-4 h-4" /> Nova Campanha
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Campanhas', value: campaigns.length.toString(), icon: Mail, color: 'text-plum' },
          { label: 'Enviados', value: totalSent.toLocaleString(), icon: Send, color: 'text-blue-600' },
          { label: 'Taxa de Abertura', value: `${avgOpen}%`, icon: Eye, color: 'text-amber-600' },
          { label: 'Taxa de Clique', value: `${avgClick}%`, icon: TrendingUp, color: 'text-green-600' },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60 text-center">
            <k.icon className={`w-5 h-5 ${k.color} mx-auto mb-2`} />
            <div className={`font-serif text-2xl ${k.color}`}>{k.value}</div>
            <div className="text-xs text-espresso/40 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Templates Quick Start */}
      <div className="mb-8 p-5 rounded-2xl bg-white/60 border border-white/60">
        <h3 className="text-sm font-medium text-espresso mb-3">Templates Rapidos</h3>
        <div className="flex flex-wrap gap-2">
          {templates.map(t => {
            const Icon = typeIcons[t.type]
            return (
              <button key={t.id} onClick={() => { setForm({ ...form, type: t.type, name: t.name, subject: t.name }); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-canvas rounded-xl text-xs text-espresso/60 hover:bg-plum/10 hover:text-plum transition-all border border-transparent hover:border-plum/20">
                <Icon className="w-3.5 h-3.5" /> {t.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-2xl w-fit">
          {[
            { id: 'all' as const, label: 'Todas', icon: Mail },
            { id: 'email' as const, label: 'Email', icon: Mail },
            { id: 'sms' as const, label: 'SMS', icon: MessageSquare },
            { id: 'push' as const, label: 'Push', icon: Bell },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === t.id ? 'bg-plum text-cream' : 'text-espresso/40 hover:text-espresso/70'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 w-48" />
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(c => {
          const Icon = typeIcons[c.type]
          return (
            <div key={c.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/60 border border-white/60 hover:bg-white/80 transition-all">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.type === 'email' ? 'bg-blue-50' : c.type === 'sms' ? 'bg-green-50' : 'bg-amber-50'}`}>
                <Icon className={`w-5 h-5 ${c.type === 'email' ? 'text-blue-600' : c.type === 'sms' ? 'text-green-600' : 'text-amber-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-medium text-espresso">{c.name}</h3>
                  <span className={`px-2 py-0.5 text-[9px] font-medium rounded-full ${
                    c.status === 'enviada' ? 'bg-green-50 text-green-600 border border-green-100' :
                    c.status === 'agendada' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                    'bg-gray-50 text-gray-500 border border-gray-100'
                  }`}>{c.status}</span>
                </div>
                <p className="text-xs text-espresso/40">{c.subject}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-espresso/30">
                  <span>{c.audience}</span>
                  <span>{c.eventName}</span>
                  {c.sent > 0 && <span className="flex items-center gap-1"><Send className="w-3 h-3" /> {c.sent}</span>}
                </div>
              </div>
              {c.status === 'enviada' && (
                <div className="text-right flex-shrink-0 hidden md:block">
                  <div className="text-xs text-espresso/60">{c.openRate}% abertura</div>
                  <div className="text-xs text-espresso/60">{c.clickRate}% cliques</div>
                </div>
              )}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toast.success('Duplicado!')} className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                <button onClick={() => deleteCampaign(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/20 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Nova Campanha</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center bg-white/60 border border-white/60 rounded-full p-1">
                {(['email', 'sms', 'push'] as const).map(t => (
                  <button key={t} onClick={() => setForm({ ...form, type: t })} className={`flex-1 py-2 text-xs font-medium rounded-full transition-all ${form.type === t ? 'bg-plum text-cream' : 'text-espresso/40'}`}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome da campanha *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} placeholder="Evento" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Assunto/Mensagem *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Conteudo completo..." rows={5} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none" />
              <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso/60 focus:outline-none">
                <option>Todos os participantes</option>
                <option>Compradores VIP</option>
                <option>Compradores Pista</option>
                <option>Lista de interesse</option>
                <option>Afiliados</option>
              </select>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.checked })} className="accent-plum" />
                <span className="text-xs text-espresso/60">Agendar envio</span>
              </label>
              {form.schedule && (
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" onChange={e => setForm({ ...form, date: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso/60 focus:outline-none" />
                  <input type="time" onChange={e => setForm({ ...form, time: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso/60 focus:outline-none" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-espresso/50 hover:text-espresso transition-colors">Cancelar</button>
              <button onClick={addCampaign} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">{form.schedule ? 'Agendar' : 'Salvar Rascunho'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
