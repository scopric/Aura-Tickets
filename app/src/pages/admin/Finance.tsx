import { useState, useEffect, useRef } from 'react'
import {
  TrendingUp, CreditCard, ArrowUpRight, ArrowDownRight,
  Wallet, BarChart3, Search, DollarSign, Clock,
  Building2, AlertCircle, RefreshCw, Settings, ArrowRight, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import gsap from 'gsap'
import { supabase } from '../../lib/supabase'
import { useAdminFinance } from '../../hooks/useAdminFinance'
import { downloadCsv, toCsv, csvFilename, fetchAllRows } from '../../lib/exportCsv'

// Mapa de apresentação: a coluna `type` do banco (income/expense/withdrawal/refund/fee) para
// os três pesos que a tela soma (entrada, saída, comissão).
const typeSinal: Record<string, { sinal: '+' | '-' | ''; label: string; cls: string }> = {
  income: { sinal: '+', label: 'Venda', cls: 'text-green-600' },
  withdrawal: { sinal: '-', label: 'Repasse', cls: 'text-red-500' },
  fee: { sinal: '', label: 'Comissão', cls: 'text-plum' },
  refund: { sinal: '-', label: 'Reembolso', cls: 'text-red-500' },
  expense: { sinal: '-', label: 'Despesa', cls: 'text-red-500' },
}

const withdrawStatus: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  processing: { label: 'Em processamento', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  completed: { label: 'Pago', cls: 'bg-green-50 text-green-700 border-green-100' },
  failed: { label: 'Falhou', cls: 'bg-red-50 text-red-500 border-red-100' },
}

const brl = (n: number) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const quando = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const nomeProdutor = (p: { full_name: string | null; email: string | null } | null) =>
  p?.full_name || p?.email || 'Produtor sem perfil'

export default function AdminFinance() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { data, isLoading, isError, error } = useAdminFinance()

  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'withdraws' | 'tools'>('overview')

  // Filters
  const [txSearch, setTxSearch] = useState('')
  const [txFilterType, setTxFilterType] = useState<string>('all')

  // Tools states
  const [platformCommission, setPlatformCommission] = useState(10.0) // 10%
  const [payoutPixDays, setPayoutPixDays] = useState(0) // D+0
  const [payoutCardDays, setPayoutCardDays] = useState(14) // D+14
  const [payoutBoletoDays, setPayoutBoletoDays] = useState(2) // D+2

  const orders = data?.orders ?? []
  const transactions = data?.transactions ?? []
  const withdrawals = data?.withdrawals ?? []

  const handleExportCSV = async (tabela: 'orders' | 'transactions' | 'withdrawals') => {
    const colunas: Record<string, string[]> = {
      orders: ['id', 'created_at', 'status', 'payment_method', 'total', 'customer_name', 'customer_email'],
      transactions: ['id', 'created_at', 'type', 'status', 'amount', 'description'],
      withdrawals: ['id', 'created_at', 'status', 'amount', 'pix_key', 'processed_at'],
    }
    try {
      const linhas = await fetchAllRows<Record<string, unknown>>((from, to) =>
        supabase.from(tabela).select('*').order('id').range(from, to)
      )
      if (linhas.length === 0) {
        toast.info('Não há registros para exportar nesta tabela.')
        return
      }
      downloadCsv(csvFilename(tabela), toCsv(linhas, colunas[tabela]))
      toast.success(`${linhas.length} linha(s) exportada(s).`)
    } catch (e: unknown) {
      toast.error('Falha ao exportar: ' + ((e as { message?: string } | null)?.message || 'erro desconhecido'))
    }
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

  // Calculations — só o que está gravado no banco
  const pedidosPagos = orders.filter(o => o.status === 'paid')
  const grossSalesVolume = pedidosPagos.reduce((s, o) => s + Number(o.total || 0), 0)
  const totalPayouts = withdrawals.filter(w => w.status === 'completed').reduce((s, w) => s + Number(w.amount || 0), 0)
  const platformRevenue = transactions.filter(t => t.type === 'fee').reduce((s, t) => s + Number(t.amount || 0), 0)
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending')
  const comissoes = transactions.filter(t => t.type === 'fee')

  // Métodos de pagamento: contagem real dos pedidos pagos
  const metodos = ['pix', 'credit_card', 'boleto'].map(m => ({
    key: m,
    label: m === 'pix' ? 'PIX' : m === 'credit_card' ? 'Cartão de Crédito' : 'Boleto / Outros',
    count: pedidosPagos.filter(o => o.payment_method === m).length,
  }))
  const totalMetodos = pedidosPagos.length

  // Filter Transaction Extrato
  const filteredTransactions = transactions
    .filter(t => !txSearch
      || (t.description || '').toLowerCase().includes(txSearch.toLowerCase())
      || nomeProdutor(t.profiles).toLowerCase().includes(txSearch.toLowerCase()))
    .filter(t => txFilterType === 'all' || t.type === txFilterType)

  const aviso = (
    <div className="fin-anim mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3.5 items-start">
      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
      <div>
        <h4 className="text-xs font-bold text-amber-800">Cobrança e repasses desativados até a Fase 4</h4>
        <p className="text-[10px] text-amber-700 leading-normal mt-0.5">
          A Evokaa ainda não tem gateway de pagamento. Saques, reembolsos e comissão não podem ser executados
          por aqui: aprovar um saque aqui só mudaria o texto na tela, sem mover dinheiro. Estes números são
          <strong> reais</strong> — o que estiver zerado é porque ainda não houve venda confirmada.
        </p>
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Financeiro</h1>
          <p className="text-sm text-espresso/70 mt-1">Visão geral do volume financeiro, comissões coletadas e moderação de repasses.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap bg-white/60 p-1 border border-white/60 rounded-xl gap-1 sm:gap-0">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'overview' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/70 hover:text-espresso'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" /> Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'transactions' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/70 hover:text-espresso'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Extrato Comercial
          </button>
          <button 
            onClick={() => setActiveTab('withdraws')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'withdraws' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/70 hover:text-espresso'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Repasses / Saques ({pendingWithdrawals.length})
          </button>
          <button 
            onClick={() => setActiveTab('tools')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'tools' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/70 hover:text-espresso'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Ferramentas & Taxas
          </button>
        </div>
      </div>

      {isError && (
        <div role="alert" className="fin-anim mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300">
          Não foi possível carregar os dados financeiros: {(error as Error)?.message || 'erro desconhecido'}
        </div>
      )}

      {aviso}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-plum animate-spin" />
        </div>
      )}

      {/* Financial KPIs */}
      {!isLoading && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Volume Geral de Vendas (GMV)', value: brl(grossSalesVolume), icon: TrendingUp, change: `${pedidosPagos.length} pedido(s) pago(s)`, color: 'text-emerald-600' },
          { label: 'Receita Líquida (Plataforma)', value: brl(platformRevenue), icon: CreditCard, change: 'Comissões lançadas', color: 'text-plum' },
          { label: 'Repasses Efetuados (Saques)', value: brl(totalPayouts), icon: Wallet, change: 'Saques concluídos', color: 'text-rose-500' },
          { label: 'Repasses Pendentes', value: brl(pendingWithdrawals.reduce((s, w) => s + Number(w.amount || 0), 0)), icon: Clock, change: `${pendingWithdrawals.length} pedido(s)`, color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="fin-anim p-5 rounded-2xl bg-white/60 border border-white/60 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <span className="text-[9px] text-espresso/70 font-bold uppercase tracking-wider">{k.change}</span>
            </div>
            <div>
              <div className="font-serif text-2xl text-espresso">{k.value}</div>
              <div className="text-[10px] text-espresso/70 mt-1 uppercase tracking-wider leading-none">{k.label}</div>
            </div>
          </div>
        ))}
      </div>
      )}

      {activeTab === 'overview' && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pedidos pagos — a curva só existe depois que o gateway confirmar venda */}
          <div className="lg:col-span-2 space-y-6">
            <div className="fin-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-espresso">Pedidos pagos</h3>
                  <p className="text-[10px] text-espresso/70">Pedidos com status <span className="font-mono">paid</span> no banco.</p>
                </div>
                <div className="text-xs font-bold text-plum bg-plum/5 border border-plum/10 px-2.5 py-1 rounded-lg">
                  {pedidosPagos.length} no total
                </div>
              </div>

              {pedidosPagos.length === 0 ? (
                <p className="py-12 text-center text-xs text-espresso/70 italic">
                  Nenhum pedido pago até agora. Enquanto o gateway não estiver publicado, todo pedido nasce
                  <span className="font-mono"> pending</span> e nenhum valor entra aqui.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-espresso/5">
                        <th className="px-2 py-2 text-[10px] font-bold text-espresso/70 uppercase">Pedido</th>
                        <th className="px-2 py-2 text-[10px] font-bold text-espresso/70 uppercase hidden sm:table-cell">Evento</th>
                        <th className="px-2 py-2 text-[10px] font-bold text-espresso/70 uppercase">Comprador</th>
                        <th className="px-2 py-2 text-[10px] font-bold text-espresso/70 uppercase text-right">Valor</th>
                        <th className="px-2 py-2 text-[10px] font-bold text-espresso/70 uppercase text-right">Quando</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-espresso/3">
                      {pedidosPagos.map(o => (
                        <tr key={o.id} className="hover:bg-white/40 transition-colors">
                          <td className="px-2 py-2.5 font-mono text-[10px] text-espresso/70">{o.id.slice(0, 8)}</td>
                          <td className="px-2 py-2.5 text-xs text-espresso/70 hidden sm:table-cell">{o.events?.title || '—'}</td>
                          <td className="px-2 py-2.5 text-xs text-espresso/70">{o.customer_name || o.customer_email || '—'}</td>
                          <td className="px-2 py-2.5 text-right text-xs font-bold text-espresso">{brl(o.total)}</td>
                          <td className="px-2 py-2.5 text-right text-xs text-espresso/70">{quando(o.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Withdraw review warning */}
            {pendingWithdrawals.length > 0 && (
              <div className="fin-anim p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3.5 items-start">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-amber-800">{pendingWithdrawals.length} Solicitação(ões) de Repasse Pendente(s)</h4>
                  <p className="text-[10px] text-amber-700 leading-normal mt-0.5">
                    Produtores pediram resgate de {brl(pendingWithdrawals.reduce((s, w) => s + Number(w.amount || 0), 0))}.
                    A liberação bancária está desligada até a Fase 4; a aba Repasses mostra a fila para conference.
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
              <h3 className="text-xs font-bold text-espresso/70 uppercase tracking-wider mb-5">Meios de Pagamento Utilizados</h3>
              
              <div className="space-y-4">
                {metodos.map(m => {
                  const share = totalMetodos > 0 ? Math.round((m.count / totalMetodos) * 100) : 0
                  const cor = m.key === 'pix' ? 'bg-emerald-500' : m.key === 'credit_card' ? 'bg-plum' : 'bg-blue-500'
                  const txt = m.key === 'pix' ? 'text-emerald-600' : m.key === 'credit_card' ? 'text-plum' : 'text-blue-600'
                  return (
                    <div key={m.key} className="flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-espresso/70 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${cor}`} />
                          {m.label}
                        </div>
                        <div className="w-full h-1.5 bg-canvas rounded-full mt-2 overflow-hidden">
                          <div className={`h-full rounded-full ${cor}`} style={{ width: `${share}%` }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold ${txt}`}>{share}%</span>
                      </div>
                    </div>
                  )
                })}
                {totalMetodos === 0 && (
                  <p className="pt-2 text-[10px] text-espresso/70 italic leading-relaxed">
                    Sem pedidos pagos ainda, não há distribuição por meio de pagamento. A leitura vem de
                    <span className="font-mono"> orders.status = 'paid'</span>.
                  </p>
                )}
              </div>
            </div>

            {/* Commissions policy info */}
            <div className="fin-anim p-5 rounded-2xl border border-white bg-white/40 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-espresso/70 uppercase tracking-wider flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Política de Taxação</h3>
              <p className="text-[10px] text-espresso/70 leading-relaxed">
                Comissão e prazos de repasse são configurados na aba <strong>Ferramentas &amp; Taxas</strong>.
                Nenhum valor é retido hoje: a comissão passa a ser lançada em <span className="font-mono">transactions</span>
                quando o gateway confirmar o pagamento, na Fase 4.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && !isLoading && (
        <div className="fin-anim bg-white/60 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
          {/* Filters Bar */}
          <div className="p-4 border-b border-espresso/5 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/40">
            <div className="relative w-full md:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-espresso/30" />
              <input
                type="text"
                placeholder="Buscar por descrição ou produtor..."
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-white/5 border border-espresso/10 rounded-xl text-xs focus:outline-none focus:border-plum text-espresso placeholder:text-espresso/70"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
              <select
                value={txFilterType}
                onChange={e => setTxFilterType(e.target.value)}
                aria-label="Filtrar por tipo de operação"
                className="px-3 py-1.5 bg-white dark:bg-white/5 border border-espresso/10 rounded-xl text-xs text-espresso/70 focus:outline-none"
              >
                <option value="all">Todas Operações</option>
                {Object.entries(typeSinal).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Transactions List */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-espresso/5 text-left bg-white/40">
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/70 uppercase">Código</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/70 uppercase">Operação</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/70 uppercase hidden sm:table-cell">Produtor</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/70 uppercase hidden md:table-cell">Situação</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/70 uppercase">Data/Hora</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/70 uppercase text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-espresso/3">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-xs text-espresso/70 italic">
                      {transactions.length === 0
                        ? 'Nenhum lançamento em transactions. A comissão e os repasses passam a ser gravados aqui quando o gateway for publicado (Fase 4).'
                        : 'Nenhum lançamento encontrado para os filtros selecionados.'}
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(tx => {
                    const cfg = typeSinal[tx.type] || { sinal: '', label: tx.type, cls: 'text-espresso/70' }
                    const Icon = tx.type === 'income' ? ArrowUpRight : tx.type === 'fee' ? CreditCard : ArrowDownRight
                    return (
                      <tr key={tx.id} className="hover:bg-white/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-[10px] text-espresso/70">{tx.id.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-canvas ${cfg.cls}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-espresso">{tx.description || cfg.label}</span>
                              <div className="text-[10px] text-espresso/70">{cfg.label}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-espresso/70 hidden sm:table-cell">{nomeProdutor(tx.profiles)}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="px-2 py-0.5 rounded bg-canvas text-espresso/70 text-[9px] font-bold uppercase">{tx.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-espresso/70">{quando(tx.created_at)}</td>
                        <td className={`px-4 py-3 text-right text-xs font-bold ${cfg.cls}`}>
                          {cfg.sinal}{brl(tx.amount)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'withdraws' && !isLoading && (
        <div className="fin-anim bg-white/60 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-espresso/5 bg-white/40">
            <h3 className="text-sm font-semibold text-espresso">Solicitações Bancárias de Repasses</h3>
            <p className="text-[10px] text-espresso/70">Fila real de saques pedidos pelos produtores. A liberação Pix fica desligada até a Fase 4.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-espresso/5 bg-white/40">
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/70 uppercase">Produtor / Contato</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/70 uppercase">Chave Pix</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/70 uppercase">Data da Solicitação</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/70 uppercase">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-espresso/70 uppercase text-right">Valor</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-espresso/3">
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-xs text-espresso/70 italic">
                      Nenhuma solicitação de saque registrada na plataforma.
                    </td>
                  </tr>
                ) : (
                  withdrawals.map(w => {
                    const sc = withdrawStatus[w.status] || { label: w.status, cls: 'bg-canvas text-espresso/70 border-espresso/10' }
                    const banco = (w.bank_account?.bank_name || w.bank_account?.bankName) as string | undefined
                    return (
                      <tr key={w.id} className="hover:bg-white/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-xs font-bold text-espresso">{nomeProdutor(w.profiles)}</div>
                          <div className="text-[10px] text-espresso/70">{w.profiles?.email || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold text-espresso/70 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-espresso/40" /> {w.pix_key || 'Chave não informada'}
                          </div>
                          {banco && <div className="text-[10px] text-espresso/70">{banco}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-espresso/70">{quando(w.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${sc.cls}`}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-serif text-sm font-bold text-espresso">{brl(w.amount)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            disabled
                            className="px-2.5 py-1 text-[11px] font-medium bg-canvas text-espresso/70 rounded-lg cursor-not-allowed border border-espresso/10"
                            title="Aprovação e rejeição de saque só serão liberadas com o gateway de pagamento (Fase 4)"
                          >
                            Liberação manual desligada
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'tools' && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 fin-anim animate-fadeIn">
          {/* Painel de Configuração de Comissões e Taxas */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-espresso">Configurações de Comissão & Taxas</h3>
                <p className="text-[10px] text-espresso/70">Taxa operacional padrão retida pela Evokaa e regras de resgate.</p>
              </div>

              <div className="space-y-4 opacity-60">
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
                    disabled
                    aria-label="Taxa de comissão (desativada)"
                    onChange={e => setPlatformCommission(parseFloat(e.target.value))}
                    className="w-full accent-plum cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[9px] text-espresso/70 uppercase font-semibold">
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
                      <span className="text-[9px] text-espresso/70 font-bold uppercase">PIX</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={payoutPixDays}
                          disabled
                          aria-label="Prazo Pix em dias (desativado)"
                          onChange={e => setPayoutPixDays(parseInt(e.target.value) || 0)}
                          className="w-12 px-2 py-0.5 bg-white dark:bg-white/5 border border-espresso/10 rounded font-bold text-xs text-espresso cursor-not-allowed"
                        />
                        <span className="text-xs text-espresso/70 font-semibold">dias (D+{payoutPixDays})</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/40 border border-espresso/5 space-y-1">
                      <span className="text-[9px] text-espresso/70 font-bold uppercase">Cartão de Crédito</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={payoutCardDays}
                          disabled
                          aria-label="Prazo de cartão em dias (desativado)"
                          onChange={e => setPayoutCardDays(parseInt(e.target.value) || 0)}
                          className="w-12 px-2 py-0.5 bg-white dark:bg-white/5 border border-espresso/10 rounded font-bold text-xs text-espresso cursor-not-allowed"
                        />
                        <span className="text-xs text-espresso/70 font-semibold">dias (D+{payoutCardDays})</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/40 border border-espresso/5 space-y-1">
                      <span className="text-[9px] text-espresso/70 font-bold uppercase">Boleto Bancário</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={payoutBoletoDays}
                          disabled
                          aria-label="Prazo de boleto em dias (desativado)"
                          onChange={e => setPayoutBoletoDays(parseInt(e.target.value) || 0)}
                          className="w-12 px-2 py-0.5 bg-white dark:bg-white/5 border border-espresso/10 rounded font-bold text-xs text-espresso cursor-not-allowed"
                        />
                        <span className="text-xs text-espresso/70 font-semibold">dias (D+{payoutBoletoDays})</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    disabled
                    className="px-4 py-2 bg-plum/50 text-cream rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-sm cursor-not-allowed"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Salvar indisponível até a Fase 4</span>
                  </button>
                </div>
                <p className="text-[10px] text-espresso/70 leading-relaxed">
                  A comissão precisa ser cobrada pelo gateway e registrada em <span className="font-mono">transactions</span>;
                  salvar um valor aqui não mudaria nada no repasse real.
                </p>
              </div>
            </div>

            {/* Comissões: só o que está lançado no banco */}
            <div className="p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-espresso">Demonstrativo de Comissões Coletadas</h3>
                <p className="text-[10px] text-espresso/70">Lançamentos de tipo <span className="font-mono">fee</span> em <span className="font-mono">transactions</span>.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-espresso/5 text-espresso/70 text-[9px] uppercase tracking-wider bg-white/30 dark:bg-white/5">
                      <th className="px-3 py-2 font-bold">Comissão</th>
                      <th className="px-3 py-2 font-bold hidden sm:table-cell">Produtor</th>
                      <th className="px-3 py-2 font-bold">Lançamento</th>
                      <th className="px-3 py-2 font-bold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-espresso/3 text-xs">
                    {comissoes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-10 text-center text-xs text-espresso/70 italic">
                          Nenhuma comissão lançada. Elas passam a existir quando o gateway confirmar um pagamento.
                        </td>
                      </tr>
                    ) : (
                      comissoes.map(c => (
                        <tr key={c.id} className="hover:bg-white/40 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-espresso font-mono">{c.id.slice(0, 8)}</td>
                          <td className="px-3 py-2.5 text-espresso/80 hidden sm:table-cell">{nomeProdutor(c.profiles)}</td>
                          <td className="px-3 py-2.5 text-espresso/70">{quando(c.created_at)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-plum">{brl(c.amount)}</td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-espresso/5 font-bold border-t border-espresso/10">
                      <td className="px-3 py-2.5 text-espresso" colSpan={3}>Total em comissões</td>
                      <td className="px-3 py-2.5 text-right text-plum">{brl(platformRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Ferramentas de Exportação e Auditoria lateral */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-espresso/70 uppercase tracking-wider">Exportar Relatórios</h3>
              <p className="text-[10px] text-espresso/70 leading-normal">Baixa o CSV direto do banco, com todas as linhas da tabela.</p>

              <div className="space-y-2 pt-2">
                {([
                  ['orders', 'Relatório de Pedidos (.csv)'],
                  ['transactions', 'Relatório de Transações (.csv)'],
                  ['withdrawals', 'Relatório de Saques (.csv)'],
                ] as const).map(([tabela, label]) => (
                  <button
                    key={tabela}
                    onClick={() => handleExportCSV(tabela)}
                    className="w-full py-2.5 px-4 bg-white dark:bg-white/5 border border-espresso/10 rounded-xl text-xs font-bold text-espresso/70 hover:bg-espresso/5 flex items-center justify-between transition-all"
                  >
                    <span>{label}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-espresso/40" />
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-white bg-white/40 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-espresso/70 uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Compliance de Saques
              </h3>
              <p className="text-[10px] text-espresso/70 leading-relaxed font-semibold">
                Regra operacional: saques em processamento acima de {brl(10000)} exigem auditoria manual do
                faturamento do produtor e validação de documentos fiscais antes da liberação Pix.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
