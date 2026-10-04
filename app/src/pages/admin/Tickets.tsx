import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as I from '@/components/icones/evokaa16'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState, PageHeader, Stat, selectNativo, chipErro, chipInfo, chipNeutro, chipOk } from '@/components/producer/ui'
import { Tabela, alertaAviso, alertaErro, painel, th } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
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

  const abas = [
    { id: 'overview', icon: I.Ingressos, label: 'Bilheteria Geral' },
    { id: 'sales', icon: I.Pessoas, label: `Ingressos Emitidos (${realTickets.length})` },
    { id: 'checkin', icon: I.Qr, label: `Portaria / Check-in (${realCheckIns.length})` },
    { id: 'refunds', icon: I.Alerta, label: `Cancelados (${refundedTickets.length})` },
  ] as const

  // Cartão com cabeçalho (título e explicação) e a tabela ou o estado vazio por baixo
  const cabecalho = (titulo: string, descricao: string) => (
    <div className="border-b border-border bg-secondary/50 p-4">
      <h3 className="text-[15px] font-semibold leading-5 text-foreground">{titulo}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
    </div>
  )
  const vazio = (titulo: string) => <div className="p-4"><EmptyState title={titulo} /></div>

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <PageHeader
        title="Ingressos"
        description="Gestão de bilheteria geral, controle de check-in nos eventos e moderação de ingressos."
        actions={
          <div className="flex flex-wrap gap-1 rounded-ev-lg bg-secondary p-0.5">
            {abas.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveSubTab(a.id)}
                aria-pressed={activeSubTab === a.id}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-ev-md px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4',
                  activeSubTab === a.id ? 'bg-card text-foreground shadow-ev-seg' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <a.icon aria-hidden="true" /> {a.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Aviso de modo de teste */}
      <div className={cn(alertaAviso, 'mb-6 p-4 text-[13px]')}>
        <I.Info size={16} className="text-[var(--ev-warning)]" aria-hidden="true" />
        <div>
          <span className="font-semibold">Bilheteria e Ingressos:</span> Ingressos reais são emitidos automaticamente pelos webhooks de confirmação de pagamento. Emissões manuais e reembolsos bancários automatizados estão desabilitados até a ativação dos gateways na Fase 4.
        </div>
      </div>

      {isErrorReal && (
        <div role="alert" className={cn(alertaErro, 'mb-6')}>
          Não foi possível carregar ingressos/check-ins: {(errorReal as Error)?.message || 'erro desconhecido'}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : (
        <>
          {/* Main Ticket KPIs */}
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Tipos de Ingressos" value={allTicketTypes.length.toString()} hint={`Ocupação: ${occupancy}%`} />
            <Stat label="Ingressos Emitidos" value={realTickets.length.toString()} hint={`${realTickets.filter(t => t.status === 'active').length} ativos`} />
            <Stat label="Check-ins Realizados" value={checkedInCount.toString()} hint={`${realCheckIns.length} na portaria`} />
            <Stat label="Ingressos Cancelados" value={refundedTickets.length.toString()} hint={`${refundedTickets.length} cancelados`} />
          </div>

          {activeSubTab === 'overview' && (
            <div className={`${painel} overflow-hidden`}>
              {cabecalho('Tipos de Ingressos Cadastrados', 'Configuração de lotes, valores e capacidades por evento.')}
              {allTicketTypes.length === 0 ? vazio('Nenhum tipo de ingresso cadastrado em eventos da plataforma.') : (
                <Tabela label="Tipos de ingressos cadastrados">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={th}>Ingresso</th>
                      <th className={cn(th, 'hidden sm:table-cell')}>Evento</th>
                      <th className={cn(th, 'text-right')}>Preço</th>
                      <th className={cn(th, 'text-right')}>Vendidos</th>
                      <th className={cn(th, 'hidden text-right lg:table-cell')}>Capacidade</th>
                      <th className={cn(th, 'text-center')}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allTicketTypes.map(t => (
                      <tr key={t.id} className="hover:bg-[var(--ev-tint-hover)]">
                        <td className="px-4 py-3">
                          <div className="text-[13px] font-semibold text-foreground">{t.name}</div>
                          <div className="text-xs text-muted-foreground sm:hidden">{t.event_title}</div>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{t.event_title}</td>
                        <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-foreground">
                          {Number(t.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-primary">{t.sold || 0}</td>
                        <td className="hidden px-4 py-3 text-right text-xs tabular-nums text-muted-foreground lg:table-cell">{t.capacity || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="secondary" className={t.is_active ? chipOk : chipNeutro}>{t.is_active ? 'Ativo' : 'Inativo'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
            </div>
          )}

          {activeSubTab === 'sales' && (
            <div className={`${painel} overflow-hidden`}>
              <div className="flex flex-col items-stretch justify-between gap-3 border-b border-border bg-secondary/50 p-4 md:flex-row md:items-center">
                <div className="relative w-full md:max-w-xs">
                  <I.Buscar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="text"
                    placeholder="Buscar por comprador, evento ou código..."
                    aria-label="Buscar ingresso"
                    value={salesSearch}
                    onChange={e => setSalesSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <select
                  value={salesFilterStatus}
                  onChange={e => setSalesFilterStatus(e.target.value)}
                  aria-label="Filtrar por status"
                  className={cn(selectNativo, 'md:w-auto')}
                >
                  <option value="all">Todos os Status</option>
                  <option value="active">Ativos</option>
                  <option value="used">Utilizados (Check-in)</option>
                  <option value="cancelled">Cancelados</option>
                </select>
              </div>

              {filteredTickets.length === 0 ? vazio(realTickets.length === 0 ? 'Nenhum ingresso emitido na plataforma até o momento.' : 'Nenhum ingresso encontrado para os filtros selecionados.') : (
                <Tabela label="Ingressos emitidos">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={th}>ID / Código</th>
                      <th className={th}>Comprador</th>
                      <th className={cn(th, 'hidden sm:table-cell')}>Evento / Lote</th>
                      <th className={th}>Status</th>
                      <th className={th}>Data</th>
                      <th className={cn(th, 'text-right')}>Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTickets.map(tk => (
                      <tr key={tk.id} className="hover:bg-[var(--ev-tint-hover)]">
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{tk.id.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <div className="text-[13px] font-semibold text-foreground">{tk.buyer_name || 'Participante'}</div>
                          <div className="text-xs text-muted-foreground">{tk.buyer_email || '—'}</div>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <div className="text-xs text-foreground">{tk.events?.title || 'Evento'}</div>
                          <div className="text-xs text-muted-foreground">{tk.ticket_types?.name || 'Ingresso'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={tk.status === 'active' ? chipOk : tk.status === 'used' ? chipInfo : chipErro}>
                            {tk.status === 'active' ? 'Ativo' : tk.status === 'used' ? 'Utilizado' : 'Cancelado'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">{new Date(tk.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="secondary" className={chipNeutro} title="Reenvio de ingressos e reembolsos manuais desabilitados em modo de teste até a Fase 4">Modo Teste</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
            </div>
          )}

          {activeSubTab === 'checkin' && (
            <div className={`${painel} overflow-hidden`}>
              {cabecalho('Registro de Check-in em Portaria', 'Leituras de QR code validadas pelos scanners na entrada dos eventos.')}
              {realCheckIns.length === 0 ? vazio('Nenhum check-in registrado na portaria até o momento.') : (
                <Tabela label="Check-ins na portaria">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={th}>Ingresso ID</th>
                      <th className={th}>Participante</th>
                      <th className={th}>Evento</th>
                      <th className={th}>Horário do Check-in</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {realCheckIns.map(ci => (
                      <tr key={ci.id} className="hover:bg-[var(--ev-tint-hover)]">
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{ci.ticket_id.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <div className="text-[13px] font-semibold text-foreground">{ci.tickets?.buyer_name || 'Participante'}</div>
                          <div className="text-xs text-muted-foreground">{ci.tickets?.buyer_email || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground">{ci.events?.title || 'Evento'}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                          {new Date(ci.checked_in_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
            </div>
          )}

          {activeSubTab === 'refunds' && (
            <div className={`${painel} overflow-hidden`}>
              {cabecalho('Ingressos Cancelados ou Reembolsados', 'Auditoria de ingressos que foram cancelados ou invalidados.')}
              {refundedTickets.length === 0 ? vazio('Nenhum ingresso cancelado ou reembolsado registrado.') : (
                <Tabela label="Ingressos cancelados ou reembolsados">
                  <thead>
                    <tr className="border-b border-border">
                      <th className={th}>Código</th>
                      <th className={th}>Comprador</th>
                      <th className={th}>Evento</th>
                      <th className={th}>Data</th>
                      <th className={cn(th, 'text-center')}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {refundedTickets.map(rf => (
                      <tr key={rf.id} className="hover:bg-[var(--ev-tint-hover)]">
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{rf.id.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <div className="text-[13px] font-semibold text-foreground">{rf.buyer_name || 'Participante'}</div>
                          <div className="text-xs text-muted-foreground">{rf.buyer_email || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground">{rf.events?.title || 'Evento'}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">{new Date(rf.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="secondary" className={chipErro}>{rf.status === 'refunded' ? 'Reembolsado' : 'Cancelado'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
