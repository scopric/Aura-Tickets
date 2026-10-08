import { useState, useEffect, useRef, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Link, useSearchParams } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { PageHeader, EmptyState, Erro, SectionTitle, selectNativo } from '@/components/producer/ui'
import { CabecalhoEvento, EmBreve, KpiCard } from '@/components/producer/ui-evento'
import LeitorCamera from '@/components/producer/LeitorCamera'
import RitmoDeEntrada from '@/components/producer/RitmoDeEntrada'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { iniciais } from '../../hooks/useConversas'
import { supabase } from '../../lib/supabase'
import { useProducerEvents } from '../../hooks/useEvents'
import { useEventoDaUrl } from '../../hooks/useEventoDaUrl'
import { useEventosDaEquipe } from '../../hooks/useEventosDaEquipe'
import { downloadCsv, csvFilename, slugArquivo, toCsv } from '../../lib/exportCsv'
import { faltaSegundoFator } from '../../lib/vendasPagas'
import { situacaoEvento } from '../../lib/eventoProdutor'
import { dataBR } from '../../lib/bordero'
import {
  codigoCompleto, codigoCurto, COLUNAS_CSV_CHECKIN, filtrarSituacao, LEITURA_CODIGO_CURTO, linhasCsvCheckin, motivoLeitura,
  normalizarCodigo, ordenarPorEntrada, ritmoPorHora, ROTULO_SITUACAO, type FiltroSituacao, type Leitura,
} from '../../lib/checkin'

interface TicketCheck {
  id: string
  name: string
  ticketType: string
  ticketCode: string
  status: 'pendente' | 'usado' | 'cancelado' | 'transferido'
  checkInTime: string | null
  checkedInAt: string | null // ISO, para ordenar, o ritmo por hora e o CSV
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
type LinhaEquipe = { id: string; buyer_name: string | null; status: string; checked_in_at: string | null; tipo: string | null }
// Equipe: lista com os 1000 ingressos mais recentes (limite no SQL, como o dono) e números pela contagem no servidor
const listaEquipe = async (eventId: string) => {
  const { data, error } = await supabase.rpc('team_lista_ingressos' as never, { p_event_id: eventId } as never)
  if (error) throw error
  return (data ?? []) as LinhaEquipe[]
}
const contagemEquipe = async (eventId: string) => {
  const { data, error } = await supabase.rpc('team_contagem' as never, { p_event_id: eventId } as never)
  if (error) throw error
  const c = ((data ?? []) as { total: number; usados: number; cancelados: number; transferidos: number }[])[0]
  return { total: c?.total ?? 0, usados: c?.usados ?? 0, cancelados: c?.cancelados ?? 0, transferidos: c?.transferidos ?? 0 }
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

type EventoCheckIn = { id: string; title: string; status: string; approval_status?: string | null; rejection_reason?: string | null; date?: string | null }

// Dono do evento (/producer/checkin): os próprios eventos. Equipe da portaria (/equipe/checkin): useEventosDaEquipe.
export default function ProducerCheckIn() {
  const { data, isLoading } = useProducerEvents()
  return <CheckInTela events={data} isEventsLoading={isLoading} />
}

export function EquipeCheckIn() {
  const { data, isLoading, isError } = useEventosDaEquipe()
  return <div className="mx-auto max-w-5xl px-4 py-6"><CheckInTela events={data} isEventsLoading={isLoading} eventsError={isError} voltar="/equipe" equipe /></div>
}

// equipe: os ingressos vêm de team_lista_ingressos (só id, nome, status, horário e tipo; sem o código do ingresso),
// então a lista só mostra; a entrada é pelo leitor (check-in-validate).
function CheckInTela({ events, isEventsLoading, eventsError = false, voltar = '/producer/events', equipe = false }: { events?: EventoCheckIn[]; isEventsLoading: boolean; eventsError?: boolean; voltar?: string; equipe?: boolean }) {

  const [tickets, setTickets] = useState<TicketCheck[]>([])
  // 'carregando' até a 1ª resposta do evento: sem ela os números seriam um "0" falso
  const [carga, setCarga] = useState<'carregando' | 'ok' | 'erro'>('carregando')
  const [search, setSearch] = useState('') // busca da Lista
  const [codigo, setCodigo] = useState('') // campo de código da Leitura
  const [situacao, setSituacao] = useState<FiltroSituacao>('todos')
  const [ordem, setOrdem] = useState<'lista' | 'entrada'>('lista')
  const [validando, setValidando] = useState(false) // a câmera não lê durante a chamada
  const [tentativa, setTentativa] = useState(0) // refaz a carga (botão "Tentar de novo")
  const [doisFatores, setDoisFatores] = useState<'?' | 'sim' | 'nao' | 'erro'>('?')
  const [mode, setMode] = useState<'scanner' | 'list'>('scanner')
  const [lastScan, setLastScan] = useState<{ ticket: TicketCheck; leitura: Leitura } | null>(null)
  const [contagem, setContagem] = useState({ total: 0, usados: 0, cancelados: 0, transferidos: 0 })
  const [atualizadoEm, setAtualizadoEm] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const eventoAtual = useRef('') // descarta resposta de evento que já não está na tela
  const emVoo = useRef(new Set<string>()) // códigos sendo validados: a mesma leitura não dispara duas vezes
  const ultimaLeitura = useRef(0) // só a leitura mais recente troca o cartão (resposta atrasada não)
  const versaoLista = useRef(0) // carga da lista iniciada antes de uma leitura (ou de outra carga) é descartada
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
      ticketType: dbTicket.tipo || dbTicket.ticket_types?.name || 'Ingresso Comum',
      ticketCode: dbTicket.qr_code ?? '',
      status: checkStatus,
      checkInTime: dbTicket.checked_in_at ? hora(dbTicket.checked_in_at) : null,
      checkedInAt: dbTicket.checked_in_at ?? null,
      seat: '-',
      eventName: dbTicket.events?.title || 'Evento'
    }
  }

