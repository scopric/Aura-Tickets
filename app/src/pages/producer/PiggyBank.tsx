import { useState } from 'react'
import {
  PiggyBank as PiggyIcon, Plus, X, Target, TrendingUp, Trash2,
  CheckCircle2, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useBudgetBoxes,
  useCreateBudgetBox,
  useUpdateBudgetBox,
  useDeleteBudgetBox,
  useCreatePiggyTransaction,
} from '../../hooks/useProducerTools'

const categories = [
  { id: 'marketing', label: 'Marketing', color: '#8b5cf6' },
  { id: 'infra', label: 'Infraestrutura', color: '#3b82f6' },
  { id: 'decoracao', label: 'Decoracao', color: '#ec4899' },
  { id: 'equipamento', label: 'Equipamento', color: '#f59e0b' },
  { id: 'emergencia', label: 'Emergencia', color: '#ef4444' },
  { id: 'lucro', label: 'Lucro/Liquidacao', color: '#22c55e' },
]

export default function ProducerPiggyBank() {
  const { data: boxes = [], isLoading } = useBudgetBoxes()
  const createBox = useCreateBudgetBox()
  const deleteBox = useDeleteBudgetBox()
  const createTransaction = useCreatePiggyTransaction()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ eventName: '', name: '', target: '', category: 'marketing', notes: '' })
  const [depositBox, setDepositBox] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState('')

  const totalTarget = boxes.reduce((s, b) => s + (b.target || 0), 0)
  const totalSaved = boxes.reduce((s, b) => s + (b.saved || 0), 0)
  const progress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0
  const completed = boxes.filter(b => (b.saved || 0) >= (b.target || 0)).length
  const nearGoal = boxes.filter(b => {
    const pct = (b.target || 0) > 0 ? (b.saved || 0) / (b.target || 0) : 0
    return pct >= 0.8 && pct < 1
  }).length

  const addBox = async () => {
    if (!form.name || !form.target) { toast.error('Preencha nome e meta'); return }
    try {
      await createBox.mutateAsync({
        event_name: form.eventName || null,
        name: form.name,
        target: Number(form.target),
        saved: 0,
        category: form.category,
        notes: form.notes || null,
      })
      setForm({ eventName: '', name: '', target: '', category: 'marketing', notes: '' })
      setShowForm(false)
      toast.success('Caixinha criada!')
    } catch {
      toast.error('Erro ao criar caixinha')
    }
  }

  const handleTransaction = async (boxId: string, type: 'deposit' | 'withdraw') => {
    const amount = Number(depositAmount)
    if (!amount || amount <= 0) { toast.error('Valor invalido'); return }
    try {
      await createTransaction.mutateAsync({ box_id: boxId, type, amount })
      setDepositBox(null)
      setDepositAmount('')
      toast.success(type === 'deposit' ? `Depositado R$ ${amount.toFixed(2)}!` : `Sacado R$ ${amount.toFixed(2)}!`)
    } catch {
      toast.error('Erro na transacao')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteBox.mutateAsync(id)
      toast.success('Caixinha removida')
    } catch {
      toast.error('Erro ao remover caixinha')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando caixinhas...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Caixinha</h1>
          <p className="text-sm text-espresso/50 mt-1">Organize seu dinheiro por evento e categoria</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
          <Plus className="w-4 h-4" /> Nova Caixinha
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Meta Total', value: `R$ ${totalTarget.toLocaleString('pt-BR')}`, icon: Target, color: 'text-plum' },
          { label: 'Guardado', value: `R$ ${totalSaved.toLocaleString('pt-BR')}`, icon: PiggyIcon, color: 'text-green-600' },
          { label: 'Progresso', value: `${progress.toFixed(0)}%`, icon: TrendingUp, color: 'text-blue-600' },
          { label: 'Completas', value: `${completed}/${boxes.length}`, icon: CheckCircle2, color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
            <k.icon className={`w-5 h-5 ${k.color} mb-3`} />
            <div className={`font-serif text-2xl ${k.color}`}>{k.value}</div>
            <div className="text-xs text-espresso/40 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Global Progress */}
      <div className="mb-8 p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-espresso">Progresso Geral</span>
          <span className="text-sm font-medium text-plum">{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full h-4 bg-canvas rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 relative" style={{ width: `${Math.min(progress, 100)}%`, background: 'linear-gradient(90deg, #7a3b69, #c49ab8)' }}>
            <div className="absolute inset-0 animate-pulse bg-white/20" />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-espresso/30">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Completas: {completed}</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Quase la: {nearGoal}</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-espresso/20" /> Em andamento: {boxes.length - completed - nearGoal}</span>
        </div>
      </div>

      {/* Boxes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boxes.map(box => {
          const cat = categories.find(c => c.id === box.category)
          const pct = (box.target || 0) > 0 ? Math.min(((box.saved || 0) / (box.target || 0)) * 100, 100) : 0
          const isDone = (box.saved || 0) >= (box.target || 0)
          const isNear = pct >= 80 && !isDone
          return (
            <div key={box.id} className={`p-5 rounded-2xl border backdrop-blur-sm transition-all hover:shadow-md ${isDone ? 'bg-green-50/60 border-green-200/60' : 'bg-white/60 border-white/60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat?.color}15` }}>
                    {isDone ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <PiggyIcon className="w-4 h-4" style={{ color: cat?.color }} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-espresso">{box.name}</h3>
                    <p className="text-[10px] text-espresso/30">{box.event_name || 'Evento'}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(box.id)} className="p-1 rounded hover:bg-red-50 text-espresso/15 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-espresso/40 mb-3">{box.notes}</p>

              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-espresso/50">R$ {(box.saved || 0).toLocaleString('pt-BR')}</span>
                <span className="text-espresso/30">R$ {(box.target || 0).toLocaleString('pt-BR')}</span>
              </div>
              <div className="w-full h-2.5 bg-canvas rounded-full overflow-hidden mb-4">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: isDone ? '#22c55e' : isNear ? '#f59e0b' : cat?.color }} />
              </div>

              {depositBox === box.id ? (
                <div className="space-y-2">
                  <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="Valor (R$)" className="w-full px-3 py-2 bg-white/60 border border-white/60 rounded-lg text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleTransaction(box.id, 'deposit')} className="flex-1 py-1.5 bg-green-500 text-white text-[11px] font-medium rounded-lg hover:bg-green-600 transition-colors">Depositar</button>
                    <button onClick={() => handleTransaction(box.id, 'withdraw')} className="flex-1 py-1.5 bg-red-400 text-white text-[11px] font-medium rounded-lg hover:bg-red-500 transition-colors">Sacar</button>
                    <button onClick={() => { setDepositBox(null); setDepositAmount('') }} className="px-2 py-1.5 bg-canvas text-espresso/30 text-[11px] rounded-lg hover:text-espresso/60 transition-colors">X</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setDepositBox(box.id)} className="w-full py-2 text-[11px] font-medium rounded-lg border border-espresso/10 text-espresso/50 hover:text-espresso hover:border-espresso/20 transition-all">
                  Depositar / Sacar
                </button>
              )}
            </div>
          )
        })}
      </div>

      {boxes.length === 0 && (
        <div className="text-center py-16">
          <PiggyIcon className="w-12 h-12 text-espresso/10 mx-auto mb-3" />
          <p className="text-sm text-espresso/30">Nenhuma caixinha encontrada.</p>
          <p className="text-xs text-espresso/20 mt-1">Crie sua primeira caixinha de orcamento.</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Nova Caixinha</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-canvas text-espresso/40 hover:text-espresso transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} placeholder="Nome do evento" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome da caixinha *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <input type="number" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} placeholder="Meta (R$) *" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              <div>
                <label className="text-xs font-medium text-espresso/60 mb-2 block">Categoria</label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map(c => (
                    <button key={c.id} onClick={() => setForm({ ...form, category: c.id })} className={`px-3 py-2 rounded-xl text-[11px] font-medium border transition-all ${form.category === c.id ? 'border-plum/30 text-plum bg-plum/10' : 'border-white/60 text-espresso/50 bg-white/40'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anotacao (opcional)" rows={2} className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 resize-none" />
            </div>
            <div className="flex items-center justify-end gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-espresso/50 hover:text-espresso transition-colors">Cancelar</button>
              <button onClick={addBox} disabled={createBox.isPending} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all disabled:opacity-50">
                {createBox.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
