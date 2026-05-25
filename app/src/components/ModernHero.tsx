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

export default function ModernHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0, active: false })
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)
  const [isLoaded, setIsLoaded] = useState(false)

  // Initialize particles
  const initParticles = useCallback((width: number, height: number) => {
    const count = Math.floor((width * height) / 16000)
    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.2 + 0.3,
        opacity: Math.random() * 0.6 + 0.1,
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

        // Mouse attraction
        if (mouse.active) {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 180 && dist > 0) {
            const force = (180 - dist) / 180
            p.vx += (dx / dist) * force * 0.015
            p.vy += (dy / dist) * force * 0.015
          }
        }

        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.996
        p.vy *= 0.996

        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        // Draw particle with cyan/blue glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(6, 182, 212, ${p.opacity})`
        ctx.fill()

        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 100) {
            const opacity = (1 - dist / 100) * 0.15
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // Mouse glow
      if (mouse.active) {
        const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 200)
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.08)')
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.03)')
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    setIsLoaded(true)
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
    if (!isLoaded) return
    const tl = gsap.timeline({ delay: 0.2 })
    tl.fromTo('.mh-line-1',
      { y: 100, opacity: 0, rotateX: -30 },
      { y: 0, opacity: 1, rotateX: 0, duration: 1, ease: 'power3.out' }
    )
    .fromTo('.mh-line-2',
      { y: 100, opacity: 0, rotateX: -30 },
      { y: 0, opacity: 1, rotateX: 0, duration: 1, ease: 'power3.out' },
      '-=0.75'
    )
    .fromTo('.mh-line-3',
      { y: 100, opacity: 0, rotateX: -30 },
      { y: 0, opacity: 1, rotateX: 0, duration: 1, ease: 'power3.out' },
      '-=0.75'
    )
    .fromTo('.mh-badge',
      { scale: 0.8, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.7)' },
      '-=0.8'
    )
    .fromTo('.mh-desc',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' },
      '-=0.4'
    )
    .fromTo('.mh-cta-group',
      { y: 25, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' },
      '-=0.4'
    )
    .fromTo('.mh-stats',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' },
      '-=0.3'
    )
    .fromTo('.mh-scroll',
      { opacity: 0 },
      { opacity: 1, duration: 0.5 },
      '-=0.2'
    )
  }, [isLoaded])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">
      {/* Animated gradient background */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.12), transparent), radial-gradient(ellipse 60% 50% at 80% 20%, rgba(139,92,246,0.08), transparent), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(6,182,212,0.06), transparent)',
        }}
      />
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 z-[1] opacity-[0.03]"
        style={{ 
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }}
      />

      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[2] pointer-events-none"
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-32">
        <div className="max-w-4xl">
          {/* Badge */}
          <div className="mh-badge inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-sm font-medium text-white/80 tracking-wide">Plataforma de Experiências</span>
          </div>

          {/* Title with 3D perspective */}
          <div className="perspective-1000 mb-8">
            <h1 className="leading-[0.95] tracking-tight">
              <span className="mh-line-1 block text-5xl sm:text-7xl lg:text-[100px] font-bold text-white">
                Crie
              </span>
              <span className="mh-line-2 block text-5xl sm:text-7xl lg:text-[100px] font-bold text-white mt-2 lg:mt-3">
                Eventos
              </span>
              <span className="mh-line-3 block text-5xl sm:text-7xl lg:text-[100px] font-bold mt-2 lg:mt-3 text-gradient">
                Extraordinários
              </span>
            </h1>
          </div>

          {/* Subtitle */}
          <p className="mh-desc text-lg sm:text-xl text-white/40 max-w-lg mb-10 leading-relaxed font-light">
            A plataforma definitiva para criadores de experiências. 
            Crie, gerencie e venda ingressos para eventos que deixam marcas.
          </p>

          {/* CTAs */}
          <div className="mh-cta-group flex flex-col sm:flex-row items-start gap-4">
            <Link
              to="/auth/register"
              className="group relative px-8 py-4 text-sm font-semibold text-white rounded-full transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] active:scale-[0.98] overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)',
                backgroundSize: '200% 200%',
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                Começar Agora
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
            <Link
              to="/event/festival-de-verao-2025"
              className="group flex items-center gap-3 px-8 py-4 border border-white/15 text-white font-medium rounded-full text-sm transition-all duration-300 hover:bg-white/5 hover:border-white/25"
            >
              <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center transition-all group-hover:bg-cyan-500/20 group-hover:scale-110">
                <Play className="w-3 h-3 text-white ml-0.5" />
              </span>
              Ver Demo
            </Link>
          </div>

          {/* Quick stats */}
          <div className="mh-stats mt-14 grid grid-cols-3 gap-8 max-w-sm">
            {[
              { value: '10K+', label: 'Eventos' },
              { value: '500K+', label: 'Ingressos' },
              { value: '98%', label: 'Satisfação' },
            ].map((stat) => (
              <div key={stat.label} className="text-left">
                <div className="text-2xl font-bold text-gradient">{stat.value}</div>
                <div className="text-[10px] text-white/30 uppercase tracking-[0.15em] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="mh-scroll absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3">
        <span className="text-[10px] text-white/25 uppercase tracking-[0.2em]">Rolar</span>
        <div className="w-px h-10 bg-gradient-to-b from-white/25 to-transparent relative overflow-hidden">
          <div 
            className="absolute top-0 left-0 w-full bg-cyan-400/80" 
            style={{ height: '16px', animation: 'scrollDot 2s ease-in-out infinite' }} 
          />
        </div>
      </div>
    </section>
  )
}
