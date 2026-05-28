import { useState, useEffect, useRef } from 'react'
import { 
  Ticket, CheckCircle, QrCode, XCircle, Clock, Users, 
  BarChart3, Loader2, Search, ArrowRight, RefreshCw, AlertTriangle,
  Mail
} from 'lucide-react'
import { toast } from 'sonner'
import gsap from 'gsap'
import { useAdminTickets } from '../../hooks/useEvents'

interface RefundRequest {
  id: string
  buyer: string
  ticket: string
  event: string
  amount: number
  status: 'pending' | 'refunded' | 'rejected'
  time: string
  reason: string
}

interface SaleRecord {
  id: string
  buyer: string
  ticket: string
  event: string
  amount: number
  status: 'confirmed' | 'pending' | 'cancelled'
  checkInStatus: 'entered' | 'waiting'
  checkInTime: string | null
  time: string
}

const initialRecentSales: SaleRecord[] = [
  { id: 's-001', buyer: 'Ana Carolina Silva', ticket: 'Ingresso VIP', event: 'Festival Sunset Evokaa 2026', amount: 280, status: 'confirmed', checkInStatus: 'entered', checkInTime: '27 Mai, 20:15', time: '2 min atrás' },
  { id: 's-002', buyer: 'Bruno Costa', ticket: 'Mesa Coletiva', event: 'Festival Sunset Evokaa 2026', amount: 160, status: 'confirmed', checkInStatus: 'entered', checkInTime: '27 Mai, 19:40', time: '5 min atrás' },
  { id: 's-003', buyer: 'Camila Rocha', ticket: 'Ingresso Geral', event: 'Jazz & Blues Night', amount: 80, status: 'pending', checkInStatus: 'waiting', checkInTime: null, time: '12 min atrás' },
  { id: 's-004', buyer: 'Diego Lima', ticket: 'Ingresso VIP', event: 'Workshop de Growth & Inovação', amount: 120, status: 'confirmed', checkInStatus: 'waiting', checkInTime: null, time: '18 min atrás' },
  { id: 's-005', buyer: 'Elisa Nakamura', ticket: 'Mesa Coletiva', event: 'Festival Sunset Evokaa 2026', amount: 160, status: 'cancelled', checkInStatus: 'waiting', checkInTime: null, time: '25 min atrás' },
  { id: 's-006', buyer: 'Fernando Almeida', ticket: 'Ingresso Geral', event: 'Festival Sunset Evokaa 2026', amount: 120, status: 'confirmed', checkInStatus: 'entered', checkInTime: '27 Mai, 18:30', time: '40 min atrás' },
]

const initialRefundRequests: RefundRequest[] = [
  { id: 'ref-001', buyer: 'Mariana Souza', ticket: 'Ingresso VIP', event: 'Workshop de Growth & Inovação', amount: 120, status: 'pending', time: '1 hora atrás', reason: 'Imprevisto profissional na data do evento' },
  { id: 'ref-002', buyer: 'Pedro Henrique', ticket: 'Ingresso Geral', event: 'Jazz & Blues Night', amount: 80, status: 'pending', time: '3 horas atrás', reason: 'Problema de saúde na família' },
  { id: 'ref-003', buyer: 'Carla Dias', ticket: 'Mesa Coletiva', event: 'Gastronomia Gourmet', amount: 160, status: 'refunded', time: '1 dia atrás', reason: 'Evento cancelado pelo produtor' },
]

const statusCfg = {
  confirmed: { label: 'Confirmado', cls: 'bg-green-50 text-green-600 border-green-100', icon: CheckCircle },
  pending: { label: 'Pendente', cls: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock },
  cancelled: { label: 'Cancelado', cls: 'bg-red-50 text-red-500 border-red-100', icon: XCircle },
}

