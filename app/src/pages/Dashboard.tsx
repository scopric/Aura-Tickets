import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Calendar, Users, Ticket, TrendingUp, ArrowUpRight } from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { events } from '../data/mockData'

gsap.registerPlugin(ScrollTrigger)

interface CardItem {
  id: string
  title: string
  image: string
  date: string
  location: string
}

export default function Dashboard() {
  const containerRef = useRef<HTMLDivElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  const items: CardItem[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    image: e.image,
    date: e.date,
    location: e.location,
  }))

  // Cylindrical positioning
  useEffect(() => {
    const radius = 450
    items.forEach((_, i) => {
      const el = cardRefs.current[i]
      if (!el) return
      const angle = (i / items.length) * 360
      const rad = (angle * Math.PI) / 180
      const x = Math.sin(rad) * radius
      const z = Math.cos(rad) * radius
      el.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${angle}deg)`
    })
  }, [items])

  // GSAP animations
  useEffect(() => {
    if (!carouselRef.current || !containerRef.current) return

    const ctx = gsap.context(() => {
      // Carousel rotation on scroll
      gsap.to(carouselRef.current, {
        rotationX: 360,
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      })

      // Cards floating up
      gsap.to(cardRefs.current.filter(Boolean), {
        rotationZ: 8,
        y: '-100vh',
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })
    })

    return () => ctx.revert()
  }, [])

  // Stats
  const stats = [
    { icon: Calendar, label: 'Eventos Ativos', value: '3' },
    { icon: Ticket, label: 'Ingressos Vendidos', value: '1.420' },
    { icon: Users, label: 'Participantes', value: '892' },
    { icon: TrendingUp, label: 'Receita', value: 'R$ 45.6K' },
  ]

  return (
    <div className="bg-void min-h-screen">
      {/* Header toolbar */}
      <div className="fixed top-0 left-0 right-0 z-40 glass-dark border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div>
              <h1 className="font-serif text-2xl text-cream">Dashboard</h1>
              <p className="text-xs text-cream/40">Gerencie seus eventos</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2">
                {['Música', 'Arte', 'Workshop'].map((tag) => (
                  <button
                    key={tag}
                    className="px-4 py-1.5 text-xs font-medium text-cream/60 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 hover:text-cream transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <Link
                to="/event/noite-eletro-2025"
                className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Criar Evento</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="pt-24 lg:pt-32 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-plum/20 flex items-center justify-center">
                    <stat.icon className="w-4 h-4 text-plum" />
                  </div>
                  <span className="text-xs text-cream/40 uppercase tracking-wider">{stat.label}</span>
                </div>
                <div className="font-serif text-3xl text-cream">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3D Cylindrical Gallery */}
      <div ref={containerRef} className="relative w-full h-[150vh] perspective-2000 overflow-hidden">
        {/* Floating title */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none">
          <h2 className="font-serif text-4xl sm:text-6xl lg:text-8xl text-cream/90 mb-4">
            Experiências
          </h2>
          <p className="text-cream/40 text-sm uppercase tracking-widest">Role para explorar</p>
        </div>

        {/* 3D Carousel */}
        <div
          ref={carouselRef}
          className="absolute top-1/2 left-1/2 w-[280px] h-[380px] preserve-3d -translate-x-1/2 -translate-y-1/2"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {items.map((item, i) => (
            <div
              key={item.id}
              ref={(el) => { if (el) cardRefs.current[i] = el }}
              className="absolute inset-0 backface-hidden rounded-lg shadow-2xl overflow-hidden cursor-pointer group"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              {/* Card overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="text-xs text-cream/50 uppercase tracking-wider mb-1">{item.date}</p>
                <h3 className="font-serif text-xl text-cream mb-1">{item.title}</h3>
                <p className="text-xs text-cream/40">{item.location}</p>
              </div>
              {/* Hover link */}
              <Link
                to={`/event/${item.id}`}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-plum"
              >
                <ArrowUpRight className="w-4 h-4 text-cream" />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Event List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="font-serif text-3xl text-cream mb-8">Todos os Eventos</h3>
        <div className="space-y-4">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/event/${event.id}`}
              className="group flex items-center gap-6 p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-plum/30 transition-all duration-500"
            >
              <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                <img src={event.image} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-serif text-xl text-cream mb-1 group-hover:text-plum transition-colors">{event.title}</h4>
                <p className="text-sm text-cream/40">{event.date} · {event.location}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                {event.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 text-xs text-cream/50 bg-white/5 rounded-full">{tag}</span>
                ))}
              </div>
              <ArrowUpRight className="w-5 h-5 text-cream/20 group-hover:text-plum transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
