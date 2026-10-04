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
import { codigoCompleto, codigoCurto, EXEMPLO_CODIGO, LEITURA_CODIGO_CURTO, motivoLeitura, normalizarCodigo, type Leitura } from '../../lib/checkin'

interface TicketCheck {
  id: string
  name: string
  ticketType: string
  ticketCode: string
  status: 'pendente' | 'usado' | 'cancelado' | 'transferido'
  checkInTime: string | null
  seat: string
  eventName: string
}


// Resultado da leitura: texto e fundo seguem o tema (--ev-success e --ev-warning mudam no escuro; text-destructive idem)
const TOM = {
  ok: { texto: 'text-[var(--ev-success)]', caixa: 'border-[var(--ev-success)] bg-[color-mix(in_srgb,var(--ev-success)_10%,hsl(var(--card)))]', Icone: I.Liberado },
  aviso: { texto: 'text-[var(--ev-warning)]', caixa: 'border-[var(--ev-warning)] bg-[color-mix(in_srgb,var(--ev-warning)_10%,hsl(var(--card)))]', Icone: I.Alerta },
  erro: { texto: 'text-destructive', caixa: 'border-destructive bg-[color-mix(in_srgb,hsl(var(--destructive))_10%,hsl(var(--card)))]', Icone: I.Negado },
}

