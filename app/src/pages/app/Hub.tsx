import { useState, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Ticket, Heart, MessageSquare, QrCode, Clock, MapPin, Calendar,
  ChevronRight, Star, Share2, Download, Wine, UtensilsCrossed,
  Package, Send, User, Bell, Search, Sparkles,
  ShoppingCart, Minus, Plus, Image as ImageIcon, Loader2
} from 'lucide-react'
import gsap from 'gsap'
import { usePublicEvents } from '../../hooks/useEvents'
import { useUserTickets } from '../../hooks/useCheckout'
import { useAuth } from '../../hooks/useAuth'
import TicketQRCode from '../../components/TicketQRCode'
import { useEventMenuItems } from '../../hooks/useMenuItems'
import { useChat } from '../../hooks/useChat'
import OnboardingTour from '../../components/OnboardingTour'

export default function AppHub() {
  const [activeTab, setActiveTab] = useState<'ingressos' | 'eventos' | 'cardapio' | 'chat'>('ingressos')
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [showQR, setShowQR] = useState<string | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [chatMessage, setChatMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [menuCategory, setMenuCategory] = useState<string>('Todos')
  
  const { user } = useAuth()
  const { data: dbEvents = [], isLoading: isLoadingEvents } = usePublicEvents()
  const { data: dbTickets = [], isLoading: isLoadingTickets } = useUserTickets()

  // Evento ativo para o cardápio e chat (primeiro evento dos ingressos do usuário)
  const activeEventId = useMemo(() => {
    const activeTicket = dbTickets.find(t => t.status === 'active')
    return activeTicket?.events?.id || null
  }, [dbTickets])

  const activeEventName = useMemo(() => {
    const activeTicket = dbTickets.find(t => t.status === 'active')
    return activeTicket?.events?.title || 'Evento'
  }, [dbTickets])

  const { data: dbMenuItems = [], isLoading: isLoadingMenu } = useEventMenuItems(activeEventId || undefined)
  const { messages: chatMessages, isLoading: isLoadingChat, sendMessage, markAsRead } = useChat(activeEventId)

  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gsap.fromTo('.hub-tab-content', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' })
  }, [activeTab])

  // Marcar mensagens como lidas quando abrir a aba de chat
  useEffect(() => {
    if (activeTab === 'chat' && activeEventId) {
      markAsRead.mutate()
    }
  }, [activeTab, activeEventId])

  const toggleFav = (id: string) => setFavorites(prev => ({ ...prev, [id]: !prev[id] }))

  // Mapear tickets do DB para o formato do layout
  const myTickets = (dbTickets || []).map(t => {
    const eventDate = t.events?.date
      ? new Date(t.events.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Data a definir'
    return {
      id: t.id,
      eventId: t.events?.id || t.event_id || '',
      eventName: t.events?.title || 'Evento',
      date: eventDate,
      time: t.events?.time || '--:--',
      location: t.events?.venue_name || 'Local a definir',
      type: t.ticket_types?.name || 'Ingresso',
      seat: t.seat_info || 'Livre',
      price: t.ticket_types?.price || 0,
      qr: t.code || t.qr_code || '',
      status: t.status === 'active' ? 'ativo' : t.status === 'used' ? 'usado' : t.status === 'cancelled' ? 'cancelado' : 'ativo',
    }
  })

  const handleSendChat = () => {
    if (!chatMessage.trim()) return
    sendMessage.mutate(chatMessage, {
      onSuccess: () => setChatMessage(''),
      onError: (err: any) => toast.error(err.message || 'Erro ao enviar mensagem'),
    })
  }

  const cartTotal = Object.entries(cart).reduce((s, [id, qty]) => {
    const item = dbMenuItems.find(m => m.id === id)
    return s + (item ? item.price * qty : 0)
  }, 0)
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  const tabs = [
    { id: 'ingressos' as const, label: 'Meus Ingressos', icon: Ticket, count: myTickets.length > 0 ? myTickets.length : undefined },
    { id: 'eventos' as const, label: 'Eventos', icon: Star, count: dbEvents.length > 0 ? dbEvents.length : undefined },
    { id: 'cardapio' as const, label: 'Cardápio', icon: ShoppingCart, count: cartCount > 0 ? cartCount : undefined },
    { id: 'chat' as const, label: 'Chat', icon: MessageSquare, count: 1 },
  ]

  const filteredEvents = dbEvents.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.venue_name || e.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  )  const renderStats = () => (
    <div className="grid grid-cols-3 gap-3">
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
        <Ticket className="w-4 h-4 text-plum mx-auto mb-1" />
        <div className="font-serif text-xl text-cream">{isLoadingTickets ? '...' : myTickets.length}</div>
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
  )

  const renderTickets = () => (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-cream/70 mb-2 flex items-center gap-1.5"><Ticket className="w-4 h-4 text-plum" /> Meus Ingressos</h2>
      {isLoadingTickets ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : myTickets.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
          <Ticket className="w-8 h-8 text-cream/20 mx-auto mb-3" />
          <p className="text-sm text-cream/40">Você ainda não tem ingressos.</p>
          <p className="text-[11px] text-cream/25 mt-1 mb-4">Explore eventos e faça sua primeira compra!</p>
          <button onClick={() => setActiveTab('eventos')} className="px-4 py-2 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all">
            Explorar Eventos
          </button>
        </div>
      ) : (
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
              <div className="flex items-center gap-4 text-[11px] text-cream/30 mb-3 overflow-x-auto pb-1">
                <span className="flex items-center gap-1 whitespace-nowrap"><Calendar className="w-3 h-3" />{ticket.date}</span>
                <span className="flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" />{ticket.time}</span>
                <span className="flex items-center gap-1 whitespace-nowrap"><MapPin className="w-3 h-3" />{ticket.location}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-3 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-plum flex-shrink-0" />
                <span className="text-xs text-cream/50">{ticket.seat}</span>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button onClick={() => setShowQR(ticket.qr)} className="flex-1 py-2 bg-plum text-cream text-xs font-medium rounded-xl hover:shadow-glow transition-all flex items-center justify-center gap-1.5">
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
      )}
    </div>
  )

  const renderNextEvents = () => (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-cream/70 mb-2 mt-6">Próximos Eventos</h2>
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
  )

  const renderEventosList = () => (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-cream/70 mb-2 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-plum" /> Descobrir Eventos</h2>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/20" />
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar eventos..."
          className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-cream placeholder:text-cream/25 focus:outline-none focus:border-plum/30 transition-colors"
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
                <div className="relative h-44">
                  <img src={event.cover_image || '/images/hero-bg.jpg'} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] via-transparent to-transparent" />
                  <button onClick={() => toggleFav(event.id)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
                    <Heart className={`w-4 h-4 ${isFav ? 'text-rose-500 fill-rose-500' : 'text-cream/60'}`} />
                  </button>
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="font-serif text-base text-cream">{event.title}</h3>
                    <p className="text-[10px] text-cream/40">{formattedDate} · {event.venue_name || event.location || 'Local a definir'}</p>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-[60%] scrollbar-none">
                    {tags.slice(0, 2).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-white/[0.05] text-cream/40 text-[9px] rounded-full whitespace-nowrap">{tag}</span>
                    ))}
                  </div>
                  <Link to={`/event/${event.id}`} className="px-3.5 py-1.5 bg-plum text-cream text-[11px] font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-1">
                    Ingressos <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 text-cream/30 text-xs italic">
            Nenhum evento encontrado.
          </div>
        )}
      </div>
    </div>
  )

  const renderCardapio = () => (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-cream/70 mb-2 flex items-center gap-1.5"><ShoppingCart className="w-4 h-4 text-plum" /> Cardápio do Evento</h2>
      {activeEventId ? (
        <>
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-plum/10 to-transparent border border-plum/20">
            <h3 className="text-xs font-semibold text-cream mb-0.5 truncate">
              {activeEventName}
            </h3>
            <p className="text-[10px] text-cream/40">Compre antecipado e retire no local</p>
          </div>

          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
            {['Todos', 'bebida', 'comida', 'combo', 'servico'].map((cat) => (
              <button 
                key={cat} 
                onClick={() => setMenuCategory(cat)}
                className={`px-3 py-1 text-[10px] font-medium rounded-full whitespace-nowrap transition-all ${menuCategory === cat ? 'bg-plum text-cream' : 'bg-white/[0.05] text-cream/40 hover:bg-white/10'}`}
              >
                {cat === 'Todos' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Menu items */}
          {isLoadingMenu ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-plum animate-spin" />
            </div>
          ) : dbMenuItems.length === 0 ? (
            <div className="text-center py-8 text-cream/30 text-xs">
              Cardápio não disponível para este evento.
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {dbMenuItems
                .filter(item => menuCategory === 'Todos' || item.category === menuCategory)
                .map(item => {
                  const qty = cart[item.id] || 0
                  const icons: Record<string, typeof Wine> = { bebida: Wine, comida: UtensilsCrossed, combo: Package, merchandise: Package, servico: Sparkles }
                  const Icon = icons[item.category] || Package
                  return (
                    <div key={item.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="w-8 h-8 rounded-lg bg-plum/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3.5 h-3.5 text-plum" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-cream font-medium truncate">{item.name}</div>
                        <div className="text-[9px] text-cream/30 truncate">{item.description}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-cream font-medium">R$ {item.price}</div>
                        {qty > 0 ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <button onClick={() => { const n = { ...cart }; if (n[item.id] > 1) n[item.id]--; else delete n[item.id]; setCart(n) }} className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs hover:bg-white/20 transition-all"><Minus className="w-2.5 h-2.5" /></button>
                            <span className="text-[11px] w-3 text-center">{qty}</span>
                            <button onClick={() => setCart({ ...cart, [item.id]: (cart[item.id] || 0) + 1 })} className="w-5 h-5 rounded-full bg-plum flex items-center justify-center text-xs hover:shadow-glow transition-all"><Plus className="w-2.5 h-2.5" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setCart({ ...cart, [item.id]: 1 }); toast.success(`${item.name} adicionado!`) }} className="mt-0.5 px-2.5 py-0.5 bg-plum/20 text-plum text-[9px] rounded-full hover:bg-plum hover:text-cream transition-all">Adicionar</button>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
          <ShoppingCart className="w-8 h-8 text-cream/10 mx-auto mb-2" />
          <p className="text-cream/35 text-xs mb-1">Você não tem ingressos ativos</p>
          <p className="text-cream/20 text-[10px]">Compre um ingresso para ver o cardápio do evento</p>
        </div>
      )}

      {/* Cart summary */}
      {cartCount > 0 && (
        <div className="p-3 rounded-xl bg-plum border border-plum/40 shadow-glow mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-cream/70">{cartCount} itens</span>
            <span className="font-serif text-base text-cream">R$ {cartTotal}</span>
          </div>
          <button className="w-full py-1.5 bg-cream text-plum text-xs font-semibold rounded-lg hover:bg-cream/90 transition-all">
            Confirmar Pedido
          </button>
        </div>
      )}
    </div>
  )

  const renderChat = () => (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-cream/70 mb-2 flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-plum" /> Chat com o Produtor</h2>
      {!activeEventId ? (
        <div className="text-center py-8 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
          <MessageSquare className="w-8 h-8 text-cream/10 mx-auto mb-2" />
          <p className="text-cream/35 text-xs mb-1">Chat disponível para eventos ativos</p>
          <p className="text-cream/20 text-[10px]">Adquira um ingresso para conversar com o produtor</p>
        </div>
      ) : (
        <>
          {/* Producer info */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-plum/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-plum" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-cream truncate">Produtor</div>
                <div className="text-[9px] text-cream/30 truncate">{activeEventName}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] text-green-400">Online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="border border-white/[0.06] rounded-xl p-3 bg-white/[0.01] h-[220px] overflow-y-auto flex flex-col justify-between">
            {isLoadingChat ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 text-plum animate-spin" />
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="text-center py-8 my-auto">
                <MessageSquare className="w-6 h-6 text-cream/10 mx-auto mb-2" />
                <p className="text-cream/35 text-xs">Nenhuma mensagem ainda</p>
                <p className="text-cream/20 text-[10px] mt-0.5">Envie uma mensagem para o produtor!</p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-2.5 rounded-xl ${
                      msg.sender_id === user?.id
                        ? 'bg-plum text-cream rounded-br-none'
                        : 'bg-white/[0.06] text-cream/80 rounded-bl-none border border-white/[0.06]'
                    }`}>
                      <p className="text-xs leading-normal">{msg.content}</p>
                      <span className={`text-[8px] mt-0.5 block text-right ${msg.sender_id === user?.id ? 'text-cream/50' : 'text-cream/25'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-1.5">
            <input
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              placeholder="Escreva uma mensagem..."
              disabled={sendMessage.isPending}
              className="flex-1 px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-xs text-cream placeholder:text-cream/20 focus:outline-none focus:border-plum/30 disabled:opacity-50 transition-colors"
            />
            <button 
              onClick={handleSendChat} 
              disabled={sendMessage.isPending || !chatMessage.trim()}
              className="p-2 bg-plum text-cream rounded-xl hover:shadow-glow transition-all disabled:opacity-50"
            >
              {sendMessage.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div ref={ref} className="w-full bg-void text-cream pb-8">
      {/* Welcome */}
      <div className="max-w-lg lg:max-w-7xl mx-auto px-4 py-4 lg:py-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-plum/20 flex items-center justify-center ring-1 ring-plum/30">
            <User className="w-5 h-5 text-plum" />
          </div>
          <div>
            <p className="text-xs text-cream/40">Olá,</p>
            <h1 className="font-serif text-xl text-cream">{user?.full_name || user?.name || 'Participante'}</h1>
          </div>
        </div>
      </div>

      {/* Layout Responsivo: Grid no Desktop / Abas no Mobile */}
      <div className="max-w-lg lg:max-w-7xl mx-auto px-4">
        {/* Seletor de Abas (Visível apenas no Mobile) */}
        <div className="lg:hidden mb-6">
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

        {/* Visualização Mobile (Abas) */}
        <div className="lg:hidden hub-tab-content space-y-4">
          {activeTab === 'ingressos' && (
            <div className="space-y-6">
              {renderStats()}
              {renderTickets()}
              {renderNextEvents()}
            </div>
          )}
          {activeTab === 'eventos' && renderEventosList()}
          {activeTab === 'cardapio' && renderCardapio()}
          {activeTab === 'chat' && renderChat()}
        </div>

        {/* Visualização Desktop (Grid Completo de 3 Colunas) */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6">
          {/* Coluna 1: Ingressos & Stats (4 colunas) */}
          <div className="lg:col-span-4 space-y-6">
            {renderStats()}
            {renderTickets()}
            {renderNextEvents()}
          </div>

          {/* Coluna 2: Busca & Descobrir Eventos (4 colunas) */}
          <div className="lg:col-span-4 space-y-6">
            {renderEventosList()}
          </div>

          {/* Coluna 3: Interação Local - Cardápio & Chat do Evento Ativo (4 colunas) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md">
              {renderCardapio()}
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md">
              {renderChat()}
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Tour */}
      <OnboardingTour role="buyer" onComplete={() => {}} />

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(null)}>
          <div className="bg-void border border-white/10 rounded-3xl p-8 max-w-xs w-full text-center shadow-elevated" onClick={e => e.stopPropagation()}>
            <h3 className="font-serif text-xl text-cream mb-2">Ingresso</h3>
            <p className="text-xs text-cream/40 mb-6">Apresente na entrada do evento</p>
            <div className="w-48 h-48 mx-auto mb-4">
              <TicketQRCode code={showQR} size={192} className="rounded-2xl" />
            </div>
            <p className="text-xs text-cream/30 font-mono">{showQR}</p>
            <button onClick={() => setShowQR(null)} className="mt-6 w-full py-2.5 bg-plum text-cream text-xs rounded-full hover:shadow-glow transition-all">Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}
