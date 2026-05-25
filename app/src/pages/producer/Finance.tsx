import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, Download, Plus, X, Edit3,
  CreditCard, QrCode, Receipt, Banknote, ArrowRightLeft, Calendar,
  CheckCircle2, Clock, AlertTriangle, Search
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

// ─── Types ───
type PaymentMethod = 'credito' | 'debito' | 'pix' | 'boleto' | 'dinheiro' | 'transferencia'
type PaymentStatus = 'pago' | 'pendente' | 'atrasado'
type TransactionType = 'income' | 'expense'

interface Transaction {
  id: string
  event: string
  description: string
  type: TransactionType
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  date: string
  dueDate: string
  category: string
}

// ─── Helpers ───
const methodIcons: Record<PaymentMethod, typeof CreditCard> = {
  credito: CreditCard,
  debito: CreditCard,
  pix: QrCode,
  boleto: Receipt,
  dinheiro: Banknote,
  transferencia: ArrowRightLeft,
}

const methodLabels: Record<PaymentMethod, string> = {
  credito: 'Cartão Crédito',
  debito: 'Cartão Débito',
  pix: 'PIX',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
}

const statusConfig: Record<PaymentStatus, { bg: string; text: string; icon: typeof CheckCircle2; label: string }> = {
  pago: { bg: 'bg-green-50 border-green-100', text: 'text-green-600', icon: CheckCircle2, label: 'Pago' },
  pendente: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', icon: Clock, label: 'Pendente' },
  atrasado: { bg: 'bg-red-50 border-red-100', text: 'text-red-500', icon: AlertTriangle, label: 'Atrasado' },
}