// Mock recent gate check-ins (simulated scanner feed)
const recentCheckIns = [
  { id: 'scan-001', buyer: 'Ana Carolina Silva', ticket: 'Ingresso VIP', event: 'Festival Sunset Evokaa 2026', gate: 'Portaria Principal A', time: 'Há 2 min' },
  { id: 'scan-002', buyer: 'Bruno Costa', ticket: 'Mesa Coletiva', event: 'Festival Sunset Evokaa 2026', gate: 'Entrada Setor VIP', time: 'Há 5 min' },
  { id: 'scan-003', buyer: 'Fernando Almeida', ticket: 'Ingresso Geral', event: 'Festival Sunset Evokaa 2026', gate: 'Portaria Principal B', time: 'Há 40 min' },
  { id: 'scan-004', buyer: 'Gabriela Lima', ticket: 'Ingresso Geral', event: 'Jazz & Blues Night', gate: 'Portaria Única', time: 'Há 1 hora' },
  { id: 'scan-005', buyer: 'Rodrigo Santos', ticket: 'Ingresso Geral', event: 'Jazz & Blues Night', gate: 'Portaria Única', time: 'Há 1.5 horas' },
]

// Attendance rate hourly pico (mock dataset)
const hourlyCheckInPeak = [
  { hour: '18:00', count: 45, percentage: 15 },
  { hour: '19:00', count: 120, percentage: 40 },
  { hour: '20:00', count: 300, percentage: 100 }, // Peak
  { hour: '21:00', count: 180, percentage: 60 },
  { hour: '22:00', count: 60, percentage: 20 },
]

