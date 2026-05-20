import { useState } from 'react'
import {
  Users, UserPlus, TrendingUp, DollarSign, QrCode, Copy, Check,
  X, Search, Medal, Crown, Award, Star, Tag, Ticket, BarChart3,
  Phone, Mail, Share2, Edit3, Trash2, Gift
} from 'lucide-react'
import { toast } from 'sonner'

interface AffiliateSale {
  date: string
  tickets: number
  value: number
}

interface Affiliate {
  id: string
  name: string
  email: string
  phone: string
  avatar: string
  code: string
  couponCode: string
  couponDiscount: number
  status: 'ativo' | 'pausado' | 'pendente'
  totalSales: number
  ticketsSold: number
  ticketLimit: number
  commission: number
  commissionRate: number
  commissionPaid: number
  lastSale: string
  level: 'bronze' | 'silver' | 'gold' | 'platinum'
  eventName: string
  pixKey: string
  joinedAt: string
  salesHistory: AffiliateSale[]
  conversionRate: number
}

const generateHistory = (): AffiliateSale[] => [
  { date: '10 Mai', tickets: 3, value: 450 },
  { date: '11 Mai', tickets: 5, value: 750 },
  { date: '12 Mai', tickets: 2, value: 300 },
  { date: '13 Mai', tickets: 8, value: 1200 },
  { date: '14 Mai', tickets: 12, value: 1800 },
  { date: '15 Mai', tickets: 7, value: 1050 },
  { date: '16 Mai', tickets: 15, value: 2250 },
]

const mockAffiliates: Affiliate[] = [
  { id: 'a1', name: 'Carlos Mendes', email: 'carlos@email.com', phone: '(11) 98765-4321', avatar: 'https://i.pravatar.cc/150?img=11', code: 'CARLOS20', couponCode: 'CARLOSVIP', couponDiscount: 15, status: 'ativo', totalSales: 12500, ticketsSold: 87, ticketLimit: 200, commission: 1250, commissionRate: 10, commissionPaid: 800, lastSale: '2h atras', level: 'gold', eventName: 'Noite Eletro 2025', pixKey: 'carlos@pix.com', joinedAt: '01 Abr 2025', salesHistory: generateHistory(), conversionRate: 12.5 },
  { id: 'a2', name: 'Fernanda Rocha', email: 'fernanda@email.com', phone: '(11) 91234-5678', avatar: 'https://i.pravatar.cc/150?img=5', code: 'FERNANDA15', couponCode: 'FERNA10', couponDiscount: 10, status: 'ativo', totalSales: 8400, ticketsSold: 52, ticketLimit: 100, commission: 840, commissionRate: 10, commissionPaid: 500, lastSale: '5h atras', level: 'silver', eventName: 'Noite Eletro 2025', pixKey: '(11)91234-5678', joinedAt: '10 Abr 2025', salesHistory: generateHistory().map(h => ({ ...h, tickets: Math.floor(h.tickets * 0.6), value: Math.floor(h.value * 0.6) })), conversionRate: 8.3 },
  { id: 'a3', name: 'Rafael Torres', email: 'rafael@email.com', phone: '(11) 92345-6789', avatar: 'https://i.pravatar.cc/150?img=3', code: 'RAFAEL10', couponCode: 'RAFAEL5', couponDiscount: 5, status: 'ativo', totalSales: 6200, ticketsSold: 41, ticketLimit: 80, commission: 620, commissionRate: 10, commissionPaid: 200, lastSale: '1 dia', level: 'silver', eventName: 'Jazz Sunset Session', pixKey: 'rafael@pix.com', joinedAt: '15 Abr 2025', salesHistory: generateHistory().map(h => ({ ...h, tickets: Math.floor(h.tickets * 0.5), value: Math.floor(h.value * 0.5) })), conversionRate: 6.1 },
  { id: 'a4', name: 'Amanda Costa', email: 'amanda@email.com', phone: '(11) 93456-7890', avatar: 'https://i.pravatar.cc/150?img=9', code: 'AMANDA20', couponCode: '', couponDiscount: 0, status: 'pendente', totalSales: 0, ticketsSold: 0, ticketLimit: 50, commission: 0, commissionRate: 10, commissionPaid: 0, lastSale: '-', level: 'bronze', eventName: 'Noite Eletro 2025', pixKey: '', joinedAt: '16 Mai 2025', salesHistory: [], conversionRate: 0 },
  { id: 'a5', name: 'Lucas Oliveira', email: 'lucas@email.com', phone: '(11) 94567-8901', avatar: 'https://i.pravatar.cc/150?img=8', code: 'LUCAS25', couponCode: 'LUCAS20', couponDiscount: 20, status: 'ativo', totalSales: 18200, ticketsSold: 124, ticketLimit: 300, commission: 1820, commissionRate: 10, commissionPaid: 1200, lastSale: '30min', level: 'platinum', eventName: 'Noite Eletro 2025', pixKey: 'lucas@pix.com', joinedAt: '01 Mar 2025', salesHistory: generateHistory().map(h => ({ ...h, tickets: Math.floor(h.tickets * 1.8), value: Math.floor(h.value * 1.8) })), conversionRate: 18.7 },
  { id: 'a6', name: 'Beatriz Lima', email: 'bia@email.com', phone: '(11) 95678-9012', avatar: 'https://i.pravatar.cc/150?img=20', code: 'BIA15', couponCode: 'BIAFRIEND', couponDiscount: 12, status: 'pausado', totalSales: 2100, ticketsSold: 15, ticketLimit: 60, commission: 210, commissionRate: 10, commissionPaid: 210, lastSale: '5 dias', level: 'bronze', eventName: 'Jazz Sunset Session', pixKey: 'bia@pix.com', joinedAt: '01 Mai 2025', salesHistory: generateHistory().map(h => ({ ...h, tickets: Math.floor(h.tickets * 0.2), value: Math.floor(h.value * 0.2) })), conversionRate: 3.2 },
]

