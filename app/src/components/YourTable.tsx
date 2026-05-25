import { useState, useEffect, useRef, useMemo } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import {
  Sparkles,
  Users,
  Clock,
  MessageCircle,
  Trophy,
  Camera,
  Zap,
  Heart,
  Crown,
  Loader2,
  MapPin,
  Music,
  Star,
} from 'lucide-react'
import { useMyTable, useTableMembers } from '../hooks/useMatchmaking'
import { mesasColetivas, events as mockEvents } from '../data/mockData'
import { intervalToDuration, differenceInSeconds } from 'date-fns'

interface YourTableProps {
  eventId: string
}

/* ============================================================
   Tipos & Helpers
   ============================================================ */

interface DisplayMember {
  id: string
  name: string
  avatar: string | null
  role: string
  vibe: string | null
  interests: string[]
  isYou: boolean
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function hashString(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h)
  }
  return h
}

function avatarGradient(name: string) {
  const hues = [320, 280, 240, 200, 160, 30, 10]
  const h = hues[Math.abs(hashString(name)) % hues.length]
  return `linear-gradient(135deg, hsl(${h}, 70%, 55%), hsl(${h + 40}, 60%, 35%))`
}

function parseEventDate(dateStr: string): Date {
  const months: Record<string, number> = {
    Janeiro: 0,
    Fevereiro: 1,
    Março: 2,
    Abril: 3,
    Maio: 4,
    Junho: 5,
    Julho: 6,
    Agosto: 7,
    Setembro: 8,
    Outubro: 9,
    Novembro: 10,
    Dezembro: 11,
  }
  const match = dateStr.match(/(\d+)\s+de\s+(\w+),\s+(\d{4})/)
  if (match) {
    const [, day, month, year] = match
    return new Date(parseInt(year), months[month] ?? 5, parseInt(day), 20, 0, 0)
  }
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
}

function getEventDate(eventId: string): Date {
  const ev = import.meta.env.DEV ? mockEvents.find((e) => e.id === eventId) : undefined
  if (ev) return parseEventDate(ev.date)
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
}

function generateMission(tableName: string): { icon: typeof Camera; title: string; desc: string } {
  const missions = [
    { icon: Camera, title: 'Missão Fotográfica', desc: 'Tire uma foto em grupo e poste com #AuraTickets' },
    { icon: MessageCircle, title: 'Missão Conversa', desc: 'Descubra quem na mesa já visitou o país mais exótico' },
    { icon: Zap, title: 'Missão Energia', desc: 'Leve toda a mesa até a pista em pelo menos uma música' },
    { icon: Trophy, title: 'Missão Quiz', desc: 'Responda juntos ao quiz do evento e conquistem o topo' },
    { icon: Music, title: 'Missão Playlist', desc: 'Crie uma playlist colaborativa com um hit de cada um' },
    { icon: Star, title: 'Missão Estrela', desc: 'Escolham um "membro do destaque" da noite por votação' },
  ]
  const idx = Math.abs(hashString(tableName)) % missions.length
  return missions[idx]
}

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(() => differenceInSeconds(targetDate, new Date()))

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = differenceInSeconds(targetDate, new Date())
      setTimeLeft(diff > 0 ? diff : 0)
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  const duration = intervalToDuration({ start: 0, end: timeLeft * 1000 })
  return {
    days: duration.days ?? 0,
    hours: duration.hours ?? 0,
    minutes: duration.minutes ?? 0,
    seconds: duration.seconds ?? 0,
    isExpired: timeLeft <= 0,
  }
}

/* ============================================================
   Sub-componentes
   ============================================================ */