  // Números: contagem no servidor (a lista é limitada a 1000 linhas)
  const contarIngressos = async (eventId: string) => {
    if (equipe) return contagemEquipe(eventId)
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
    if (!silencioso) setCarga('carregando')
    const versao = ++versaoLista.current
    try {
      if (equipe) {
        const [linhas, contagemNova] = await Promise.all([listaEquipe(eventId), contagemEquipe(eventId)])
        if (eventoAtual.current !== eventId || versaoLista.current !== versao) return
        setTickets(linhas.map(mapDbTicketToTicketCheck))
        setContagem(contagemNova)
        setCarga('ok')
        setAtualizadoEm(new Date().toLocaleTimeString('pt-BR'))
        return
      }
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
      if (eventoAtual.current !== eventId || versaoLista.current !== versao) return
      setTickets(lista.data.map(mapDbTicketToTicketCheck))
      setContagem(contagemNova)
      setCarga('ok')
      setAtualizadoEm(new Date().toLocaleTimeString('pt-BR'))
    } catch (err: any) {
      console.error('Erro ao carregar ingressos:', err)
      if (!silencioso) {
        toast.error('Erro ao carregar ingressos da portaria')
        if (eventoAtual.current === eventId) setCarga('erro')
      }
    } finally {
      // resposta descartada por uma leitura no meio da carga: sai do esqueleto (como antes), a próxima atualização completa
      if (!silencioso && eventoAtual.current === eventId) setCarga(c => (c === 'carregando' ? 'ok' : c))
    }
  }

  useEffect(() => {
    eventoAtual.current = selectedEventId
    if (!selectedEventId) return
    setLastScan(null) // o último ingresso lido é do evento anterior
    setDoisFatores('?')
    loadTickets(selectedEventId)
    // ponytail: consulta a cada 20 s com a aba visível; canal Realtime se a latência importar
    const id = setInterval(() => { if (document.visibilityState === 'visible') loadTickets(selectedEventId, true) }, ATUALIZA_MS)
    return () => clearInterval(id)
  }, [selectedEventId, tentativa])