const levelConfig = {
  bronze: { icon: Medal, color: 'text-amber-700', bg: 'bg-amber-100', label: 'Bronze', next: 25 },
  silver: { icon: Award, color: 'text-gray-400', bg: 'bg-gray-100', label: 'Prata', next: 75 },
  gold: { icon: Crown, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Ouro', next: 150 },
  platinum: { icon: Star, color: 'text-violet-500', bg: 'bg-violet-50', label: 'Platina', next: 999 },
}

export default function ProducerAffiliates() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>(mockAffiliates)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', commissionRate: '10', eventName: '', pixKey: '', ticketLimit: '100', couponCode: '', couponDiscount: '' })
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selected, setSelected] = useState<Affiliate | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [showRanking, setShowRanking] = useState(false)

  const filtered = affiliates.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.toLowerCase().includes(search.toLowerCase())).filter(a => filterStatus === 'all' || a.status === filterStatus)

  const stats = {
    total: affiliates.length, active: affiliates.filter(a => a.status === 'ativo').length,
    totalSales: affiliates.reduce((s, a) => s + a.totalSales, 0),
    totalTickets: affiliates.reduce((s, a) => s + a.ticketsSold, 0),
    totalCommission: affiliates.reduce((s, a) => s + a.commission, 0),
    commissionPending: affiliates.reduce((s, a) => s + (a.commission - a.commissionPaid), 0),
    avgConversion: affiliates.filter(a => a.conversionRate > 0).length > 0 ? (affiliates.filter(a => a.conversionRate > 0).reduce((s, a) => s + a.conversionRate, 0) / affiliates.filter(a => a.conversionRate > 0).length).toFixed(1) : '0',
  }

  const ranking = [...affiliates].filter(a => a.status === 'ativo').sort((a, b) => b.ticketsSold - a.ticketsSold)

  const addAffiliate = () => {
    if (!form.name || !form.email) { toast.error('Nome e email obrigatorios'); return }
    const code = form.name.toUpperCase().replace(/\s/g, '').slice(0, 8) + Math.floor(Math.random() * 100)
    const newAff: Affiliate = {
      id: `a${Date.now()}`, name: form.name, email: form.email, phone: form.phone,
      avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70) + 1}`,
      code, couponCode: form.couponCode?.toUpperCase() || '', couponDiscount: Number(form.couponDiscount) || 0,
      status: 'ativo', totalSales: 0, ticketsSold: 0, ticketLimit: Number(form.ticketLimit) || 100,
      commission: 0, commissionRate: Number(form.commissionRate), commissionPaid: 0, lastSale: '-',
      level: 'bronze', eventName: form.eventName || 'Evento Geral', pixKey: form.pixKey, joinedAt: 'Hoje',
      salesHistory: [], conversionRate: 0,
    }
    setAffiliates([newAff, ...affiliates])
    setForm({ name: '', email: '', phone: '', commissionRate: '10', eventName: '', pixKey: '', ticketLimit: '100', couponCode: '', couponDiscount: '' })
    setShowForm(false)
    toast.success(`Afiliado ${form.name} adicionado!`)
  }

  const copyCode = (code: string, id: string) => { navigator.clipboard.writeText(`https://aura.events/?ref=${code}`); setCopied(id); setTimeout(() => setCopied(null), 1500); toast.success('Link copiado!') }
  const toggleStatus = (id: string) => { setAffiliates(affiliates.map(a => { if (a.id !== id) return a; const next = a.status === 'ativo' ? 'pausado' : a.status === 'pausado' ? 'pendente' : 'ativo'; return { ...a, status: next } })) }
  const deleteAffiliate = (id: string) => { setAffiliates(affiliates.filter(a => a.id !== id)); setSelected(null); toast.success('Afiliado removido') }

  const maxHistoryVal = selected ? Math.max(...selected.salesHistory.map(h => h.value), 1) : 1

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Afiliados</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie seus vendedores, cupons e limites</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRanking(!showRanking)} className="flex items-center gap-2 px-4 py-2.5 bg-white/60 border border-white/60 text-espresso text-sm font-medium rounded-full hover:bg-white transition-all">
            <Award className="w-4 h-4" /> Ranking
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
            <UserPlus className="w-4 h-4" /> Novo Afiliado
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Ativos', value: stats.active.toString(), icon: Users, color: 'text-blue-600' },
          { label: 'Vendas Totais', value: `R$ ${stats.totalSales.toLocaleString()}`, icon: DollarSign, color: 'text-green-600' },
          { label: 'Ingressos', value: stats.totalTickets.toString(), icon: Ticket, color: 'text-plum' },
          { label: 'Com. Pendente', value: `R$ ${stats.commissionPending.toLocaleString()}`, icon: TrendingUp, color: 'text-amber-600' },
          { label: 'Conversao Media', value: `${stats.avgConversion}%`, icon: BarChart3, color: 'text-violet-600' },
        ].map(k => (
          <div key={k.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
            <k.icon className={`w-4 h-4 ${k.color} mx-auto mb-1.5`} />
            <div className={`font-serif text-xl ${k.color}`}>{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Ranking */}
      {showRanking && (
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-amber-50/60 via-white/60 to-violet-50/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Ranking de Vendas</h3>
          <div className="space-y-3">
            {ranking.slice(0, 5).map((a, i) => { const lc = levelConfig[a.level]; const Li = lc.icon; return (
              <div key={a.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/60 border border-white/60">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-canvas text-espresso/30'}`}>{i + 1}</div>
                <img src={a.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-canvas" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-espresso font-medium">{a.name}</div>
                  <div className="text-[10px] text-espresso/30 flex items-center gap-1"><Li className={`w-3 h-3 ${lc.color}`} /> {lc.label} · {a.ticketsSold} ingressos · Conv. {a.conversionRate}%</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-serif text-green-600">R$ {a.totalSales.toLocaleString()}</div>
                  <div className="text-[10px] text-espresso/30">R$ {a.commission} comissao</div>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar afiliado..." className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" /></div>
        <div className="flex items-center gap-2">
          {(['all', 'ativo', 'pausado', 'pendente'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filterStatus === s ? 'bg-plum text-cream' : 'bg-white/40 border border-white/60 text-espresso/50 hover:text-espresso/70'}`}>{s === 'all' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-espresso/5">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Afiliado</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Codigo / Cupom</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Limite</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden md:table-cell">Conv.</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={a.avatar} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-canvas" />
                      <div className="min-w-0">
                        <div className="text-sm text-espresso font-medium">{a.name}</div>
                        <div className="text-[10px] text-espresso/30">{a.ticketsSold} vendidos · R$ {a.totalSales.toLocaleString()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <button onClick={() => copyCode(a.code, a.id)} className="flex items-center gap-1 px-2 py-1 bg-canvas rounded-lg text-[10px] text-espresso/50 hover:text-plum transition-colors">
                        <QrCode className="w-3 h-3" /> {a.code} {copied === a.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                      {a.couponCode && <span className="px-2 py-1 bg-plum/10 rounded-lg text-[10px] text-plum flex items-center gap-1"><Tag className="w-3 h-3" /> {a.couponCode} ({a.couponDiscount}%)</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-espresso font-medium">{a.ticketsSold}/{a.ticketLimit}</div>
                    <div className="w-20 h-1.5 bg-canvas rounded-full overflow-hidden mt-1">
                      <div className={`h-full rounded-full ${a.ticketsSold >= a.ticketLimit ? 'bg-red-400' : 'bg-plum'}`} style={{ width: `${Math.min((a.ticketsSold / a.ticketLimit) * 100, 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-espresso/60">{a.conversionRate}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStatus(a.id)} className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all ${a.status === 'ativo' ? 'bg-green-50 border-green-100 text-green-600' : a.status === 'pausado' ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelected(a)} className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => copyCode(a.code, a.id)} className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-plum transition-colors"><Share2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h3 className="font-serif text-xl text-espresso">Novo Afiliado</h3><button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-4 h-4" /></button></div>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome completo *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Telefone" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={form.pixKey} onChange={e => setForm({ ...form, pixKey: e.target.value })} placeholder="Chave PIX" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} placeholder="Evento" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                <input type="number" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: e.target.value })} placeholder="% Comissao" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.ticketLimit} onChange={e => setForm({ ...form, ticketLimit: e.target.value })} placeholder="Limite de ingressos" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none" />
                <input value={form.couponCode} onChange={e => setForm({ ...form, couponCode: e.target.value.toUpperCase() })} placeholder="Codigo do cupom" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 font-mono" />
              </div>
              <input type="number" value={form.couponDiscount} onChange={e => setForm({ ...form, couponDiscount: e.target.value })} placeholder="Desconto do cupom (%)" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none" />
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-espresso/50 hover:text-espresso transition-colors">Cancelar</button>
              <button onClick={addAffiliate} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Performance Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg bg-canvas border-l border-espresso/10 h-full overflow-y-auto shadow-2xl">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <img src={selected.avatar} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-plum/30" />
                  <div>
                    <h3 className="font-serif text-xl text-espresso">{selected.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${levelConfig[selected.level].bg} ${levelConfig[selected.level].color}`}>{levelConfig[selected.level].label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => deleteAffiliate(selected.id)} className="p-2 rounded-full hover:bg-red-50 text-espresso/30 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  <button onClick={() => setSelected(null)} className="p-2 rounded-full bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-5 h-5" /></button>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Mail className="w-4 h-4 text-espresso/30" />{selected.email}</div>
                <div className="flex items-center gap-2 text-sm text-espresso/50"><Phone className="w-4 h-4 text-espresso/30" />{selected.phone}</div>
                <div className="flex items-center gap-2 text-sm text-espresso/50"><QrCode className="w-4 h-4 text-espresso/30" />{selected.code}</div>
                {selected.pixKey && <div className="flex items-center gap-2 text-sm text-espresso/50"><DollarSign className="w-4 h-4 text-espresso/30" />{selected.pixKey}</div>}
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center">
                  <div className="font-serif text-xl text-espresso">{selected.ticketsSold}<span className="text-xs text-espresso/30">/{selected.ticketLimit}</span></div>
                  <div className="text-[10px] text-espresso/30">Ingressos · {((selected.ticketsSold/selected.ticketLimit)*100).toFixed(0)}%</div>
                  <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden mt-1.5"><div className={`h-full rounded-full ${selected.ticketsSold >= selected.ticketLimit ? 'bg-red-400' : 'bg-plum'}`} style={{ width: `${Math.min((selected.ticketsSold / selected.ticketLimit) * 100, 100)}%` }} /></div>
                </div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center"><div className="font-serif text-xl text-green-600">R$ {selected.totalSales.toLocaleString()}</div><div className="text-[10px] text-espresso/30">Vendas</div></div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center"><div className="font-serif text-xl text-plum">R$ {selected.commission.toLocaleString()}</div><div className="text-[10px] text-espresso/30">Comissao</div></div>
                <div className="p-4 rounded-xl bg-white/60 border border-white/60 text-center"><div className="font-serif text-xl text-violet-600">{selected.conversionRate}%</div><div className="text-[10px] text-espresso/30">Conversao</div></div>
              </div>

              {/* Coupon */}
              {selected.couponCode && (
                <div className="mb-6 p-4 rounded-xl bg-plum/5 border border-plum/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-plum" />
                    <div>
                      <div className="text-sm text-espresso font-medium">{selected.couponCode}</div>
                      <div className="text-[10px] text-espresso/30">{selected.couponDiscount}% de desconto exclusivo</div>
                    </div>
                  </div>
                  <button onClick={() => copyCode(selected.couponCode, selected.id)} className="p-2 rounded-lg bg-plum/10 text-plum hover:bg-plum/20 transition-colors">{copied === selected.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
                </div>
              )}

              {/* Sales Chart */}
              {selected.salesHistory.length > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-white/60 border border-white/60">
                  <h4 className="text-xs font-medium text-espresso/40 uppercase tracking-wider mb-3 flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5" /> Historico de Vendas</h4>
                  <div className="flex items-end gap-2 h-28">
                    {selected.salesHistory.map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-espresso/30">R${(h.value/1000).toFixed(1)}k</span>
                        <div className="w-full bg-plum/20 rounded-t-lg transition-all hover:bg-plum/40" style={{ height: `${(h.value / maxHistoryVal) * 80}px` }} />
                        <span className="text-[9px] text-espresso/30">{h.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Level Progress */}
              <div className="mb-6 p-4 rounded-xl bg-white/60 border border-white/60">
                <h4 className="text-xs font-medium text-espresso/40 uppercase tracking-wider mb-2">Progresso de Nivel</h4>
                <div className="flex items-center justify-between text-[10px] text-espresso/30 mb-1">
                  <span>{levelConfig[selected.level].label}</span>
                  <span>{selected.ticketsSold} / {levelConfig[selected.level].next} ingressos</span>
                </div>
                <div className="w-full h-2 bg-canvas rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-violet-500 rounded-full" style={{ width: `${Math.min((selected.ticketsSold / levelConfig[selected.level].next) * 100, 100)}%` }} />
                </div>
              </div>

              {/* Payment */}
              <div className="p-4 rounded-xl bg-green-50 border border-green-100 mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-green-700">Para pagamento</span>
                  <span className="text-xs text-green-600 font-medium">R$ {selected.commission - selected.commissionPaid} pendente</span>
                </div>
                <div className="text-sm text-green-800 font-medium">{selected.pixKey || 'Chave PIX nao cadastrada'}</div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-green-600/60">
                  <span>Pago: R$ {selected.commissionPaid}</span>
                  <span>Total: R$ {selected.commission}</span>
                </div>
              </div>

              <button onClick={() => { navigator.clipboard.writeText(selected.email); toast.success('Email copiado!') }} className="w-full py-2.5 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
                <Mail className="w-3.5 h-3.5" /> Enviar Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
