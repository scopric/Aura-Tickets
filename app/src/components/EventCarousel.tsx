import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Calendar, MapPin, Ticket, Sparkles } from 'lucide-react'
import { useFeaturedEvents } from '../hooks/useEvents'

export default function EventCarousel() {
  const { data: featuredEvents = [], isLoading } = useFeaturedEvents()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isTouchActive, setIsTouchActive] = useState(false)
  const touchStart = useRef(0)
  const touchEnd = useRef(0)

  // Autoplay timer
  useEffect(() => {
    if (featuredEvents.length <= 1) return
    const timer = setInterval(() => {
      handleNext()
    }, 6000)
    return () => clearInterval(timer)
  }, [activeIndex, featuredEvents.length])

  const handleNext = () => {
    if (featuredEvents.length <= 1) return
    setActiveIndex((prev) => (prev + 1) % featuredEvents.length)
  }

  const handlePrev = () => {
    if (featuredEvents.length <= 1) return
    setActiveIndex((prev) => (prev - 1 + featuredEvents.length) % featuredEvents.length)
  }

  const handleDotClick = (index: number) => {
    setActiveIndex(index)
  }

  // Swipe handlers para mobile/touch
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.targetTouches[0].clientX
    setIsTouchActive(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX
  }

  const handleTouchEnd = () => {
    setIsTouchActive(false)
    const threshold = 50 // px mínimos para registrar o swipe
    if (touchStart.current - touchEnd.current > threshold && touchEnd.current !== 0) {
      handleNext()
    } else if (touchStart.current - touchEnd.current < -threshold && touchEnd.current !== 0) {
      handlePrev()
    }
    // Resetar coordenadas
    touchStart.current = 0
    touchEnd.current = 0
  }

  if (isLoading) {
    return (
      <div className="w-full h-[380px] md:h-[480px] rounded-3xl bg-white/[0.01] border border-white/[0.05] flex items-center justify-center animate-pulse">
        <div className="text-center">
          <Ticket className="w-8 h-8 text-[#8f33f5] animate-spin mx-auto mb-3" />
          <p className="text-xs text-white/30">Carregando destaques...</p>
        </div>
      </div>
    )
  }

  if (featuredEvents.length === 0) {
    return null
  }

  return (
    <div className="relative w-full h-[380px] md:h-[480px] rounded-3xl overflow-hidden shadow-2xl border border-white/[0.06] group bg-[#0a0b10]">
      {/* Trilha deslizante do Carrossel (overflow contido na moldura principal) */}
      <div 
        className="flex w-full h-full transition-transform duration-700 ease-out cursor-grab active:cursor-grabbing select-none"
        style={{
          transform: `translateX(-${activeIndex * 100}%)`
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {featuredEvents.map((event, i) => {
          const isActive = i === activeIndex
          const formattedDate = event.date
            ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })
            : 'Data a definir'

          return (
            <div
              key={event.id}
              className="w-full h-full flex-shrink-0 relative overflow-hidden"
            >
              {/* Imagem de Fundo com zoom suave e fade */}
              <div 
                className={`absolute inset-0 w-full h-full bg-cover bg-center transition-all ease-out ${
                  isActive ? 'scale-105 opacity-100' : 'scale-100 opacity-0'
                }`}
                style={{ 
                  backgroundImage: `url(${event.cover_image || '/images/hero-bg.jpg'})`,
                  transitionDuration: '10000ms'
                }}
              />
              
              {/* Degradê escuro de sobreposição para contraste perfeito de leitura */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent md:bg-gradient-to-r md:from-slate-950 md:via-slate-950/40 md:to-transparent" />

              {/* Conteúdo Informativo */}
              <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 lg:p-16 md:justify-center md:max-w-xl z-10 text-left">
                <div className={`space-y-4 md:space-y-6 transition-all duration-700 delay-100 transform ${
                  isActive ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                }`}>
                  {/* Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8f33f5]/20 border border-[#8f33f5]/30 text-white text-[10px] font-bold uppercase tracking-wider w-max">
                    <Sparkles className="w-3.5 h-3.5 text-[#8f33f5] animate-pulse" />
                    Destaque Evokaa
                  </div>

                  {/* Título do Evento */}
                  <div className="space-y-2">
                    <h2 className="font-serif text-2xl md:text-4xl lg:text-5xl text-white leading-tight drop-shadow-md">
                      {event.title}
                    </h2>
                    {event.subtitle && (
                      <p className="text-xs md:text-sm text-white/70 line-clamp-2 leading-relaxed font-light">
                        {event.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Detalhes do Evento */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-white/80 text-xs md:text-sm font-light">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#1d68c4]" />
                      <span>{formattedDate} {event.time ? `às ${event.time}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#1d68c4]" />
                      <span>{event.venue_city || event.venue_name || 'Local a definir'}</span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-4 pt-2">
                    <Link 
                      to={`/event/${event.id}`}
                      className="px-6 py-3 bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] text-white text-xs font-bold rounded-full hover:shadow-[0_0_20px_rgba(143,51,245,0.4)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 flex items-center gap-2"
                    >
                      Garantir Ingresso
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                      {event.category || 'Outros'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Setas Laterais de Navegação */}
      {featuredEvents.length > 1 && (
        <>
          <button 
            onClick={handlePrev}
            className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-950/40 hover:bg-slate-950/80 border border-white/10 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm z-20 hover:scale-105"
            aria-label="Destaque anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={handleNext}
            className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-950/40 hover:bg-slate-950/80 border border-white/10 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm z-20 hover:scale-105"
            aria-label="Próximo destaque"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Pontos de Paginação inferior */}
      {featuredEvents.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
          {featuredEvents.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex 
                  ? 'w-6 bg-gradient-to-r from-[#1d68c4] to-[#8f33f5]' 
                  : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
