import { useState } from 'react'
import { Plus, X, Trash2, Copy, Check, Power, Ticket, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useProducerCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useDeleteCoupon,
  type DbCoupon,
} from '../../hooks/useProducerTools'

const statusOptions = ['Todos', 'Ativo', 'Expirado', 'Esgotado', 'Desativado']
const typeOptions = ['Todos', 'Percentual', 'Valor Fixo']

const statusColors: Record<string, string> = {
  ativo: 'bg-green-50 text-green-600 border-green-100',
  expirado: 'bg-amber-50 text-amber-600 border-amber-100',
  esgotado: 'bg-espresso/5 text-espresso/40 border-espresso/10',
  desativado: 'bg-red-50 text-red-500 border-red-100',
}

export default function ProducerCoupons() {
  const { data: coupons = [], isLoading } = useProducerCoupons()
  const createCoupon = useCreateCoupon()
  const updateCoupon = useUpdateCoupon()
  const deleteCoupon = useDeleteCoupon()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', type: 'percent' as DbCoupon['type'], value: '', minPurchase: '', maxUses: '999', eventName: '', startDate: '', endDate: '', description: '' })
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [filterType, setFilterType] = useState('Todos')
  const [copied, setCopied] = useState<string | null>(null)

  const filtered = coupons
    .filter(c => filterStatus === 'Todos' || c.status === filterStatus.toLowerCase())
    .filter(c => filterType === 'Todos' || (c.type === 'percent' ? 'Percentual' : 'Valor Fixo') === filterType)

  const total = coupons.length
  const active = coupons.filter(c => c.status === 'ativo').length
  const totalUses = coupons.reduce((s, c) => s + (c.used || 0), 0)

  const addCoupon = async () => {
    if (!form.code) return
    try {
      await createCoupon.mutateAsync({
        code: form.code.toUpperCase(),
        type: form.type,
        value: Number(form.value) || 0,
        min_purchase: Number(form.minPurchase) || 0,
        max_uses: Number(form.maxUses) || 999,
        used: 0,
        status: 'ativo',
        event_name: form.eventName || null,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        description: form.description || null,
      })
      setForm({ code: '', type: 'percent', value: '', minPurchase: '', maxUses: '999', eventName: '', startDate: '', endDate: '', description: '' })
      setShowForm(false)
      toast.success('Cupom criado!')
    } catch {
      toast.error('Erro ao criar cupom')
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Codigo copiado!')
  }

  const toggleStatus = async (coupon: DbCoupon) => {
    const newStatus = coupon.status === 'ativo' ? 'desativado' : 'ativo'
    try {
      await updateCoupon.mutateAsync({ id: coupon.id, status: newStatus })
      toast.success(`Cupom ${newStatus === 'ativo' ? 'ativado' : 'desativado'}!`)
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCoupon.mutateAsync(id)
      toast.success('Cupom removido!')
    } catch {
      toast.error('Erro ao remover cupom')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando cupons...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Cupons</h1>
          <p className="text-sm text-espresso/50 mt-1">Gerencie descontos e promocoes</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <Plus className="w-4 h-4" /> Novo Cupom
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total', value: total, icon: Ticket, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Ativos', value: active, icon: Check, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Utilizacoes', value: totalUses, icon: Ticket, color: 'text-plum', bg: 'bg-plum/10' },
        ].map(s => (
          <div key={s.label} className={`p-4 rounded-2xl ${s.bg} border border-white/60 text-center`}>
            <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-1`} />
            <div className={`font-serif text-xl ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-espresso/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-full">
          {statusOptions.map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${filterStatus === s ? 'bg-plum text-cream' : 'text-espresso/40 hover:text-espresso/70'}`}>{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-full">
          {typeOptions.map(t => (
            <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${filterType === t ? 'bg-plum text-cream' : 'text-espresso/40 hover:text-espresso/70'}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-canvas border border-white/60 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Novo Cupom</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-espresso/5 text-espresso/40"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Codigo (ex: AURA20)" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as DbCoupon['type'] })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                  <option value="percent">% Percentual</option>
                  <option value="fixed">R$ Valor Fixo</option>
                </select>
                <input value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={form.type === 'percent' ? 'Desconto %' : 'Valor R$'} type="number" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.minPurchase} onChange={e => setForm({ ...form, minPurchase: e.target.value })} placeholder="Compra min. R$" type="number" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                <input value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} placeholder="Limite usos" type="number" className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              </div>
              <input value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} placeholder="Evento (opcional)" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
                <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
              </div>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descricao (opcional)" rows={2} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30 resize-none" />
              <button onClick={addCoupon} disabled={createCoupon.isPending} className="w-full py-3 bg-plum text-cream text-sm font-medium rounded-xl hover:shadow-glow transition-all disabled:opacity-50">
                {createCoupon.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Criar Cupom'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(coupon => (
          <div key={coupon.id} className="p-5 rounded-2xl bg-white/60 border border-white/60 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <span className={`px-2 py-0.5 text-[9px] font-medium rounded-full border ${statusColors[coupon.status] || statusColors.ativo}`}>{coupon.status}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => copyCode(coupon.code)} className="p-1.5 rounded-lg text-espresso/10 hover:text-plum hover:bg-plum/10 transition-colors">
                  {copied === coupon.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => toggleStatus(coupon)} className="p-1.5 rounded-lg text-espresso/10 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(coupon.id)} className="p-1.5 rounded-lg text-espresso/10 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="mb-3">
              <div className="font-mono text-lg font-bold text-espresso tracking-wider">{coupon.code}</div>
              <div className="text-xs text-espresso/40 mt-0.5">{coupon.description || 'Sem descricao'}</div>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-b border-espresso/5">
              <div className="text-center flex-1">
                <div className="text-xs text-espresso/30">Desconto</div>
                <div className="text-sm font-medium text-espresso">
                  {coupon.type === 'percent' ? `${coupon.value}%` : `R$ ${Number(coupon.value || 0).toLocaleString('pt-BR')}`}
                </div>
              </div>
              <div className="w-px h-8 bg-espresso/5" />
              <div className="text-center flex-1">
                <div className="text-xs text-espresso/30">Usado</div>
                <div className="text-sm font-medium text-espresso">{coupon.used || 0}/{coupon.max_uses || '-'}</div>
              </div>
              <div className="w-px h-8 bg-espresso/5" />
              <div className="text-center flex-1">
                <div className="text-xs text-espresso/30">Minimo</div>
                <div className="text-sm font-medium text-espresso">R$ {Number(coupon.min_purchase || 0).toLocaleString('pt-BR')}</div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 text-[10px] text-espresso/30">
              <span>Valido: {coupon.start_date ? new Date(coupon.start_date).toLocaleDateString('pt-BR') : 'Sempre'} {coupon.end_date ? `- ${new Date(coupon.end_date).toLocaleDateString('pt-BR')}` : ''}</span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Ticket className="w-12 h-12 text-espresso/10 mx-auto mb-3" />
          <p className="text-sm text-espresso/30">Nenhum cupom encontrado.</p>
          <p className="text-xs text-espresso/20 mt-1">Crie seu primeiro cupom de desconto.</p>
        </div>
      )}
    </div>
  )
}
