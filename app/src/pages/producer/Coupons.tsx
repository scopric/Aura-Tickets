import { useState } from 'react'
import {
  Tag, Plus, X, Copy, Check, Trash2, TrendingUp, Users,
  Calendar, Percent, DollarSign
} from 'lucide-react'
import { toast } from 'sonner'

interface Coupon {
  id: string
  code: string
  type: 'percent' | 'fixed'
  value: number
  minPurchase: number
  maxUses: number
  used: number
  status: 'ativo' | 'expirado' | 'esgotado' | 'desativado'
  eventName: string
  startDate: string
  endDate: string
  description: string
}

const mockCoupons: Coupon[] = [
  { id: 'cp1', code: 'ELETRO20', type: 'percent', value: 20, minPurchase: 100, maxUses: 100, used: 67, status: 'ativo', eventName: 'Noite Eletro 2025', startDate: '01 Mai', endDate: '20 Mai', description: '20% OFF para primeiros compradores' },
  { id: 'cp2', code: 'VIP30', type: 'percent', value: 30, minPurchase: 200, maxUses: 50, used: 50, status: 'esgotado', eventName: 'Noite Eletro 2025', startDate: '01 Mai', endDate: '20 Mai', description: '30% OFF em ingressos VIP' },
  { id: 'cp3', code: 'AMIGO15', type: 'percent', value: 15, minPurchase: 0, maxUses: 500, used: 234, status: 'ativo', eventName: 'Jazz Sunset Session', startDate: '01 Mai', endDate: '25 Mai', description: '15% OFF para amigos indicados' },
  { id: 'cp4', code: 'MESMAIS50', type: 'fixed', value: 50, minPurchase: 300, maxUses: 30, used: 0, status: 'ativo', eventName: 'Noite Eletro 2025', startDate: '15 Mai', endDate: '20 Mai', description: 'R$ 50 OFF em mesas coletivas' },
  { id: 'cp5', code: 'BLACK10', type: 'percent', value: 10, minPurchase: 50, maxUses: 200, used: 0, status: 'desativado', eventName: 'Workshop UX', startDate: '01 Jun', endDate: '30 Jun', description: '10% OFF geral' },
]