// ─── Form Modal ───
function TransactionForm({ tx, onSave, onClose, events }: { tx?: Transaction | null; onSave: (formVal: any) => void; onClose: () => void; events: any[] }) {
  const [form, setForm] = useState({
    eventId: '',
    description: tx?.description || '',
    type: tx?.type || 'expense' as TransactionType,
    amount: tx?.amount || '',
    method: tx?.method || 'pix' as PaymentMethod,
    status: tx?.status || 'pendente' as PaymentStatus,
    date: tx?.date || new Date().toISOString().substring(0, 10),
    dueDate: tx?.dueDate || new Date().toISOString().substring(0, 10),
    category: tx?.category || 'Local',
  })

  const categories = {
    income: ['Ingressos', 'Patrocínio', 'Merchandise', 'Serviços'],
    expense: ['Local', 'Equipamento', 'Decoração', 'Marketing', 'Alimentação', 'Transporte', 'Taxas', 'Outros'],
  }

  const handleSubmit = () => {
    if (!form.description || !form.amount) {
      toast.error('Preencha o valor e a descrição da transação')
      return
    }
    
    onSave({
      id: tx?.id || null,
      event_id: form.eventId || null,
      description: form.description,
      type: form.type,
      amount: Number(form.amount),
      status: form.status === 'pago' ? 'paid' : form.status === 'pendente' ? 'pending' : 'cancelled',
      created_at: new Date(form.date).toISOString()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-xl text-espresso">{tx ? 'Editar' : 'Nova'} Transação</h3>
          <button onClick={onClose} aria-label="Fechar modal" title="Fechar" className="p-2 rounded-full hover:bg-canvas text-espresso/40 hover:text-espresso transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Tipo */}
          <div className="flex items-center bg-white/60 border border-white/60 rounded-full p-1">
            <button onClick={() => setForm({ ...form, type: 'income' })} className={`flex-1 py-2 text-xs font-medium rounded-full transition-all ${form.type === 'income' ? 'bg-green-500 text-white' : 'text-espresso/50'}`}>
              Receita
            </button>
            <button onClick={() => setForm({ ...form, type: 'expense' })} className={`flex-1 py-2 text-xs font-medium rounded-full transition-all ${form.type === 'expense' ? 'bg-red-500 text-white' : 'text-espresso/50'}`}>
              Despesa
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Vincular a Evento</label>
            <select value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} aria-label="Vincular a Evento" title="Vincular a Evento" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
              <option value="">Geral (Sem evento específico)</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Descrição *</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: Aluguel do espaço" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Valor (R$) *</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0,00" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Categoria</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} aria-label="Selecionar Categoria" title="Selecionar Categoria" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30">
                {categories[form.type].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-2 block">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(methodIcons) as [PaymentMethod, typeof CreditCard][]).map(([key, Icon]) => (
                <button key={key} type="button" onClick={() => setForm({ ...form, method: key })} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${form.method === key ? 'bg-plum/10 border-plum/30 text-plum' : 'bg-white/40 border-white/60 text-espresso/50 hover:text-espresso/70'}`}>
                  <Icon className="w-3.5 h-3.5" /> {methodLabels[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-espresso/60 mb-2 block">Status</label>
            <div className="flex items-center gap-2">
              {(['pago', 'pendente', 'atrasado'] as PaymentStatus[]).map(s => {
                const cfg = statusConfig[s]
                return (
                  <button key={s} type="button" onClick={() => setForm({ ...form, status: s })} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-all ${form.status === s ? cfg.bg + ' ' + cfg.text + ' ' + cfg.bg.replace('50', '100') : 'bg-white/40 border-white/60 text-espresso/50'}`}>
                    <cfg.icon className="w-3.5 h-3.5" /> {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Data Lançamento</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} aria-label="Data de Lançamento" title="Data de Lançamento" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-espresso/60 mb-1.5 block">Vencimento</label>
              <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} aria-label="Data de Vencimento" title="Data de Vencimento" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso focus:outline-none focus:border-plum/30" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-5 py-2.5 text-sm text-espresso/50 hover:text-espresso transition-colors">Cancelar</button>
          <button onClick={handleSubmit} className="px-6 py-2.5 bg-plum text-cream text-sm rounded-full hover:shadow-glow transition-all">
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ───
export default function ProducerFinance() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'all'>('all')
  const [filterMethod] = useState<PaymentMethod | 'all'>('all')

  // Obter lista de eventos do produtor para o Dropdown do form
  const [events, setEvents] = useState<any[]>([])

  // Carregar dados financeiros do Supabase
  const loadFinanceData = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      // 1. Carregar eventos para vinculação
      const { data: dbEvents } = await supabase
        .from('events')
        .select('id, title')
        .eq('producer_id', user.id)
      
      setEvents(dbEvents || [])

      // 2. Carregar transações
      const { data: dbTxs, error } = await supabase
        .from('transactions')
        .select(`
          *,
          events (title)
        `)
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!dbTxs || dbTxs.length === 0) {
        // Se estiver vazio, realizamos auto-seed para exibição
        await seedInitialTransactions(user.id, dbEvents || [])
        return
      }

      setTransactions(dbTxs.map(mapDbTxToTransaction))
    } catch (err: any) {
      console.error('Erro ao carregar dados financeiros:', err)
      toast.error('Erro ao carregar fluxo de caixa')
    } finally {
      setIsLoading(false)
    }
  }

  // Mapear dados do banco para o frontend
  const mapDbTxToTransaction = (dbTx: any): Transaction => {
    let tStatus: PaymentStatus = 'pendente'
    if (dbTx.status === 'paid' || dbTx.status === 'pago') {
      tStatus = 'pago'
    } else if (dbTx.status === 'cancelled' || dbTx.status === 'atrasado') {
      tStatus = 'atrasado'
    }

    // Gerar método mock dependendo do tipo de transação
    let method: PaymentMethod = 'pix'
    if (dbTx.type === 'income') {
      method = Math.random() > 0.4 ? 'pix' : 'credito'
    } else {
      method = Math.random() > 0.5 ? 'transferencia' : 'boleto'
    }

    return {
      id: dbTx.id,
      event: dbTx.events?.title || 'Geral',
      description: dbTx.description || 'Transação financeira',
      type: dbTx.type as TransactionType,
      amount: Number(dbTx.amount) || 0,
      method: method,
      status: tStatus,
      date: new Date(dbTx.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }),
      dueDate: new Date(dbTx.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }),
      category: dbTx.type === 'income' ? 'Ingressos' : 'Local'
    }
  }

  // Auto-seed de transações de demonstração
  const seedInitialTransactions = async (producerId: string, producerEvents: any[]) => {
    try {
      const eventId = producerEvents.length > 0 ? producerEvents[0].id : null

      const initialTxs = [
        { producer_id: producerId, event_id: eventId, type: 'income', amount: 2840, description: 'Venda ingressos - lote 1', status: 'paid', created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() },
        { producer_id: producerId, event_id: eventId, type: 'income', amount: 4260, description: 'Venda ingressos - lote 2', status: 'paid', created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() },
        { producer_id: producerId, event_id: eventId, type: 'income', amount: 960, description: 'Venda ingressos VIP', status: 'paid', created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() },
        { producer_id: producerId, event_id: eventId, type: 'expense', amount: 3500, description: 'Aluguel do espaço', status: 'paid', created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString() },
        { producer_id: producerId, event_id: eventId, type: 'expense', amount: 1200, description: 'Equipamento de som', status: 'pending', created_at: new Date().toISOString() },
        { producer_id: producerId, event_id: eventId, type: 'expense', amount: 380, description: 'Comissão Evokaa - Processamento', status: 'paid', created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() }
      ]

      const { error } = await supabase
        .from('transactions')
        .insert(initialTxs)

      if (error) throw error

      // Recarregar
      const { data: finalTxs } = await supabase
        .from('transactions')
        .select(`
          *,
          events (title)
        `)
        .eq('producer_id', producerId)
        .order('created_at', { ascending: false })

      if (finalTxs) {
        setTransactions(finalTxs.map(mapDbTxToTransaction))
      }
    } catch (err) {
      console.error('Erro ao semear transações:', err)
    }
  }

  useEffect(() => {
    loadFinanceData()
  }, [user?.id])

  const filtered = transactions
    .filter(t => activeTab === 'all' || t.type === activeTab)
    .filter(t => !search || t.event.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()))
    .filter(t => filterStatus === 'all' || t.status === filterStatus)
    .filter(t => filterMethod === 'all' || t.method === filterMethod)

  const income = transactions.filter(t => t.type === 'income')
  const expenses = transactions.filter(t => t.type === 'expense')
  const totalIncome = income.reduce((s, t) => s + t.amount, 0)
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0)
  const net = totalIncome - totalExpense
  const pendingAmount = transactions.filter(t => t.status === 'pendente').reduce((s, t) => s + t.amount, 0)
  const overdueAmount = transactions.filter(t => t.status === 'atrasado').reduce((s, t) => s + t.amount, 0)

  // Agrupado por método
  const byMethod = (Object.keys(methodIcons) as PaymentMethod[]).map(m => ({
    method: m,
    income: income.filter(t => t.method === m).reduce((s, t) => s + t.amount, 0),
    expense: expenses.filter(t => t.method === m).reduce((s, t) => s + t.amount, 0),
  })).filter(m => m.income > 0 || m.expense > 0)

  // Agrupado por categoria
  const byCategory = [...new Set(expenses.map(t => t.category))].map(c => ({
    category: c,
    total: expenses.filter(t => t.category === c).reduce((s, t) => s + t.amount, 0),
  })).sort((a, b) => b.total - a.total)

  // Salvar transações
  const handleSave = async (formVal: any) => {
    if (!user?.id) return
    try {
      if (formVal.id) {
        // Update
        const { error } = await supabase
          .from('transactions')
          .update({
            event_id: formVal.event_id,
            description: formVal.description,
            type: formVal.type,
            amount: formVal.amount,
            status: formVal.status,
            created_at: formVal.created_at
          })
          .eq('id', formVal.id)

        if (error) throw error
        toast.success('Transação atualizada no Supabase')
      } else {
        // Insert
        const { error } = await supabase
          .from('transactions')
          .insert({
            producer_id: user.id,
            event_id: formVal.event_id,
            description: formVal.description,
            type: formVal.type,
            amount: formVal.amount,
            status: formVal.status,
            created_at: formVal.created_at
          })

        if (error) throw error
        toast.success('Transação adicionada no Supabase')
      }
      
      setEditingTx(null)
      setShowForm(false)
      loadFinanceData()
    } catch (err: any) {
      console.error('Erro ao salvar transação:', err)
      toast.error('Erro ao salvar transação no banco de dados')
    }
  }

  const tabs = [
    { id: 'all' as const, label: 'Todas', count: transactions.length },
    { id: 'income' as const, label: 'Receitas', count: income.length },
    { id: 'expense' as const, label: 'Despesas', count: expenses.length },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Financeiro</h1>
          <p className="text-sm text-espresso/50 mt-1">Fluxo de caixa, receitas reais e conciliação bancária</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => toast.success('Relatório CSV exportado!')} className="flex items-center gap-2 px-4 py-2.5 bg-white/60 border border-white/60 text-espresso text-sm font-medium rounded-full hover:bg-white transition-all">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button onClick={() => { setEditingTx(null); setShowForm(true) }} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all">
            <Plus className="w-4 h-4" /> Nova Transação
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="p-5 rounded-2xl bg-white/40 border border-white/60 animate-pulse text-center h-[98px]" />
          ))}
        </div>
      ) : (
        /* KPI Cards */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Receitas', value: `R$ ${totalIncome.toLocaleString()}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
            { label: 'Despesas', value: `R$ ${totalExpense.toLocaleString()}`, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50 border-red-100' },
            { label: 'Saldo Líquido', value: `R$ ${net.toLocaleString()}`, icon: DollarSign, color: net >= 0 ? 'text-green-600' : 'text-red-500', bg: net >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100' },
            { label: 'Contas a Pagar', value: `R$ ${(pendingAmount + overdueAmount).toLocaleString()}`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          ].map(k => (
            <div key={k.label} className={`p-5 rounded-2xl border backdrop-blur-sm ${k.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              <div className={`font-serif text-2xl ${k.color}`}>{k.value}</div>
              <div className="text-xs text-espresso/40 mt-1">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alert for overdue */}
      {overdueAmount > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-600 font-medium">Você tem despesas em atraso</p>
            <p className="text-xs text-red-400">R$ {overdueAmount.toLocaleString()} em contas com vencimento ultrapassado.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-48 bg-white/40 border border-white/60 animate-pulse rounded-2xl mb-8" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Payment Method Chart */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
            <h3 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-plum" /> Por Forma de Pagamento</h3>
            <div className="space-y-3">
              {byMethod.map(m => {
                const maxVal = Math.max(...byMethod.map(x => Math.max(x.income, x.expense) || 1))
                return (
                  <div key={m.method}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-espresso/60 flex items-center gap-1.5">
                        {(() => { const I = methodIcons[m.method]; return <I className="w-3.5 h-3.5 text-espresso/30" /> })()}
                        {methodLabels[m.method]}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 h-5 bg-canvas rounded-lg overflow-hidden flex">
                        {m.income > 0 && (
                          <div className="h-full bg-green-400/40 flex items-center px-2 transition-all" style={{ width: `${(m.income / maxVal) * 100}%` }}>
                            <span className="text-[10px] font-medium text-green-700 whitespace-nowrap">R$ {m.income.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 h-5 bg-canvas rounded-lg overflow-hidden flex">
                        {m.expense > 0 && (
                          <div className="h-full bg-red-400/40 flex items-center px-2 transition-all" style={{ width: `${(m.expense / maxVal) * 100}%` }}>
                            <span className="text-[10px] font-medium text-red-700 whitespace-nowrap">R$ {m.expense.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-espresso/5">
              <span className="flex items-center gap-1.5 text-[10px] text-espresso/40"><div className="w-2 h-2 rounded-full bg-green-400/60" /> Receitas</span>
              <span className="flex items-center gap-1.5 text-[10px] text-espresso/40"><div className="w-2 h-2 rounded-full bg-red-400/60" /> Despesas</span>
            </div>
          </div>

          {/* Expense by Category */}
          <div className="p-6 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
            <h3 className="text-sm font-medium text-espresso mb-4">Despesas por Categoria</h3>
            <div className="space-y-3">
              {byCategory.map(c => {
                const maxCat = Math.max(...byCategory.map(x => x.total) || 1)
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="text-xs text-espresso/60 w-24 truncate">{c.category}</span>
                    <div className="flex-1 h-5 bg-canvas rounded-lg overflow-hidden">
                      <div className="h-full bg-plum/20 rounded-lg flex items-center px-2 transition-all" style={{ width: `${(c.total / maxCat) * 100}%` }}>
                        <span className="text-[10px] font-medium text-plum whitespace-nowrap">R$ {c.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {byCategory.length === 0 && (
                <div className="py-12 text-center text-xs text-espresso/30">Nenhuma despesa registrada.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1 p-1 bg-white/60 border border-white/60 rounded-2xl w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === t.id ? 'bg-plum text-cream' : 'text-espresso/40 hover:text-espresso/70'}`}>
              {t.label} <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${activeTab === t.id ? 'bg-cream/20' : 'bg-canvas'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-espresso/20" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar transações..." className="pl-9 pr-4 py-2 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 w-48" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as PaymentStatus | 'all')} aria-label="Filtrar por Status" title="Filtrar por Status" className="px-3 py-2 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso/60 focus:outline-none">
            <option value="all">Todos Status</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="atrasado">Atrasado</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-14 bg-white/40 border border-white/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-espresso/5">
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Evento / Descrição</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Categoria</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Forma Pagto</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase hidden lg:table-cell">Vencimento</th>
                  <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/30 uppercase">Valor</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => {
                  const MethodIcon = methodIcons[tx.method]
                  const statusCfg = statusConfig[tx.status]
                  return (
                    <tr key={tx.id} className="border-b border-espresso/3 last:border-0 hover:bg-white/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm text-espresso font-medium">{tx.event}</div>
                        <div className="text-[10px] text-espresso/30">{tx.description}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-canvas text-espresso/50 text-[10px] rounded-md">{tx.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-espresso/60">
                          <MethodIcon className="w-3.5 h-3.5 text-espresso/30" />
                          {methodLabels[tx.method]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${statusCfg.bg} ${statusCfg.text}`}>
                          <statusCfg.icon className="w-3 h-3" /> {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-xs text-espresso/40">
                          <Calendar className="w-3 h-3" />
                          {tx.dueDate || '-'}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-medium font-serif ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.type === 'income' ? '+' : '-'}R$ {tx.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setEditingTx(tx); setShowForm(true) }} aria-label="Editar transação" title="Editar Transação" className="p-1.5 rounded-lg hover:bg-canvas text-espresso/20 hover:text-espresso/60 transition-colors">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-espresso/20">Nenhuma transação encontrada</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <TransactionForm
          tx={editingTx}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingTx(null) }}
          events={events}
        />
      )}
    </div>
  )
}
