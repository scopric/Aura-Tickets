import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, Ticket, MapPin, Calendar, CreditCard, Loader2, LogIn } from 'lucide-react'
import { useState, useEffect } from 'react'
import { usePublicEvent } from '../../hooks/useEvents'
import { useAuth } from '../../hooks/useAuth'
import { toast } from 'sonner'

export default function Checkout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { eventId: stateEventId, cart: stateCart } = (location.state || {}) as { eventId?: string; cart?: Record<string, number> }

  // Recuperar carrinho pendente do sessionStorage (quando volta do login)
  const pendingCheckout = (() => {
    try {
      const raw = sessionStorage.getItem('aura_pending_checkout')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })()

  const eventId = stateEventId || pendingCheckout?.eventId
  const initialCart = stateCart || pendingCheckout?.cart || {}

  const { data: event, isLoading, error } = usePublicEvent(eventId)
  const { isAuthenticated } = useAuth()
  const [cart, setCart] = useState<Record<string, number>>(initialCart || {})

  useEffect(() => {
    if (!eventId) {
      toast.error('Nenhum evento selecionado para checkout.')
      navigate('/')
    }
  }, [eventId, navigate])

  const ticketTypes = event?.ticket_types || []

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const current = prev[id] || 0
      const next = Math.max(0, current + delta)
      if (next === 0) {
        const n = { ...prev }
        delete n[id]
        return n
      }
      return { ...prev, [id]: next }
    })
  }

  const items = Object.entries(cart).map(([id, qty]) => {
    const ticket = ticketTypes.find(t => t.id === id)
    if (!ticket) return null
    return { ...ticket, qty, total: (ticket.price || 0) * qty }
  }).filter(Boolean) as any[]

  const total = items.reduce((s, i) => s + (i.total || 0), 0)
  const fees = Number((total * 0.05).toFixed(2)) // 5% fee
  const grandTotal = total + fees

  const handleContinuePayment = () => {
    if (items.length === 0) {
      toast.error('Selecione pelo menos um ingresso para continuar.')
      return
    }
    if (!isAuthenticated) {
      // Salvar carrinho no sessionStorage para recuperar após login
      sessionStorage.setItem('aura_pending_checkout', JSON.stringify({
        eventId,
        cart,
        totalAmount: grandTotal,
        itemsSummary: items.map(i => ({ ticket_type_id: i.id, quantity: i.qty, name: i.name, price: i.price }))
      }))
      toast.info('Faça login para continuar sua compra.')
      navigate('/auth/login', { state: { from: '/checkout' } })
      return
    }
    navigate('/checkout/payment', {
      state: {
        eventId,
        cart,
        totalAmount: grandTotal,
        itemsSummary: items.map(i => ({ ticket_type_id: i.id, quantity: i.qty, name: i.name, price: i.price }))
      }
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando detalhes do seu pedido...</p>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white/60 border border-white/60 rounded-3xl p-8 backdrop-blur-sm shadow-elevated">
          <h2 className="font-serif text-2xl text-espresso mb-3">Erro no Pedido</h2>
          <p className="text-sm text-espresso/60 mb-6">Não conseguimos processar o seu pedido. Por favor, tente novamente.</p>
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar para Explorar
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-serif text-3xl text-espresso">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Tickets */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
              <h2 className="font-serif text-lg text-espresso mb-4">Ingressos</h2>
              {ticketTypes.length > 0 ? (
                ticketTypes.map(ticket => {
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
                        <button
                          onClick={() => updateQty(ticket.id, -1)}
                          className="w-8 h-8 rounded-full bg-espresso/5 flex items-center justify-center text-espresso hover:bg-plum/10 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium">{qty}</span>
                        <button
                          onClick={() => updateQty(ticket.id, 1)}
                          className="w-8 h-8 rounded-full bg-espresso/5 flex items-center justify-center text-espresso hover:bg-plum/10 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-espresso/40 italic py-4">Nenhum ingresso cadastrado para este evento.</p>
              )}
            </div>

            {/* Event Info */}
            <div className="p-5 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm">
              <h2 className="font-serif text-lg text-espresso mb-4">Resumo do Evento</h2>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={event.cover_image || '/images/hero-bg.jpg'} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-sm font-medium text-espresso">{event.title}</div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-espresso/50">
                    <Calendar className="w-3 h-3" />
                    {event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Data a definir'}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-espresso/50">
                    <MapPin className="w-3 h-3" />
                    {event.venue_name || event.location || 'Local a definir'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-2">
            <div className="p-6 rounded-2xl bg-void text-cream sticky top-24">
              <h2 className="font-serif text-xl mb-6">Resumo</h2>
              {items.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-cream/60">{item.name} x{item.qty}</span>
                      <span className="font-medium">R$ {item.total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-cream/40 italic mb-6">Seu carrinho está vazio.</p>
              )}
              
              <div className="border-t border-white/10 pt-4 space-y-2">
                <div className="flex justify-between text-sm text-cream/50">
                  <span>Subtotal</span>
                  <span>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-cream/50">
                  <span>Taxas (5%)</span>
                  <span>R$ {fees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-lg font-serif pt-2 border-t border-white/10">
                  <span>Total</span>
                  <span>R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              
              <button
                onClick={handleContinuePayment}
                disabled={items.length === 0}
                className="mt-6 w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isAuthenticated ? (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Continuar para Pagamento
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Entrar e Continuar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
