import { useState, useEffect, useRef } from 'react'
import {
  ScanLine, CheckCircle2, XCircle, Clock, Users,
  Search, Ticket, AlertTriangle, Zap, ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useProducerEvents } from '../../hooks/useEvents'

interface TicketCheck {
  id: string
  name: string
  email: string
  ticketType: string
  ticketCode: string
  status: 'pendente' | 'usado' | 'cancelado'
  checkInTime: string | null
  seat: string
  avatar: string
  eventName: string
}

export default function ProducerCheckIn() {
  const { user } = useAuth()
  const { data: events, isLoading: isEventsLoading } = useProducerEvents()
  
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [tickets, setTickets] = useState<TicketCheck[]>([])
  const [isLoadingTickets, setIsLoadingTickets] = useState(false)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'scanner' | 'list'>('scanner')
  const [lastScan, setLastScan] = useState<{ ticket: TicketCheck; success: boolean; message: string } | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)

  // Mapear eventos ativos
  const activeEvents = events?.filter(e => e.status === 'published') || []

  // Selecionar o primeiro evento automaticamente ao carregar
  useEffect(() => {
    if (activeEvents.length > 0 && !selectedEventId) {
      setSelectedEventId(activeEvents[0].id)
    }
  }, [activeEvents, selectedEventId])

  // Mapear dados do banco de dados para o layout do frontend
  const mapDbTicketToTicketCheck = (dbTicket: any): TicketCheck => {
    let checkStatus: TicketCheck['status'] = 'pendente'
    if (dbTicket.status === 'used') {
      checkStatus = 'usado'
    } else if (dbTicket.status === 'cancelled' || dbTicket.status === 'refunded') {
      checkStatus = 'cancelado'
    }

    return {
      id: dbTicket.id,
      name: dbTicket.buyer_name || 'Participante',
      email: dbTicket.buyer_email || '',
      ticketType: dbTicket.ticket_types?.name || 'Ingresso Comum',
      ticketCode: dbTicket.qr_code,
      status: checkStatus,
      checkInTime: dbTicket.checked_in_at
        ? new Date(dbTicket.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : null,
      seat: '-',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${dbTicket.buyer_name || 'U'}`,
      eventName: dbTicket.events?.title || 'Evento'
    }
  }

  // Carregar ingressos do evento selecionado
  const loadTickets = async (eventId: string) => {
    if (!eventId) return
    setIsLoadingTickets(true)
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          ticket_types (name),
          events (title)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        // Se o evento não tem ingressos comprados no banco, realizamos auto-seed para teste rápido
        await seedInitialTickets(eventId)
        return
      }

      setTickets(data.map(mapDbTicketToTicketCheck))
    } catch (err: any) {
      console.error('Erro ao carregar ingressos:', err)
      toast.error('Erro ao carregar ingressos da portaria')
    } finally {
      setIsLoadingTickets(false)
    }
  }

  // Realizar auto-seed de ingressos para eventos novos para que o produtor possa testar
  const seedInitialTickets = async (eventId: string) => {
    try {
      // 1. Obter ou criar um tipo de ingresso do evento para vincular
      const { data: ticketTypes, error: typeError } = await supabase
        .from('ticket_types')
        .select('id, name')
        .eq('event_id', eventId)

      if (typeError) throw typeError

      let typeId = ''
      if (ticketTypes && ticketTypes.length > 0) {
        typeId = ticketTypes[0].id
      } else {
        // Criar tipo de ingresso padrão se não houver
        const { data: newType, error: createTypeError } = await supabase
          .from('ticket_types')
          .insert({
            event_id: eventId,
            name: 'Pista Geral',
            price: 50.00,
            capacity: 500,
            sold: 0,
            type: 'individual',
            lot_number: 1,
            is_active: true
          })
          .select()
          .single()

        if (createTypeError) throw createTypeError
        typeId = newType.id
      }

      // 2. Inserir ingressos de teste
      const testTickets = [
        { event_id: eventId, ticket_type_id: typeId, user_id: user?.id || eventId, buyer_name: 'Ana Costa', buyer_email: 'ana@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-001`, status: 'active' },
        { event_id: eventId, ticket_type_id: typeId, user_id: user?.id || eventId, buyer_name: 'Pedro Lima', buyer_email: 'pedro@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-002`, status: 'used', checked_in_at: new Date(Date.now() - 3600000).toISOString() },
        { event_id: eventId, ticket_type_id: typeId, user_id: user?.id || eventId, buyer_name: 'Maria Souza', buyer_email: 'maria@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-003`, status: 'active' },
        { event_id: eventId, ticket_type_id: typeId, user_id: user?.id || eventId, buyer_name: 'João Silva', buyer_email: 'joao@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-004`, status: 'used', checked_in_at: new Date(Date.now() - 7200000).toISOString() },
        { event_id: eventId, ticket_type_id: typeId, user_id: user?.id || eventId, buyer_name: 'Fernanda Rocha', buyer_email: 'fernanda@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-005`, status: 'active' },
        { event_id: eventId, ticket_type_id: typeId, user_id: user?.id || eventId, buyer_name: 'Lucas Oliveira', buyer_email: 'lucas@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-006`, status: 'cancelled' }
      ]

      const { error: insertError } = await supabase
        .from('tickets')
        .insert(testTickets)

      if (insertError) throw insertError

      // Recarregar
      const { data: finalTickets } = await supabase
        .from('tickets')
        .select(`
          *,
          ticket_types (name),
          events (title)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (finalTickets) {
        setTickets(finalTickets.map(mapDbTicketToTicketCheck))
      }
    } catch (err) {
      console.error('Erro no auto-seed de ingressos:', err)
    }
  }

  useEffect(() => {
    if (selectedEventId) {
      loadTickets(selectedEventId)
    }
  }, [selectedEventId])

  const total = tickets.length
  const checked = tickets.filter(t => t.status === 'usado').length
  const pending = tickets.filter(t => t.status === 'pendente').length
  const cancelled = tickets.filter(t => t.status === 'cancelado').length
  const progress = total > 0 ? (checked / total) * 100 : 0

  const filtered = tickets.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.ticketCode.toLowerCase().includes(search.toLowerCase())
  )

  // Escanear/validar ingresso na Edge Function
  const handleScan = async (code: string) => {
    if (!code.trim() || !selectedEventId) return

    try {
      // Chamar a Edge Function check-in-validate
      const { data, error } = await supabase.functions.invoke('check-in-validate', {
        body: {
          qrCode: code.trim(),
          eventId: selectedEventId,
          operatorId: user?.id
        }
      })

      if (error) throw error

      // Mapear o resultado do scan
      if (data.valid) {
        toast.success(data.message || 'Check-in realizado com sucesso!')
        
        // Atualizar lista local
        setTickets(prev => prev.map(t => 
          t.ticketCode === code.trim() 
            ? { ...t, status: 'usado', checkInTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } 
            : t
        ))

        const updatedTicket = tickets.find(t => t.ticketCode === code.trim()) || {
          id: '',
          name: data.buyerName,
          email: '',
          ticketType: data.ticketType,
          ticketCode: code.trim(),
          status: 'usado' as const,
          checkInTime: 'Agora',
          seat: '-',
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${data.buyerName}`,
          eventName: activeEvents.find(e => e.id === selectedEventId)?.title || 'Evento'
        }

        setLastScan({
          ticket: { ...updatedTicket, status: 'usado', checkInTime: 'Agora' },
          success: true,
          message: data.message
        })
      } else {
        // Encontrou o ingresso mas é inválido (ex: já usado ou cancelado)
        toast.warning(data.message)
        
        const existingTicket = tickets.find(t => t.ticketCode === code.trim()) || {
          id: '',
          name: data.buyerName || 'Ingresso Inválido',
          email: '',
          ticketType: '',
          ticketCode: code.trim(),
          status: 'cancelado' as const,
          checkInTime: data.checkedInAt ? new Date(data.checkedInAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null,
          seat: '-',
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${data.buyerName || 'X'}`,
          eventName: ''
        }

        setLastScan({
          ticket: existingTicket,
          success: false,
          message: data.message
        })
      }
    } catch (err: any) {
      console.error('Erro ao validar check-in:', err)
      toast.error('Erro na validação do ingresso!')
      
      setLastScan({
        ticket: {
          id: '',
          name: 'Erro na Validação',
          email: '',
          ticketType: '',
          ticketCode: code,
          status: 'cancelado',
          checkInTime: null,
          seat: '',
          avatar: '',
          eventName: ''
        },
        success: false,
        message: err.message || 'Erro de rede ao conectar com a API de check-in'
      })
    }
  }

  // Confirmar check-in manual na listagem
  const manualCheckIn = async (ticket: TicketCheck) => {
    await handleScan(ticket.ticketCode)
  }

  useEffect(() => {
    if (mode === 'scanner' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [mode])

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      {/* Event Selector & Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Check-in</h1>
          <p className="text-sm text-espresso/50 mt-1">Validação de ingressos e portaria em tempo real</p>
        </div>
        
        {/* Selector Dropdown */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {activeEvents.length > 0 && (
            <div className="relative w-full sm:w-64">
              <select
                value={selectedEventId}
                onChange={e => {
                  setSelectedEventId(e.target.value)
                  setLastScan(null)
                }}
                aria-label="Selecionar Evento"
                title="Selecionar Evento"
                className="w-full pl-4 pr-10 py-2.5 bg-white/60 border border-white/60 rounded-xl text-xs font-medium text-espresso appearance-none focus:outline-none focus:border-plum/30 transition-all cursor-pointer"
              >
                {activeEvents.map(e => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/40 pointer-events-none" />
            </div>
          )}
          <div className="flex items-center gap-1 bg-white/40 border border-white/60 rounded-full p-1">
            <button 
              onClick={() => setMode('scanner')} 
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${mode === 'scanner' ? 'bg-plum text-cream shadow-sm' : 'text-espresso/50 hover:text-espresso'}`}
            >
              <ScanLine className="w-3.5 h-3.5" /> Scanner
            </button>
            <button 
              onClick={() => setMode('list')} 
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${mode === 'list' ? 'bg-plum text-cream shadow-sm' : 'text-espresso/50 hover:text-espresso'}`}
            >
              <Users className="w-3.5 h-3.5" /> Lista
            </button>
          </div>
        </div>
      </div>

      {isEventsLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-plum" />
        </div>
      ) : activeEvents.length === 0 ? (
        <div className="bg-white/60 border border-white/60 rounded-3xl p-12 text-center backdrop-blur-sm">
          <div className="w-16 h-16 rounded-full bg-plum/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-plum" />
          </div>
          <h3 className="font-serif text-xl text-espresso mb-2">Nenhum evento ativo</h3>
          <p className="text-sm text-espresso/50 max-w-sm mx-auto">
            Você precisa ter pelo menos um evento publicado para gerenciar a portaria e check-in.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Total Emitido', value: isLoadingTickets ? '...' : total.toString(), icon: Ticket, color: 'text-plum', bg: 'bg-plum/5' },
              { label: 'Check-in Realizado', value: isLoadingTickets ? '...' : checked.toString(), icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Pendentes', value: isLoadingTickets ? '...' : pending.toString(), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Cancelados', value: isLoadingTickets ? '...' : cancelled.toString(), icon: XCircle, color: 'text-red-400', bg: 'bg-red-50' },
            ].map(k => (
              <div key={k.label} className={`p-4 rounded-2xl bg-white/60 border border-white/60 text-center ${k.bg}`}>
                <k.icon className={`w-4 h-4 ${k.color} mx-auto mb-1.5`} />
                <div className={`font-serif text-xl ${k.color}`}>{k.value}</div>
                <div className="text-[10px] text-espresso/40 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="mb-8 p-4 rounded-2xl bg-white/60 border border-white/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-espresso/50">Progresso do check-in</span>
              <span className="text-xs font-medium text-plum">
                {isLoadingTickets ? 'Carregando...' : `${progress.toFixed(0)}% · ${checked}/${total}`}
              </span>
            </div>
            <div className="w-full h-3 bg-canvas rounded-full overflow-hidden">
              <div className="h-full bg-plum rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Scanner Mode */}
          {mode === 'scanner' && (
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-white/60 border border-white/60 text-center backdrop-blur-sm">
                <div className="w-20 h-20 rounded-full bg-plum/10 flex items-center justify-center mx-auto mb-4">
                  <ScanLine className="w-10 h-10 text-plum" />
                </div>
                <p className="text-sm text-espresso/60 mb-4">Posicione o leitor ou digite o código do ingresso</p>
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => { 
                    setSearch(e.target.value)
                    // Se digitar o código completo ou passar leitor de código de barras/QR (geralmente dispara submit com Enter)
                    if (e.target.value.length >= 10 && !e.target.value.includes(' ')) {
                      handleScan(e.target.value)
                      setSearch('')
                    }
                  }}
                  onKeyDown={e => { 
                    if (e.key === 'Enter' && search.trim().length >= 3) { 
                      handleScan(search.trim())
                      setSearch('') 
                    } 
                  }}
                  placeholder="Código do ingresso (ex: AUR-XXXX-001)..."
                  className="w-full max-w-sm mx-auto px-6 py-4 bg-white/60 border border-white/60 rounded-full text-center text-lg text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 font-mono tracking-wider"
                />
              </div>

              {/* Last Scan Result */}
              {lastScan && (
                <div className={`p-6 rounded-2xl border backdrop-blur-sm transition-all ${
                  lastScan.success 
                    ? 'bg-green-50/80 border-green-200 text-green-800' 
                    : lastScan.ticket.status === 'usado' 
                    ? 'bg-amber-50/80 border-amber-200 text-amber-800' 
                    : 'bg-red-50/80 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-center gap-4">
                    <img src={lastScan.ticket.avatar} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-white flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {lastScan.success ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" /> : lastScan.ticket.status === 'usado' ? <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                        <h3 className="text-base font-serif text-espresso truncate">{lastScan.ticket.name}</h3>
                      </div>
                      <p className="text-xs text-espresso/50 mt-0.5 truncate">
                        {lastScan.ticket.ticketType} · {lastScan.ticket.ticketCode}
                      </p>
                      <p className="text-[10px] font-medium mt-1">
                        {lastScan.message}
                      </p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${
                      lastScan.success ? 'bg-green-200/60 text-green-800' : lastScan.ticket.status === 'usado' ? 'bg-amber-200/60 text-amber-800' : 'bg-red-200/60 text-red-800'
                    }`}>
                      {lastScan.success ? 'Acesso Permitido' : lastScan.ticket.status === 'usado' ? 'Duplicado' : 'Acesso Negado'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* List Mode */}
          {mode === 'list' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por participante ou código do ingresso..." className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30" />
              </div>
              
              {isLoadingTickets ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="h-16 bg-white/40 border border-white/60 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filtered.map(t => (
                    <div key={t.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${t.status === 'usado' ? 'bg-green-50/40 border-green-100/40' : t.status === 'cancelado' ? 'bg-red-50/30 border-red-100/30 opacity-50' : 'bg-white/60 border-white/60'}`}>
                      <img src={t.avatar} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-canvas flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-espresso font-medium truncate">{t.name}</div>
                        <div className="text-[10px] text-espresso/40">
                          {t.ticketType} · {t.ticketCode}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {t.status === 'usado' && (
                          <div className="text-xs text-green-600 font-semibold flex items-center gap-1 justify-end">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmado às {t.checkInTime}
                          </div>
                        )}
                        {t.status === 'cancelado' && <div className="text-xs text-red-500 font-medium">Cancelado</div>}
                        {t.status === 'pendente' && (
                          <button 
                            onClick={() => manualCheckIn(t)} 
                            className="px-4 py-1.5 bg-plum text-cream text-xs font-semibold rounded-full hover:shadow-glow transition-all flex items-center gap-1"
                          >
                            <Zap className="w-3 h-3 fill-current" /> Confirmar Entrada
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <div className="py-12 text-center text-xs text-espresso/30">Nenhum participante encontrado nesta busca.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
