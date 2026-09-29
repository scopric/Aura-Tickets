import { useState, useEffect, useRef } from 'react'
import { 
  Ticket, QrCode, Users, 
  Loader2, Search, AlertTriangle, AlertCircle
} from 'lucide-react'
import gsap from 'gsap'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAdminTickets } from '../../hooks/useEvents'

interface RealTicket {
  id: string
  ticket_type_id: string
  event_id: string
  buyer_name: string | null
  buyer_email: string | null
  status: string
  checked_in_at: string | null
  created_at: string
  events?: { title: string } | null
  ticket_types?: { name: string } | null
}

interface RealCheckIn {
  id: string
  event_id: string
  ticket_id: string
  user_id: string | null
  checked_in_at: string
  events?: { title: string } | null
  tickets?: {
    buyer_name: string | null
    buyer_email: string | null
    ticket_types?: { name: string } | null
  } | null
}

export default function AdminTickets() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { data: allTicketTypes = [], isLoading: isLoadingTypes } = useAdminTickets()
  
  // Navigation sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'sales' | 'checkin' | 'refunds'>('overview')
  
  // Filters
  const [salesSearch, setSalesSearch] = useState('')
  const [salesFilterStatus, setSalesFilterStatus] = useState<string>('all')

  // Real tickets query
  const { data: realTickets = [], isLoading: isLoadingTickets, isError: isErrorTickets, error: errorTickets } = useQuery<RealTicket[]>({
    queryKey: ['admin-tickets-real'],
    queryFn: async () => {
      // sem CPF/QR/preço: são dado sensível ou credencial de entrada e a tela não os exibe
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id, ticket_type_id, event_id, buyer_name, buyer_email,
          status, checked_in_at, created_at,
          events (title),
          ticket_types (name)
        `)
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      return (data || []) as RealTicket[]
    }
  })

  // Real check-ins query
  const { data: realCheckIns = [], isLoading: isLoadingCheckIns, isError: isErrorCheckIns, error: errorCheckIns } = useQuery<RealCheckIn[]>({
    queryKey: ['admin-checkins-real'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('check_ins')
        .select(`
          id, event_id, ticket_id, user_id, checked_in_at,
          events (title),
          tickets (buyer_name, buyer_email, ticket_types (name))
        `)
        .order('checked_in_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      return (data || []) as RealCheckIn[]
    }
  })

  const isLoading = isLoadingTypes || isLoadingTickets || isLoadingCheckIns
  const isErrorReal = isErrorTickets || isErrorCheckIns
  const errorReal = errorTickets || errorCheckIns

  useEffect(() => {
    if (!isLoading) {
      const ctx = gsap.context(() => {
        gsap.fromTo('.tk-anim', 
          { y: 15, opacity: 0 }, 
          { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
        )
      }, containerRef)
      return () => ctx.revert()
    }
  }, [isLoading, activeSubTab])

  // Calculations com dados reais
  const totalSold = allTicketTypes.reduce((s, t) => s + (Number(t.sold) || 0), 0)
  const totalCapacity = allTicketTypes.reduce((s, t) => s + (Number(t.capacity) || 0), 0)
  // totalRevenue calculado sob demanda quando houver gateway de pagamento real
  const occupancy = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0
  
  // um check-in pode existir nas duas fontes (ticket com checked_in_at/'used' e a linha em check_ins);
  // contar por ticket_id distinto entre as duas evita contar o mesmo check-in duas vezes
  const checkedInTicketIds = new Set([
    ...realTickets.filter(t => t.checked_in_at || t.status === 'used').map(t => t.id),
    ...realCheckIns.map(c => c.ticket_id),
  ])
  const checkedInCount = checkedInTicketIds.size
  const refundedTickets = realTickets.filter(t => t.status === 'cancelled' || t.status === 'refunded')

  // Filter Sales list
  const filteredTickets = realTickets
    .filter(t => {
      const q = salesSearch.toLowerCase()
      if (!q) return true
      return (
        t.buyer_name?.toLowerCase().includes(q) ||
        t.buyer_email?.toLowerCase().includes(q) ||
        t.events?.title?.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      )
    })
    .filter(t => salesFilterStatus === 'all' || t.status === salesFilterStatus)

  return (
    <div ref={containerRef} className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Ingressos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de bilheteria geral, controle de check-in nos eventos e moderação de ingressos.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap bg-card p-1 border border-border rounded-xl gap-1">
          <button 
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'overview' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" /> Bilheteria Geral
          </button>
          <button 
            onClick={() => setActiveSubTab('sales')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'sales' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Ingressos Emitidos ({realTickets.length})
          </button>
          <button 
            onClick={() => setActiveSubTab('checkin')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'checkin' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" /> Portaria / Check-in ({realCheckIns.length})
          </button>
          <button 
            onClick={() => setActiveSubTab('refunds')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'refunds' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Cancelados ({refundedTickets.length})
          </button>
        </div>
      </div>

      {/* Aviso de modo de teste */}
      <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold">Bilheteria e Ingressos:</span> Ingressos reais são emitidos automaticamente pelos webhooks de confirmação de pagamento. Emissões manuais e reembolsos bancários automatizados estão desabilitados até a ativação dos gateways na Fase 4.
        </div>
      </div>

      {isErrorReal && (
        <div role="alert" className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700">
          Não foi possível carregar ingressos/check-ins: {(errorReal as Error)?.message || 'erro desconhecido'}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Main Ticket KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Tipos de Ingressos', value: allTicketTypes.length.toString(), icon: Ticket, detail: `Ocupação: ${occupancy}%`, color: 'text-primary' },
              { label: 'Ingressos Emitidos', value: realTickets.length.toString(), icon: Users, detail: `${realTickets.filter(t => t.status === 'active').length} ativos`, color: 'text-emerald-600' },
              { label: 'Check-ins Realizados', value: checkedInCount.toString(), icon: QrCode, detail: `${realCheckIns.length} na portaria`, color: 'text-blue-600' },
              { label: 'Ingressos Cancelados', value: refundedTickets.length.toString(), icon: AlertTriangle, detail: `${refundedTickets.length} cancelados`, color: 'text-amber-600' },
            ].map(k => (
              <div key={k.label} className="tk-anim p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{k.detail}</span>
                </div>
                <div>
                  <div className="font-serif text-2xl text-foreground">{k.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider leading-none">{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          {activeSubTab === 'overview' && (
            <div className="space-y-6">
              <div className="tk-anim bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border bg-muted/20">
                  <h3 className="text-sm font-semibold text-foreground">Tipos de Ingressos Cadastrados</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Configuração de lotes, valores e capacidades por evento.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Ingresso</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase hidden sm:table-cell">Evento</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase text-right">Preço</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase text-right">Vendidos</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase text-right hidden lg:table-cell">Capacidade</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {allTicketTypes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-16 text-center text-xs text-muted-foreground italic">
                            Nenhum tipo de ingresso cadastrado em eventos da plataforma.
                          </td>
                        </tr>
                      ) : (
                        allTicketTypes.map(t => (
                          <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                            <td className="px-4 py-3">
                              <div className="text-xs font-semibold text-foreground">{t.name}</div>
                              <div className="text-[11px] text-muted-foreground sm:hidden">{t.event_title}</div>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{t.event_title}</td>
                            <td className="px-4 py-3 text-right text-xs font-semibold text-foreground">
                              {Number(t.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-semibold text-primary">{t.sold || 0}</td>
                            <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">{t.capacity || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                t.is_active
                                  ? 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}>
                                {t.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'sales' && (
            <div className="tk-anim bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/20">
                <div className="relative w-full md:max-w-xs">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    type="text"
                    placeholder="Buscar por comprador, evento ou código..."
                    value={salesSearch}
                    onChange={e => setSalesSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
                  />
                </div>
                
                <div className="flex gap-2 w-full md:w-auto justify-end">
                  <select 
                    value={salesFilterStatus}
                    onChange={e => setSalesFilterStatus(e.target.value)}
                    className="px-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="active">Ativos</option>
                    <option value="used">Utilizados (Check-in)</option>
                    <option value="cancelled">Cancelados</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">ID / Código</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Comprador</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase hidden sm:table-cell">Evento / Lote</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Status</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Data</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-16 text-center text-xs text-muted-foreground italic">
                          {realTickets.length === 0 ? 'Nenhum ingresso emitido na plataforma até o momento.' : 'Nenhum ingresso encontrado para os filtros selecionados.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map(tk => (
                        <tr key={tk.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{tk.id.slice(0, 8)}</td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-semibold text-foreground">{tk.buyer_name || 'Participante'}</div>
                            <div className="text-[11px] text-muted-foreground">{tk.buyer_email || '—'}</div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <div className="text-xs text-foreground">{tk.events?.title || 'Evento'}</div>
                            <div className="text-[11px] text-muted-foreground">{tk.ticket_types?.name || 'Ingresso'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                              tk.status === 'active'
                                ? 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20'
                                : tk.status === 'used'
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                                : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                            }`}>
                              {tk.status === 'active' ? 'Ativo' : tk.status === 'used' ? 'Utilizado' : 'Cancelado'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(tk.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              disabled
                              className="px-2.5 py-1 text-[11px] font-medium bg-muted text-muted-foreground rounded-lg opacity-60 cursor-not-allowed border border-border"
                              title="Reenvio de ingressos e reembolsos manuais desabilitados em modo de teste até a Fase 4"
                            >
                              Modo Teste
                            </button>
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
            <div className="tk-anim bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border bg-muted/20">
                <h3 className="text-sm font-semibold text-foreground">Registro de Check-in em Portaria</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Leituras de QR code validadas pelos scanners na entrada dos eventos.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Ingresso ID</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Participante</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Evento</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Horário do Check-in</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {realCheckIns.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-16 text-center text-xs text-muted-foreground italic">
                          Nenhum check-in registrado na portaria até o momento.
                        </td>
                      </tr>
                    ) : (
                      realCheckIns.map(ci => (
                        <tr key={ci.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{ci.ticket_id.slice(0, 8)}</td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-semibold text-foreground">{ci.tickets?.buyer_name || 'Participante'}</div>
                            <div className="text-[11px] text-muted-foreground">{ci.tickets?.buyer_email || '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground">{ci.events?.title || 'Evento'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(ci.checked_in_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === 'refunds' && (
            <div className="tk-anim bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border bg-muted/20">
                <h3 className="text-sm font-semibold text-foreground">Ingressos Cancelados ou Reembolsados</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Auditoria de ingressos que foram cancelados ou invalidados.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Código</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Comprador</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Evento</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Data</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {refundedTickets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-16 text-center text-xs text-muted-foreground italic">
                          Nenhum ingresso cancelado ou reembolsado registrado.
                        </td>
                      </tr>
                    ) : (
                      refundedTickets.map(rf => (
                        <tr key={rf.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{rf.id.slice(0, 8)}</td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-semibold text-foreground">{rf.buyer_name || 'Participante'}</div>
                            <div className="text-[11px] text-muted-foreground">{rf.buyer_email || '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground">{rf.events?.title || 'Evento'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(rf.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20">
                              {rf.status === 'refunded' ? 'Reembolsado' : 'Cancelado'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
