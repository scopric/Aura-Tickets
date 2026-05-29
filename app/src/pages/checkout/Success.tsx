import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, Download, Ticket, Mail, Calendar, Users, Sparkles, Loader2, QrCode, Clipboard } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import YourTable from '../../components/YourTable'
import { useOrderTickets } from '../../hooks/useCheckout'
import { toast } from 'sonner'
import TicketQRCode from '../../components/TicketQRCode'

export default function CheckoutSuccess() {
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  
  const { orderId, totalAmount, paymentMethod } = (location.state || {}) as {
    orderId?: string
    totalAmount?: number
    paymentMethod?: 'credit_card' | 'pix'
  }

  const [showTable, setShowTable] = useState(false)
  const { data: tickets = [], isLoading } = useOrderTickets(orderId)

  useEffect(() => {
    if (!orderId) {
      toast.error('Nenhum pedido encontrado.')
      navigate('/')
    }
  }, [orderId, navigate])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.success-icon', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' })
      gsap.fromTo('.success-text', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.3 })
      gsap.fromTo('.success-card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power3.out', delay: 0.5 })
    }, ref)
    return () => ctx.revert()
  }, [])

  const copyPixCode = () => {
    navigator.clipboard.writeText('00020101021226870014br.gov.bcb.pix2565pix-key-aura@tickets.com.br5204000053039865409252.005802BR5912AURA TICKETS6009SAO PAULO62070503***6304D1B2')
    toast.success('Código Pix Copiado!')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando confirmação de compra...</p>
      </div>
    )
  }

  const firstTicket = tickets[0]
  const event = firstTicket?.events
  const hasCollectiveTable = tickets.some(t => t.ticket_types?.type === 'collective_table' || t.ticket_types?.name?.toLowerCase().includes('mesa'))

  // Mapeamento dos ingressos agrupados por tipo para resumo do card
  const ticketSummary = tickets.reduce((acc, t) => {
    const name = t.ticket_types?.name || 'Ingresso Geral'
    acc[name] = (acc[name] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div ref={ref} className="min-h-screen bg-canvas pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="success-icon w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="success-text font-serif text-3xl text-espresso mb-2">
            {paymentMethod === 'pix' ? 'Pedido Reservado!' : 'Pagamento Confirmado!'}
          </h1>
          <p className="success-text text-espresso/50">
            {paymentMethod === 'pix' 
              ? 'Realize o pagamento do Pix abaixo para ativar seus ingressos.' 
              : 'Seu ingresso foi reservado com sucesso. Enviamos os detalhes para seu e-mail.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Ticket + Actions */}
          <div className="lg:col-span-2 space-y-4">
            <div className="sticky top-24 space-y-4">
              {/* PIX Area if payment is Pix */}
              {paymentMethod === 'pix' && (
                <div className="success-card bg-white/80 border border-white/60 backdrop-blur-sm rounded-3xl p-6 text-center space-y-4 shadow-sm">
                  <h3 className="font-serif text-lg text-espresso">Pague com Pix</h3>
                  <div className="w-40 h-40 mx-auto bg-white border border-espresso/10 p-2 rounded-2xl flex items-center justify-center shadow-inner">
                    {orderId ? (
                      <TicketQRCode code={`AURA-${orderId.substring(0, 8).toUpperCase()}`} size={144} className="rounded-xl" />
                    ) : (
                      <QrCode className="w-32 h-32 text-espresso" />
                    )}
                  </div>
                  <button
                    onClick={copyPixCode}
                    className="w-full py-2.5 bg-green-600 text-cream text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 hover:bg-green-700 transition-colors"
                  >
                    <Clipboard className="w-4 h-4" />
                    Copiar Código Pix
                  </button>
                  <p className="text-[10px] text-espresso/40">Após efetuar o pagamento, seu ingresso ficará ativo imediatamente no seu Hub.</p>
                </div>
              )}

              {/* Ticket Cards */}
              {tickets.length > 0 ? (
                <div className="space-y-4">
                  {tickets.map((t, i) => (
                    <div key={t.id} className="success-card bg-void text-cream rounded-3xl p-6 text-left shadow-elevated">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                          <img src={t.events?.cover_image || '/images/hero-bg.jpg'} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{t.events?.title || event?.title || 'Evento'}</div>
                          <div className="text-xs text-cream/40">{t.ticket_types?.name || 'Ingresso'}</div>
                        </div>
                      </div>

                      {/* QR Code per ticket */}
                      <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                        <TicketQRCode code={t.qr_code || t.code || `TK-${i + 1}`} size={80} className="rounded-lg flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] text-cream/30">Código do Ingresso</div>
                          <div className="text-xs font-mono text-cream/70 truncate">{t.qr_code || t.code}</div>
                          <div className="text-[10px] text-cream/30 mt-1">{t.events?.date ? new Date(t.events.date + 'T00:00:00').toLocaleDateString('pt-BR') : ''} · {t.events?.time || ''}</div>
                        </div>
                      </div>

                      {totalAmount && (
                        <div className="flex items-center gap-2 text-xs text-cream/40">
                          <span className="text-plum font-semibold">Valor:</span>
                          <span>R$ {(t.ticket_types?.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : event && (
                <div className="success-card bg-void text-cream rounded-3xl p-6 text-left shadow-elevated">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                      <img src={event.cover_image || '/images/hero-bg.jpg'} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{event.title}</div>
                      <div className="text-xs text-cream/40">
                        {Object.entries(ticketSummary).map(([name, qty]) => `${name} x${qty}`).join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-cream/40 mb-2">
                    <Calendar className="w-3 h-3 text-plum" />
                    {event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Data a definir'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-cream/40 mb-2">
                    <Ticket className="w-3 h-3 text-plum" />
                    Código do Pedido: <span className="font-mono text-cream/70">#{orderId?.substring(0, 8).toUpperCase()}</span>
                  </div>
                  {totalAmount && (
                    <div className="flex items-center gap-2 text-xs text-cream/40">
                      <span className="text-plum font-semibold">Total Pago:</span>
                      <span>R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {hasCollectiveTable && (
                    <div className="mt-4 p-3 rounded-xl bg-plum/10 border border-plum/20">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-plum" />
                        <span className="text-xs text-cream/70">Seu matchmaking está em andamento</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Toggle Table View (only for collective tables) */}
              {hasCollectiveTable && (
                <button
                  onClick={() => setShowTable(!showTable)}
                  className="success-card w-full py-3 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {showTable ? 'Ocultar Minha Mesa' : 'Ver Minha Mesa'}
                </button>
              )}

              {/* Actions */}
              <div className="success-card space-y-3">
                <button
                  onClick={() => toast.success('Download de ingresso iniciado!')}
                  className="w-full py-3 bg-void text-cream font-medium rounded-full hover:bg-void/80 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Baixar Ingresso
                </button>
                <button
                  onClick={() => toast.success('E-mail de confirmação enviado!')}
                  className="w-full py-3 border border-espresso/15 text-espresso font-medium rounded-full hover:bg-espresso/5 transition-all flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Enviar por E-mail
                </button>
                {event && (
                  <Link
                    to={`/event/${event.id}`}
                    className="block w-full py-3 text-sm text-espresso/50 hover:text-plum transition-colors text-center"
                  >
                    Voltar ao evento
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Right: Your Table (matchmaking simulator) */}
          <div className="lg:col-span-3">
            {hasCollectiveTable ? (
              showTable ? (
                event && <YourTable eventId={event.id} />
              ) : (
                <div className="success-card bg-void text-cream rounded-3xl p-8 text-center h-full flex flex-col items-center justify-center min-h-[400px] shadow-elevated">
                  <div className="w-16 h-16 rounded-full bg-plum/20 flex items-center justify-center mb-4 animate-pulse-glow">
                    <Users className="w-8 h-8 text-plum" />
                  </div>
                  <h3 className="font-serif text-2xl mb-2">Sua Mesa Está Sendo Montada</h3>
                  <p className="text-sm text-cream/50 mb-6 max-w-sm">
                    Nosso algoritmo está analisando perfis de compatibilidade para formar 
                    o grupo ideal para você. Em 48h você recebe seus colegas de mesa.
                  </p>
                  <div className="flex items-center gap-3 mb-6">
                    {['Temperamento', 'Interesses', 'Vibe'].map((tag) => (
                      <span key={tag} className="px-3 py-1.5 bg-white/5 text-cream/50 text-xs rounded-full border border-white/10 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-plum" />
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="w-full max-w-xs">
                    <div className="flex items-center justify-between text-xs text-cream/30 mb-2">
                      <span>Analisando perfis</span>
                      <span>85%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-plum rounded-full animate-pulse" style={{ width: '85%' }} />
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTable(true)}
                    className="mt-6 text-sm text-plum hover:text-cream transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="w-4 h-4" />
                    Ver preview da minha mesa
                  </button>
                </div>
              )
            ) : (
              <div className="success-card bg-white/60 border border-white/60 backdrop-blur-sm text-espresso rounded-3xl p-8 text-center h-full flex flex-col items-center justify-center min-h-[400px] shadow-sm">
                <div className="w-16 h-16 rounded-full bg-plum/10 flex items-center justify-center mb-4">
                  <Ticket className="w-8 h-8 text-plum" />
                </div>
                <h3 className="font-serif text-2xl text-espresso mb-2">Ingressos Emitidos com Sucesso!</h3>
                <p className="text-sm text-espresso/60 mb-6 max-w-sm">
                  Seus ingressos já estão ativos. Você pode acessá-los a qualquer momento pelo Hub Evokaa ou no aplicativo do Participante.
                </p>
                <Link
                  to="/app/hub"
                  className="px-6 py-2.5 bg-plum text-cream text-xs font-semibold rounded-full hover:shadow-glow transition-all"
                >
                  Ir para o Hub Evokaa
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