function MemberAvatar({
  member,
  size = 64,
  glow = false,
}: {
  member: DisplayMember
  size?: number
  glow?: boolean
}) {
  const initials = getInitials(member.name)
  const hasAvatar = member.avatar && member.avatar.trim().length > 0

  return (
    <div
      className="relative rounded-full flex items-center justify-center overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        boxShadow: glow
          ? '0 0 20px rgba(122, 59, 105, 0.45), 0 0 40px rgba(122, 59, 105, 0.15)'
          : '0 0 0 1px rgba(255,255,255,0.1)',
        border: `2px solid ${member.isYou ? 'rgba(122, 59, 105, 0.9)' : 'rgba(255,255,255,0.15)'}`,
      }}
    >
      {hasAvatar ? (
        <img
          src={member.avatar!}
          alt={member.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-cream font-semibold"
          style={{
            fontSize: size * 0.35,
            background: avatarGradient(member.name),
          }}
        >
          {initials}
        </div>
      )}
      {member.isYou && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-plum text-[9px] text-cream rounded-full whitespace-nowrap shadow-lg">
          Você
        </div>
      )}
    </div>
  )
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[52px]">
      <div className="relative overflow-hidden rounded-xl bg-white/5 border border-white/10 px-2 py-2 sm:px-3 sm:py-3">
        <span className="block text-lg sm:text-2xl font-serif text-cream tabular-nums leading-none">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-[9px] sm:text-[10px] text-cream/30 mt-1 uppercase tracking-wider">{label}</span>
    </div>
  )
}

/* ============================================================
   Componente Principal
   ============================================================ */

