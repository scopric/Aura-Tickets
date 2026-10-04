import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import YourTable from '../../components/YourTable'
import EventoCapa from '../../components/EventoCapa'
import { useOrderTickets } from '../../hooks/useCheckout'
import { usePublicEvent } from '../../hooks/useEvents'
import TicketQRCode from '../../components/TicketQRCode'
import { corSorteada, derivarCor, ehHex, varsDoEvento } from '../../lib/corEvento'
import { brl } from '../../lib/taxa'
import { soltarConfete } from '../../lib/confete'

function Confete({ cor }: { cor: string }) {
  useEffect(() => {
    const d = derivarCor(cor)
    return soltarConfete([d.cor, d.duoLuz, '#f2994a']) // cores do evento + acento quente
  }, [cor])
  return null
}

export default function CheckoutSuccess() {
  const location = useLocation()
  const navigate = useNavigate()

  const { orderId, totalAmount } = (location.state || {}) as {
    orderId?: string
    totalAmount?: number
  }

  const [showTable, setShowTable] = useState(false)
  const { data: tickets = [], isLoading } = useOrderTickets(orderId)

  useEffect(() => {
    if (!orderId) {
      toast.error('Nenhum pedido encontrado.')
      navigate('/')
    }
  }, [orderId, navigate])

  const firstTicket = tickets[0]
  const event = firstTicket?.events
  // A cor do evento vem do evento inteiro (os ingressos só trazem a capa); sem ela, o mesmo sorteio do restante do site
  const { data: eventoCompleto, isLoading: carregandoEvento } = usePublicEvent(event?.id)
  const corEv = ehHex(eventoCompleto?.accent_color) ? eventoCompleto.accent_color : corSorteada(event?.id ?? orderId ?? 'evento')

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <Spinner className="mb-4 size-8" />
        <p className="text-sm text-muted-foreground">Carregando confirmação de compra...</p>
      </div>
    )
  }

  // Sem gateway publicado, nenhum ticket nasce 'active' hoje. `some` (não `every`) porque, quando
  // a Fase 4 existir, o webhook do Pix insere tickets novos 'active' ao lado dos que o checkout já
  // criou 'cancelled' para o mesmo pedido — `every` ficaria preso em "Pedido registrado" mesmo pago.
  const ticketsActive = tickets.some(t => t.status === 'active')
  const hasCollectiveTable = tickets.some(t => t.ticket_types?.type === 'coletiva')

  // Mapeamento dos ingressos agrupados por tipo para resumo do card
  const ticketSummary = tickets.reduce((acc, t) => {
    const name = t.ticket_types?.name || 'Ingresso Geral'
    acc[name] = (acc[name] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const dataEvento = event?.date ? new Date(event.date + 'T00:00:00') : null
  const cartao = 'rounded-ev-xl bg-card p-5 shadow-ev-secondary'
  const entra = 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-lento'

  return (
    <div className="evento-cor min-h-screen bg-background pb-16 text-foreground" style={varsDoEvento(corEv)}>
      {/* Só celebra quando o pagamento está confirmado (um pedido pendente não é festa) */}
      {ticketsActive && !carregandoEvento && <Confete cor={corEv} />}

      {/* Topo na cor do evento */}
      <div className="bg-[var(--evento-fundo)] px-5 pb-20 pt-6 text-center">
        <img src="/evo/evo-corpo-joinha.webp" alt="" width={47} height={78} className="mx-auto h-[88px] w-auto" />
        {/* O Payment.tsx manda para cá assim que o gateway não devolve erro — sem Stripe/Woovi
            publicados isso nunca confirma pagamento de verdade hoje, então o texto segue o
            status real do ticket, não a suposição de que chegar aqui = pago. */}
        <h1 className={`mt-2 text-2xl font-semibold leading-8 tracking-[-0.015em] ${entra}`}>
          {ticketsActive ? 'Pagamento confirmado!' : 'Pedido registrado!'}
        </h1>
        <p className="mx-auto mt-1 max-w-md text-[15px] leading-[22px]">
          {ticketsActive
            ? 'Seus ingressos já estão em "Meus ingressos".'
            : 'Assim que o pagamento for confirmado, seus ingressos ficam ativos em "Meus ingressos".'}
        </p>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* O ingresso sobe em cima do topo colorido (cartão escuro nos dois temas, texto branco sobre a cor do evento) */}
        {event && (
          <div className={`relative -mt-14 mx-auto max-w-md overflow-hidden rounded-ev-2xl bg-[var(--evento-fundo-e)] text-white shadow-ev-2 ${entra}`}>
            <div className="relative h-[132px] overflow-hidden">
              <EventoCapa evento={{ ...event, ...eventoCompleto, id: event.id }} tamanho="faixa" />
            </div>
            <div className="px-[18px] pb-[18px] pt-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold leading-5">Evokaa</span>
                <span className="text-right text-[13px] leading-5">{Object.entries(ticketSummary).map(([name, qty]) => `${name} x${qty}`).join(', ')}</span>
              </div>
              <p className="font-display wide mt-2 break-words text-[22px] font-extrabold uppercase leading-6">{event.title}</p>
              <div className="mt-2.5 flex gap-6">
                <div>
                  <div className="text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em]">Data</div>
                  <div className="font-display text-lg font-semibold tabular-nums leading-[22px]">{dataEvento ? dataEvento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'A definir'}</div>
                </div>
                {event.time && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em]">Horário</div>
                    <div className="font-display text-lg font-semibold tabular-nums leading-[22px]">{event.time}</div>
                  </div>
                )}
                <div className="ml-auto text-right">
                  <div className="text-[11px] font-semibold uppercase leading-[14px] tracking-[0.06em]">Ingressos</div>
                  <div className="font-display text-lg font-semibold tabular-nums leading-[22px]">{tickets.length}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left: Ticket + Actions */}
          <div className="space-y-4 lg:col-span-2">
            {/* Ticket Cards */}
            {tickets.map((t, i) => (
              <div key={t.id} className={cartao}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-ev-lg bg-secondary text-muted-foreground">
                    <I.Ingressos size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-medium leading-6">{t.ticket_types?.name || 'Ingresso'}</div>
                    <div className="text-[13px] leading-5 text-muted-foreground">{t.events?.title || event?.title || 'Evento'}</div>
                  </div>
                </div>

                {/* QR só para ingresso já ativo — o de pedido pendente não passa no check-in */}
                <div className="flex items-center gap-4 rounded-ev-lg bg-secondary p-3">
                  {t.status === 'active' ? (
                    <TicketQRCode code={t.qr_code || t.code || `TK-${i + 1}`} size={80} className="shrink-0 rounded-lg" />
                  ) : (
                    <div className="grid size-20 shrink-0 place-items-center rounded-lg bg-card px-1 text-center text-[11px] leading-[14px] text-muted-foreground">
                      Aguardando pagamento
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] leading-4 text-muted-foreground">Código do Ingresso</div>
                    <div className="truncate font-display text-xs font-semibold tabular-nums">{t.qr_code || t.code}</div>
                    <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{t.events?.date ? new Date(t.events.date + 'T00:00:00').toLocaleDateString('pt-BR') : ''} · {t.events?.time || ''}</div>
                  </div>
                </div>

                {totalAmount && (
                  <div className="mt-3 flex justify-between gap-3 text-sm leading-5">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-display font-semibold tabular-nums">{brl(t.ticket_types?.price || 0)}</span>
                  </div>
                )}
              </div>
            ))}

            {tickets.length === 0 && event && (
              <div className={cartao}>
                <div className="flex justify-between gap-3 border-b border-border py-2.5 text-sm leading-5">
                  <span className="text-muted-foreground">Evento</span>
                  <span className="text-right font-medium">{event.title}</span>
                </div>
                <div className="flex justify-between gap-3 border-b border-border py-2.5 text-sm leading-5">
                  <span className="text-muted-foreground">Código do Pedido</span>
                  <span className="font-display font-semibold tabular-nums">#{orderId?.substring(0, 8).toUpperCase()}</span>
                </div>
                {totalAmount && (
                  <div className="flex justify-between gap-3 py-2.5 text-sm leading-5">
                    <span className="text-muted-foreground">Total Pago</span>
                    <span className="font-display font-semibold tabular-nums">{brl(totalAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Toggle Table View (only for collective tables) */}
            {hasCollectiveTable && (
              <Button type="button" variant="outline" size="lg" className="w-full rounded-full" onClick={() => setShowTable(!showTable)}>
                <I.Mesa size={16} />
                {showTable ? 'Ocultar Minha Mesa' : 'Ver Minha Mesa'}
              </Button>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <Button asChild size="lg" className="w-full rounded-full">
                <Link to="/app/tickets">
                  <I.Ingressos size={16} />
                  Ver meus ingressos
                </Link>
              </Button>
              {event && (
                <Button asChild variant="ghost" size="lg" className="w-full rounded-full">
                  <Link to={`/event/${event.id}`}>Voltar ao evento</Link>
                </Button>
              )}
            </div>
          </div>

          {/* Right: Your Table (matchmaking simulator) */}
          <div className="lg:col-span-3">
            {hasCollectiveTable ? (
              showTable ? (
                event && <YourTable eventId={event.id} />
              ) : (
                <div className={`${cartao} flex min-h-[320px] flex-col items-center justify-center text-center`}>
                  <div className="mb-4 grid size-14 place-items-center rounded-full bg-secondary text-muted-foreground">
                    <I.Mesa size={28} />
                  </div>
                  <h2 className="mb-2 text-2xl font-semibold">Match de Mesa</h2>
                  <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Sua mesa é formada automaticamente 24 h antes do evento, e você pode escolher a sua antes.
                    {ticketsActive && ' Seu ingresso vale normalmente no evento.'}
                  </p>
                  <button
                    onClick={() => setShowTable(true)}
                    className="mt-6 flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-4"
                  >
                    <I.Estrela size={16} />
                    Ver minha mesa
                  </button>
                </div>
              )
            ) : (
              <div className={`${cartao} flex min-h-[320px] flex-col items-center justify-center text-center`}>
                <div className="mb-4 grid size-14 place-items-center rounded-full bg-secondary text-muted-foreground">
                  <I.Ingressos size={28} />
                </div>
                <h2 className="mb-2 text-2xl font-semibold">
                  {ticketsActive ? 'Ingressos Emitidos com Sucesso!' : 'Pedido Registrado!'}
                </h2>
                <p className="mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {ticketsActive
                    ? 'Seus ingressos já estão ativos. Você pode acessá-los a qualquer momento pelo Hub Evokaa ou no aplicativo do Participante.'
                    : 'Assim que o pagamento for confirmado, seus ingressos ficam ativos e disponíveis pelo Hub Evokaa.'}
                </p>
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/app/hub">Ir para o Hub Evokaa</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
