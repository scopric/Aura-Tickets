import { Link } from 'react-router-dom'
import { Calendar, MapPin, CreditCard, QrCode, Loader2, Ticket, ChevronRight } from 'lucide-react'
import { useUserOrders } from '../../hooks/useCheckout'
import { useAuth } from '../../hooks/useAuth'

const methodLabels: Record<string, string> = {
  credit_card: 'Cartão de Crédito',
  pix: 'PIX',
  boleto: 'Boleto',
  cashless: 'Cashless',
}

const methodIcons: Record<string, typeof CreditCard> = {
  credit_card: CreditCard,
  pix: QrCode,
  boleto: Ticket,
  cashless: CreditCard,
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'text-amber-600 bg-amber-50' },
  paid: { label: 'Pago', color: 'text-green-600 bg-green-50' },
  completed: { label: 'Concluído', color: 'text-green-600 bg-green-50' },
  cancelled: { label: 'Cancelado', color: 'text-red-500 bg-red-50' },
  refunded: { label: 'Reembolsado', color: 'text-gray-500 bg-gray-50' },
}

export default function AppOrders() {
  const { user } = useAuth()
  const { data: orders = [], isLoading } = useUserOrders()

  if (isLoading) {
    return (
      <div className="max-w-3xl flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando suas compras...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif text-3xl text-espresso mb-6">Minhas Compras</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white/60 border border-white/60 rounded-3xl">
          <Ticket className="w-12 h-12 text-espresso/10 mx-auto mb-4" />
          <p className="text-espresso/40 text-sm mb-2">Você ainda não fez nenhuma compra.</p>
          <Link to="/app/events" className="text-plum text-sm hover:underline">
            Explorar eventos
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = statusLabels[order.status] || { label: order.status, color: 'text-gray-600 bg-gray-50' }
            const MethodIcon = methodIcons[order.payment_method] || CreditCard

            return (
              <div
                key={order.id}
                className="p-5 rounded-2xl bg-white/60 border border-white/60 hover:border-plum/20 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={order.events?.cover_image || '/images/hero-bg.jpg'}
                      alt={order.events?.title || 'Evento'}
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                    <div>
                      <h3 className="font-medium text-espresso text-sm">
                        {order.events?.title || 'Evento'}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-espresso/30">
                          <Calendar className="w-3 h-3" />
                          {order.created_at
                            ? new Date(order.created_at).toLocaleDateString('pt-BR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-espresso/30">
                          <MapPin className="w-3 h-3" />
                          {order.events?.venue_name || 'Local a definir'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.color} flex-shrink-0`}>
                    {status.label}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/60">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-xs text-espresso/50">
                      <MethodIcon className="w-3.5 h-3.5" />
                      {methodLabels[order.payment_method] || order.payment_method}
                    </span>
                    <span className="font-serif text-lg text-espresso">
                      R$ {order.total_amount?.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <Link
                    to={`/app/tickets`}
                    className="flex items-center gap-1 text-xs text-plum hover:underline"
                  >
                    Ver ingressos
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
