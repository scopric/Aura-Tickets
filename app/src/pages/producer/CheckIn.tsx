import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Link, useSearchParams } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { PageHeader, Stat, EmptyState, selectNativo } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Segmented } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { iniciais } from '../../hooks/useConversas'
import { supabase } from '../../lib/supabase'
import { useProducerEvents } from '../../hooks/useEvents'
import { useEventoDaUrl } from '../../hooks/useEventoDaUrl'

interface TicketCheck {
  id: string
  name: string
  email: string
  ticketType: string
  ticketCode: string
  status: 'pendente' | 'usado' | 'cancelado'
  checkInTime: string | null
  seat: string
  eventName: string
}


// Resultado da leitura: texto e fundo seguem o tema (--ev-success e --ev-warning mudam no escuro; text-destructive idem)
const TOM = {
  ok: { texto: 'text-[var(--ev-success)]', caixa: 'border-[var(--ev-success)] bg-[color-mix(in_srgb,var(--ev-success)_10%,hsl(var(--card)))]', Icone: I.Liberado, rotulo: 'Acesso Permitido' },
  aviso: { texto: 'text-[var(--ev-warning)]', caixa: 'border-[var(--ev-warning)] bg-[color-mix(in_srgb,var(--ev-warning)_10%,hsl(var(--card)))]', Icone: I.Alerta, rotulo: 'Duplicado' },
  erro: { texto: 'text-destructive', caixa: 'border-destructive bg-[color-mix(in_srgb,hsl(var(--destructive))_10%,hsl(var(--card)))]', Icone: I.Negado, rotulo: 'Acesso Negado' },
}

