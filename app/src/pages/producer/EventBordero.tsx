import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft, Download, DollarSign, Users, CreditCard,
  BarChart3, TrendingUp,
  Calendar, Printer, ArrowDownRight, ArrowUpRight
} from 'lucide-react'
import { toast } from 'sonner'

interface Transaction {
  id: string
  date: string
  description: string
  type: 'income' | 'fee' | 'refund' | 'payout'
  amount: number
  status: 'completed' | 'pending' | 'cancelled'
}

const borderoMock = {
  eventName: 'Noite Eletro 2025',
  eventDate: '15 Jun 2025',
  totalSales: 1840,
  grossRevenue: 147600.00,
  serviceFee: 14760.00,
  processingFee: 3690.00,
  refunds: 2400.00,
  netRevenue: 126750.00,
  payoutDate: '17 Jun 2025',
  payoutStatus: 'pending',
  paymentMethod: 'Transferencia Bancaria',
  pixRate: 0.99,
  cardRate: 2.49,
  boletoRate: 2.99,
  transactions: [
    { id: '1', date: '2025-06-01', description: 'Venda Ingresso VIP #1284', type: 'income' as const, amount: 150.00, status: 'completed' as const },
    { id: '2', date: '2025-06-01', description: 'Venda Entrada Geral #1285', type: 'income' as const, amount: 80.00, status: 'completed' as const },
    { id: '3', date: '2025-06-02', description: 'Taxa de servico #1284', type: 'fee' as const, amount: -15.00, status: 'completed' as const },
    { id: '4', date: '2025-06-02', description: 'Taxa de servico #1285', type: 'fee' as const, amount: -8.00, status: 'completed' as const },
    { id: '5', date: '2025-06-03', description: 'Venda Mesa Coletiva #1286', type: 'income' as const, amount: 300.00, status: 'completed' as const },
    { id: '6', date: '2025-06-05', description: 'Reembolso #1102', type: 'refund' as const, amount: -150.00, status: 'completed' as const },
    { id: '7', date: '2025-06-05', description: 'Taxa processamento PIX', type: 'fee' as const, amount: -4.50, status: 'completed' as const },
    { id: '8', date: '2025-06-08', description: 'Venda Camiseta Store #45', type: 'income' as const, amount: 80.00, status: 'completed' as const },
  ] as Transaction[],
  salesByDay: [
    { day: '01/06', amount: 3240 },
    { day: '02/06', amount: 5120 },
    { day: '03/06', amount: 8900 },
    { day: '04/06', amount: 4200 },
    { day: '05/06', amount: 6780 },
    { day: '06/06', amount: 12500 },
    { day: '07/06', amount: 18900 },
    { day: '08/06', amount: 23400 },
    { day: '09/06', amount: 15600 },
    { day: '10/06', amount: 12100 },
    { day: '11/06', amount: 8900 },
    { day: '12/06', amount: 6700 },
    { day: '13/06', amount: 4500 },
    { day: '14/06', amount: 3200 },
    { day: '15/06', amount: 1560 },
  ],
  salesByMethod: [
    { method: 'PIX', amount: 78900, count: 920, color: '#22c55e' },
    { method: 'Cartao Credito', amount: 48600, count: 580, color: '#3b82f6' },
    { method: 'Cartao Debito', amount: 12300, count: 210, color: '#06b6d4' },
    { method: 'Boleto', amount: 7800, count: 130, color: '#f59e0b' },
  ],
}

