import { Link } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import EventoCapa from '../../components/EventoCapa'
import { useUserOrders } from '../../hooks/useCheckout'
import { dataCurta, horaCurta, motivoEvento } from '../../lib/ingresso'

const methodLabels: Record<string, string> = {
  credit_card: 'Cartão de Crédito',
  pix: 'PIX',
  boleto: 'Boleto',
  cashless: 'Cashless',
}

const methodIcons: Record<string, I.IconeEvokaa> = {
  credit_card: I.Cartao,
  pix: I.Qr,
  boleto: I.Recibo,
  cashless: I.Cartao,
}

// Situação do pedido: texto na cor do significado (contrato 2.1), sem caixa colorida
const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'text-[var(--ev-warning)]' },
  paid: { label: 'Pago', color: 'text-[var(--ev-success)]' },
  failed: { label: 'Falhou', color: 'text-destructive' },
  cancelled: { label: 'Cancelado', color: 'text-destructive' },
  refunded: { label: 'Reembolsado', color: 'text-muted-foreground' },
}

// "Sáb, 12 dez"; com o ano ("Sáb, 12 dez de 2025") quando não é o ano corrente
const dataDoEvento = (data?: string | null) => {
  const d = dataCurta(data)
  return d && data!.slice(0, 4) !== String(new Date().getFullYear()) ? `${d} de ${data!.slice(0, 4)}` : d
}

export default function AppOrders() {
  const { data: orders = [], isLoading, isError, refetch } = useUserOrders()

  if (isLoading) {
    return (
      <div className="max-w-3xl py-20 text-center text-foreground">
        <Spinner className="mx-auto size-6" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando suas compras...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl text-foreground">
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.015em]">Minhas Compras</h1>

      {isError && orders.length === 0 ? (
        <div role="alert" className="flex max-w-sm flex-col items-start gap-3">
          <p className="text-lg font-semibold">Não foi possível carregar suas compras.</p>
          <p className="text-[15px] text-muted-foreground">Suas compras não foram apagadas. Confira a conexão e tente de novo.</p>
          <Button variant="outline" size="lg" onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      ) : orders.length === 0 ? (
        <div role="status" className="flex max-w-sm flex-col items-start gap-3">
          <I.Ingressos size={40} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-lg font-semibold">Você ainda não fez nenhuma compra.</p>
          <Button asChild variant="outline" size="lg"><Link to="/app/events">Explorar eventos</Link></Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((order) => {
            const status = statusLabels[order.status] || { label: order.status, color: 'text-muted-foreground' }
            const MethodIcon = methodIcons[order.payment_method] || I.Cartao
            // evento que saiu do ar: a leitura dele só segue para quem tem ingresso, então num pedido sem ingresso ele vem vazio
            const foraDoAr = !order.events
            const aviso = foraDoAr ? 'Evento indisponível' : motivoEvento(order.events)
            const itens = (order.order_items ?? []).map(i => `${i.quantity}× ${i.ticket_types?.name ?? 'Ingresso'}`).join(', ')

            return (
              <li key={order.id} className="py-5 first:pt-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* a consulta de pedidos não traz a cor salva do evento (accent_color): a capa usa a cor sorteada pelo id */}
                    <EventoCapa evento={{ ...order.events, id: order.event_id, title: order.events?.title || 'Evento' }} tamanho="mini" className="!size-14" />
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg font-extrabold leading-[22px] tracking-[-0.01em] wide">
                        {foraDoAr ? 'Evento indisponível' : order.events?.title || 'Evento'}
                      </h2>
                      {itens && <p className="mt-1 text-[13px] font-medium leading-[18px]">{itens}</p>}
                      {aviso && <p role="status" className="mt-1 text-[13px] font-semibold leading-[18px] text-[var(--ev-warning)]">{aviso}. Fale com o suporte sobre este pedido.</p>}
                      {!foraDoAr && <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs leading-4 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <I.Eventos size={16} aria-hidden="true" />
                          {[dataDoEvento(order.events?.date), horaCurta(order.events?.time)].filter(Boolean).join(' · ') || 'Data a definir'}
                        </span>
                        <span className="flex items-center gap-1">
                          <I.Local size={16} aria-hidden="true" />
                          {order.events?.venue_name || 'Local a definir'}
                        </span>
                      </p>}
                      <p className="mt-1 text-xs leading-4 text-muted-foreground">
                        Pedido #{order.id.slice(0, 8).toUpperCase()}
                        {order.created_at && ` · comprado em ${new Date(order.created_at).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                  </div>
                  <span className={`flex-none text-xs font-semibold leading-4 ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-[13px] leading-[18px] text-muted-foreground">
                      <MethodIcon size={16} aria-hidden="true" />
                      {methodLabels[order.payment_method] || order.payment_method}
                    </span>
                    <span className="font-display text-lg font-semibold tabular-nums">
                      R$ {order.total_amount?.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <Link
                    to={`/app/tickets`}
                    className="flex items-center gap-1 rounded-ev-md text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:shadow-ev-foco"
                  >
                    Ver ingressos
                    <I.ChevronDireita size={16} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