export default function ProducerCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>(mockCoupons)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', type: 'percent' as Coupon['type'], value: '', minPurchase: '', maxUses: '', eventName: '', startDate: '', endDate: '', description: '' })
  const [copied, setCopied] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = filterStatus === 'all' ? coupons : coupons.filter(c => c.status === filterStatus)

  const totalUses = coupons.reduce((s, c) => s + c.used, 0)
  const activeCoupons = coupons.filter(c => c.status === 'ativo').length

  const addCoupon = () => {
    if (!form.code || !form.value) { toast.error('Codigo e valor obrigatorios'); return }
    const newC: Coupon = {
      id: `cp${Date.now()}`,
      code: form.code.toUpperCase(),
      type: form.type,
      value: Number(form.value),
      minPurchase: Number(form.minPurchase) || 0,
      maxUses: Number(form.maxUses) || 999,
      used: 0,
      status: 'ativo',
      eventName: form.eventName || 'Geral',
      startDate: form.startDate || 'Hoje',
      endDate: form.endDate || 'Sem limite',
      description: form.description,
    }
    setCoupons([newC, ...coupons])
    setForm({ code: '', type: 'percent', value: '', minPurchase: '', maxUses: '', eventName: '', startDate: '', endDate: '', description: '' })
    setShowForm(false)
    toast.success(`Cupom ${newC.code} criado!`)
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
    toast.success('Copiado!')
  }

  const toggleStatus = (id: string) => {
    setCoupons(coupons.map(c => {
      if (c.id !== id) return c
      return { ...c, status: c.status === 'ativo' ? 'desativado' : 'ativo' as Coupon['status'] }
    }))
  }

  const deleteCoupon = (id: string) => {
    setCoupons(coupons.filter(c => c.id !== id))
    toast.success('Cupom removido')
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Cupons</h1>
          <p className="text-sm text-espresso/50 mt-1">Crie e gerencie cupons de desconto</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <Plus className="w-4 h-4" /> Novo Cupom
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Cupons Ativos', value: activeCoupons.toString(), icon: Tag, color: 'text-green-600' },
          { label: 'Total Usos', value: totalUses.toLocaleString(), icon: Users, color: 'text-plum' },
          { label: 'Mais Usado', value: 'ELETRO20', icon: TrendingUp, color: 'text-amber-600' },
          { label: 'Economia Gerada', value: 'R$ 8.420', icon: DollarSign, color: 'text-blue-600' },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60 text-center">
            <k.icon className={`w-5 h-5 ${k.color} mx-auto mb-2`} />
            <div className={`font-serif text-2xl ${k.color}`}>{k.value}</div>
            <div className="text-xs text-espresso/40 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        {(['all', 'ativo', 'esgotado', 'expirado', 'desativado'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${filterStatus === s ? 'bg-plum text-cream' : 'bg-white/40 border border-white/60 text-espresso/50'}`}>
            {s === 'all' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => {
          const usagePercent = Math.min((c.used / c.maxUses) * 100, 100)
          return (
            <div key={c.id} className={`p-5 rounded-2xl border backdrop-blur-sm transition-all ${c.status === 'ativo' ? 'bg-white/60 border-white/60' : 'bg-espresso/[0.02] border-espresso/5 opacity-50'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.type === 'percent' ? 'bg-plum/10' : 'bg-blue-50'}`}>
                    {c.type === 'percent' ? <Percent className="w-4 h-4 text-plum" /> : <DollarSign className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-espresso">{c.code}</h3>
                    <p className="text-[10px] text-espresso/30">{c.eventName}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-[9px] font-medium rounded-full ${
                  c.status === 'ativo' ? 'bg-green-50 text-green-600 border border-green-100' :
                  c.status === 'esgotado' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                  c.status === 'expirado' ? 'bg-red-50 text-red-400 border border-red-100' :
                  'bg-gray-50 text-gray-500 border border-gray-100'
                }`}>{c.status}</span>
              </div>

              <div className="text-center py-3 mb-3 bg-canvas rounded-xl">
                <span className="text-2xl font-serif text-plum">{c.type === 'percent' ? `${c.value}%` : `R$ ${c.value}`}</span>
                <span className="text-xs text-espresso/30 ml-1">OFF</span>
              </div>

              <p className="text-xs text-espresso/40 mb-3">{c.description}</p>

              <div className="mb-3">
                <div className="flex items-center justify-between text-[10px] text-espresso/30 mb-1">
                  <span>{c.used}/{c.maxUses} usos</span>
                  <span>{usagePercent.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-canvas rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${c.status === 'ativo' ? 'bg-plum' : 'bg-espresso/15'}`} style={{ width: `${usagePercent}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-espresso/20 mb-3">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{c.startDate} - {c.endDate}</span>
                {c.minPurchase > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />Min: R$ {c.minPurchase}</span>}
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => copyCode(c.code)} className="flex-1 py-2 bg-canvas rounded-lg text-xs text-espresso/50 hover:text-plum transition-colors flex items-center justify-center gap-1">
                  {copied === c.code ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />} Copiar
                </button>
                <button onClick={() => toggleStatus(c.id)} className={`px-3 py-2 rounded-lg text-xs transition-colors ${c.status === 'ativo' ? 'bg-red-50 text-red-400 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                  {c.status === 'ativo' ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => deleteCoupon(c.id)} className="p-2 rounded-lg hover:bg-red-50 text-espresso/20 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Novo Cupom</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Codigo do cupom *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 font-mono tracking-wider" />
              <div className="flex items-center bg-white/60 border border-white/60 rounded-full p-1">
                <button onClick={() => setForm({ ...form, type: 'percent' })} className={`flex-1 py-2 text-xs font-medium rounded-full transition-all ${form.type === 'percent' ? 'bg-plum text-cream' : 'text-espresso/40'}`}>% Percentual</button>
                <button onClick={() => setForm({ ...form, type: 'fixed' })} className={`flex-1 py-2 text-xs font-medium rounded-full transition-all ${form.type === 'fixed' ? 'bg-plum text-cream' : 'text-espresso/40'}`}>R$ Fixo</button>
              </div>
              <input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'percent' ? 'Percentual de desconto *' : 'Valor em R$ *'} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.minPurchase} onChange={e => setForm({ ...form, minPurchase: e.target.value })} placeholder="Compra minima" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none" />
                <input type="number" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} placeholder="Limite de usos" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none" />
              </div>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descricao" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" onChange={e => setForm({ ...form, startDate: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso/60 focus:outline-none" />
                <input type="date" onChange={e => setForm({ ...form, endDate: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso/60 focus:outline-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-espresso/50 hover:text-espresso transition-colors">Cancelar</button>
              <button onClick={addCoupon} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">Criar Cupom</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
