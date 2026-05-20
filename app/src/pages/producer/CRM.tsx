import { useState } from 'react'
import {
  Users, TrendingUp, Target, Phone, Mail, MessageSquare,
  Star, ArrowRight, Search, CheckCircle2,
  Calendar, DollarSign, BarChart3
} from 'lucide-react'
import { toast } from 'sonner'

interface Lead {
  id: string
  name: string
  email: string
  avatar: string
  status: 'novo' | 'qualificado' | 'proposta' | 'negociacao' | 'fechado'
  source: string
  score: number
  value: number
  lastContact: string
  eventInterest: string
  phone: string
  notes: string
  interactions: { date: string; type: string; content: string }[]
}

const initialLeads: Lead[] = [
  { id: 'l1', name: 'Pedro Santos', email: 'pedro@empresa.com', avatar: 'https://i.pravatar.cc/150?img=11', status: 'novo', source: 'Instagram', score: 72, value: 5000, lastContact: '2h atras', eventInterest: 'Festa Corporativa', phone: '(11) 98765-1111', notes: 'Interessado em evento para 100 pessoas', interactions: [{ date: '14 Mai', type: 'Visita', content: 'Visitou pagina do evento' }, { date: '13 Mai', type: 'Email', content: 'Clicou no email de lancamento' }] },
  { id: 'l2', name: 'Mariana Costa', email: 'mariana@design.com', avatar: 'https://i.pravatar.cc/150?img=5', status: 'qualificado', source: 'Indicacao', score: 91, value: 12000, lastContact: '1h atras', eventInterest: 'Noite Eletro 2025', phone: '(11) 98765-2222', notes: 'Ja comprou antes, quer upgrade', interactions: [{ date: '14 Mai', type: 'Ligacao', content: 'Conversa de 15 min, interesse confirmado' }, { date: '12 Mai', type: 'WhatsApp', content: 'Pediu orcamento' }] },
  { id: 'l3', name: 'Carlos Eduardo', email: 'carlos@tech.com', avatar: 'https://i.pravatar.cc/150?img=3', status: 'proposta', source: 'Google Ads', score: 68, value: 8500, lastContact: '30 min', eventInterest: 'Workshop UX', phone: '(11) 98765-3333', notes: 'Aguardando aprovacao do gestor', interactions: [{ date: '14 Mai', type: 'Email', content: 'Proposta enviada' }, { date: '10 Mai', type: 'Visita', content: 'Landing page' }] },
  { id: 'l4', name: 'Fernanda Lima', email: 'fernanda@food.com', avatar: 'https://i.pravatar.cc/150?img=9', status: 'negociacao', source: 'Afiliado', score: 85, value: 15000, lastContact: '15 min', eventInterest: 'Gastronomia Fest', phone: '(11) 98765-4444', notes: 'Negociando desconto de 10%', interactions: [{ date: '15 Mai', type: 'Ligacao', content: 'Contra-proposta de desconto' }, { date: '13 Mai', type: 'Proposta', content: 'Primeira proposta enviada' }] },
  { id: 'l5', name: 'Roberto Souza', email: 'roberto@corp.com', avatar: 'https://i.pravatar.cc/150?img=8', status: 'fechado', source: 'LinkedIn', score: 94, value: 22000, lastContact: '5 min', eventInterest: 'Evento Corporativo Q3', phone: '(11) 98765-5555', notes: 'CONTRATO ASSINADO!', interactions: [{ date: '15 Mai', type: 'Fechamento', content: 'Contrato assinado e pagamento confirmado' }, { date: '14 Mai', type: 'Negociacao', content: 'Acordo final' }] },
  { id: 'l6', name: 'Amanda Rocha', email: 'amanda@art.com', avatar: 'https://i.pravatar.cc/150?img=20', status: 'novo', source: 'Organico', score: 45, value: 2500, lastContact: '3h atras', eventInterest: 'Feira de Arte', phone: '(11) 98765-6666', notes: 'Primeiro contato', interactions: [{ date: '15 Mai', type: 'Cadastro', content: 'Se cadastrou na newsletter' }] },
  { id: 'l7', name: 'Lucas Torres', email: 'lucas@sports.com', avatar: 'https://i.pravatar.cc/150?img=13', status: 'qualificado', source: 'Facebook', score: 78, value: 9500, lastContact: '4h atras', eventInterest: 'Corrida Noturna', phone: '(11) 98765-7777', notes: 'Busca parceria com patrocinadores', interactions: [{ date: '14 Mai', type: 'Email', content: 'Respondeu pesquisa de interesse' }, { date: '12 Mai', type: 'Visita', content: 'Pagina de precos' }] },
]