export default function ProducerCheckIn() {
  const { data: events, isLoading: isEventsLoading } = useProducerEvents()

  const [tickets, setTickets] = useState<TicketCheck[]>([])
  const [isLoadingTickets, setIsLoadingTickets] = useState(false)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'scanner' | 'list'>('scanner')
  const [lastScan, setLastScan] = useState<{ ticket: TicketCheck; success: boolean; message: string; falha?: boolean } | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const cartaoRef = useRef<HTMLDivElement>(null)

  // Mapear eventos ativos
  const activeEvents = events?.filter(e => e.status === 'published') || []

  // Evento da URL (?eventId=) ou o último usado; sem nenhum, o primeiro ao carregar
  const [eventoEscolhido, setSelectedEventId] = useEventoDaUrl(activeEvents.map(e => e.id))
  // ?eventId= de evento que existe mas não está publicado: aviso, em vez de cair em outro evento com a URL dizendo outro
  const pedido = useSearchParams()[0].get('eventId')
  const naoPublicado = !!pedido && !!events?.some(e => e.id === pedido && e.status !== 'published')
  const selectedEventId = naoPublicado ? '' : (eventoEscolhido ?? activeEvents[0]?.id ?? '')

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
      eventName: dbTicket.events?.title || 'Evento'
    }
  }

  // Carregar ingressos do evento selecionado
  const loadTickets = async (eventId: string) => {
    if (!eventId) return
    setLastScan(null) // o último ingresso lido é do evento anterior
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

      setTickets(data.map(mapDbTicketToTicketCheck))
    } catch (err: any) {
      console.error('Erro ao carregar ingressos:', err)
      toast.error('Erro ao carregar ingressos da portaria')
    } finally {
      setIsLoadingTickets(false)
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
        }
      })

      if (error) {
        // Em 4xx/5xx o invoke não devolve o JSON: lê a mensagem real da função (sem permissão, 2FA, não encontrado)
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(body?.error || body?.message || error.message)
      }

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
      toast.error(err.message || 'Erro na validação do ingresso!')
      
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
          eventName: ''
        },
        success: false,
        message: err.message || 'Erro de rede ao conectar com a API de check-in',
        falha: true
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

  // o cartão nasce abaixo do campo: no celular fica fora da tela ou atrás da barra inferior (scroll-mb no cartão)
  useEffect(() => {
    cartaoRef.current?.scrollIntoView?.({ block: 'nearest', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [lastScan])

  const resultado = lastScan && TOM[lastScan.success ? 'ok' : lastScan.ticket.status === 'usado' ? 'aviso' : 'erro']

  return (
    <div>
      <PageHeader
        title="Check-in"
        description="Validação de ingressos e portaria em tempo real"
        actions={
          <>
            {activeEvents.length > 0 && (
              <div data-tour="checkin-evento" className="w-full sm:w-64">
                <select
                  value={selectedEventId}
                  onChange={e => {
                    setSelectedEventId(e.target.value)
                    setLastScan(null)
                  }}
                  aria-label="Selecionar Evento"
                  title="Selecionar Evento"
                  className={selectNativo}
                >
                  {!selectedEventId && <option value="" disabled>Selecione um evento</option>}
                  {activeEvents.map(e => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </div>
            )}
            <div data-tour="checkin-modo" className="w-full sm:w-52">
              <Segmented
                label="Modo"
                size="md"
                value={mode}
                onValueChange={v => setMode(v as 'scanner' | 'list')}
                items={[
                  { value: 'scanner', label: <><I.Escanear size={16} />Scanner</> },
                  { value: 'list', label: <><I.Pessoas size={16} />Lista</> },
                ]}
              />
            </div>
          </>
        }
      />

      {isEventsLoading ? (
        <div aria-busy="true" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
      ) : naoPublicado ? (
        <div role="status">
          <EmptyState
            title="Este evento ainda não está publicado"
            description={<>O check-in abre quando ele estiver no ar. Escolha outro evento acima ou <Link to="/producer/events" className="text-foreground underline underline-offset-4">veja seus eventos</Link>.</>}
          />
        </div>
      ) : activeEvents.length === 0 ? (
        <EmptyState
          title="Nenhum evento ativo"
          description="Você precisa ter pelo menos um evento publicado para gerenciar a portaria e check-in."
        />
      ) : (
        <>
          {/* Stats */}
          <div data-tour="checkin-numeros" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total Emitido', value: total, icon: I.Ingressos, cor: 'text-muted-foreground' },
              { label: 'Check-in Realizado', value: checked, icon: I.Liberado, cor: 'text-[var(--ev-success)]' },
              { label: 'Pendentes', value: pending, icon: I.Horario, cor: 'text-[var(--ev-warning)]' },
              { label: 'Cancelados', value: cancelled, icon: I.Negado, cor: 'text-destructive' },
            ].map(k => (
              <Stat
                key={k.label}
                label={<span className="inline-flex items-center gap-1.5"><k.icon size={16} className={k.cor} />{k.label}</span>}
                value={isLoadingTickets ? '...' : k.value}
              />
            ))}
          </div>

          {/* Progress */}
          <div className="mt-3 rounded-[10px] border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span id="progresso-checkin" className="text-[13px] text-muted-foreground">Progresso do check-in</span>
              <span className="text-[13px] font-medium tabular-nums text-foreground">
                {isLoadingTickets ? 'Carregando...' : `${progress.toFixed(0)}% · ${checked}/${total}`}
              </span>
            </div>
            <Progress value={progress} aria-labelledby="progresso-checkin" className="h-2 bg-secondary" />
          </div>

          {/* Scanner Mode */}
          {mode === 'scanner' && (
            <div className="mt-6 space-y-4">
              <div data-tour="checkin-leitor" className="rounded-[10px] border border-border bg-card p-6 text-center sm:p-8">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-secondary text-primary">
                  <I.Escanear size={32} />
                </div>
                <p className="mb-4 text-sm text-muted-foreground">Posicione o leitor ou digite o código do ingresso</p>
                <Input
                  ref={inputRef}
                  type="text"
                  aria-label="Código do ingresso"
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
                  className="mx-auto h-14 max-w-md text-center font-mono text-base tracking-wide md:text-base"
                />
              </div>

              {/* Last Scan Result */}
              {resultado && lastScan && (
                <div ref={cartaoRef} className={cn('scroll-mb-[calc(var(--barra-cel,0px)+1rem)] rounded-[10px] border p-4 sm:p-5', resultado.caixa)}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:flex-nowrap">
                    {!lastScan.falha && <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-muted-foreground">{iniciais(lastScan.ticket.name ?? '')}</span>}
                    <div className={cn('min-w-0 flex-1', lastScan.falha ? 'max-sm:basis-full' : 'max-sm:basis-[calc(100%-4rem)]')}>
                      <div className="flex items-center gap-2">
                        <resultado.Icone size={20} className={cn('shrink-0', resultado.texto)} />
                        <h2 className="truncate text-base font-semibold leading-6 tracking-normal text-foreground">{lastScan.ticket.name}</h2>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[lastScan.ticket.ticketType, lastScan.ticket.ticketCode].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 text-xs font-medium text-foreground">
                        {lastScan.message}
                      </p>
                    </div>
                    <div className={cn('whitespace-nowrap rounded-full bg-card px-3 py-1.5 text-xs font-semibold sm:shrink-0', !lastScan.falha && 'max-sm:ml-16', resultado.texto)}>
                      {resultado.rotulo}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* List Mode */}
          {mode === 'list' && (
            <div className="mt-6 space-y-3">
              <div className="relative w-full sm:max-w-md">
                <I.Buscar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar participante" placeholder="Buscar por participante ou código do ingresso..." className="pl-9" />
              </div>

              {isLoadingTickets ? (
                <div aria-busy="true" className="space-y-2">
                  {[1, 2, 3].map(n => (
                    <Skeleton key={n} className="h-16 rounded-[10px] bg-muted" />
                  ))}
                </div>
              ) : (
                <ul className="max-h-[500px] divide-y divide-border overflow-y-auto rounded-[10px] border border-border bg-card">
                  {filtered.map(t => (
                    <li key={t.id} className="flex items-center gap-3 p-3">
                      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{iniciais(t.name ?? '')}</span>
                      <div className="min-w-0 flex-1">
                        <div className={cn('truncate text-sm font-medium', t.status === 'cancelado' ? 'text-muted-foreground' : 'text-foreground')}>{t.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {t.ticketType} · {t.ticketCode}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {t.status === 'usado' && (
                          <div className="flex items-center justify-end gap-1 text-xs font-semibold text-[var(--ev-success)]">
                            <I.Liberado size={14} /> Confirmado às {t.checkInTime}
                          </div>
                        )}
                        {t.status === 'cancelado' && <div className="text-xs font-medium text-destructive">Cancelado</div>}
                        {t.status === 'pendente' && (
                          <Button size="sm" onClick={() => manualCheckIn(t)}>
                            <I.Raio /> Confirmar Entrada
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                  {filtered.length === 0 && (
                    <li className="py-12 text-center text-xs text-muted-foreground">Nenhum participante encontrado nesta busca.</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