  const { total, usados: checked, cancelados: cancelled, transferidos } = contagem
  const pending = Math.max(0, total - checked - cancelled - transferidos)
  const noServidor = total > tickets.length
  const comparecimento = total > 0 ? Math.round((checked / total) * 100) : 0
  const carregando = carga === 'carregando'

  // zero em tudo pode ser sessão sem 2FA concluído (o banco devolve vazio, sem erro): nunca mostrar "0 ingressos" falso
  const semDados = carga === 'ok' && total === 0 && tickets.length === 0
  useEffect(() => {
    if (!semDados) return
    let vivo = true
    faltaSegundoFator().then(f => vivo && setDoisFatores(f ? 'sim' : 'nao')).catch(() => vivo && setDoisFatores('erro'))
    return () => { vivo = false }
  }, [semDados, selectedEventId, tentativa])

  const buscados = filtrarSituacao(tickets, situacao).filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.ticketCode.toLowerCase().includes(search.toLowerCase())
  )
  const filtered = ordem === 'entrada' ? ordenarPorEntrada(buscados) : buscados
  const ritmo = ritmoPorHora(tickets.map(t => t.checkedInAt))

  // Escanear/validar ingresso na Edge Function
  const handleScan = async (code: string) => {
    const codigo = code.trim()
    if (!codigo || !selectedEventId || emVoo.current.has(codigo)) return
    const minha = ++ultimaLeitura.current
    // formato do e-mail (8 caracteres, traço, 1): o ingresso não se acha por prefixo
    if (codigoCurto(codigo)) {
      toast.warning(LEITURA_CODIGO_CURTO.mensagem)
      setLastScan({ ticket: { id: '', name: 'Código incompleto', ticketType: '', ticketCode: codigo, status: 'pendente', checkInTime: null, checkedInAt: null, seat: '-', eventName: '' }, leitura: LEITURA_CODIGO_CURTO })
      return
    }
    emVoo.current.add(codigo)
    setValidando(true)
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
          checkedInAt: null,
          seat: '-',
          eventName: '',
        },
        leitura,
      })
      // Conferiu no servidor (entrou ou já tinha entrado): atualiza só este item e refaz só as contagens
      if (leitura.tom === 'ok' || leitura.rotulo === 'Já usado') {
        const quando = dados.checkedInAt ? hora(dados.checkedInAt) : null
        versaoLista.current++
        setTickets(ts => ts.map(t => t.ticketCode === codigo ? { ...t, status: 'usado', checkInTime: quando ?? (leitura.tom === 'ok' ? hora(new Date().toISOString()) : t.checkInTime), checkedInAt: dados.checkedInAt ?? (leitura.tom === 'ok' ? new Date().toISOString() : t.checkedInAt) } : t))
      }
      // equipe: a lista não tem o código do ingresso; depois de entrar, recarrega a lista (e a contagem) em silêncio
      if (equipe && (leitura.tom === 'ok' || leitura.rotulo === 'Já usado')) loadTickets(evento, true)
      else if (!leitura.falha) contarIngressos(evento).then(c => { if (eventoAtual.current === evento) setContagem(c) }).catch(() => {})
    } catch {
      console.error('Erro ao validar check-in')
      if (eventoAtual.current !== evento) return
      const leitura = motivoLeitura({})
      toast.error(leitura.mensagem)
      if (minha === ultimaLeitura.current) setLastScan({
        ticket: { id: '', name: 'Leitura não concluída', ticketType: '', ticketCode: codigo, status: 'pendente', checkInTime: null, checkedInAt: null, seat: '', eventName: '' },
        leitura,
      })
    } finally {
      emVoo.current.delete(codigo)
      setValidando(emVoo.current.size > 0)
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
  const eventoSel = activeEvents.find(e => e.id === selectedEventId)

  const exportar = () => {
    downloadCsv(csvFilename(`checkin-${slugArquivo(eventoSel?.title, selectedEventId)}`), toCsv(linhasCsvCheckin(filtered), COLUNAS_CSV_CHECKIN))
    toast.info('O arquivo tem o nome dos participantes: dado pessoal (LGPD). Não compartilhe.')
  }

  // Situação dos números: nunca "0" por engano (carregando, erro, 2FA pendente) nem lista vazia sem explicar
  const refazer = () => setTentativa(n => n + 1)
  let avisoDados: ReactNode = null
  if (carga === 'erro') avisoDados = <Erro texto="Não foi possível carregar os ingressos deste evento." refetch={refazer} carregando={false} />
  else if (semDados && doisFatores === '?') avisoDados = <div aria-busy="true"><Skeleton className="h-24 rounded-[10px] bg-muted" /></div>
  else if (semDados && doisFatores === 'erro') avisoDados = <Erro texto="Não consegui confirmar o seu acesso (2FA). Sem isso a lista pode parecer vazia." refetch={refazer} carregando={false} />
  else if (semDados && doisFatores === 'sim') avisoDados = <div role="alert"><EmptyState title="Confirme o 2FA para ver os ingressos" description="Saia e entre de novo, informando o código do 2FA. Sem isso o banco não mostra os ingressos, e os números seriam zero por engano." /></div>
  else if (semDados) avisoDados = <EmptyState title="Nenhum ingresso emitido neste evento ainda" description="Quando houver venda ou cortesia, os números e a lista aparecem aqui." />

  return (
    <div>
      {/* produtor com evento: cabeçalho do evento; equipe (e produtor sem evento): título simples */}
      {!equipe && eventoSel ? (
        <CabecalhoEvento titulo={eventoSel.title} situacao={situacaoEvento(eventoSel)} detalhes={[eventoSel.date && dataBR(eventoSel.date)]} editarHref={`/producer/events/${eventoSel.id}/edit`} />
      ) : (
        <PageHeader title="Check-in" description="Validação de ingressos e controle da portaria" />
      )}
      <div className="mb-6 flex flex-wrap items-center gap-3">
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
              className={cn(selectNativo, 'min-h-11')}
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
            className="h-11"
            items={[
              { value: 'scanner', label: <><I.Escanear size={16} />Leitura</> },
              { value: 'list', label: <><I.Pessoas size={16} />Lista</> },
            ]}
          />
        </div>
      </div>

      {isEventsLoading ? (
        <div aria-busy="true" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
      ) : naoPublicado ? (
        <div role="status">
          <EmptyState
            title="Este evento ainda não está publicado"
            description={<>O check-in abre quando ele estiver no ar. Escolha outro evento acima ou <Link to={voltar} className="text-foreground underline underline-offset-4">veja seus eventos</Link>.</>}
          />
        </div>
      ) : eventsError ? (
        <div role="alert">
          <EmptyState title="Não deu para carregar os eventos" description="Confira a conexão e recarregue a página." />
        </div>
      ) : activeEvents.length === 0 ? (
        <EmptyState
          title="Nenhum evento ativo"
          description="Você precisa ter pelo menos um evento publicado para gerenciar a portaria e check-in."
        />
      ) : (
        <>
          {/* Leitura primeiro no celular: os números vêm depois dela */}
          {mode === 'scanner' && (
            <div className="space-y-4">
              <div data-tour="checkin-leitor" className="rounded-[10px] border border-border bg-card p-4 text-center sm:p-8">
                <LeitorCamera onLeitura={handleScan} ocupado={validando} codigoNaTela={lastScan && !lastScan.leitura.falha ? lastScan.ticket.ticketCode : undefined} />
                <p className="mb-3 mt-5 text-sm text-muted-foreground">Ou use o leitor de código de barras ou digite o código do ingresso</p>
                <Input
                  ref={inputRef}
                  type="text"
                  aria-label="Código do ingresso"
                  value={codigo}
                  onChange={e => {
                    // Valida sozinho só quando o código tem o formato real (uuid de 36 caracteres ou QR dinâmico E1 de 44); antes disso, só com Enter
                    if (codigoCompleto(e.target.value)) {
                      handleScan(normalizarCodigo(e.target.value))
                      setCodigo('')
                    } else setCodigo(e.target.value)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && codigo.trim().length >= 3) {
                      handleScan(normalizarCodigo(codigo))
                      setCodigo('')
                    }
                  }}
                  placeholder="Leia o QR ou digite o código do ingresso"
                  className="mx-auto h-14 max-w-md text-center font-mono text-base tracking-wide md:text-base"
                />
              </div>

              {/* Resultado da última leitura: ícone, texto e cor (a cor nunca é a única pista) */}
              {resultado && lastScan && (
                <div ref={cartaoRef} role="status" className={cn('scroll-mb-[calc(var(--barra-cel,0px)+1rem)] rounded-[10px] border-2 p-5 text-center sm:p-6', resultado.caixa)}>
                  <resultado.Icone size={48} aria-hidden="true" className={cn('mx-auto', resultado.texto)} />
                  <p className={cn('mt-2 text-2xl font-semibold leading-8', resultado.texto)}>{lastScan.leitura.rotulo}</p>
                  <h2 className="mt-2 break-words text-lg font-semibold leading-6 tracking-normal text-foreground">{lastScan.ticket.name}</h2>
                  <p className="mt-0.5 break-all text-xs text-muted-foreground">
                    {[lastScan.ticket.ticketType, lastScan.ticket.ticketCode].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">{lastScan.leitura.mensagem}</p>
                </div>
              )}
            </div>
          )}

          {/* Números */}
          <div data-tour="checkin-numeros" className={mode === 'scanner' ? 'mt-6' : undefined}>
            {carregando ? (
              <div aria-busy="true" aria-label="Carregando os números" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-[88px] rounded-[10px] bg-muted" />)}
              </div>
            ) : avisoDados ?? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <KpiCard rotulo="Total" valor={total.toLocaleString('pt-BR')} comparacao="ingressos emitidos" />
                  <KpiCard rotulo="Entradas" valor={checked.toLocaleString('pt-BR')} comparacao="check-ins feitos" />
                  <KpiCard rotulo="Restantes" valor={pending.toLocaleString('pt-BR')} comparacao={cancelled + transferidos > 0 ? `sem contar ${(cancelled + transferidos).toLocaleString('pt-BR')} cancelados ou transferidos` : 'ainda não entraram'} />
                  <KpiCard rotulo="Comparecimento" valor={`${comparecimento}%`} comparacao={`${checked.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Atualiza sozinho a cada {ATUALIZA_MS / 1000} s{atualizadoEm && ` · última atualização às ${atualizadoEm}`}
                </p>
              </>
            )}
          </div>

          {/* Lista */}
          {mode === 'list' && (
            <div className="mt-6 space-y-3">
              {ritmo.length > 0 && <RitmoDeEntrada dados={ritmo} parcial={tickets.length >= LIMITE_LISTA} limite={LIMITE_LISTA} />}

              <div className="flex flex-wrap items-end gap-3">
                <div className="relative w-full sm:max-w-md">
                  <I.Buscar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar participante" placeholder={equipe ? 'Buscar por participante...' : 'Buscar por participante ou código do ingresso...'} className="min-h-11 pl-9" />
                </div>
                <div>
                  <label htmlFor="ci-situacao" className="mb-1 block text-sm text-muted-foreground">Situação</label>
                  <select id="ci-situacao" value={situacao} onChange={e => setSituacao(e.target.value as FiltroSituacao)} className={cn(selectNativo, 'min-h-11 w-auto min-w-40')}>
                    <option value="todos">Todos</option>
                    {(Object.keys(ROTULO_SITUACAO) as (keyof typeof ROTULO_SITUACAO)[]).map(k => <option key={k} value={k}>{ROTULO_SITUACAO[k]}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ci-ordem" className="mb-1 block text-sm text-muted-foreground">Ordem</label>
                  <select id="ci-ordem" value={ordem} onChange={e => setOrdem(e.target.value as 'lista' | 'entrada')} className={cn(selectNativo, 'min-h-11 w-auto min-w-40')}>
                    <option value="lista">Mais recentes primeiro</option>
                    <option value="entrada">Hora de entrada</option>
                  </select>
                </div>
                {!equipe && (
                  <Button variant="outline" className="min-h-11 sm:ml-auto" onClick={exportar} disabled={filtered.length === 0}>
                    <I.Baixar aria-hidden="true" />Exportar CSV
                  </Button>
                )}
              </div>
              {!equipe && <p className="text-xs text-muted-foreground">O CSV tem o nome dos participantes: dado pessoal (LGPD). Não compartilhe.</p>}

              {noServidor && (
                <p className="text-xs text-muted-foreground">
                  Mostrando os {tickets.length.toLocaleString('pt-BR')} ingressos mais recentes de {total.toLocaleString('pt-BR')}. Os números acima contam todos; para achar um ingresso mais antigo, use o campo da Leitura.
                </p>
              )}
              {carregando ? (
                <div aria-busy="true" className="space-y-2">
                  {[1, 2, 3].map(n => (
                    <Skeleton key={n} className="h-16 rounded-[10px] bg-muted" />
                  ))}
                </div>
              ) : avisoDados ? null : (
                <ul className="max-h-[500px] divide-y divide-border overflow-y-auto rounded-[10px] border border-border bg-card">
                  {filtered.map(t => (
                    <li key={t.id} className="flex items-center gap-3 p-3">
                      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{iniciais(t.name ?? '')}</span>
                      <div className="min-w-0 flex-1">
                        <div className={cn('truncate text-sm font-medium', t.status === 'cancelado' ? 'text-muted-foreground' : 'text-foreground')}>{t.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[t.ticketType, t.ticketCode].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {t.status === 'usado' && (
                          <div className="flex items-center justify-end gap-1 text-xs font-semibold text-[var(--ev-success)]">
                            <I.Liberado size={14} /> {t.checkInTime ? `Confirmado às ${t.checkInTime}` : 'Confirmado'}
                          </div>
                        )}
                        {t.status === 'cancelado' && <div className="text-xs font-medium text-destructive">Cancelado</div>}
                        {t.status === 'transferido' && <div className="text-xs font-medium text-muted-foreground">Transferido</div>}
                        {t.status === 'pendente' && equipe && <div className="text-xs text-muted-foreground">Não entrou</div>}
                        {t.status === 'pendente' && !equipe && (
                          <Button size="sm" className="min-h-11" onClick={() => manualCheckIn(t)}>
                            <I.Raio /> Confirmar Entrada
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                  {filtered.length === 0 && (
                    <li className="py-12 text-center text-xs text-muted-foreground">Nenhum participante encontrado com esta busca e este filtro.</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* Recursos planejados (só o produtor): dizem o que fazem e do que dependem */}
          {!equipe && (
            <div className="mt-8">
              <SectionTitle>Em breve</SectionTitle>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <EmBreve titulo="Desfazer entrada" descricao="Cancelar um check-in feito por engano, pedindo o motivo e deixando registro. Precisa de uma função nova no banco (RPC), ainda não criada." acao="Desfazer entrada" />
                <EmBreve titulo="PIN do porteiro" descricao="Cada porteiro entra com um PIN próprio, sem usar a senha do produtor. Precisa de uma coluna e uma regra novas no banco." acao="Criar PIN" />
                <EmBreve titulo="Modo offline" descricao="Baixar a lista no aparelho e sincronizar quando a internet voltar. Precisa de service worker (fase M4). Hoje o check-in precisa de internet." acao="Ativar modo offline" />
                <EmBreve titulo="Selo de meia-entrada" descricao="Mostrar na leitura que o ingresso é meia, para conferir o documento. A função de validação precisa devolver o benefício, ainda não devolve." acao="Ver selo de meia" />
                <EmBreve titulo="Filtro por portaria e por membro" descricao="Ver as entradas por portaria e por quem fez a leitura. Depende de registrar a portaria e o membro em cada leitura (M3/M4)." acao="Filtrar por portaria" />
                <EmBreve titulo="Etiqueta e impressão" descricao="Imprimir etiqueta ou crachá do participante na entrada. Depende de modelo de etiqueta e de impressora (M4)." acao="Imprimir etiqueta" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
