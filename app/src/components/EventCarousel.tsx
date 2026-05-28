import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Calendar, MapPin, Ticket, Sparkles } from 'lucide-react'
import gsap from 'gsap'
import { useFeaturedEvents } from '../hooks/useEvents'
import type { DbEvent } from '../hooks/useEvents'


export default function EventCarousel() {
  const { data: featuredEvents = [], isLoading } = useFeaturedEvents()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const slideRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Autoplay timer
  useEffect(() => {
    if (featuredEvents.length <= 1 || isAnimating) return
    const timer = setInterval(() => {
      handleNext()
    }, 6000)
    return () => clearInterval(timer)
  }, [activeIndex, featuredEvents.length, isAnimating])

  // GSAP Transition Animation
  const animateSlide = (direction: 'next' | 'prev', newIndex: number) => {
    if (isAnimating || !slideRef.current) return
    setIsAnimating(true)

    const tl = gsap.timeline({
      onComplete: () => {
        setActiveIndex(newIndex)
        setIsAnimating(false)
      }
    })

    // Fade out text e zoom out imagem
    tl.to(contentRef.current, { y: -20, opacity: 0, duration: 0.3, ease: 'power2.in' })
    tl.to(imageRef.current, { scale: 1.05, opacity: 0.3, duration: 0.3, ease: 'power2.in' }, 0)
    
    // Transicionar estado (no callback do timeline ou logo após)
    tl.add(() => {
      // O estado é atualizado ao final da animação, mas para fazer o efeito de entrada:
      // Nós forçamos a troca de dados instantânea e depois fazemos a animação de entrada.
    })

    // Entrada: resetar e animar
    tl.set(contentRef.current, { y: 20, opacity: 0 })
    tl.set(imageRef.current, { scale: 1.15, opacity: 0 })
    
    tl.to(imageRef.current, { scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out' })
    tl.to(contentRef.current, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, '-=0.3')
  }

  const handleNext = () => {
    if (featuredEvents.length <= 1 || isAnimating) return
    const nextIndex = (activeIndex + 1) % featuredEvents.length
    animateSlide('next', nextIndex)
  }

  const handlePrev = () => {
    if (featuredEvents.length <= 1 || isAnimating) return
    const prevIndex = (activeIndex - 1 + featuredEvents.length) % featuredEvents.length
    animateSlide('prev', prevIndex)
  }

  const handleDotClick = (index: number) => {
    if (index === activeIndex || isAnimating) return
    const direction = index > activeIndex ? 'next' : 'prev'
    animateSlide(direction, index)
  }

  if (isLoading) {
    return (
      <div className="w-full h-[380px] md:h-[480px] rounded-3xl bg-white/20 border border-white/30 flex items-center justify-center animate-pulse">
        <div className="text-center">
          <Ticket className="w-8 h-8 text-plum animate-spin mx-auto mb-3" />
          <p className="text-xs text-espresso/40">Carregando destaques...</p>
        </div>
      </div>
    )
  }

  if (featuredEvents.length === 0) {
    return null
  }

  const currentEvent = featuredEvents[activeIndex]
  const formattedDate = currentEvent.date
    ? new Date(currentEvent.date + 'T00:00:00').toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : 'Data a definir'

  return (
    <div 
      ref={slideRef} 
      className="relative w-full h-[400px] md:h-[500px] rounded-3xl overflow-hidden shadow-2xl border border-white/60 group"
      style={{
        background: 'linear-gradient(to right, #1a0e14, #2d1624)'
      }}
    >
      {/* Background Image with Zoom & Overlay */}
      <div 
        ref={imageRef}
        className="absolute inset-0 w-full h-full transition-transform duration-700 bg-cover bg-center opacity-70"
        style={{ 
          backgroundImage: `url(${currentEvent.cover_image || '/images/hero-bg.jpg'})`,
          transformOrigin: 'center'
        }}
      />
      
      {/* Gradient Overlay for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#13090e] via-[#1a0e14]/60 to-transparent md:bg-gradient-to-r md:from-[#13090e]/90 md:via-[#1a0e14]/50 md:to-transparent" />

      {/* Content Container */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 lg:p-16 md:justify-center md:max-w-xl z-10">
        <div ref={contentRef} className="space-y-4 md:space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-plum/20 border border-plum/30 text-cream text-[10px] font-bold uppercase tracking-wider w-max">
            <Sparkles className="w-3.5 h-3.5 text-cream animate-pulse" />
            Destaque Evokaa
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="font-serif text-2xl md:text-4xl lg:text-5xl text-cream leading-tight drop-shadow-md">
              {currentEvent.title}
            </h2>
            {currentEvent.subtitle && (
              <p className="text-xs md:text-sm text-cream/70 line-clamp-2 leading-relaxed">
                {currentEvent.subtitle}
              </p>
            )}
          </div>

          {/* Event details */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-cream/80 text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-plum" />
              <span>{formattedDate} {currentEvent.time ? `às ${currentEvent.time}` : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-plum" />
              <span>{currentEvent.venue_city || currentEvent.venue_name || 'Local a definir'}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-2">
            <Link 
              to={`/event/${currentEvent.id}`}
              className="px-6 py-3 bg-plum text-cream text-xs font-bold rounded-full hover:shadow-glow hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
              Garantir Ingresso
              <ChevronRight className="w-4 h-4" />
            </Link>
            <span className="text-[10px] text-cream/40 uppercase tracking-widest font-semibold bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">
              {currentEvent.category || 'Outros'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {featuredEvents.length > 1 && (
        <>
          <button 
            onClick={handlePrev}
            disabled={isAnimating}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#13090e]/40 hover:bg-[#13090e]/80 border border-white/10 text-cream flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm z-20 hover:scale-105"
            aria-label="Destaque anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={handleNext}
            disabled={isAnimating}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#13090e]/40 hover:bg-[#13090e]/80 border border-white/10 text-cream flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm z-20 hover:scale-105"
            aria-label="Próximo destaque"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Pagination Dots */}
      {featuredEvents.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
          {featuredEvents.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex 
                  ? 'w-6 bg-plum' 
                  : 'w-1.5 bg-cream/40 hover:bg-cream/60'
              }`}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