const columns = [
  { key: 'novo', label: 'Novo', color: 'bg-blue-100 text-blue-700', icon: Users },
  { key: 'qualificado', label: 'Qualificado', color: 'bg-amber-100 text-amber-700', icon: Target },
  { key: 'proposta', label: 'Proposta', color: 'bg-violet-100 text-violet-700', icon: Mail },
  { key: 'negociacao', label: 'Negociacao', color: 'bg-orange-100 text-orange-700', icon: ArrowRight },
  { key: 'fechado', label: 'Fechado', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
] as const

export default function ProducerCRM() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const filtered = leads.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()))

  const stats = {
    total: leads.length,
    novos: leads.filter(l => l.status === 'novo').length,
    conversao: Math.round((leads.filter(l => l.status === 'fechado').length / leads.length) * 100),
    revenue: leads.filter(l => l.status === 'fechado').reduce((s, l) => s + l.value, 0),
    pipeline: leads.reduce((s, l) => s + l.value, 0),
    avgScore: Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length),
  }

  const handleDragStart = (id: string) => setDraggedId(id)
  const handleDragOver = (e: React.DragEvent, col: string) => { e.preventDefault(); setDragOverCol(col) }
  const handleDragLeave = () => setDragOverCol(null)
  const handleDrop = (col: string) => {
    if (draggedId) {
      setLeads(leads.map(l => l.id === draggedId ? { ...l, status: col as Lead['status'] } : l))
      const lead = leads.find(l => l.id === draggedId)
      if (lead) toast.success(`${lead.name} movido para ${columns.find(c => c.key === col)?.label}`)
      setDraggedId(null)
    }
    setDragOverCol(null)
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">CRM</h1>
          <p className="text-sm text-espresso/50 mt-1">Pipeline, leads e comunicacao</p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar leads..." className="w-full pl-9 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: 'Total Leads', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Novos', value: stats.novos, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Conversao', value: `${stats.conversao}%`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Score Medio', value: stats.avgScore, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Receita', value: `R$ ${(stats.revenue / 1000).toFixed(0)}K`, icon: DollarSign, color: 'text-plum', bg: 'bg-plum/5' },
          { label: 'Pipeline', value: `R$ ${(stats.pipeline / 1000).toFixed(0)}K`, icon: BarChart3, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(s => (
          <div key={s.label} className={`p-4 rounded-2xl ${s.bg} border border-white/60 text-center`}>
            <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1.5`} />
            <div className={`font-serif text-lg ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-espresso/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => {
          const colLeads = filtered.filter(l => l.status === col.key)
          const isOver = dragOverCol === col.key
          return (
            <div
              key={col.key}
              className={`flex-shrink-0 w-72 rounded-2xl transition-all ${isOver ? 'ring-2 ring-plum/30 scale-[1.02]' : ''}`}
              style={{ background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.6)' }}
              onDragOver={e => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(col.key)}
            >
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <col.icon className={`w-3.5 h-3.5`} />
                  <span className="text-xs font-medium text-espresso">{col.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-canvas text-espresso/40">{colLeads.length}</span>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {colLeads.map(l => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => handleDragStart(l.id)}
                    onClick={() => setSelected(l)}
                    className="p-3 rounded-xl bg-white/60 border border-white/60 hover:shadow-md hover:bg-white/80 transition-all cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <img src={l.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-espresso truncate">{l.name}</div>
                        <div className="text-[9px] text-espresso/30">{l.source}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Star className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-espresso/50">{l.score}</span>
                      <span className="text-[10px] text-plum ml-auto">R$ {(l.value / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="text-[9px] text-espresso/25">{l.eventInterest}</div>
                  </div>
                ))}
                {colLeads.length === 0 && <div className="py-8 text-center text-[10px] text-espresso/15">Arraste leads aqui</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-canvas border-l border-espresso/10 h-full overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <img src={selected.avatar} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-plum/30" />
                  <div>
                    <h3 className="font-serif text-xl text-espresso">{selected.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${columns.find(c => c.key === selected.status)?.color}`}>{columns.find(c => c.key === selected.status)?.label}</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 rounded-full bg-canvas text-espresso/40">X</button>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Mail className="w-4 h-4 text-espresso/30" />{selected.email}</div>
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Phone className="w-4 h-4 text-espresso/30" />{selected.phone}</div>
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Calendar className="w-4 h-4 text-espresso/30" />{selected.lastContact}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className="font-serif text-xl text-plum">{selected.score}</div>
                  <div className="text-[10px] text-espresso/30">Score</div>
                </div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className="font-serif text-xl text-green-600">R$ {selected.value.toLocaleString()}</div>
                  <div className="text-[10px] text-espresso/30">Valor</div>
                </div>
              </div>

              <div className="mb-6 p-4 rounded-xl bg-white/60 border border-white/60">
                <div className="text-[10px] text-espresso/30 uppercase mb-1">Notas</div>
                <div className="text-sm text-espresso/60">{selected.notes}</div>
              </div>

              <h4 className="text-xs font-medium text-espresso/40 uppercase mb-3">Interacoes</h4>
              <div className="space-y-2 mb-6">
                {selected.interactions.map((int, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/40">
                    <div className="w-8 h-8 rounded-lg bg-canvas flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-3.5 h-3.5 text-plum" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-espresso">{int.type}</span>
                        <span className="text-[10px] text-espresso/20">{int.date}</span>
                      </div>
                      <p className="text-xs text-espresso/40">{int.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => { navigator.clipboard.writeText(selected.email); toast.success('Copiado!') }} className="flex-1 py-2.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow">Enviar Email</button>
                <button onClick={() => toast.success('Ligacao iniciada!')} className="flex-1 py-2.5 bg-canvas text-espresso/50 text-xs rounded-full hover:text-espresso">Ligar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