export default function EventBordero() {
  const [filter, setFilter] = useState<'all' | 'income' | 'fee' | 'refund' | 'payout'>('all')

  const filtered = borderoMock.transactions.filter(t => filter === 'all' || t.type === filter)
  const totalFees = borderoMock.transactions.filter(t => t.type === 'fee').reduce((s, t) => s + Math.abs(t.amount), 0)

  const handleDownload = () => { toast.success('Bordero PDF baixado!') }
  const handlePrint = () => { toast.success('Enviado para impressao!') }

  const maxDay = Math.max(...borderoMock.salesByDay.map(d => d.amount))

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/event-manager" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Bordero Financeiro</h1>
          <p className="text-sm text-espresso/50 mt-1">{borderoMock.eventName} — {borderoMock.eventDate}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownload} className="px-4 py-2.5 bg-white/60 border border-white/60 text-espresso text-sm rounded-full hover:bg-plum hover:text-cream hover:border-plum transition-all flex items-center gap-2">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={handlePrint} className="px-4 py-2.5 bg-white/60 border border-white/60 text-espresso text-sm rounded-full hover:bg-plum hover:text-cream hover:border-plum transition-all flex items-center gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Receita Bruta', value: `R$ ${borderoMock.grossRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: '#22c55e', trend: '+12%' },
          { label: 'Ingressos', value: borderoMock.totalSales.toString(), icon: Users, color: '#3b82f6', trend: null },
          { label: 'Taxas', value: `R$ ${totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: CreditCard, color: '#f59e0b', trend: null },
          { label: 'Receita Liquida', value: `R$ ${borderoMock.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: BarChart3, color: '#7a3b69', trend: null },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <div className="flex items-center justify-between mb-2">
              <k.icon className="w-4 h-4" style={{ color: k.color }} />
              {k.trend && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />{k.trend}</span>}
            </div>
            <div className="font-serif text-xl text-espresso">{k.value}</div>
            <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Breakdown */}
        <div className="lg:col-span-2 p-6 bg-white/60 border border-white/60 rounded-2xl">
          <h3 className="text-sm font-medium text-espresso mb-4">Detalhamento</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-white/60">
              <span className="text-sm text-espresso/60">Receita Bruta (vendas)</span>
              <span className="text-sm font-medium text-green-600">+ R$ {borderoMock.grossRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/60">
              <span className="text-sm text-espresso/60">Taxa de servico Aura ({borderoMock.serviceFee / borderoMock.grossRevenue * 100}%)</span>
              <span className="text-sm font-medium text-red-500">- R$ {borderoMock.serviceFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/60">
              <span className="text-sm text-espresso/60">Taxa de processamento</span>
              <span className="text-sm font-medium text-red-500">- R$ {borderoMock.processingFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/60">
              <span className="text-sm text-espresso/60">Reembolsos</span>
              <span className="text-sm font-medium text-red-500">- R$ {borderoMock.refunds.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-plum/20">
              <span className="text-sm font-medium text-espresso">Receita Liquida</span>
              <span className="text-lg font-medium text-plum">R$ {borderoMock.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Payout Info */}
          <div className="mt-4 p-4 bg-plum/5 rounded-xl flex items-center gap-3">
            <Calendar className="w-5 h-5 text-plum" />
            <div className="flex-1">
              <div className="text-sm font-medium text-espresso">Repasse programado</div>
              <div className="text-xs text-espresso/40">{borderoMock.payoutDate} via {borderoMock.paymentMethod}</div>
            </div>
            <span className={`px-3 py-1 rounded-full text-[10px] font-medium ${borderoMock.payoutStatus === 'completed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
              {borderoMock.payoutStatus === 'completed' ? 'Concluido' : 'Pendente'}
            </span>
          </div>
        </div>

        {/* Sales by Method */}
        <div className="p-6 bg-white/60 border border-white/60 rounded-2xl">
          <h3 className="text-sm font-medium text-espresso mb-4">Vendas por Metodo</h3>
          <div className="space-y-4">
            {borderoMock.salesByMethod.map(m => (
              <div key={m.method}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-espresso/60">{m.method}</span>
                  <span className="text-xs font-medium text-espresso">{m.count} vendas</span>
                </div>
                <div className="w-full h-2 bg-canvas rounded-full overflow-hidden mb-1">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(m.amount / borderoMock.grossRevenue) * 100}%`, background: m.color }} />
                </div>
                <div className="text-[10px] text-espresso/30">R$ {m.amount.toLocaleString('pt-BR')} ({((m.amount / borderoMock.grossRevenue) * 100).toFixed(1)}%)</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/60">
            <div className="text-[10px] text-espresso/30 mb-2">Taxas de processamento:</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs"><span className="text-espresso/40">PIX</span><span className="text-espresso/60">{borderoMock.pixRate}%</span></div>
              <div className="flex justify-between text-xs"><span className="text-espresso/40">Cartao</span><span className="text-espresso/60">{borderoMock.cardRate}%</span></div>
              <div className="flex justify-between text-xs"><span className="text-espresso/40">Boleto</span><span className="text-espresso/60">{borderoMock.boletoRate}%</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Chart */}
      <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
        <h3 className="text-sm font-medium text-espresso mb-4">Vendas por Dia</h3>
        <div className="flex items-end gap-1 h-40">
          {borderoMock.salesByDay.map(d => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-plum/20 rounded-t-sm transition-all hover:bg-plum/40 relative group" style={{ height: `${(d.amount / maxDay) * 100}%` }}>
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-void text-cream text-[9px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  R$ {d.amount.toLocaleString()}
                </div>
              </div>
              <span className="text-[8px] text-espresso/30">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-espresso">Transacoes</h3>
          <div className="flex gap-1">
            {(['all', 'income', 'fee', 'refund'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all ${filter === f ? 'bg-plum text-cream' : 'bg-white/40 text-espresso/40 hover:text-espresso'}`}>
                {f === 'all' ? 'Todas' : f === 'income' ? 'Receitas' : f === 'fee' ? 'Taxas' : 'Reembolsos'}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-white/60">
          {filtered.map(t => (
            <div key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/40 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === 'income' ? 'bg-green-50' : t.type === 'fee' ? 'bg-amber-50' : 'bg-red-50'}`}>
                {t.type === 'income' ? <ArrowDownRight className="w-4 h-4 text-green-600" /> : t.type === 'fee' ? <ArrowUpRight className="w-4 h-4 text-amber-600" /> : <ArrowUpRight className="w-4 h-4 text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-espresso truncate">{t.description}</div>
                <div className="text-[10px] text-espresso/30">{t.date}</div>
              </div>
              <div className={`text-sm font-medium ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                {t.type === 'income' ? '+' : '-'} R$ {Math.abs(t.amount).toFixed(2)}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${t.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                {t.status === 'completed' ? 'OK' : t.status === 'pending' ? 'Pendente' : 'Cancelada'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