export default function AdminTickets() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { data: allTickets = [], isLoading: isQueryLoading } = useAdminTickets()
  
  // Navigation sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'sales' | 'checkin' | 'refunds'>('overview')
  
  // States
  const [sales, setSales] = useState<SaleRecord[]>(initialRecentSales)
  const [refunds, setRefunds] = useState<RefundRequest[]>(initialRefundRequests)
  
  // Filters
  const [salesSearch, setSalesSearch] = useState('')
  const [salesFilterCheckin, setSalesFilterCheckin] = useState<'all' | 'entered' | 'waiting'>('all')

  // Action Handlers
  const handleResendEmail = (buyer: string, id: string) => {
    toast.success(`Ingresso (${id}) enviado com sucesso para o e-mail cadastrado de ${buyer}!`)
  }

  const handleRefundCortesia = (id: string, buyer: string, amount: number) => {
    const confirm = window.confirm(`Deseja realmente realizar um REEMBOLSO CORTESIA de R$ ${amount.toLocaleString('pt-BR')} para ${buyer}? O ingresso será imediatamente cancelado e invalidado.`)
    if (!confirm) return

    setSales(prev => prev.map(s => s.id === id ? { ...s, status: 'cancelled' as const } : s))
    toast.success(`Reembolso cortesia no valor de R$ ${amount.toLocaleString('pt-BR')} emitido e ingresso invalidado.`)
  }

  useEffect(() => {
    if (!isQueryLoading) {
      const ctx = gsap.context(() => {
        gsap.fromTo('.tk-anim', 
          { y: 15, opacity: 0 }, 
          { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
        )
      }, containerRef)
      return () => ctx.revert()
    }
  }, [isQueryLoading, activeSubTab])

  // Calculations
  const totalSold = allTickets.reduce((s, t) => s + (Number(t.sold) || 0), 0)
  const totalCapacity = allTickets.reduce((s, t) => s + (Number(t.capacity) || 0), 0)
  const totalRevenue = allTickets.reduce((s, t) => s + (Number(t.price) || 0) * (Number(t.sold) || 0), 0)
  const occupancy = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0
  
  // Check-in rates (Simulating global platform check-ins)
  const checkInEntered = sales.filter(s => s.checkInStatus === 'entered' && s.status === 'confirmed').length
  const checkInTotal = sales.filter(s => s.status === 'confirmed').length
  const attendanceRate = checkInTotal > 0 ? Math.round((checkInEntered / checkInTotal) * 100) : 72 // Média de 72%

  // Handle Approve Refund
  const handleApproveRefund = (id: string, buyer: string, amount: number) => {
    const confirm = window.confirm(`Deseja aprovar o reembolso de R$ ${amount.toLocaleString('pt-BR')} para ${buyer}? O valor será devolvido à conta original do cliente.`)
    if (!confirm) return

    setRefunds(prev => prev.map(r => r.id === id ? { ...r, status: 'refunded' } : r))
    
    // Atualizar no extrato de vendas (marcar como cancelado/reembolsado)
    setSales(prev => prev.map(s => s.buyer === buyer && s.amount === amount ? { ...s, status: 'cancelled' } : s))
    
    toast.success(`Reembolso de R$ ${amount.toLocaleString('pt-BR')} processado com sucesso!`)
  }

  // Handle Reject Refund
  const handleRejectRefund = (id: string, buyer: string) => {
    const confirm = window.confirm(`Deseja realmente recusar o pedido de reembolso de ${buyer}?`)
    if (!confirm) return

    setRefunds(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r))
    toast.success(`Pedido de reembolso de ${buyer} rejeitado.`)
  }

  // Filter Sales list
  const filteredSales = sales
    .filter(s => !salesSearch || s.buyer.toLowerCase().includes(salesSearch.toLowerCase()) || s.event.toLowerCase().includes(salesSearch.toLowerCase()))
    .filter(s => salesFilterCheckin === 'all' || s.checkInStatus === salesFilterCheckin)

  return (
    <div ref={containerRef} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Ingressos</h1>
          <p className="text-sm text-espresso/50 mt-1">Gestão de bilheteria geral, controle de check-in nos eventos e moderação de reembolsos.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap bg-white/60 p-1 border border-white/60 rounded-xl gap-1 sm:gap-0">
          <button 
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'overview' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" /> Bilheteria Geral
          </button>
          <button 
            onClick={() => setActiveSubTab('sales')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'sales' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Vendas & Emissões
          </button>
          <button 
            onClick={() => setActiveSubTab('checkin')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'checkin' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" /> Portaria / Check-in
          </button>
          <button 
            onClick={() => setActiveSubTab('refunds')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'refunds' 
                ? 'bg-plum text-cream shadow-md' 
                : 'text-espresso/60 hover:text-espresso'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Reembolsos ({refunds.filter(r => r.status === 'pending').length})
          </button>
        </div>
      </div>

      {isQueryLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-plum animate-spin" />
        </div>
      )}

      {!isQueryLoading && (
        <>
          {/* Main Ticket KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Vendido', value: totalSold.toLocaleString('pt-BR'), icon: Ticket, detail: `Taxa de ocupação: ${occupancy}%`, color: 'text-plum', bg: 'bg-plum/5' },
              { label: 'Check-in Realizado', value: `${checkInEntered}`, icon: QrCode, detail: `${attendanceRate}% de presença`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Receita de Bilheteria', value: `R$ ${totalRevenue.toLocaleString('pt-BR')}`, icon: BarChart3, detail: 'Volume total acumulado', color: 'text-rose-500', bg: 'bg-rose-50' },
              { label: 'Reembolsos Pendentes', value: `${refunds.filter(r => r.status === 'pending').length}`, icon: AlertTriangle, detail: 'Solicitações de suporte', color: 'text-amber-500', bg: 'bg-amber-50' },
            ].map(k => (
              <div key={k.label} className="tk-anim p-5 rounded-2xl bg-white/60 border border-white/60 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                  <span className="text-[9px] text-espresso/40 font-bold uppercase tracking-wider">{k.detail}</span>
                </div>
                <div>
                  <div className="font-serif text-2xl text-espresso">{k.value}</div>
                  <div className="text-[10px] text-espresso/40 mt-1 uppercase tracking-wider leading-none">{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          {activeSubTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Ticket types table (Left/Center Col) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="tk-anim bg-white/60 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-espresso/5 bg-white/40">
                    <h3 className="text-sm font-semibold text-espresso">Por Tipo de Ingresso e Demanda</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-espresso/5 bg-white/40">
                          <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Ingresso</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase hidden sm:table-cell">Evento</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase text-right">Preço</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase text-right">Vendidos</th>
                          <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase text-right hidden lg:table-cell">Receita</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-espresso/3">
                        {allTickets.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-xs text-espresso/30 italic">
                              Nenhum tipo de ingresso cadastrado na base de dados.
                            </td>
                          </tr>
                        ) : (
                          allTickets.map(t => {
                            const ticketRevenue = (Number(t.price) || 0) * (Number(t.sold) || 0)
                            return (
                              <tr key={t.id} className="hover:bg-white/40 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="text-xs font-bold text-espresso">{t.name}</div>
                                  <div className="text-[9px] text-espresso/40 uppercase font-semibold">{t.type}</div>
                                </td>
                                <td className="px-4 py-3 hidden sm:table-cell">
                                  <div className="text-xs text-espresso/50 line-clamp-1">{t.event_title}</div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="text-xs font-serif text-espresso font-semibold">R$ {t.price.toLocaleString('pt-BR')}</div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="text-xs text-espresso">
                                    <strong>{t.sold || 0}</strong> <span className="text-espresso/30">/ {t.capacity || '∞'}</span>
                                  </div>
                                  {/* Small bar indicator */}
                                  {t.capacity && (
                                    <div className="w-16 h-1 bg-canvas rounded-full ml-auto mt-1 overflow-hidden">
                                      <div className="h-full bg-plum rounded-full" style={{ width: `${Math.min(((t.sold || 0)/(t.capacity || 1))*100, 100)}%` }} />
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right hidden lg:table-cell">
                                  <div className="text-xs font-serif text-espresso font-bold">R$ {ticketRevenue.toLocaleString('pt-BR')}</div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Side Info Cards (Right Col) */}
              <div className="space-y-6">
                {/* Real-time Check-in occupancy overview */}
                <div className="tk-anim p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider">Status do Check-in Global</h3>
                  
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs text-espresso/60">Presença Confirmada nos Eventos</span>
                    <span className="text-xs font-bold text-plum">{attendanceRate}%</span>
                  </div>
                  <div className="w-full h-3 bg-canvas rounded-full overflow-hidden">
                    <div className="h-full bg-plum rounded-full" style={{ width: `${attendanceRate}%` }} />
                  </div>
                  <p className="text-[9px] text-espresso/40 leading-normal mt-2">
                    Percentual calculado com base no número de leituras de QR Code realizadas na entrada dos eventos ativados.
                  </p>
                </div>

                {/* Operations rules advisory */}
                <div className="tk-anim p-5 rounded-2xl border border-white bg-white/40 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> Políticas de Reembolso</h3>
                  <p className="text-[10px] text-espresso/60 leading-relaxed">
                    De acordo com as regras de compliance e o Código de Defesa do Consumidor, o reembolso integral é garantido para cancelamentos solicitados até 7 dias após a compra, desde que ocorra até 48 horas antes do evento.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'sales' && (
            <div className="tk-anim bg-white/60 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
              {/* Sales Search Bar */}
              <div className="p-4 border-b border-espresso/5 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/40">
                <div className="relative w-full md:max-w-xs">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-espresso/30" />
                  <input 
                    type="text"
                    placeholder="Buscar por comprador ou evento..."
                    value={salesSearch}
                    onChange={e => setSalesSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-espresso/10 rounded-xl text-xs focus:outline-none focus:border-plum text-espresso placeholder:text-espresso/30"
                  />
                </div>
                
                <div className="flex gap-2 w-full md:w-auto justify-end">
                  <select 
                    value={salesFilterCheckin}
                    onChange={e => setSalesFilterCheckin(e.target.value as any)}
                    className="px-3 py-1.5 bg-white border border-espresso/10 rounded-xl text-xs text-espresso/60 focus:outline-none"
                  >
                    <option value="all">Todos Status de Entrada</option>
                    <option value="entered">Check-in Concluído (Entrou)</option>
                    <option value="waiting">Aguardando Entrada</option>
                  </select>
                </div>
              </div>

              {/* Sales Table list */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-espresso/5 bg-white/40">
                      <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Código</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Comprador</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Ingresso / Evento</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase hidden sm:table-cell">Entrada / Check-in</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase text-right">Valor</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-espresso/3">
                    {filteredSales.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-xs text-espresso/30 italic">
                          Nenhum registro de venda encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredSales.map(sale => {
                        const sc = statusCfg[sale.status] || statusCfg.confirmed
                        return (
                          <tr key={sale.id} className="hover:bg-white/40 transition-colors">
                            <td className="px-4 py-3 font-mono text-[10px] text-espresso/50">{sale.id}</td>
                            <td className="px-4 py-3">
                              <div className="text-xs font-bold text-espresso">{sale.buyer}</div>
                              <div className="text-[10px] text-espresso/30">{sale.time}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs font-semibold text-espresso">{sale.ticket}</div>
                              <div className="text-[10px] text-espresso/40">{sale.event}</div>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              {sale.status === 'confirmed' ? (
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${sale.checkInStatus === 'entered' ? 'bg-green-500' : 'bg-amber-400'}`} />
                                  <span className="text-xs text-espresso/70">
                                    {sale.checkInStatus === 'entered' ? `Entrou às ${sale.checkInTime}` : 'Aguardando na portaria'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-red-500 font-bold uppercase">Cancelado</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="text-xs font-bold text-espresso">R$ {sale.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                              <span className={`text-[9px] px-1.5 py-0.25 rounded-full border ${sc.cls} inline-block mt-0.5`}>{sc.label}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {sale.status === 'confirmed' && (
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    onClick={() => handleResendEmail(sale.buyer, sale.id)}
                                    className="p-1.5 bg-plum/10 hover:bg-plum/20 text-plum rounded-lg transition-colors"
                                    title="Reenviar Ingresso por E-mail"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRefundCortesia(sale.id, sale.buyer, sale.amount)}
                                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-lg transition-colors"
                                    title="Emitir Reembolso Cortesia"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
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

          {activeSubTab === 'refunds' && (
            <div className="tk-anim bg-white/60 border border-white/60 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-espresso/5 bg-white/40">
                <h3 className="text-sm font-semibold text-espresso">Solicitações de Reembolso</h3>
                <p className="text-[10px] text-espresso/40">Analise os motivos alegados pelos compradores e aprove ou recuse a devolução do dinheiro.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-espresso/5 bg-white/40">
                      <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Comprador</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Ingresso / Evento</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase hidden sm:table-cell">Motivo Reivindicado</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase">Status</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-espresso/40 uppercase text-right">Valor</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-espresso/3">
                    {refunds.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-xs text-espresso/30 italic">
                          Nenhuma solicitação de reembolso ativa.
                        </td>
                      </tr>
                    ) : (
                      refunds.map(r => (
                        <tr key={r.id} className="hover:bg-white/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-xs font-bold text-espresso">{r.buyer}</div>
                            <div className="text-[10px] text-espresso/30">{r.time}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-semibold text-espresso">{r.ticket}</div>
                            <div className="text-[10px] text-espresso/40">{r.event}</div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <p className="text-xs text-espresso/50 italic max-w-xs truncate" title={r.reason}>"{r.reason}"</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                              r.status === 'pending'
                                ? 'bg-amber-50 text-amber-600 border-amber-100'
                                : r.status === 'refunded'
                                ? 'bg-green-50 text-green-600 border-green-100'
                                : 'bg-red-50 text-red-500 border-red-100'
                            }`}>
                              {r.status === 'pending' ? 'Pendente' : r.status === 'refunded' ? 'Reembolsado' : 'Rejeitado'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-serif text-sm font-bold text-espresso">
                            R$ {r.amount.toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {r.status === 'pending' && (
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => handleApproveRefund(r.id, r.buyer, r.amount)}
                                  className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded-lg transition-colors"
                                  title="Aprovar Reembolso"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRejectRefund(r.id, r.buyer)}
                                  className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-lg transition-colors"
                                  title="Negar Reembolso"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
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

          {activeSubTab === 'checkin' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 tk-anim animate-fadeIn">
              {/* Gráficos de Pico e Métricas de Checkin */}
              <div className="lg:col-span-2 space-y-6">
                {/* Horário de Pico */}
                <div className="p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-sm font-semibold text-espresso">Fluxo de Entrada / Horários de Pico</h3>
                      <p className="text-[10px] text-espresso/40">Detalhamento por faixa horária de leituras de QR Codes válidas na portaria.</p>
                    </div>
                    <div className="text-xs font-bold text-plum bg-plum/5 border border-plum/10 px-2.5 py-1 rounded-lg">
                      Leituras Realizadas
                    </div>
                  </div>

                  <div className="flex items-end gap-3 h-36 pt-4">
                    {hourlyCheckInPeak.map(item => (
                      <div key={item.hour} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <div className="text-[9px] font-bold text-plum opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.count} check-ins
                        </div>
                        <div className="w-full bg-plum/5 rounded-t-lg relative" style={{ height: '70%' }}>
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-plum rounded-t-lg transition-all" 
                            style={{ height: `${item.percentage}%` }}
                          />
                        </div>
                        <span className="text-[9.5px] font-semibold text-espresso/40">{item.hour}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Histórico recente de leituras */}
                <div className="p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-sm font-semibold text-espresso">Feed de Leituras em Tempo Real</h3>
                      <p className="text-[10px] text-espresso/40">Últimos ingressos validados pelos scanners dos portões dos eventos.</p>
                    </div>
                    <span className="flex items-center gap-1.5 text-[9px] bg-green-50 text-green-600 font-bold px-2 py-0.5 border border-green-100 rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" /> Scanners Conectados
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {recentCheckIns.map((scan) => (
                      <div key={scan.id} className="flex items-start justify-between border-b border-espresso/5 pb-3 last:border-0 last:pb-0">
                        <div className="flex gap-3">
                          <div className="p-2 bg-green-50 text-green-600 rounded-lg border border-green-100">
                            <QrCode className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-espresso">{scan.buyer}</div>
                            <div className="text-[10px] text-espresso/40 font-semibold">{scan.event} • <span className="text-plum font-bold">{scan.ticket}</span></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] text-espresso/40 font-bold uppercase">{scan.gate}</div>
                          <div className="text-[9px] text-espresso/30 mt-0.5">{scan.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Informações Auxiliares do Check-in (No-Show) */}
              <div className="space-y-6">
                {/* No-show KPI Card */}
                <div className="p-6 rounded-2xl bg-white/60 border border-white/60 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider">No-Show Geral (Ausência)</h3>
                  
                  <div className="flex justify-between items-baseline">
                    <span className="font-serif text-3xl text-rose-500 font-bold">{100 - attendanceRate}%</span>
                    <span className="text-[10px] text-espresso/40 font-semibold font-bold">Taxa de Não Comparecimento</span>
                  </div>
                  <p className="text-[10px] text-espresso/60 leading-normal leading-relaxed font-semibold">
                    Dos ingressos emitidos e confirmados para os eventos deste mês, **{100 - attendanceRate}%** dos compradores não compareceram ou não tiveram seu QR Code escaneado na entrada.
                  </p>
                  <div className="pt-2">
                    <div className="flex justify-between text-[9px] font-bold text-espresso/40 uppercase mb-1">
                      <span>Presença ({attendanceRate}%)</span>
                      <span>No-Show ({100 - attendanceRate}%)</span>
                    </div>
                    <div className="w-full h-2 bg-canvas rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${attendanceRate}%` }} />
                      <div className="h-full bg-rose-500" style={{ width: `${100 - attendanceRate}%` }} />
                    </div>
                  </div>
                </div>

                {/* Gate policy and warning */}
                <div className="p-5 rounded-2xl border border-white bg-white/40 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-espresso/50 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Suporte à Portaria
                  </h3>
                  <p className="text-[10px] text-espresso/60 leading-relaxed font-semibold">
                    Caso um participante apresente problemas de leitura do QR Code impresso ou no celular, verifique seu status de emissão na aba **Vendas & Emissões** e utilize a busca rápida pelo e-mail ou nome para validar a presença.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
