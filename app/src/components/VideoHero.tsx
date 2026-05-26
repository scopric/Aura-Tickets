import { useRef, useEffect, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Play } from 'lucide-react'
import gsap from 'gsap'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
}

export default function VideoHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0, active: false })
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoLoaded, setVideoLoaded] = useState(true)

  // Initialize particles
  const initParticles = useCallback((width: number, height: number) => {
    const count = Math.floor((width * height) / 18000)
    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.2,
      })
    }
    particlesRef.current = particles
  }, [])

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = window.innerWidth
    let height = window.innerHeight

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initParticles(width, height)
    }

    resize()
    window.addEventListener('resize', resize)

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      const particles = particlesRef.current
      const mouse = mouseRef.current

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        if (mouse.active) {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 200 && dist > 0) {
            const force = (200 - dist) / 200
            p.vx += (dx / dist) * force * 0.02
            p.vy += (dy / dist) * force * 0.02
          }
        }

        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.995
        p.vy *= 0.995

        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(247, 245, 240, ${p.opacity})`
        ctx.fill()

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            const opacity = (1 - dist / 120) * 0.12
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(247, 245, 240, ${opacity})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      if (mouse.active) {
        const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 250)
        gradient.addColorStop(0, 'rgba(122, 59, 105, 0.1)')
        gradient.addColorStop(0.5, 'rgba(122, 59, 105, 0.04)')
        gradient.addColorStop(1, 'rgba(122, 59, 105, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [initParticles])

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true }
    }
    const handleMouseLeave = () => { mouseRef.current.active = false }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  // GSAP text animations
  useEffect(() => {
    const tl = gsap.timeline({ delay: 0.3 })
    tl.fromTo('.vh-line-1',
      { y: 120, opacity: 0, rotateX: -40 },
      { y: 0, opacity: 1, rotateX: 0, duration: 1.2, ease: 'power3.out' }
    )
    .fromTo('.vh-line-2',
      { y: 120, opacity: 0, rotateX: -40 },
      { y: 0, opacity: 1, rotateX: 0, duration: 1.2, ease: 'power3.out' },
      '-=0.85'
    )
    .fromTo('.vh-line-3',
      { y: 120, opacity: 0, rotateX: -40 },
      { y: 0, opacity: 1, rotateX: 0, duration: 1.2, ease: 'power3.out' },
      '-=0.85'
    )
    .fromTo('.vh-badge',
      { scale: 0.8, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' },
      '-=0.8'
    )
    .fromTo('.vh-desc',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: 'power3.out' },
      '-=0.5'
    )
    .fromTo('.vh-cta-group',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' },
      '-=0.5'
    )
    .fromTo('.vh-ticket-3d',
      { x: 100, opacity: 0, rotateY: -30 },
      { x: 0, opacity: 1, rotateY: 0, duration: 1.4, ease: 'power3.out' },
      '-=1'
    )
    .fromTo('.vh-scroll',
      { opacity: 0 },
      { opacity: 1, duration: 0.6 },
      '-=0.3'
    )
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-void">
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          onLoadedData={() => setVideoLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-1000 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ transform: 'scale(1.05)' }}
        >
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>
        {/* Fallback gradient while video loads */}
        {!videoLoaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-void via-void to-plum/40" />
        )}
      </div>

      {/* Dark overlays for readability */}
      <div className="absolute inset-0 bg-void/60 z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-void/80 via-void/40 to-transparent z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-void/30 z-[1]" />

      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[2] pointer-events-none"
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Text Content */}
          <div className="lg:col-span-12 text-left">
            {/* Badge */}
            <div className="vh-badge inline-flex items-center gap-2 px-5 py-2.5 bg-cream/10 border border-cream/20 rounded-full mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-plum animate-pulse" />
              <span className="text-sm font-medium text-cream/90 tracking-wide">Plataforma de Experiencias</span>
            </div>

            {/* Title with 3D perspective */}
            <div className="perspective-1000 mb-8">
              <h1 className="font-serif leading-[0.88] tracking-tight">
                <span className="vh-line-1 block text-5xl sm:text-7xl lg:text-[110px] text-cream">
                  Crie
                </span>
                <span className="vh-line-2 block text-5xl sm:text-7xl lg:text-[110px] text-cream mt-2 lg:mt-4">
                  Eventos
                </span>
                <span className="vh-line-3 block text-5xl sm:text-7xl lg:text-[110px] italic text-plum mt-2 lg:mt-4">
                  Extraordinarios
                </span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="vh-desc text-lg sm:text-xl text-cream/50 max-w-lg mb-10 leading-relaxed font-light">
              A plataforma definitiva para criadores de experiencias. 
              Crie, gerencie e venda ingressos para eventos que deixam marcas.
            </p>

            {/* CTAs */}
            <div className="vh-cta-group flex flex-col sm:flex-row items-start gap-4">
              <Link
                to="/auth/register"
                className="group relative px-8 py-4 bg-plum text-cream font-medium rounded-full transition-all duration-500 hover:shadow-glow hover:scale-105 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Comecar Agora
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
              <Link
                to="/event/noite-eletro-2025"
                className="group flex items-center gap-3 px-8 py-4 border border-cream/20 text-cream font-medium rounded-full transition-all duration-300 hover:bg-cream/10 hover:border-cream/30"
              >
                <span className="w-8 h-8 rounded-full bg-cream/10 flex items-center justify-center transition-all group-hover:bg-plum group-hover:scale-110">
                  <Play className="w-3 h-3 text-cream ml-0.5" />
                </span>
                Ver Demo
              </Link>
            </div>

            {/* Quick stats */}
            <div className="mt-14 grid grid-cols-3 gap-6 max-w-sm">
              {[
                { value: '10K+', label: 'Eventos' },
                { value: '500K+', label: 'Ingressos' },
                { value: '98%', label: 'Satisfacao' },
              ].map((stat) => (
                <div key={stat.label} className="text-left">
                  <div className="font-serif text-2xl text-plum">{stat.value}</div>
                  <div className="text-[10px] text-cream/40 uppercase tracking-[0.15em] mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Scroll indicator */}
      <div className="vh-scroll absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3">
        <span className="text-[10px] text-cream/30 uppercase tracking-[0.2em]">Rolar</span>
        <div className="w-px h-10 bg-gradient-to-b from-cream/30 to-transparent relative overflow-hidden">
          <div 
            className="absolute top-0 left-0 w-full bg-plum/80" 
            style={{ height: '16px', animation: 'scrollDot 2s ease-in-out infinite' }} 
          />
        </div>
      </div>

      {/* Scroll indicator animation */}
      <style>{`
        @keyframes scrollDot {
          0% { transform: translateY(-20px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(40px); opacity: 0; }
        }
      `}</style>
    </section>
  )
}
