import { useState, useEffect, useRef } from 'react'
import { 
  TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, 
  Wallet, BarChart3, Search, DollarSign, Check, X, Clock, 
  Building2, Filter, AlertCircle, RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import gsap from 'gsap'

interface Transaction {
  id: string
  desc: string
  producer: string
  amount: number
  type: 'in' | 'out' | 'fee' // in = venda de ingresso, out = repasse/saque produtor, fee = comissão evokaa
  date: string
  paymentMethod: 'pix' | 'cartao' | 'boleto'
}

interface WithdrawRequest {
  id: string
  producer: string
  email: string
  amount: number
  bankName: string
  pixKey: string
  status: 'pending' | 'approved' | 'rejected'
  date: string
}

const initialTransactions: Transaction[] = [
  { id: 'tx-001', desc: 'Ingresso VIP - Festival Sunset Evokaa', producer: 'Joao Eventos', amount: 280, type: 'in', date: '27 Mai 2026, 14:30', paymentMethod: 'pix' },
  { id: 'tx-002', desc: 'Mesa Coletiva - Gastronomia Gourmet', producer: 'Elisa Nakamura', amount: 160, type: 'in', date: '27 Mai 2026, 13:45', paymentMethod: 'cartao' },
  { id: 'tx-003', desc: 'Repasse Automático - Show Rock', producer: 'Lucas Festas', amount: 12500, type: 'out', date: '26 Mai 2026, 10:00', paymentMethod: 'pix' },
  { id: 'tx-004', desc: 'Ingresso Geral - Jazz & Blues', producer: 'Bruno Costa', amount: 80, type: 'in', date: '25 Mai 2026, 09:15', paymentMethod: 'pix' },
  { id: 'tx-005', desc: 'Taxa Evokaa (Comissão 10%) - Jazz & Blues', producer: 'Bruno Costa', amount: 8, type: 'fee', date: '25 Mai 2026, 09:15', paymentMethod: 'pix' },
  { id: 'tx-006', desc: 'Ingresso VIP - Stand Up Comedy', producer: 'Mariana Costa', amount: 180, type: 'in', date: '25 Mai 2026, 18:20', paymentMethod: 'cartao' },
  { id: 'tx-007', desc: 'Repasse Efetuado - Teatro Central', producer: 'Teatro Central', amount: 4800, type: 'out', date: '24 Mai 2026, 17:00', paymentMethod: 'pix' },
  { id: 'tx-008', desc: 'Ingresso Geral - Festival Sunset Evokaa', producer: 'Joao Eventos', amount: 120, type: 'in', date: '24 Mai 2026, 12:10', paymentMethod: 'boleto' },
]

const initialWithdrawRequests: WithdrawRequest[] = [
  { id: 'w-001', producer: 'Joao Eventos', email: 'joao@eventos.com.br', amount: 4500, bankName: 'Itaú Unibanco', pixKey: 'joao@eventos.com.br', status: 'pending', date: '27 Mai 2026, 08:30' },
  { id: 'w-002', producer: 'Elisa Nakamura', email: 'elisa@nakamura.com.br', amount: 8200, bankName: 'Nubank S.A.', pixKey: '098.765.432-11', status: 'pending', date: '26 Mai 2026, 15:20' },
  { id: 'w-003', producer: 'Bruno Costa', email: 'bruno@costa.com.br', amount: 1250, bankName: 'Banco do Brasil', pixKey: 'bruno@costa.com.br', status: 'approved', date: '25 Mai 2026, 11:00' },
  { id: 'w-004', producer: 'Lucas Festas', email: 'lucas@festas.com.br', amount: 12500, bankName: 'Bradesco', pixKey: '44.555.666/0001-22', status: 'approved', date: '25 Mai 2026, 09:30' },
]

export default function AdminFinance() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'withdraws' | 'tools'>('overview')
  
  // States
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [withdraws, setWithdraws] = useState<WithdrawRequest[]>(initialWithdrawRequests)
  
  // Filters
  const [txSearch, setTxSearch] = useState('')
  const [txFilterType, setTxFilterType] = useState<'all' | 'in' | 'out' | 'fee'>('all')
  const [txFilterMethod, setTxFilterMethod] = useState<'all' | 'pix' | 'cartao' | 'boleto'>('all')

  // Tools states
  const [platformCommission, setPlatformCommission] = useState(10.0) // 10%
  const [payoutPixDays, setPayoutPixDays] = useState(0) // D+0
  const [payoutCardDays, setPayoutCardDays] = useState(14) // D+14
  const [payoutBoletoDays, setPayoutBoletoDays] = useState(2) // D+2
  const [savingSettings, setSavingSettings] = useState(false)

  const handleSaveSettings = () => {
    setSavingSettings(true)
    setTimeout(() => {
      setSavingSettings(false)
      toast.success('Configurações financeiras e taxas atualizadas com sucesso!')
    }, 800)
  }

  const handleExportCSV = (type: 'transactions' | 'fees' | 'withdrawals') => {
    toast.loading(`Gerando relatório de ${type === 'transactions' ? 'transações' : type === 'fees' ? 'taxas e comissões' : 'repasses'}...`)
    setTimeout(() => {
      toast.dismiss()
      toast.success(`Relatório exportado com sucesso! O download do arquivo .csv foi iniciado.`)
    }, 1200)
  }

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.fin-anim', 
        { y: 15, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
      )
    }, containerRef)
    return () => ctx.revert()
  }, [activeTab])

  // Calculations
  const grossSalesVolume = transactions.filter(t => t.type === 'in').reduce((sum, t) => sum + t.amount, 0)
  const totalPayouts = transactions.filter(t => t.type === 'out').reduce((sum, t) => sum + t.amount, 0)
  const platformRevenue = transactions.filter(t => t.type === 'fee').reduce((sum, t) => sum + t.amount, 0)
  const netPlatformBalance = platformRevenue // Lucro líquido da plataforma são as comissões
  
  // Withdraw Payout Handlers
  const handleApproveWithdraw = (id: string, producer: string, amount: number) => {
    const confirm = window.confirm(`Deseja aprovar o repasse de R$ ${amount.toLocaleString('pt-BR')} para ${producer}? O pagamento será simulado.`)
    if (!confirm) return

    setWithdraws(prev => prev.map(w => w.id === id ? { ...w, status: 'approved' } : w))
    
    // Adicionar transação de repasse
    const newTx: Transaction = {
      id: `tx-out-${Math.random().toString().slice(2, 6)}`,
      desc: `Repasse de Saque Aprovado - ${producer}`,
      producer,
      amount,
      type: 'out',
      date: new Date().toLocaleDateString('pt-BR', {day: 'numeric', month: 'short', year: 'numeric'}) + ', ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
      paymentMethod: 'pix'
    }
    setTransactions([newTx, ...transactions])
    
    toast.success(`Repasse de R$ ${amount.toLocaleString('pt-BR')} aprovado e enviado com sucesso!`)
  }

  const handleRejectWithdraw = (id: string, producer: string) => {
    const reason = window.prompt('Por favor, informe a justificativa para a rejeição do saque:')
    if (reason === null) return
    if (!reason.trim()) {
      toast.error('É obrigatório informar uma justificativa para rejeitar o saque.')
      return
    }

    setWithdraws(prev => prev.map(w => w.id === id ? { ...w, status: 'rejected' } : w))
    toast.success(`Solicitação de saque de ${producer} rejeitada com sucesso.`)
  }

  // Filter Transaction Extrato
  const filteredTransactions = transactions
    .filter(t => !txSearch || t.desc.toLowerCase().includes(txSearch.toLowerCase()) || t.producer.toLowerCase().includes(txSearch.toLowerCase()))
    .filter(t => txFilterType === 'all' || t.type === txFilterType)
    .filter(t => txFilterMethod === 'all' || t.paymentMethod === txFilterMethod)

  // Payment methods distribution metrics
  const pixPercentage = 74
  const creditCardPercentage = 20
  const otherPercentage = 6

  return (
    <div ref={containerRef} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Financeiro</h1>
          <p className="text-sm text-espresso/50 mt-1">Visão geral do volume financeiro, comissões coletadas e moderação de repasses.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap bg-white/60 p-1 border border-white/60 rounded-xl gap-1 sm:gap-0">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'overview' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" /> Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'transactions' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Extrato Comercial
          </button>
          <button 
            onClick={() => setActiveTab('withdraws')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'withdraws' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Repasses / Saques ({withdraws.filter(w => w.status === 'pending').length})
          </button>
          <button 
            onClick={() => setActiveTab('tools')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'tools' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Ferramentas & Taxas
          </button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Volume Geral de Vendas (GMV)', value: `R$ ${grossSalesVolume.toLocaleString('pt-BR')}`, icon: TrendingUp, change: '+14% este mês', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Receita Líquida (Plataforma)', value: `R$ ${netPlatformBalance.toLocaleString('pt-BR')}`, icon: CreditCard, change: '+10% comissão', color: 'text-plum', bg: 'bg-plum/5 border-plum/10' },
          { label: 'Repasses Efetuados (Saques)', value: `R$ ${totalPayouts.toLocaleString('pt-BR')}`, icon: Wallet, change: 'Enviado a produtores', color: 'text-rose-500', bg: 'bg-rose-50 border-rose-100' },
          { label: 'Repasses Pendentes', value: `R$ ${withdraws.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0).toLocaleString('pt-BR')}`, icon: Clock, change: 'Aguardando auditoria', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
        ].map(k => (
          <div key={k.label} className="fin-anim p-5 rounded-2xl bg-white/60 border border-white/60 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <span className="text-[9px] text-espresso/40 font-bold uppercase tracking-wider">{k.change}</span>
            </div>
            <div>
              <div className="font-serif text-2xl text-espresso">{k.value}</div>
              <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider leading-none">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Revenue chart (Weekly distribution mockup) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="fin-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-espresso">Receita de Vendas diária (Últimos 7 dias)</h3>
                  <p className="text-[10px] text-espresso/40">Faturamento bruto transacionado nas bilheterias.</p>
                </div>
                <div className="text-xs font-bold text-plum bg-plum/5 border border-plum/10 px-2.5 py-1 rounded-lg">
                  Semana Corrente
                </div>
              </div>

              <div className="flex items-end gap-3 h-32 pt-4">
                {[
                  { day: 'Seg', val: 400, percentage: 30 },
                  { day: 'Ter', val: 950, percentage: 65 },
                  { day: 'Qua', val: 600, percentage: 45 },
                  { day: 'Qui', val: 1200, percentage: 80 },
                  { day: 'Sex', val: 1450, percentage: 100 },
                  { day: 'Sab', val: 1100, percentage: 75 },
                  { day: 'Dom', val: 800, percentage: 55 },
                ].map(d => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="text-[9px] font-bold text-plum opacity-0 group-hover:opacity-100 transition-opacity">
                      R$ {d.val}
                    </div>
                    <div className="w-full bg-plum/5 rounded-t-lg relative" style={{ height: '70%' }}>
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-plum rounded-t-lg transition-all" 
                        style={{ height: `${d.percentage}%` }}
                      />
                    </div>
                    <span className="text-[9.5px] font-semibold text-espresso/40">{d.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Withdraw review warning */}
            {withdraws.some(w => w.status === 'pending') && (
              <div className="fin-anim p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3.5 items-start">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-amber-800">Solicitações de Repasse Pendentes</h4>
                  <p className="text-[10px] text-amber-700 leading-normal mt-0.5">
                    Existem produtores solicitando resgates bancários da plataforma. Acesse a aba **Repasses / Saques** para analisar as contas bancárias, chaves Pix e auditar o pagamento.
                  </p>
                  <button 
                    onClick={() => setActiveTab('withdraws')}
                    className="text-[10px] font-bold text-plum hover:underline mt-2 flex items-center gap-0.5"
                  >
                    Ir para Repasses <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Payment Methods & Categories (Right Col) */}
          <div className="space-y-6">
            {/* Payment Method share */}
            <div className="fin-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider mb-5">Meios de Pagamento Utilizados</h3>
              
              <div className="space-y-4">
                {[
                  { name: 'PIX Instantâneo', share: pixPercentage, color: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { name: 'Cartão de Crédito', share: creditCardPercentage, color: 'bg-plum', text: 'text-plum', bg: 'bg-plum/5' },
                  { name: 'Boleto Bancário / Outros', share: otherPercentage, color: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' },
                ].map(method => (
                  <div key={method.name} className="flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-espresso/70 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${method.color}`} />
                        {method.name}
                      </div>
                      <div className="w-full h-1.5 bg-canvas rounded-full mt-2 overflow-hidden">
                        <div className={`h-full rounded-full ${method.color}`} style={{ width: `${method.share}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold ${method.text}`}>{method.share}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Commissions policy info */}
            <div className="fin-anim p-5 rounded-2xl border border-white bg-white/40 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Política de Taxação</h3>
              <p className="text-[10px] text-espresso/60 leading-relaxed">
                A comissão ativa da Evokaa é configurada em **10.0%** retidos de forma síncrona a cada compra finalizada por participantes. O processamento Pix é isento de taxas de intermediário, gerando faturamento integral.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="fin-anim bg-white/60 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
          {/* Filters Bar */}
          <div className="p-4 border-b border-espresso/5 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/40">
            <div className="relative w-full md:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-espresso/30" />
              <input 
                type="text"
                placeholder="Buscar por transação ou produtor..."
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-espresso/10 rounded-xl text-xs focus:outline-none focus:border-plum text-espresso placeholder:text-espresso/30"
              />
            </div>
            
            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
              <select 
                value={txFilterType}
                onChange={e => setTxFilterType(e.target.value as any)}
                className="px-3 py-1.5 bg-white border border-espresso/10 rounded-xl text-xs text-espresso/60 focus:outline-none"
              >
                <option value="all">Todas Operações</option>
                <option value="in">Venda de Ingressos (Entradas)</option>
                <option value="out">Repasses/Saques (Saídas)</option>
                <option value="fee">Comissões da Plataforma</option>
              </select>
              <select 
                value={txFilterMethod}
                onChange={e => setTxFilterMethod(e.target.value as any)}
                className="px-3 py-1.5 bg-white border border-espresso/10 rounded-xl text-xs text-espresso/60 focus:outline-none"
              >
                <option value="all">Todos Pagamentos</option>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão de Crédito</option>
                <option value="boleto">Boleto</option>
              </select>
            </div>
          </div>

          {/* Transactions List */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-espresso/5 text-left bg-white/40">
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Código</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Operação</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase hidden sm:table-cell">Produtor Associado</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase hidden md:table-cell">Método</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Data/Hora</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-espresso/3">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-xs text-espresso/30 italic">
                      Nenhuma transação encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-white/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-[10px] text-espresso/50">{tx.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            tx.type === 'in' ? 'bg-green-50 text-green-600' : tx.type === 'out' ? 'bg-red-50 text-red-500' : 'bg-violet-50 text-plum'
                          }`}>
                            {tx.type === 'in' ? <ArrowUpRight className="w-3.5 h-3.5" /> : tx.type === 'out' ? <ArrowDownRight className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-espresso">{tx.desc}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-espresso/50 hidden sm:table-cell">{tx.producer}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="px-2 py-0.5 rounded bg-canvas text-espresso/50 text-[9px] font-bold uppercase">{tx.paymentMethod}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-espresso/40">{tx.date}</td>
                      <td className={`px-4 py-3 text-right text-xs font-bold ${
                        tx.type === 'in' ? 'text-green-600' : tx.type === 'out' ? 'text-red-500' : 'text-plum'
                      }`}>
                        {tx.type === 'in' ? '+' : tx.type === 'out' ? '-' : ''}R$ {tx.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'withdraws' && (
        <div className="fin-anim bg-white/60 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-espresso/5 bg-white/40">
            <h3 className="text-sm font-semibold text-espresso">Solicitações Bancárias de Repasses</h3>
            <p className="text-[10px] text-espresso/40">Aprove saques de produtores após verificar chaves e saldos retidos correspondentes.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-espresso/5 bg-white/40">
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Produtor / Contato</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Banco / Chave Pix</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Data da Solicitacão</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase text-right">Valor</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-espresso/3">
                {withdraws.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-xs text-espresso/30 italic">
                      Nenhuma solicitação de saque registrada.
                    </td>
                  </tr>
                ) : (
                  withdraws.map(w => (
                    <tr key={w.id} className="hover:bg-white/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-xs font-bold text-espresso">{w.producer}</div>
                        <div className="text-[10px] text-espresso/30">{w.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-espresso/70 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-espresso/40" /> {w.bankName}
                        </div>
                        <div className="text-[10px] text-espresso/40">Pix: {w.pixKey}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-espresso/40">{w.date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                          w.status === 'pending'
                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : w.status === 'approved'
                            ? 'bg-green-50 text-green-600 border-green-100'
                            : 'bg-red-50 text-red-500 border-red-100'
                        }`}>
                          {w.status === 'pending' ? 'Pendente' : w.status === 'approved' ? 'Pago' : 'Rejeitado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-serif text-sm font-bold text-espresso">
                        R$ {w.amount.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {w.status === 'pending' && (
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleApproveWithdraw(w.id, w.producer, w.amount)}
                              className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded-lg transition-colors"
                              title="Aprovar e Liberar Repasse"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRejectWithdraw(w.id, w.producer)}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-lg transition-colors"
                              title="Rejeitar Repasse"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 fin-anim animate-fadeIn">
          {/* Painel de Configuração de Comissões e Taxas */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-espresso">Configurações de Comissão & Taxas</h3>
                <p className="text-[10px] text-espresso/40">Defina a taxa operacional padrão retida pela Evokaa e regras de resgate.</p>
              </div>

              <div className="space-y-4">
                {/* Comissão Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-espresso/80">
                    <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-plum" /> Taxa de Comissão da Plataforma</span>
                    <span className="text-plum font-serif text-sm font-bold">{platformCommission.toFixed(1)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="25" 
                    step="0.5"
                    value={platformCommission} 
                    onChange={e => setPlatformCommission(parseFloat(e.target.value))}
                    className="w-full accent-plum"
                  />
                  <div className="flex justify-between text-[9px] text-espresso/40 uppercase font-semibold">
                    <span>0% (Taxa Zero)</span>
                    <span>10% (Padrão)</span>
                    <span>25% (Máxima)</span>
                  </div>
                </div>

                <hr className="border-espresso/5" />

                {/* Prazos de Liquidação */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-espresso/70 uppercase tracking-wider text-espresso">Prazos de Liberação para Repasse</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-white/40 border border-espresso/5 space-y-1">
                      <span className="text-[9px] text-espresso/40 font-bold uppercase">PIX</span>
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          min="0" 
                          max="30"
                          value={payoutPixDays} 
                          onChange={e => setPayoutPixDays(parseInt(e.target.value) || 0)}
                          className="w-12 px-2 py-0.5 bg-white border border-espresso/10 rounded font-bold text-xs focus:outline-none focus:border-plum text-espresso"
                        />
                        <span className="text-xs text-espresso/70 font-semibold">dias (D+{payoutPixDays})</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/40 border border-espresso/5 space-y-1">
                      <span className="text-[9px] text-espresso/40 font-bold uppercase">Cartão de Crédito</span>
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          min="0" 
                          max="60"
                          value={payoutCardDays} 
                          onChange={e => setPayoutCardDays(parseInt(e.target.value) || 0)}
                          className="w-12 px-2 py-0.5 bg-white border border-espresso/10 rounded font-bold text-xs focus:outline-none focus:border-plum text-espresso"
                        />
                        <span className="text-xs text-espresso/70 font-semibold">dias (D+{payoutCardDays})</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/40 border border-espresso/5 space-y-1">
                      <span className="text-[9px] text-espresso/40 font-bold uppercase">Boleto Bancário</span>
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          min="0" 
                          max="30"
                          value={payoutBoletoDays} 
                          onChange={e => setPayoutBoletoDays(parseInt(e.target.value) || 0)}
                          className="w-12 px-2 py-0.5 bg-white border border-espresso/10 rounded font-bold text-xs focus:outline-none focus:border-plum text-espresso"
                        />
                        <span className="text-xs text-espresso/70 font-semibold">dias (D+{payoutBoletoDays})</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="px-4 py-2 bg-plum hover:bg-plum/90 disabled:bg-plum/50 text-cream rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                  >
                    {savingSettings ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Salvar Alterações</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Demonstrativo Financeiro de comissões acumuladas */}
            <div className="p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-espresso">Demonstrativo de Comissões e Taxas Coletadas</h3>
                <p className="text-[10px] text-espresso/40">Detalhamento dos saldos retidos e comissões da Evokaa no mês atual.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-espresso/5 text-espresso/40 text-[9px] uppercase tracking-wider bg-white/30">
                      <th className="px-3 py-2 font-bold">Categoria de Repasse</th>
                      <th className="px-3 py-2 font-bold text-right">Volume Processado</th>
                      <th className="px-3 py-2 font-bold text-right">Comissões Evokaa</th>
                      <th className="px-3 py-2 font-bold text-right">Saldo Produtores</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-espresso/3 text-xs">
                    {[
                      { channel: 'PIX Instantâneo', volume: grossSalesVolume * 0.74, fee: (grossSalesVolume * 0.74) * (platformCommission/100), net: (grossSalesVolume * 0.74) * (1 - platformCommission/100) },
                      { channel: 'Cartão de Crédito', volume: grossSalesVolume * 0.20, fee: (grossSalesVolume * 0.20) * (platformCommission/100), net: (grossSalesVolume * 0.20) * (1 - platformCommission/100) },
                      { channel: 'Boleto Bancário / Outros', volume: grossSalesVolume * 0.06, fee: (grossSalesVolume * 0.06) * (platformCommission/100), net: (grossSalesVolume * 0.06) * (1 - platformCommission/100) },
                    ].map(row => (
                      <tr key={row.channel} className="hover:bg-white/40 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-espresso">{row.channel}</td>
                        <td className="px-3 py-2.5 text-right text-espresso/80">R$ {row.volume.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-plum">R$ {row.fee.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td className="px-3 py-2.5 text-right text-emerald-600 font-semibold">R$ {row.net.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      </tr>
                    ))}
                    <tr className="bg-espresso/5 font-bold border-t border-espresso/10">
                      <td className="px-3 py-2.5 text-espresso">Total Consolidado</td>
                      <td className="px-3 py-2.5 text-right text-espresso">R$ {grossSalesVolume.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="px-3 py-2.5 text-right text-plum">R$ {platformRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-600">R$ {(grossSalesVolume - platformRevenue).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Ferramentas de Exportação e Auditoria lateral */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider">Exportar Relatórios</h3>
              <p className="text-[10px] text-espresso/40 leading-normal">Selecione o formato de relatório para exportar as planilhas financeiras da plataforma.</p>
              
              <div className="space-y-2 pt-2">
                <button 
                  onClick={() => handleExportCSV('transactions')}
                  className="w-full py-2.5 px-4 bg-white border border-espresso/10 rounded-xl text-xs font-bold text-espresso/70 hover:bg-espresso/5 flex items-center justify-between transition-all"
                >
                  <span>Relatório de Transações (.csv)</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-espresso/40" />
                </button>
                <button 
                  onClick={() => handleExportCSV('fees')}
                  className="w-full py-2.5 px-4 bg-white border border-espresso/10 rounded-xl text-xs font-bold text-espresso/70 hover:bg-espresso/5 flex items-center justify-between transition-all"
                >
                  <span>Relatório de Taxas Coletadas (.csv)</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-espresso/40" />
                </button>
                <button 
                  onClick={() => handleExportCSV('withdrawals')}
                  className="w-full py-2.5 px-4 bg-white border border-espresso/10 rounded-xl text-xs font-bold text-espresso/70 hover:bg-espresso/5 flex items-center justify-between transition-all"
                >
                  <span>Relatório de Repasses (.csv)</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-espresso/40" />
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-white bg-white/40 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Compliance de Saques
              </h3>
              <p className="text-[10px] text-espresso/60 leading-relaxed font-semibold">
                Todos os saques em processamento acima de **R$ 10.000,00** exigem auditoria manual de faturamento do produtor e validação de documentos fiscais anexados antes da liberação Pix no painel de repasses.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