// Atualização entre aparelhos: não há canal em tempo real, só nova consulta a cada tanto
const ATUALIZA_MS = 20_000
const LIMITE_LISTA = 1000 // a lista traz os mais recentes; os números vêm de contagem no servidor
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function ProducerCheckIn() {
  const { data: events, isLoading: isEventsLoading } = useProducerEvents()

  const [tickets, setTickets] = useState<TicketCheck[]>([])
  const [isLoadingTickets, setIsLoadingTickets] = useState(false)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'scanner' | 'list'>('scanner')
  const [lastScan, setLastScan] = useState<{ ticket: TicketCheck; leitura: Leitura } | null>(null)
  const [contagem, setContagem] = useState({ total: 0, usados: 0, cancelados: 0, transferidos: 0 })
  const [atualizadoEm, setAtualizadoEm] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const eventoAtual = useRef('') // descarta resposta de evento que já não está na tela
  const emVoo = useRef(new Set<string>()) // códigos sendo validados: a mesma leitura não dispara duas vezes
  const ultimaLeitura = useRef(0) // só a leitura mais recente troca o cartão (resposta atrasada não)
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
    } else if (dbTicket.status === 'transferred') {
      checkStatus = 'transferido'
    }

    return {
      id: dbTicket.id,
      name: dbTicket.buyer_name || 'Participante',
      ticketType: dbTicket.ticket_types?.name || 'Ingresso Comum',
      ticketCode: dbTicket.qr_code,
      status: checkStatus,
      checkInTime: dbTicket.checked_in_at ? hora(dbTicket.checked_in_at) : null,
      seat: '-',
      eventName: dbTicket.events?.title || 'Evento'
    }
  }

  // Números: contagem no servidor (a lista é limitada a 1000 linhas)
  const contarIngressos = async (eventId: string) => {
    const contar = async (status?: string[]) => {
      let q = supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId)
      if (status) q = q.in('status', status)
      const { count, error } = await q
      if (error) throw error
      return count ?? 0
    }
    const [total, usados, cancelados, transferidos] = await Promise.all([contar(), contar(['used']), contar(['cancelled', 'refunded']), contar(['transferred'])])
    return { total, usados, cancelados, transferidos }
  }

  // Carregar ingressos do evento selecionado.
  // silencioso = atualização automática (sem esqueleto nem aviso a cada falha).
  const loadTickets = async (eventId: string, silencioso = false) => {
    if (!eventId) return
    if (!silencioso) setIsLoadingTickets(true)
    try {
      const [lista, contagemNova] = await Promise.all([
        supabase.from('tickets')
          .select(`
            id, buyer_name, qr_code, status, checked_in_at,
            ticket_types (name),
            events (title)
          `)
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .range(0, LIMITE_LISTA - 1),
        contarIngressos(eventId),
      ])
      if (lista.error) throw lista.error
      if (eventoAtual.current !== eventId) return
      setTickets(lista.data.map(mapDbTicketToTicketCheck))
      setContagem(contagemNova)
      setAtualizadoEm(new Date().toLocaleTimeString('pt-BR'))
    } catch (err: any) {
      console.error('Erro ao carregar ingressos:', err)
      if (!silencioso) toast.error('Erro ao carregar ingressos da portaria')
    } finally {
      if (!silencioso && eventoAtual.current === eventId) setIsLoadingTickets(false)
    }
  }

  useEffect(() => {
    eventoAtual.current = selectedEventId
    if (!selectedEventId) return
    setLastScan(null) // o último ingresso lido é do evento anterior
    loadTickets(selectedEventId)
    // ponytail: consulta a cada 20 s com a aba visível; canal Realtime se a latência importar
    const id = setInterval(() => { if (document.visibilityState === 'visible') loadTickets(selectedEventId, true) }, ATUALIZA_MS)
    return () => clearInterval(id)
  }, [selectedEventId])

  const { total, usados: checked, cancelados: cancelled, transferidos } = contagem
  const pending = Math.max(0, total - checked - cancelled - transferidos)
  const noServidor = total > tickets.length
  const progress = total > 0 ? (checked / total) * 100 : 0

  const filtered = tickets.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.ticketCode.toLowerCase().includes(search.toLowerCase())
  )

  // Escanear/validar ingresso na Edge Function
  const handleScan = async (code: string) => {
    const codigo = code.trim()
    if (!codigo || !selectedEventId || emVoo.current.has(codigo)) return
    const minha = ++ultimaLeitura.current
    // formato do e-mail (8 caracteres, traço, 1): o ingresso não se acha por prefixo
    if (codigoCurto(codigo)) {
      toast.warning(LEITURA_CODIGO_CURTO.mensagem)
      setLastScan({ ticket: { id: '', name: 'Código incompleto', ticketType: '', ticketCode: codigo, status: 'pendente', checkInTime: null, seat: '-', eventName: '' }, leitura: LEITURA_CODIGO_CURTO })
      return
    }
    emVoo.current.add(codigo)
    const achado = tickets.find(t => t.ticketCode === codigo)
    const evento = selectedEventId

    try {
      // Chamar a Edge Function check-in-validate
      const { data, error } = await supabase.functions.invoke('check-in-validate', {
        body: { qrCode: codigo, eventId: evento },
      })
      if (eventoAtual.current !== evento) return

      let leitura: Leitura
      let dados: { buyerName?: string; ticketType?: string; checkedInAt?: string | null } = data ?? {}
      if (error) {
        // Em 4xx/5xx o invoke não devolve o JSON: lê o status e a mensagem reais da função (sem permissão, 2FA, não encontrado)
        const resp = (error as { context?: Response }).context
        const body = await resp?.json?.().catch(() => null)
        leitura = motivoLeitura({ http: resp?.status, message: body?.error || body?.message || error.message })
        dados = body ?? {}
      } else {
        leitura = motivoLeitura({ http: 200, valid: data.valid, message: data.message, checkedInAt: data.checkedInAt })
      }

      if (leitura.tom === 'ok') toast.success(leitura.mensagem)
      else toast.warning(leitura.mensagem)

      const nome = leitura.falha ? 'Leitura não concluída' : (achado?.name || dados.buyerName || (leitura.tom === 'ok' ? 'Participante' : 'Ingresso Inválido'))
      if (minha === ultimaLeitura.current) setLastScan({
        ticket: {
          id: achado?.id ?? '',
          name: nome,
          ticketType: achado?.ticketType || dados.ticketType || '',
          ticketCode: codigo,
          status: 'pendente',
          checkInTime: null,
          seat: '-',
          eventName: '',
        },
        leitura,
      })
      // Conferiu no servidor (entrou ou já tinha entrado): atualiza só este item e refaz só as contagens
      if (leitura.tom === 'ok' || leitura.rotulo === 'Já usado') {
        const quando = dados.checkedInAt ? hora(dados.checkedInAt) : null
        setTickets(ts => ts.map(t => t.ticketCode === codigo ? { ...t, status: 'usado', checkInTime: quando ?? (leitura.tom === 'ok' ? hora(new Date().toISOString()) : t.checkInTime) } : t))
      }
      if (!leitura.falha) contarIngressos(evento).then(c => { if (eventoAtual.current === evento) setContagem(c) }).catch(() => {})
    } catch (err: any) {
      console.error('Erro ao validar check-in:', err)
      if (eventoAtual.current !== evento) return
      const leitura = motivoLeitura({})
      toast.error(leitura.mensagem)
      if (minha === ultimaLeitura.current) setLastScan({
        ticket: { id: '', name: 'Leitura não concluída', ticketType: '', ticketCode: codigo, status: 'pendente', checkInTime: null, seat: '', eventName: '' },
        leitura,
      })
    } finally {
      emVoo.current.delete(codigo)
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

  const resultado = lastScan && TOM[lastScan.leitura.tom]

  return (
    <div>
      <PageHeader
        title="Check-in"
        description="Validação de ingressos e controle da portaria"
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
            <p className="mt-2 text-xs text-muted-foreground">
              Atualiza sozinho a cada {ATUALIZA_MS / 1000} s{atualizadoEm && ` · última atualização às ${atualizadoEm}`}
            </p>
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
                    // Valida sozinho só quando o código tem o formato real (36 caracteres); antes disso, só com Enter
                    if (codigoCompleto(e.target.value)) {
                      handleScan(normalizarCodigo(e.target.value))
                      setSearch('')
                    } else setSearch(e.target.value)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && search.trim().length >= 3) {
                      handleScan(normalizarCodigo(search))
                      setSearch('')
                    }
                  }}
                  placeholder={`Código do ingresso (ex: ${EXEMPLO_CODIGO})`}
                  className="mx-auto h-14 max-w-md text-center font-mono text-base tracking-wide md:text-base"
                />
              </div>

              {/* Last Scan Result */}
              {resultado && lastScan && (
                <div ref={cartaoRef} className={cn('scroll-mb-[calc(var(--barra-cel,0px)+1rem)] rounded-[10px] border p-4 sm:p-5', resultado.caixa)}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:flex-nowrap">
                    {!lastScan.leitura.falha && <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-muted-foreground">{iniciais(lastScan.ticket.name ?? '')}</span>}
                    <div className={cn('min-w-0 flex-1', lastScan.leitura.falha ? 'max-sm:basis-full' : 'max-sm:basis-[calc(100%-4rem)]')}>
                      <div className="flex items-center gap-2">
                        <resultado.Icone size={20} className={cn('shrink-0', resultado.texto)} />
                        <h2 className="truncate text-base font-semibold leading-6 tracking-normal text-foreground">{lastScan.ticket.name}</h2>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[lastScan.ticket.ticketType, lastScan.ticket.ticketCode].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 text-xs font-medium text-foreground">
                        {lastScan.leitura.mensagem}
                      </p>
                    </div>
                    <div className={cn('whitespace-nowrap rounded-full bg-card px-3 py-1.5 text-xs font-semibold sm:shrink-0', !lastScan.leitura.falha && 'max-sm:ml-16', resultado.texto)}>
                      {lastScan.leitura.rotulo}
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

              {noServidor && (
                <p className="text-xs text-muted-foreground">
                  Mostrando os {tickets.length.toLocaleString('pt-BR')} ingressos mais recentes de {total.toLocaleString('pt-BR')}. Os números acima contam todos; para achar um ingresso mais antigo, use o campo do Scanner.
                </p>
              )}
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
                        {t.status === 'transferido' && <div className="text-xs font-medium text-muted-foreground">Transferido</div>}
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
