import { Link } from 'react-router'
import { ArrowLeft, Minus, Plus, Ticket, MapPin, Calendar, CreditCard } from 'lucide-react'
import { useState } from 'react'
import { events } from '../../data/mockData'

export default function Checkout() {
  const event = events[0]
  const [cart, setCart] = useState<Record<string, number>>({ 'ingresso-geral': 2 })

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const current = prev[id] || 0
      const next = Math.max(0, current + delta)
      if (next === 0) { const n = { ...prev }; delete n[id]; return n }
      return { ...prev, [id]: next }
    })
  }

  const items = Object.entries(cart).map(([id, qty]) => {
    const ticket = event.tickets.find(t => t.id === id)
    return { ...ticket, qty, total: (ticket?.price || 0) * qty }
  }).filter(Boolean)

  const total = items.reduce((s, i) => s + (i.total || 0), 0)
  const fees = Math.round(total * 0.05)
  const grandTotal = total + fees

  return (
    <div className="min-h-screen bg-canvas pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to={`/event/${event.id}`} className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-serif text-3xl text-espresso">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Tickets */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
              <h2 className="font-serif text-lg text-espresso mb-4">Ingressos</h2>
              {event.tickets.map(ticket => {
                const qty = cart[ticket.id] || 0
                return (
                  <div key={ticket.id} className="flex items-center gap-4 py-4 border-b border-espresso/5 last:border-0">
                    <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center">
                      <Ticket className="w-5 h-5 text-plum" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-espresso">{ticket.name}</div>
                      <div className="text-xs text-espresso/40">R$ {ticket.price} cada</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(ticket.id, -1)} className="w-8 h-8 rounded-full bg-espresso/5 flex items-center justify-center text-espresso hover:bg-plum/10 transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{qty}</span>
                      <button onClick={() => updateQty(ticket.id, 1)} className="w-8 h-8 rounded-full bg-espresso/5 flex items-center justify-center text-espresso hover:bg-plum/10 transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Event Info */}
            <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
              <h2 className="font-serif text-lg text-espresso mb-4">Resumo do Evento</h2>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={event.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-sm font-medium text-espresso">{event.title}</div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-espresso/50">
                    <Calendar className="w-3 h-3" />
                    {event.date}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-espresso/50">
                    <MapPin className="w-3 h-3" />
                    {event.location}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-2">
            <div className="p-6 rounded-2xl bg-void text-cream sticky top-24">
              <h2 className="font-serif text-xl mb-6">Resumo</h2>
              <div className="space-y-3 mb-6">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-cream/60">{item.name} x{item.qty}</span>
                    <span className="font-medium">R$ {item.total?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-cream/50">
                  <span>Subtotal</span>
                  <span>R$ {total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-cream/50">
                  <span>Taxas (5%)</span>
                  <span>R$ {fees.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-serif pt-2 border-t border-white/10">
                  <span>Total</span>
                  <span>R$ {grandTotal.toLocaleString()}</span>
                </div>
              </div>
              <Link
                to="/checkout/payment"
                className="mt-6 w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Continuar para Pagamento
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