export default function YourTable({ eventId }: YourTableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const centerRef = useRef<HTMLDivElement>(null)
  const scoreRef = useRef<HTMLSpanElement>(null)
  const memberRefs = useRef<(HTMLDivElement | null)[]>([])

  const [hoveredMember, setHoveredMember] = useState<string | null>(null)
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [displayedScore, setDisplayedScore] = useState(0)
  const [radius, setRadius] = useState(150)

  const { data: tableData, isLoading: tableLoading } = useMyTable(eventId)
  const { data: tableMembers, isLoading: membersLoading } = useTableMembers(tableData?.id ?? null)

  /* ---- Responsividade do raio circular ---- */
  useEffect(() => {
    function updateRadius() {
      const w = window.innerWidth
      if (w < 640) setRadius(115)
      else if (w < 1024) setRadius(155)
      else setRadius(195)
    }
    updateRadius()
    window.addEventListener('resize', updateRadius)
    return () => window.removeEventListener('resize', updateRadius)
  }, [])

  /* ---- Fallback para mocks quando Supabase vazio ---- */
  const effectiveTable = useMemo(() => {
    if (tableData) return tableData
    const mock = import.meta.env.DEV ? (mesasColetivas.find((m) => m.id.includes(eventId.split('-')[0])) ?? mesasColetivas[0]) : undefined
    return {
      id: mock.id,
      event_id: eventId,
      ticket_type_id: null,
      name: mock.name,
      theme: mock.theme,
      capacity: mock.capacity,
      compatibility_score: mock.compatibility,
      status: 'open' as const,
      icebreaker_question: null,
      icebreaker_sent_at: null,
      created_at: new Date().toISOString(),
    }
  }, [tableData, eventId])

  const effectiveMembers: DisplayMember[] = useMemo(() => {
    if (tableMembers && tableMembers.length > 0) {
      return tableMembers.map((m) => ({
        id: m.id,
        name: m.profiles?.full_name ?? 'Membro',
        avatar: m.profiles?.avatar_url ?? null,
        role: m.role,
        vibe: m.vibe,
        interests: [],
        isYou: false,
      }))
    }
    const mock = import.meta.env.DEV ? (mesasColetivas.find((m) => m.id === effectiveTable.id) ?? mesasColetivas[0]) : undefined
    return mock.members.map((m) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      role: m.role,
      vibe: m.vibe,
      interests: m.interests,
      isYou: m.name === 'Você',
    }))
  }, [tableMembers, effectiveTable.id])

  /* ---- Contador regressivo ---- */
  const eventDate = useMemo(() => getEventDate(eventId), [eventId])
  const countdown = useCountdown(eventDate)

  /* ---- Score animado ---- */
  useEffect(() => {
    const target = effectiveTable.compatibility_score ?? 0
    if (target <= 0) return
    const obj = { val: 0 }
    gsap.to(obj, {
      val: target,
      duration: 2.2,
      ease: 'power2.out',
      onUpdate: () => setDisplayedScore(Math.round(obj.val)),
    })
  }, [effectiveTable.compatibility_score])

  /* ---- Animações GSAP ---- */
  useGSAP(
    () => {
      if (!containerRef.current) return

      // Aurora layers
      gsap.fromTo(
        '.aurora-layer',
        { opacity: 0, scale: 1.3 },
        { opacity: 1, scale: 1, duration: 2.5, ease: 'power2.out', stagger: 0.4 }
      )

      // Partículas
      gsap.fromTo(
        '.particle',
        { opacity: 0 },
        { opacity: 1, duration: 1.5, stagger: 0.05, ease: 'power1.out', delay: 0.5 }
      )

      // Centro da mesa
      if (centerRef.current) {
        gsap.fromTo(
          centerRef.current,
          { scale: 0.4, opacity: 0 },
          { scale: 1, opacity: 1, duration: 1.2, ease: 'back.out(1.7)', delay: 0.4 }
        )
      }

      // Membros circulares
      const validMembers = memberRefs.current.filter(Boolean)
      gsap.fromTo(
        validMembers,
        { scale: 0, opacity: 0, y: 30 },
        {
          scale: 1,
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.3,
          ease: 'back.out(1.7)',
          delay: 0.9,
        }
      )

      // Cards inferiores
      gsap.fromTo(
        '.cinematic-card',
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, stagger: 0.12, ease: 'power3.out', delay: 2 }
      )
    },
    { scope: containerRef, dependencies: [effectiveMembers, effectiveTable] }
  )

  /* ---- Layout circular ---- */
  const positions = useMemo(() => {
    const count = effectiveMembers.length
    if (count === 0) return []
    return effectiveMembers.map((_, i) => {
      const angle = (i * 2 * Math.PI) / count - Math.PI / 2
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      }
    })
  }, [effectiveMembers, radius])

  const isLoading = tableLoading && !tableData
  const mission = useMemo(() => generateMission(effectiveTable.name), [effectiveTable.name])
  const icebreaker = effectiveTable.icebreaker_question ?? 'Se vocês pudessem criar um drink que representasse essa mesa, quais ingredientes teria?'

  const toggleLike = (id: string) => {
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  /* ==========================================================
     Loading State
     ========================================================== */
  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-void min-h-[420px] flex flex-col items-center justify-center p-8">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(122,59,105,0.12), transparent 70%)' }} />
        <div className="relative z-10 flex flex-col items-center text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-2 border-plum/30 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-plum animate-spin" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-plum/10 animate-ping" />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif text-2xl text-cream">Nossa IA está montando sua mesa perfeita</h3>
            <p className="text-sm text-cream/40 max-w-xs mx-auto">
              Analisando afinidades, temperamentos e vibes para criar uma experiência inesquecível.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-plum/70">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Análise de compatibilidade em andamento</span>
          </div>
        </div>
      </div>
    )
  }

  /* ==========================================================
     Render Principal
     ========================================================== */
  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-3xl bg-void">
      {/* ---- Keyframes inline para aurora e partículas ---- */}
      <style>{`
        @keyframes aurora-drift {
          0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); }
          33% { transform: translate(-45%, -55%) rotate(120deg) scale(1.1); }
          66% { transform: translate(-55%, -45%) rotate(240deg) scale(0.95); }
          100% { transform: translate(-50%, -50%) rotate(360deg) scale(1); }
        }
        @keyframes aurora-drift-slow {
          0% { transform: translate(-50%, -50%) rotate(0deg) scale(1.2); }
          50% { transform: translate(-48%, -52%) rotate(180deg) scale(1.3); }
          100% { transform: translate(-50%, -50%) rotate(360deg) scale(1.2); }
        }
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.8; }
          50% { transform: translateY(-10px) translateX(-10px); opacity: 0.5; }
          75% { transform: translateY(-30px) translateX(5px); opacity: 0.7; }
        }
        .aurora-layer {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          pointer-events: none;
        }
        .aurora-1 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(122,59,105,0.35) 0%, transparent 70%);
          animation: aurora-drift 20s linear infinite;
        }
        .aurora-2 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%);
          animation: aurora-drift-slow 25s linear infinite reverse;
        }
        .aurora-3 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(217,119,6,0.15) 0%, transparent 70%);
          animation: aurora-drift 30s linear infinite;
        }
        .particle {
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,0.5);
          pointer-events: none;
        }
      `}</style>

      {/* ---- Fundo Aurora ---- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="aurora-layer aurora-1" />
        <div className="aurora-layer aurora-2" />
        <div className="aurora-layer aurora-3" />
        {Array.from({ length: 18 }).map((_, i) => {
          const seed = ((i * 9301 + 49297) % 233280) / 233280
          const size = 2 + (seed * 3)
          const left = 10 + (((seed * 9301 + 49297) % 233280) / 233280) * 80
          const top = 10 + (((seed * 49297 + 9301) % 233280) / 233280) * 80
          const delay = seed * 5
          const duration = 6 + (((seed * 49297 + 9301) % 233280) / 233280) * 8
          return (
            <div
              key={i}
              className="particle"
              style={{
                width: size,
                height: size,
                left: `${left}%`,
                top: `${top}%`,
                animation: `float-particle ${duration.toFixed(2)}s ease-in-out ${delay.toFixed(2)}s infinite`,
              }}
            />
          )
        })}
      </div>

      {/* ---- Conteúdo ---- */}
      <div className="relative z-10 px-4 py-8 sm:px-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-cream/60 uppercase tracking-widest font-medium">Sua Mesa Coletiva</span>
          </div>
        </div>

        {/* ---- Layout Circular ---- */}
        <div className="relative mx-auto" style={{ width: '100%', maxWidth: 640, height: radius * 2 + 160 }}>
          {/* Centro */}
          <div
            ref={centerRef}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center text-center"
          >
            <div className="relative mb-3">
              <div
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-full flex flex-col items-center justify-center bg-white/5 border border-white/10 backdrop-blur-md"
                style={{ boxShadow: '0 0 60px rgba(122, 59, 105, 0.15), inset 0 0 40px rgba(122, 59, 105, 0.05)' }}
              >
                <Sparkles className="w-4 h-4 text-plum mb-1 opacity-70" />
                <span className="font-serif text-xl sm:text-2xl text-cream leading-tight">{effectiveTable.name}</span>
                <span className="text-[10px] sm:text-xs text-cream/40 mt-0.5">{effectiveTable.theme}</span>
              </div>
              {/* Anel orbital sutil */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '1px solid rgba(122, 59, 105, 0.2)',
                  transform: 'scale(1.15)',
                }}
              />
            </div>

            {/* Score */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-cream/30 uppercase tracking-widest mb-1">Compatibilidade</span>
              <div className="flex items-baseline gap-1">
                <span ref={scoreRef} className="font-serif text-3xl sm:text-4xl text-plum">
                  {displayedScore}
                </span>
                <span className="text-sm text-plum/60">%</span>
              </div>
              <div className="w-24 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-plum rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${displayedScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Membros orbitando */}
          {effectiveMembers.map((member, i) => {
            const pos = positions[i]
            if (!pos) return null
            const isHovered = hoveredMember === member.id
            return (
              <div
                key={member.id}
                ref={(el) => { memberRefs.current[i] = el }}
                className="absolute z-30 flex flex-col items-center cursor-pointer"
                style={{
                  left: `calc(50% + ${pos.x}px)`,
                  top: `calc(50% + ${pos.y}px - 30px)`,
                  transform: 'translate(-50%, -50%)',
                  transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={() => setHoveredMember(member.id)}
                onMouseLeave={() => setHoveredMember(null)}
              >
                <div
                  style={{
                    transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  <MemberAvatar
                    member={member}
                    size={56}
                    glow={isHovered || member.isYou}
                  />
                </div>

                <div className="mt-2 text-center">
                  <span className="block text-xs text-cream font-medium whitespace-nowrap">{member.name}</span>
                  {member.vibe && (
                    <span className="block text-[9px] text-plum/70 whitespace-nowrap">{member.vibe}</span>
                  )}
                </div>

                {/* Card flutuante de detalhes no hover */}
                {isHovered && (
                  <div
                    className="absolute z-50 bottom-full mb-3 w-48 p-3 rounded-xl bg-void/95 border border-white/10 backdrop-blur-xl shadow-2xl"
                    style={{ animation: 'fadeInUp 0.25s ease-out' }}
                  >
                    <style>{`
                      @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(8px); }
                        to { opacity: 1; transform: translateY(0); }
                      }
                    `}</style>
                    <div className="flex items-center gap-2 mb-2">
                      <MemberAvatar member={member} size={32} />
                      <div>
                        <span className="block text-xs text-cream font-medium">{member.name}</span>
                        <span className="block text-[10px] text-cream/40">{member.role}</span>
                      </div>
                    </div>
                    {member.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {member.interests.map((interest) => (
                          <span
                            key={interest}
                            className="px-1.5 py-0.5 bg-white/5 text-cream/50 text-[9px] rounded-full border border-white/5"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}
                    {!member.isYou && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleLike(member.id)
                        }}
                        className="flex items-center gap-1 text-[10px] transition-colors"
                        style={{ color: liked[member.id] ? '#f87171' : 'rgba(247,245,240,0.3)' }}
                      >
                        <Heart className="w-3 h-3" fill={liked[member.id] ? '#f87171' : 'none'} />
                        <span>{liked[member.id] ? 'Curtiu' : 'Curtir perfil'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ---- Contador Regressivo ---- */}
        {!countdown.isExpired && (
          <div className="cinematic-card flex flex-col items-center mt-2 mb-8">
            <div className="flex items-center gap-2 mb-3 text-cream/40">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase tracking-widest">Contagem regressiva</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <CountdownUnit value={countdown.days} label="Dias" />
              <span className="text-cream/20 text-lg -mt-4">:</span>
              <CountdownUnit value={countdown.hours} label="Horas" />
              <span className="text-cream/20 text-lg -mt-4">:</span>
              <CountdownUnit value={countdown.minutes} label="Min" />
              <span className="text-cream/20 text-lg -mt-4">:</span>
              <CountdownUnit value={countdown.seconds} label="Seg" />
            </div>
          </div>
        )}

        {/* ---- Grid inferior: Quebra-gelo + Missão + Tags ---- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {/* Quebra-Gelo */}
          <div className="cinematic-card p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-plum/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-plum" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-cream">Quebra-Gelo</h3>
                <span className="text-[10px] text-cream/30">Comece a conversa</span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <span className="block text-xs text-cream/50 mb-2">Pergunta exclusiva da mesa</span>
              <p className="text-sm text-cream/80 leading-relaxed">{icebreaker}</p>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-plum/60">
              <Sparkles className="w-3 h-3" />
              <span>Gerada pela IA com base nos perfis da mesa</span>
            </div>
          </div>

          {/* Missão da Mesa */}
          <div className="cinematic-card p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-cream">Missão da Mesa</h3>
                <span className="text-[10px] text-cream/30">Desafio social</span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/5 to-transparent border border-amber-500/10">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <mission.icon className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <span className="block text-sm font-medium text-cream mb-1">{mission.title}</span>
                  <p className="text-xs text-cream/50 leading-relaxed">{mission.desc}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-cream/30">
              <Zap className="w-3 h-3" />
              <span>Complete e ganhe pontos de experiência</span>
            </div>
          </div>
        </div>

        {/* ---- Tags de afinidade ---- */}
        <div className="cinematic-card flex flex-wrap items-center justify-center gap-2 mt-4 max-w-2xl mx-auto">
          {['Temperamento equilibrado', 'Interesses alinhados', 'Vibe compatível', 'Energia complementar'].map(
            (tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-cream/50 text-[10px] rounded-full border border-white/10"
              >
                <Sparkles className="w-3 h-3 text-plum" />
                <span>{tag}</span>
              </span>
            )
          )}
        </div>

        {/* ---- Info do evento ---- */}
        <div className="cinematic-card flex items-center justify-center gap-4 mt-6 text-[10px] text-cream/25">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span>Evento: {eventId.replace(/-/g, ' ')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{effectiveMembers.length} / {effectiveTable.capacity} membros</span>
          </div>
        </div>
      </div>
    </div>
  )
}
