import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Ticket, Heart, MessageSquare, QrCode, Clock, MapPin, Calendar,
  ChevronRight, Star, Share2, Download, Wine, UtensilsCrossed,
  Package, Send, User, Bell, Search, Sparkles,
  ShoppingCart, Minus, Plus, Image as ImageIcon
} from 'lucide-react'
import gsap from 'gsap'
import { menuItems } from '../../data/mockData'
import { usePublicEvents } from '../../hooks/useEvents'
import OnboardingTour from '../../components/OnboardingTour'

export default function AppHub() {
  const [activeTab, setActiveTab] = useState<'ingressos' | 'eventos' | 'cardapio' | 'chat'>('ingressos')
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [showQR, setShowQR] = useState<string | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [chatMessage, setChatMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  const { data: dbEvents = [], isLoading: isLoadingEvents } = usePublicEvents()

  const [chatMessages, setChatMessages] = useState([
    { id: '1', from: 'producer', text: 'Olá! Bem-vindo ao Noite Eletro 2025. Como posso ajudar?', time: '14:30' },
    { id: '2', from: 'user', text: 'Olá! A mesa coletiva já foi definida?', time: '14:32' },
    { id: '3', from: 'producer', text: 'Sim! Você foi alocado na Mesa Aurora. Em 48h você recebe os perfis dos colegas.', time: '14:33' },
  ])
  
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gsap.fromTo('.hub-tab-content', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' })
  }, [activeTab])

  const toggleFav = (id: string) => setFavorites(prev => ({ ...prev, [id]: !prev[id] }))

  // Meus ingressos (mantidos como simulação offline até o fluxo de checkout/compras estar ativo)
  const myTickets = [
    { id: 'tk-1', eventId: 'noite-eletro-2025', eventName: 'Noite Eletro 2025', date: '15 Jun 2025', time: '22:00', location: 'Warehouse Central', type: 'Mesa Coletiva', seat: 'Mesa Aurora #1', price: 160, qr: 'MC-001-2025', status: 'ativo' },
    { id: 'tk-2', eventId: 'noite-eletro-2025', eventName: 'Noite Eletro 2025', date: '15 Jun 2025', time: '22:00', location: 'Warehouse Central', type: 'Mesa Coletiva', seat: 'Mesa Aurora #2', price: 160, qr: 'MC-002-2025', status: 'ativo' },
    { id: 'tk-3', eventId: 'jazz-sunset', eventName: 'Jazz Sunset Session', date: '22 Jun 2025', time: '17:00', location: 'Rooftop Skyline', type: 'Ingresso VIP', seat: 'Mesa 3, Lugar 2', price: 180, qr: 'VIP-003-2025', status: 'ativo' },
  ]

  const handleSendChat = () => {
    if (!chatMessage.trim()) return
    setChatMessages(prev => [...prev, { id: Date.now().toString(), from: 'user', text: chatMessage, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
    setChatMessage('')
    setTimeout(() => {
      setChatMessages(prev => [...prev, { id: Date.now().toString() + 'r', from: 'producer', text: 'Obrigado pela mensagem! Nossa equipe responderá em breve.', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }])
    }, 1500)
  }

  const eventMenu = menuItems.filter(m => m.available)
  const cartTotal = Object.entries(cart).reduce((s, [id, qty]) => {
    const item = eventMenu.find(m => m.id === id)
    return s + (item ? item.price * qty : 0)
  }, 0)
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  const tabs = [
    { id: 'ingressos' as const, label: 'Meus Ingressos', icon: Ticket, count: myTickets.length },
    { id: 'eventos' as const, label: 'Eventos', icon: Star, count: dbEvents.length > 0 ? dbEvents.length : undefined },
    { id: 'cardapio' as const, label: 'Cardápio', icon: ShoppingCart, count: cartCount > 0 ? cartCount : undefined },
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare, count: 1 },
  ]

  const filteredEvents = dbEvents.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.venue_name || e.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div ref={ref} className="min-h-screen bg-void text-cream pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-void/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/images/logo-aura.png" alt="Aura" className="h-6 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-full bg-white/[0.05] text-cream/40 hover:text-cream transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-plum rounded-full" />
            </button>
            <button className="w-8 h-8 rounded-full bg-plum/20 flex items-center justify-center">
              <User className="w-4 h-4 text-plum" />
            </button>
          </div>
        </div>
      </header>

      {/* Welcome */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-plum/20 flex items-center justify-center">
            <User className="w-5 h-5 text-plum" />
          </div>
          <div>
            <p className="text-xs text-cream/40">Olá,</p>
            <h1 className="font-serif text-xl text-cream">Elisa Nakamura</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4 mb-6">
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-medium transition-all ${
                activeTab === t.id ? 'bg-plum text-cream shadow-lg shadow-plum/20' : 'text-cream/30 hover:text-cream/60'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-cream/20' : 'bg-white/[0.08]'}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 hub-tab-content">
        {/* === INGRESSOS === */}
        {activeTab === 'ingressos' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                <Ticket className="w-4 h-4 text-plum mx-auto mb-1" />
                <div className="font-serif text-xl text-cream">{myTickets.length}</div>
                <div className="text-[10px] text-cream/30">Ingressos</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                <Heart className="w-4 h-4 text-rose-400 mx-auto mb-1" />
                <div className="font-serif text-xl text-cream">{Object.values(favorites).filter(Boolean).length}</div>
                <div className="text-[10px] text-cream/30">Favoritos</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                <Calendar className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <div className="font-serif text-xl text-cream">{dbEvents.length}</div>
                <div className="text-[10px] text-cream/30">Eventos</div>
              </div>
            </div>

            {/* Tickets */}
            <h2 className="text-sm font-medium text-cream/60 mb-2">Meus Ingressos</h2>
            <div className="space-y-3">
              {myTickets.map(ticket => (
                <div key={ticket.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center">
                        <Ticket className="w-5 h-5 text-plum" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-cream">{ticket.eventName}</div>
                        <div className="text-[10px] text-cream/30">{ticket.type}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${ticket.status === 'ativo' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {ticket.status === 'ativo' ? 'Ativo' : 'Usado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-cream/30 mb-3">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{ticket.date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ticket.time}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ticket.location}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-3 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-plum flex-shrink-0" />
                    <span className="text-xs text-cream/50">{ticket.seat}</span>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowQR(ticket.qr)} className="flex-1 py-2.5 bg-plum text-cream text-xs font-medium rounded-xl hover:shadow-glow transition-all flex items-center justify-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5" /> Ver QR Code
                    </button>
                    <button className="p-2.5 rounded-xl bg-white/[0.05] text-cream/40 hover:text-cream transition-colors">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button className="p-2.5 rounded-xl bg-white/[0.05] text-cream/40 hover:text-cream transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Next events */}
            <h2 className="text-sm font-medium text-cream/60 mb-2 mt-6">Próximos Eventos</h2>
            <div className="space-y-2">
              {isLoadingEvents ? (
                [1, 2].map(i => (
                  <div key={i} className="h-16 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
                ))
              ) : dbEvents.length > 0 ? (
                dbEvents.slice(0, 2).map(event => (
                  <Link to={`/event/${event.id}`} key={event.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-plum/20 transition-all">
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={event.cover_image || '/images/hero-bg.jpg'} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-cream font-medium truncate">{event.title}</div>
                      <div className="text-[10px] text-cream/30">
                        {event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : 'Data a definir'} · {event.venue_name || event.location || 'Local a definir'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-cream/20" />
                  </Link>
                ))
              ) : (
                <p className="text-xs text-cream/30 italic">Nenhum evento agendado no momento.</p>
              )}
            </div>
          </div>
        )}

        {/* === EVENTOS === */}
        {activeTab === 'eventos' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/20" />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar eventos..."
                className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-cream placeholder:text-cream/20 focus:outline-none focus:border-plum/30"
              />
            </div>
            
            <div className="space-y-3">
              {isLoadingEvents ? (
                [1, 2].map(i => (
                  <div key={i} className="h-48 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse flex flex-col justify-end p-4 gap-2">
                    <div className="h-6 w-3/4 bg-white/10 rounded" />
                    <div className="h-4 w-1/2 bg-white/5 rounded" />
                  </div>
                ))
              ) : filteredEvents.length > 0 ? (
                filteredEvents.map(event => {
                  const isFav = favorites[event.id]
                  const formattedDate = event.date 
                    ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Data a definir'
                  const tags = event.tags && event.tags.length > 0 ? event.tags : (event.category ? [event.category] : [])
                  
                  return (
                    <div key={event.id} className="rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06]">
                      <div className="relative h-48">
                        <img src={event.cover_image || '/images/hero-bg.jpg'} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/20 to-transparent" />
                        <button onClick={() => toggleFav(event.id)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
                          <Heart className={`w-4 h-4 ${isFav ? 'text-rose-500 fill-rose-500' : 'text-cream/60'}`} />
                        </button>
                        <div className="absolute bottom-3 left-4 right-4">
                          <h3 className="font-serif text-lg text-cream">{event.title}</h3>
                          <p className="text-[11px] text-cream/40">{formattedDate} · {event.venue_name || event.location || 'Local a definir'}</p>
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-white/[0.05] text-cream/40 text-[10px] rounded-full">{tag}</span>
                          ))}
                        </div>
                        <Link to={`/event/${event.id}`} className="px-4 py-2 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-1">
                          Ver Ingressos <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-12 text-cream/30 text-sm italic">
                  Nenhum evento encontrado.
                </div>
              )}
            </div>
          </div>
        )}

        {/* === CARDAPIO === */}
        {activeTab === 'cardapio' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-plum/10 to-transparent border border-plum/20">
              <h3 className="text-sm font-medium text-cream mb-1">Noite Eletro 2025</h3>
              <p className="text-[11px] text-cream/40">Compre antecipado e retire no evento</p>
            </div>

            {/* Categories */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {['Todos', 'Bebidas', 'Comidas', 'Combos', 'Serviços'].map((cat, i) => (
                <button key={cat} className={`px-3 py-1.5 text-[11px] font-medium rounded-full whitespace-nowrap transition-all ${i === 0 ? 'bg-plum text-cream' : 'bg-white/[0.05] text-cream/40 hover:bg-white/10'}`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu items */}
            <div className="space-y-2">
              {eventMenu.map(item => {
                const qty = cart[item.id] || 0
                const icons: Record<string, typeof Wine> = { bebida: Wine, comida: UtensilsCrossed, combo: Package, merchandise: Package, servico: Sparkles }
                const Icon = icons[item.category] || Package
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-10 h-10 rounded-lg bg-plum/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-plum" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-cream font-medium">{item.name}</div>
                      <div className="text-[10px] text-cream/30 truncate">{item.description}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm text-cream font-medium">R$ {item.price}</div>
                      {qty > 0 ? (
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={() => { const n = { ...cart }; if (n[item.id] > 1) n[item.id]--; else delete n[item.id]; setCart(n) }} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                          <span className="text-xs w-4 text-center">{qty}</span>
                          <button onClick={() => setCart({ ...cart, [item.id]: (cart[item.id] || 0) + 1 })} className="w-6 h-6 rounded-full bg-plum flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setCart({ ...cart, [item.id]: 1 }); toast.success(`${item.name} adicionado!`) }} className="mt-1 px-3 py-1 bg-plum/20 text-plum text-[10px] rounded-full hover:bg-plum hover:text-cream transition-all">Adicionar</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Cart summary */}
            {cartCount > 0 && (
              <div className="sticky bottom-4 p-4 rounded-2xl bg-plum border border-plum/40 shadow-glow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-cream/70">{cartCount} itens</span>
                  <span className="font-serif text-xl text-cream">R$ {cartTotal}</span>
                </div>
                <button className="w-full py-2.5 bg-cream text-plum text-sm font-medium rounded-xl hover:bg-cream/90 transition-all">
                  Confirmar Pedido
                </button>
              </div>
            )}
          </div>
        )}

        {/* === CHAT === */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {/* Producer info */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-plum/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-plum" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-cream">Aura Eventos</div>
                <div className="text-[11px] text-cream/30">Noite Eletro 2025 · Produtor</div>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-green-400">Online</span>
              </div>
            </div>

            {/* Messages */}
            <div className="space-y-3 pb-4">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.from === 'user'
                      ? 'bg-plum text-cream rounded-br-md'
                      : 'bg-white/[0.06] text-cream/80 rounded-bl-md border border-white/[0.06]'
                  }`}>
                    <p className="text-[13px] leading-relaxed">{msg.text}</p>
                    <span className={`text-[9px] mt-1 block ${msg.from === 'user' ? 'text-cream/50' : 'text-cream/25'}`}>{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="sticky bottom-0 bg-void pt-2 pb-4">
              <div className="flex items-center gap-2">
                <button className="p-2.5 rounded-xl bg-white/[0.05] text-cream/30 hover:text-cream transition-colors">
                  <ImageIcon className="w-4 h-4" />
                </button>
                <input
                  value={chatMessage}
                  onChange={e => setChatMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                  placeholder="Escreva uma mensagem..."
                  className="flex-1 px-4 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-cream placeholder:text-cream/20 focus:outline-none focus:border-plum/30"
                />
                <button onClick={handleSendChat} className="p-2.5 bg-plum text-cream rounded-xl hover:shadow-glow transition-all">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Onboarding Tour */}
      <OnboardingTour role="buyer" onComplete={() => {}} />

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(null)}>
          <div className="bg-void border border-white/10 rounded-3xl p-8 max-w-xs w-full text-center shadow-elevated" onClick={e => e.stopPropagation()}>
            <h3 className="font-serif text-xl text-cream mb-2">Ingresso</h3>
            <p className="text-xs text-cream/40 mb-6">Apresente na entrada do evento</p>
            <div className="w-48 h-48 mx-auto bg-cream rounded-2xl p-4 mb-4">
              <div className="w-full h-full border-2 border-dashed border-espresso/20 rounded-xl flex items-center justify-center">
                <QrCode className="w-24 h-24 text-espresso" />
              </div>
            </div>
            <p className="text-xs text-cream/30 font-mono">{showQR}</p>
            <button onClick={() => setShowQR(null)} className="mt-6 w-full py-2.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all">Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}
