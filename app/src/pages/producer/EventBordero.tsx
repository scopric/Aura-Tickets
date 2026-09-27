import { Link } from 'react-router-dom'
import {
  ArrowLeft, Printer, DollarSign, Users, ShoppingBag,
  BarChart3, CheckCircle2, Clock, Calendar, Loader2
} from 'lucide-react'
import { useFinancialDashboard } from '../../hooks/useFinancialDashboard'

const brl = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

export default function EventBordero() {
  const {
    summary,
    isSummaryLoading,
    dailyRevenue = [],
    paymentMethods = [],
    eventRevenue = [],
    isEventRevenueLoading,
  } = useFinancialDashboard()

  const handlePrint = () => window.print()

  const gross = summary?.totalRevenue || 0
  const maxDay = Math.max(...dailyRevenue.map(d => d.revenue), 1)
  const methodsTotal = paymentMethods.reduce((s, m) => s + m.total, 0) || 1

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/event-manager" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-serif text-3xl text-espresso">Bordero Financeiro</h1>
          <p className="text-sm text-espresso/50 mt-1">Consolidado de todos os seus eventos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="px-4 py-2.5 bg-white/60 border border-white/60 text-espresso text-sm rounded-full hover:bg-plum hover:text-cream hover:border-plum transition-all flex items-center gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Receita Bruta', value: brl(gross), icon: DollarSign, color: '#22c55e' },
          { label: 'Ingressos', value: (summary?.totalTicketsSold || 0).toString(), icon: Users, color: '#3b82f6' },
          { label: 'Pedidos', value: (summary?.totalOrders || 0).toString(), icon: ShoppingBag, color: '#f59e0b' },
          { label: 'Receita Confirmada', value: brl(summary?.confirmedRevenue || 0), icon: BarChart3, color: '#7a3b69' },
        ].map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-white/60 border border-white/60">
            <k.icon className="w-4 h-4 mb-2" style={{ color: k.color }} />
            <div className="font-serif text-xl text-espresso">{isSummaryLoading ? '—' : k.value}</div>
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
              <span className="text-sm font-medium text-green-600">{brl(gross)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/60">
              <span className="text-sm text-espresso/60 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Confirmada (paga)</span>
              <span className="text-sm font-medium text-green-600">{brl(summary?.confirmedRevenue || 0)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/60">
              <span className="text-sm text-espresso/60 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-500" /> Pendente</span>
              <span className="text-sm font-medium text-amber-600">{brl(summary?.pendingRevenue || 0)}</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-plum/20">
              <span className="text-sm font-medium text-espresso">Ticket Medio</span>
              <span className="text-lg font-medium text-plum">{brl(summary?.avgTicketPrice || 0)}</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-plum/5 rounded-xl flex items-center gap-3">
            <Calendar className="w-5 h-5 text-plum" />
            <div className="flex-1">
              <div className="text-sm font-medium text-espresso">Repasses</div>
              <div className="text-xs text-espresso/40">Acompanhe e solicite saques na Carteira</div>
            </div>
            <Link to="/producer/wallet" className="px-3 py-1 rounded-full text-[10px] font-medium bg-plum text-cream">Ver Carteira</Link>
          </div>
        </div>

        {/* Sales by Method */}
        <div className="p-6 bg-white/60 border border-white/60 rounded-2xl">
          <h3 className="text-sm font-medium text-espresso mb-4">Vendas por Metodo</h3>
          {paymentMethods.length === 0 ? (
            <p className="text-xs text-espresso/40">Sem vendas registradas ainda.</p>
          ) : (
            <div className="space-y-4">
              {paymentMethods.map(m => (
                <div key={m.method}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-espresso/60">{m.method}</span>
                    <span className="text-xs font-medium text-espresso">{m.count} vendas</span>
                  </div>
                  <div className="w-full h-2 bg-canvas rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full bg-plum/60 transition-all" style={{ width: `${(m.total / methodsTotal) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-espresso/30">{brl(m.total)} ({((m.total / methodsTotal) * 100).toFixed(1)}%)</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sales Chart */}
      <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
        <h3 className="text-sm font-medium text-espresso mb-4">Vendas por Dia (ultimos 30 dias)</h3>
        {dailyRevenue.length === 0 ? (
          <p className="text-xs text-espresso/40">Sem vendas no periodo.</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {dailyRevenue.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-plum/20 rounded-t-sm transition-all hover:bg-plum/40 relative group" style={{ height: `${(d.revenue / maxDay) * 100}%` }}>
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-void text-cream text-[9px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {brl(d.revenue)}
                  </div>
                </div>
                <span className="text-[8px] text-espresso/30">{d.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revenue by Event */}
      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-espresso">Receita por Evento</h3>
        </div>
        <div className="divide-y divide-white/60">
          {isEventRevenueLoading && (
            <div className="px-4 py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-espresso/40" /></div>
          )}
          {!isEventRevenueLoading && eventRevenue.length === 0 && (
            <div className="px-4 py-12 text-center text-xs text-espresso/40">Nenhum evento com vendas ainda.</div>
          )}
          {eventRevenue.map(e => (
            <div key={e.event_id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/40 transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-plum/10">
                <Calendar className="w-4 h-4 text-plum" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-espresso truncate">{e.event_title}</div>
                <div className="text-[10px] text-espresso/30">{e.tickets_sold} ingressos · {e.orders_count} pedidos</div>
              </div>
              <div className="text-sm font-medium text-green-600">{brl(e.revenue)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
