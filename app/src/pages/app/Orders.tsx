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
  pending: { label: 'Pendente', color: 'text-amber-400 bg-amber-400/10 border border-amber-400/20' },
  paid: { label: 'Pago', color: 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20' },
  completed: { label: 'Concluído', color: 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20' },
  cancelled: { label: 'Cancelado', color: 'text-rose-400 bg-rose-400/10 border border-rose-400/20' },
  refunded: { label: 'Reembolsado', color: 'text-slate-400 bg-slate-400/10 border border-slate-400/20' },
}

export default function AppOrders() {
  const { user } = useAuth()
  const { data: orders = [], isLoading } = useUserOrders()

  if (isLoading) {
    return (
      <div className="max-w-3xl flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
        <p className="text-white/60 text-sm">Carregando suas compras...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-white mb-6">Minhas Compras</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-3xl">
          <Ticket className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-sm mb-2">Você ainda não fez nenhuma compra.</p>
          <Link to="/app/events" className="text-purple-400 hover:text-purple-300 text-sm hover:underline font-medium">
            Explorar eventos
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = statusLabels[order.status] || { label: order.status, color: 'text-slate-400 bg-slate-400/10 border border-slate-400/20' }
            const MethodIcon = methodIcons[order.payment_method] || CreditCard

            return (
              <div
                key={order.id}
                className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] hover:border-purple-500/20 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={order.events?.cover_image || '/images/hero-bg.jpg'}
                      alt={order.events?.title || 'Evento'}
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                    <div>
                      <h3 className="font-semibold text-white text-sm">
                        {order.events?.title || 'Evento'}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-white/40">
                          <Calendar className="w-3 h-3" />
                          {order.created_at
                            ? new Date(order.created_at).toLocaleDateString('pt-BR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-white/40">
                          <MapPin className="w-3 h-3" />
                          {order.events?.venue_name || 'Local a definir'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color} flex-shrink-0`}>
                    {status.label}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-xs text-white/60">
                      <MethodIcon className="w-3.5 h-3.5 text-purple-400" />
                      {methodLabels[order.payment_method] || order.payment_method}
                    </span>
                    <span className="text-lg font-bold text-white">
                      R$ {order.total_amount?.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <Link
                    to={`/app/tickets`}
                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 hover:underline font-semibold"
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
