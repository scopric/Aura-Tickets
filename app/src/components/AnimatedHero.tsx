import { useRef, useEffect, useCallback } from 'react'
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

export default function AnimatedHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0, y: 0, active: false })
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)

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
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      initParticles(width, height)
    }

    resize()
    window.addEventListener('resize', resize)

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      const particles = particlesRef.current
      const mouse = mouseRef.current

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Mouse influence
        if (mouse.active) {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 200) {
            const force = (200 - dist) / 200
            p.vx += (dx / dist) * force * 0.02
            p.vy += (dy / dist) * force * 0.02
          }
        }

        // Apply velocity with damping
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.995
        p.vy *= 0.995

        // Wrap around edges
        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        // Draw particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(122, 59, 105, ${p.opacity})`
        ctx.fill()

        // Draw connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 120) {
            const opacity = (1 - dist / 120) * 0.15
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(122, 59, 105, ${opacity})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // Mouse glow
      if (mouse.active) {
        const gradient = ctx.createRadialGradient(
          mouse.x, mouse.y, 0,
          mouse.x, mouse.y, 250
        )
        gradient.addColorStop(0, 'rgba(122, 59, 105, 0.08)')
        gradient.addColorStop(0.5, 'rgba(122, 59, 105, 0.03)')
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
    const handleMouseLeave = () => {
      mouseRef.current.active = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  // GSAP text animations
  useEffect(() => {
    const tl = gsap.timeline({ delay: 0.5 })

    tl.fromTo('.hero-line-1',
      { y: 120, opacity: 0, rotateX: -40 },
      { y: 0, opacity: 1, rotateX: 0, duration: 1.2, ease: 'power3.out' }
    )
    .fromTo('.hero-line-2',
      { y: 120, opacity: 0, rotateX: -40 },
      { y: 0, opacity: 1, rotateX: 0, duration: 1.2, ease: 'power3.out' },
      '-=0.85'
    )
    .fromTo('.hero-line-3',
      { y: 120, opacity: 0, rotateX: -40 },
      { y: 0, opacity: 1, rotateX: 0, duration: 1.2, ease: 'power3.out' },
      '-=0.85'
    )
    .fromTo('.hero-badge',
      { scale: 0.8, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' },
      '-=0.8'
    )
    .fromTo('.hero-desc',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: 'power3.out' },
      '-=0.5'
    )
    .fromTo('.hero-cta-group',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' },
      '-=0.5'
    )
    .fromTo('.hero-scroll',
      { opacity: 0 },
      { opacity: 1, duration: 0.6 },
      '-=0.3'
    )
  }, [])

  // Floating orbs
  const orbs = [
    { size: 400, x: '10%', y: '20%', delay: '0s', duration: '8s', color: 'rgba(122, 59, 105, 0.08)' },
    { size: 300, x: '80%', y: '60%', delay: '2s', duration: '10s', color: 'rgba(122, 59, 105, 0.06)' },
    { size: 250, x: '60%', y: '15%', delay: '4s', duration: '12s', color: 'rgba(26, 14, 20, 0.04)' },
    { size: 350, x: '30%', y: '70%', delay: '1s', duration: '9s', color: 'rgba(122, 59, 105, 0.05)' },
  ]

  return (
    <section ref={containerRef} className="relative min-h-screen flex items-center justify-center overflow-hidden bg-canvas">
      {/* Animated Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 pointer-events-none"
      />

      {/* Floating Orbs */}
      {orbs.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-float pointer-events-none z-[1]"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            animationDelay: orb.delay,
            animationDuration: orb.duration,
          }}
        />
      ))}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/50 via-transparent to-canvas z-[2] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-32">
        {/* Badge */}
        <div className="hero-badge inline-flex items-center gap-2 px-5 py-2.5 bg-plum/10 border border-plum/20 rounded-full mb-10">
          <span className="w-2 h-2 rounded-full bg-plum animate-pulse" />
          <span className="text-sm font-medium text-plum tracking-wide">Plataforma de Experiencias</span>
        </div>

        {/* Main Title - 3D perspective container */}
        <div className="perspective-1000 mb-8">
          <h1 className="font-serif leading-[0.88] tracking-tight">
            <span className="hero-line-1 block text-5xl sm:text-7xl lg:text-[130px] text-espresso">
              Crie
            </span>
            <span className="hero-line-2 block text-5xl sm:text-7xl lg:text-[130px] text-espresso mt-2 lg:mt-4">
              Eventos
            </span>
            <span className="hero-line-3 block text-5xl sm:text-7xl lg:text-[130px] italic text-plum mt-2 lg:mt-4">
              Extraordinarios
            </span>
          </h1>
        </div>

        {/* Subtitle */}
        <p className="hero-desc text-lg sm:text-xl text-espresso/50 max-w-xl mx-auto mb-12 leading-relaxed font-light">
          A plataforma definitiva para criadores de experiencias. 
          Crie, gerencie e venda ingressos para eventos que deixam marcas.
        </p>

        {/* CTAs */}
        <div className="hero-cta-group flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/producer/dashboard"
            className="group relative px-8 py-4 bg-plum text-cream font-medium rounded-full transition-all duration-500 hover:shadow-glow hover:scale-105 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              Comecar Agora
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-plum to-plum/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </Link>
          <Link
            to="/event/festival-de-verao-2025"
            className="group flex items-center gap-3 px-8 py-4 border border-espresso/15 text-espresso font-medium rounded-full transition-all duration-300 hover:bg-espresso/5 hover:border-espresso/25"
          >
            <span className="w-8 h-8 rounded-full bg-plum/10 flex items-center justify-center transition-all group-hover:bg-plum group-hover:scale-110">
              <Play className="w-3 h-3 text-plum group-hover:text-cream transition-colors ml-0.5" />
            </span>
            Ver Demo
          </Link>
        </div>

        {/* Stats row */}
        <div className="mt-20 grid grid-cols-3 gap-8 max-w-md mx-auto">
          {[
            { value: '10K+', label: 'Eventos' },
            { value: '500K+', label: 'Ingressos' },
            { value: '98%', label: 'Satisfacao' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-serif text-2xl lg:text-3xl text-plum">{stat.value}</div>
              <div className="text-xs text-espresso/40 uppercase tracking-widest mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="hero-scroll absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3">
        <span className="text-[10px] text-espresso/30 uppercase tracking-[0.2em]">Rolar</span>
        <div className="w-px h-10 bg-gradient-to-b from-espresso/30 to-transparent relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-4 bg-plum/60 animate-bounce" style={{ animationDuration: '2s' }} />
        </div>
      </div>

      {/* Decorative grid lines */}
      <div className="absolute inset-0 z-[1] pointer-events-none opacity-[0.03]">
        <div className="max-w-7xl mx-auto h-full grid grid-cols-6 gap-0">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border-l border-espresso h-full" />
          ))}
        </div>
      </div>
    </section>
  )
}
