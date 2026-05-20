import { useParams } from 'react-router'
import { useRef, useEffect, useState } from 'react'
import { MapPin, Calendar, Clock, Users, Check, ChevronDown, ChevronUp, ShoppingCart, Heart, Share2 } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { events, interestedUsers, tableStatus } from '../data/mockData'
import type { Ticket } from '../data/mockData'
import CollectiveTableCard from '../components/CollectiveTableCard'
import PreOrder from '../components/PreOrder'

gsap.registerPlugin(ScrollTrigger)

export default function EventPage() {
  const { eventId } = useParams()
  const event = events.find((e) => e.id === eventId) || events[0]
  
  const heroRef = useRef<HTMLDivElement>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  const ticketsRef = useRef<HTMLDivElement>(null)
  const socialRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)

  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [eventId])

  // Hero parallax
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero content fade in
      gsap.fromTo('.hero-event-title',
        { y: 100, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, ease: 'power3.out', delay: 0.3 }
      )
      gsap.fromTo('.hero-event-meta',
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.6 }
      )

      // Gallery parallax
      gsap.fromTo('.gallery-item',
        { y: 80, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out',
          scrollTrigger: { trigger: galleryRef.current, start: 'top 80%', toggleActions: 'play none none none' }
        }
      )

      // Ticket cards stagger
      gsap.fromTo('.ticket-card',
        { y: 60, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power3.out',
          scrollTrigger: { trigger: ticketsRef.current, start: 'top 80%', toggleActions: 'play none none none' }
        }
      )

      // Social proof items
      gsap.fromTo('.social-item',
        { x: -30, opacity: 0 },
        {
          x: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out',
          scrollTrigger: { trigger: socialRef.current, start: 'top 85%', toggleActions: 'play none none none' }
        }
      )

      // Details section
      gsap.fromTo('.detail-item',
        { y: 40, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out',
          scrollTrigger: { trigger: detailsRef.current, start: 'top 80%', toggleActions: 'play none none none' }
        }
      )
    })

    return () => ctx.revert()
  }, [])

  const addToCart = (ticketId: string) => {
    setCart((prev) => ({ ...prev, [ticketId]: (prev[ticketId] || 0) + 1 }))
  }

  const removeFromCart = (ticketId: string) => {
    setCart((prev) => {
      const updated = { ...prev }
      if (updated[ticketId] > 1) {
        updated[ticketId]--
      } else {
        delete updated[ticketId]
      }
      return updated
    })
  }

  const cartTotal = Object.entries(cart).reduce((total, [ticketId, qty]) => {
    const ticket = event.tickets.find((t) => t.id === ticketId)
    return total + (ticket ? ticket.price * qty : 0)
  }, 0)

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0)

  return (
    <div className="bg-canvas">
      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-end overflow-hidden">
        {/* Background Image with Parallax */}
        <div className="absolute inset-0">
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-void/80 to-transparent" />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-plum/40 rounded-full animate-float"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${3 + i * 0.5}s`
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 lg:pb-24 pt-32">
          {/* Tags */}
          <div className="hero-event-meta flex flex-wrap gap-2 mb-6">
            {event.tags.map((tag) => (
              <span key={tag} className="px-4 py-1.5 bg-white/10 backdrop-blur-sm text-cream/80 text-xs font-medium rounded-full border border-white/10">
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 className="hero-event-title font-serif text-5xl sm:text-7xl lg:text-[120px] leading-[0.9] text-cream mb-6">
            {event.title}
          </h1>
          <p className="hero-event-meta font-serif text-xl sm:text-2xl text-cream/60 italic mb-8 max-w-xl">
            {event.subtitle}
          </p>

          {/* Meta */}
          <div className="hero-event-meta flex flex-wrap items-center gap-6 text-cream/70">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-plum" />
              <span className="text-sm">{event.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-plum" />
              <span className="text-sm">{event.time}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-plum" />
              <span className="text-sm">{event.location}</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="hero-event-meta flex flex-wrap items-center gap-4 mt-8">
            <a
              href="#tickets"
              className="px-8 py-4 bg-plum text-cream font-medium rounded-full transition-all duration-300 hover:shadow-glow hover:scale-105"
            >
              Comprar Ingressos
            </a>
            <button className="p-4 rounded-full bg-white/10 backdrop-blur-sm text-cream border border-white/10 hover:bg-white/20 transition-all">
              <Heart className="w-5 h-5" />
            </button>
            <button className="p-4 rounded-full bg-white/10 backdrop-blur-sm text-cream border border-white/10 hover:bg-white/20 transition-all">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section ref={galleryRef} className="py-16 lg:py-24 bg-void">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl lg:text-4xl text-cream mb-12">Galeria</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {event.gallery.map((img, i) => (
              <div
                key={i}
                className={`gallery-item relative overflow-hidden rounded-xl group ${
                  i === 0 ? 'col-span-2 row-span-2' : ''
                }`}
              >
                <div className={`${i === 0 ? 'aspect-square' : 'aspect-[3/4]'}`}>
                  <img
                    src={img}
                    alt={`${event.title} - ${i + 1}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Details Section */}
      <section ref={detailsRef} className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
            {/* Description */}
            <div>
              <h2 className="detail-item font-serif text-3xl lg:text-4xl text-espresso mb-6">
                Sobre o <span className="italic text-plum">Evento</span>
              </h2>
              <p className="detail-item text-espresso/70 leading-relaxed mb-8">
                {event.description}
              </p>
              
              <div className="detail-item space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/50 border border-white/60">
                  <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-plum" />
                  </div>
                  <div>
                    <h4 className="font-medium text-espresso mb-1">Local</h4>
                    <p className="text-sm text-espresso/60">{event.location}</p>
                    <p className="text-sm text-espresso/40">{event.address}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/50 border border-white/60">
                  <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-plum" />
                  </div>
                  <div>
                    <h4 className="font-medium text-espresso mb-1">Data e Horário</h4>
                    <p className="text-sm text-espresso/60">{event.date}</p>
                    <p className="text-sm text-espresso/40">{event.time}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/50 border border-white/60">
                  <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-plum" />
                  </div>
                  <div>
                    <h4 className="font-medium text-espresso mb-1">Público</h4>
                    <p className="text-sm text-espresso/60">Maiores de 18 anos</p>
                    <p className="text-sm text-espresso/40">Dress code: Elegantérrimo</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Proof */}
            <div ref={socialRef}>
              <h2 className="detail-item font-serif text-3xl lg:text-4xl text-espresso mb-6">
                Quem Está <span className="italic text-plum">Por Dentro</span>
              </h2>
              
              {/* Interested Users */}
              <div className="detail-item mb-8">
                <h4 className="text-xs font-medium uppercase tracking-widest text-espresso/40 mb-4">
                  Atividade Recente
                </h4>
                <div className="space-y-3">
                  {interestedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="social-item flex items-center gap-3 p-3 rounded-xl bg-white/50 border border-white/60 hover:bg-white/80 transition-all"
                    >
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-espresso truncate">{user.name}</p>
                        <p className="text-xs text-espresso/50">{user.action}</p>
                      </div>
                      <span className="text-xs text-espresso/30">{user.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table Status */}
              <div className="detail-item">
                <h4 className="text-xs font-medium uppercase tracking-widest text-espresso/40 mb-4">
                  Status das Mesas
                </h4>
                <div className="space-y-3">
                  {tableStatus.map((table) => (
                    <div
                      key={table.id}
                      className="p-4 rounded-xl bg-white/50 border border-white/60"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-espresso">{table.name}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          table.status === 'full'
                            ? 'bg-red-100 text-red-600'
                            : table.status === 'filling'
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-green-100 text-green-600'
                        }`}>
                          {table.status === 'full' ? 'Lotada' : table.status === 'filling' ? 'Quase lotada' : 'Disponível'}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-espresso/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            table.status === 'full'
                              ? 'bg-red-400'
                              : table.status === 'filling'
                              ? 'bg-amber-400'
                              : 'bg-green-400'
                          }`}
                          style={{ width: `${(table.filled / table.capacity) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-espresso/40 mt-2">
                        {table.filled} de {table.capacity} lugares preenchidos
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tickets Section */}
      <section id="tickets" ref={ticketsRef} className="py-16 lg:py-24 bg-void relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-plum/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="ticket-card font-serif text-4xl lg:text-6xl text-cream mb-4">
              Ingressos
            </h2>
            <p className="ticket-card text-cream/50 max-w-xl mx-auto">
              Escolha sua experiência. Cada ingresso oferece benefícios exclusivos para tornar seu momento inesquecível.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {event.tickets.map((ticket: Ticket) => (
              ticket.type === 'coletiva' ? (
                <div key={ticket.id} className="md:col-span-2 lg:col-span-1">
                  <CollectiveTableCard
                    ticket={ticket}
                    cartQty={cart[ticket.id] || 0}
                    onAdd={() => addToCart(ticket.id)}
                    onRemove={() => removeFromCart(ticket.id)}
                    onQuantityChange={(qty) => {
                      const diff = qty - (cart[ticket.id] || 0)
                      if (diff > 0) {
                        for (let i = 0; i < diff; i++) addToCart(ticket.id)
                      } else if (diff < 0) {
                        for (let i = 0; i < Math.abs(diff); i++) removeFromCart(ticket.id)
                      }
                    }}
                  />
                </div>
              ) : (
                <div
                  key={ticket.id}
                  className="ticket-card group relative bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm transition-all duration-500 hover:border-plum/30 hover:shadow-glow"
                >
                  {/* Header */}
                  <div className="p-6 lg:p-8">
                    <h3 className="font-serif text-2xl text-cream mb-2">{ticket.name}</h3>
                    <p className="text-sm text-cream/50 mb-6">{ticket.description}</p>
                    
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="font-serif text-4xl text-cream">R$ {ticket.price}</span>
                    </div>

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-cream/40 mb-2">
                        <span>{ticket.sold} vendidos</span>
                        <span>{ticket.capacity} total</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-plum rounded-full transition-all duration-1000"
                          style={{ width: `${(ticket.sold / ticket.capacity) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Perks */}
                    <button
                      onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                      className="flex items-center gap-2 text-sm text-plum hover:text-cream transition-colors mb-4"
                    >
                      {expandedTicket === ticket.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {expandedTicket === ticket.id ? 'Ocultar benefícios' : 'Ver benefícios'}
                    </button>
                    
                    <div className={`space-y-2 transition-all duration-300 overflow-hidden ${
                      expandedTicket === ticket.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      {ticket.perks.map((perk, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-cream/60">
                          <Check className="w-4 h-4 text-plum flex-shrink-0" />
                          {perk}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cart Actions */}
                  <div className="p-6 lg:p-8 pt-0">
                    {cart[ticket.id] ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => removeFromCart(ticket.id)}
                            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-cream hover:bg-white/20 transition-colors"
                          >
                            -
                          </button>
                          <span className="text-cream font-medium">{cart[ticket.id]}</span>
                          <button
                            onClick={() => addToCart(ticket.id)}
                            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-cream hover:bg-white/20 transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-cream/60 text-sm">
                          R$ {ticket.price * cart[ticket.id]}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(ticket.id)}
                        className="w-full py-3 bg-plum text-cream font-medium rounded-full transition-all duration-300 hover:shadow-glow flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Adicionar ao Carrinho
                      </button>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </section>

      {/* Pre-Order / Comanda Digital */}
      <section className="py-16 lg:py-24 bg-void relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-plum/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <PreOrder eventId={event.id} />
        </div>
      </section>

      {/* Floating Cart */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="glass-dark border border-white/10 rounded-full px-6 py-3 flex items-center gap-4 shadow-elevated animate-pulse-glow">
            <ShoppingCart className="w-5 h-5 text-plum" />
            <span className="text-cream text-sm font-medium">{cartCount} ingresso{cartCount > 1 ? 's' : ''}</span>
            <span className="text-cream/50">|</span>
            <span className="text-cream font-medium">R$ {cartTotal}</span>
            <button className="ml-2 px-4 py-1.5 bg-plum text-cream text-xs font-medium rounded-full hover:bg-plum/80 transition-colors">
              Finalizar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
