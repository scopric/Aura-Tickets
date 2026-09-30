import { useState, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { toast } from 'sonner'
import {
  X,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  User,
  Briefcase,
  Compass,
  Music,
  Guitar,
  Radio,
  Mic2,
  Headphones,
  Piano,
  Disc3,
  Zap,
  Moon,
  Sun,
  Flame,
  Loader2,
  GraduationCap,
  AtSign,
} from 'lucide-react'
import { useMatchmakingProfile, type QuizAnswers } from '../hooks/useMatchmaking'
import {
  MESA_TAGS,
  MESA_TAGS_MAX,
  MESA_CATEGORIAS,
  ESCOLARIDADE,
  normalizarRedeSocial,
  type MesaCategoria,
} from '../lib/mesaTags'

// ============================================================
// Tipos
// ============================================================

interface ProfileQuizProps {
  onComplete: () => void
  onCancel: () => void
}

type SingleKey = 'temperament' | 'intention' | 'music_style' | 'energy_level' | 'education'

interface QuestionOption {
  value: string
  label: string
  description?: string
  icon: React.ReactNode
}

type QuizStep =
  | { kind: 'single'; id: SingleKey; question: string; subtitle: string; options: QuestionOption[] }
  | { kind: 'tags'; cat: MesaCategoria }
  | { kind: 'social' }

// ============================================================
// Dados
// ============================================================

// Sem "Romance" nem gênero (dado que pode ser sensível, LGPD art. 5º, II; CHECK no banco)
const QUIZ_STEPS: QuizStep[] = [
  {
    kind: 'single',
    id: 'temperament',
    question: 'Como você descreveria seu temperamento em eventos?',
    subtitle: 'Conte como você é em eventos',
    options: [
      {
        value: 'introvert',
        label: 'Introvertido',
        description: 'Prefiro conversas profundas em grupos menores',
        icon: <Moon className="w-5 h-5" />,
      },
      {
        value: 'extrovert',
        label: 'Extrovertido',
        description: 'Adoro puxar conversa e conhecer gente nova',
        icon: <Sun className="w-5 h-5" />,
      },
      {
        value: 'ambivert',
        label: 'Ambivertido',
        description: 'Depende do momento e da energia do lugar',
        icon: <Zap className="w-5 h-5" />,
      },
    ],
  },
  {
    kind: 'single',
    id: 'intention',
    question: 'Qual seu objetivo principal nesse evento?',
    subtitle: 'Conte o que você busca no evento',
    options: [
      {
        value: 'network',
        label: 'Networking',
        description: 'Expandir minha rede e criar conexões profissionais',
        icon: <Briefcase className="w-5 h-5" />,
      },
      {
        value: 'fun',
        label: 'Diversão',
        description: 'Curtir a noite com boas risadas e companhia',
        icon: <Sparkles className="w-5 h-5" />,
      },
      {
        value: 'experience',
        label: 'Experiência',
        description: 'Viver algo único, diferente e memorável',
        icon: <Compass className="w-5 h-5" />,
      },
    ],
  },
  {
    kind: 'single',
    id: 'music_style',
    question: 'Qual estilo musical te define mais?',
    subtitle: 'A trilha sonora da sua noite ideal',
    options: [
      {
        value: 'eletronica',
        label: 'Eletrônica',
        description: 'Techno, house e batidas que pulsam na pista',
        icon: <Disc3 className="w-5 h-5" />,
      },
      {
        value: 'rock',
        label: 'Rock',
        description: 'Guitarras, atitude e energia de palco',
        icon: <Guitar className="w-5 h-5" />,
      },
      {
        value: 'pop',
        label: 'Pop',
        description: 'Hits contagiantes que todo mundo canta',
        icon: <Mic2 className="w-5 h-5" />,
      },
      {
        value: 'sertanejo',
        label: 'Sertanejo',
        description: 'Modão, moda de viola e coração na mão',
        icon: <Music className="w-5 h-5" />,
      },
      {
        value: 'jazz',
        label: 'Jazz',
        description: 'Improviso, sofisticação e vibe intimista',
        icon: <Piano className="w-5 h-5" />,
      },
      {
        value: 'hiphop',
        label: 'Hip-Hop',
        description: 'Rimas, ritmo e cultura urbana',
        icon: <Headphones className="w-5 h-5" />,
      },
      {
        value: 'indie',
        label: 'Indie',
        description: 'Som alternativo, autoral e fora da caixa',
        icon: <Radio className="w-5 h-5" />,
      },
    ],
  },
  {
    kind: 'single',
    id: 'energy_level',
    question: 'Como você curte viver a noite?',
    subtitle: 'A intensidade que faz seu brilho único',
    options: [
      {
        value: 'low',
        label: 'Tranquila',
        description: 'Conversas, drinks e um ambiente acolhedor',
        icon: <UserCircle className="w-5 h-5" />,
      },
      {
        value: 'medium',
        label: 'Equilibrada',
        description: 'Um pouco de tudo: dança, papo e descoberta',
        icon: <User className="w-5 h-5" />,
      },
      {
        value: 'high',
        label: 'Intensa',
        description: 'Máxima energia da primeira à última batida',
        icon: <Flame className="w-5 h-5" />,
      },
    ],
  },
  ...MESA_CATEGORIAS.map((cat): QuizStep => ({ kind: 'tags', cat })),
  {
    kind: 'single',
    id: 'education',
    question: 'Qual a sua escolaridade?',
    subtitle: 'Aparece no seu cartão para os colegas de mesa',
    options: Object.entries(ESCOLARIDADE).map(([value, label]) => ({
      value,
      label,
      icon: <GraduationCap className="w-5 h-5" />,
    })),
  },
  { kind: 'social' },
]

// ============================================================
// Aurora Background
// ============================================================

function AuroraBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <style>{`
        @keyframes aurora-shift {
          0% { transform: translate(-30%, -30%) rotate(0deg); }
          50% { transform: translate(20%, 10%) rotate(180deg); }
          100% { transform: translate(-30%, -30%) rotate(360deg); }
        }
        @keyframes aurora-shift-2 {
          0% { transform: translate(20%, 20%) rotate(0deg); }
          50% { transform: translate(-20%, -10%) rotate(-180deg); }
          100% { transform: translate(20%, 20%) rotate(-360deg); }
        }
        @keyframes aurora-shift-3 {
          0% { transform: translate(-10%, 30%) rotate(0deg); }
          50% { transform: translate(30%, -20%) rotate(120deg); }
          100% { transform: translate(-10%, 30%) rotate(360deg); }
        }
        .aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.18;
        }
        .aurora-blob-1 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, #7a3b69 0%, transparent 70%);
          top: -10%;
          left: -10%;
          animation: aurora-shift 20s ease-in-out infinite;
        }
        .aurora-blob-2 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, #5a2a4d 0%, transparent 70%);
          bottom: -5%;
          right: -10%;
          animation: aurora-shift-2 25s ease-in-out infinite;
        }
        .aurora-blob-3 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, #9e5a8a 0%, transparent 70%);
          top: 40%;
          left: 40%;
          animation: aurora-shift-3 18s ease-in-out infinite;
        }
        .aurora-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 0%, #1a0e14 85%);
        }
      `}</style>
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
      <div className="aurora-overlay" />
    </div>
  )
}

// ============================================================
// Componente
// ============================================================

export default function ProfileQuiz({ onComplete, onCancel }: ProfileQuizProps) {
  const { profile, saveProfile } = useMatchmakingProfile()

  const [step, setStep] = useState(0)
  // começa com o que já foi salvo (quem abre para editar vê as próprias respostas)
  const [answers, setAnswers] = useState<QuizAnswers>(() => ({
    temperament: profile?.temperament ?? undefined,
    intention: profile?.intention ?? undefined,
    music_style: profile?.music_style ?? undefined,
    energy_level: profile?.energy_level ?? undefined,
    tags: profile?.tags ?? {},
    education: profile?.education ?? undefined,
    social_url: profile?.social_url ?? undefined,
  }))
  const [redeTexto, setRedeTexto] = useState(profile?.social_url ?? '')
  const [redeErro, setRedeErro] = useState<string | null>(null)
  const [status, setStatus] = useState<'quiz' | 'saving'>('quiz')

  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const analyzingRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<HTMLDivElement>(null)

  const totalSteps = QUIZ_STEPS.length
  const currentStep = QUIZ_STEPS[step]
  const isLast = step === totalSteps - 1
  const progress = ((step + 1) / totalSteps) * 100

  const respondido =
    currentStep.kind === 'single' ? !!answers[currentStep.id]
    : currentStep.kind === 'tags' ? (answers.tags[currentStep.cat]?.length ?? 0) > 0
    : redeTexto.trim() !== ''

  const animarOpcoes = (tl: gsap.core.Timeline) => {
    tl.fromTo(
      optionsRef.current?.querySelectorAll('.quiz-option') || [],
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out' },
      '-=0.25'
    )
  }

  const irPara = (nextStep: number) => {
    const avancando = nextStep > step
    const tl = gsap.timeline()
    tl.to(cardRef.current, { opacity: 0, x: avancando ? -60 : 60, duration: 0.35, ease: 'power3.in' })
    tl.call(() => setStep(nextStep))
    tl.fromTo(
      cardRef.current,
      { opacity: 0, x: avancando ? 60 : -60 },
      { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' }
    )
    animarOpcoes(tl)
  }

  // escolha única: clicar de novo desmarca; escolher avança
  const selectAnswer = (id: SingleKey, value: string) => {
    if (answers[id] === value) {
      setAnswers({ ...answers, [id]: undefined })
      return
    }
    setAnswers({ ...answers, [id]: value } as QuizAnswers) // value vem das opções deste passo
    const tl = gsap.timeline()
    tl.to(optionsRef.current?.querySelectorAll('.quiz-option') || [], { opacity: 0.3, scale: 0.98, duration: 0.2, ease: 'power2.in' })
    tl.to(optionsRef.current?.querySelector(`[data-value="${value}"]`) || [], { scale: 1.02, duration: 0.15, ease: 'power2.out' }, '-=0.1')
    tl.call(() => {
      gsap.set(optionsRef.current?.querySelectorAll('.quiz-option') || [], { opacity: 1, scale: 1 })
      if (!isLast) irPara(step + 1)
    })
  }

  const toggleTag = (cat: MesaCategoria, slug: string) => {
    const atual = answers.tags[cat] ?? []
    const nova = atual.includes(slug) ? atual.filter(t => t !== slug) : [...atual, slug]
    if (nova.length > MESA_TAGS_MAX) return
    const tags = { ...answers.tags }
    if (nova.length) tags[cat] = nova
    else delete tags[cat]
    setAnswers({ ...answers, tags })
  }

  const avancar = () => {
    if (!isLast) {
      irPara(step + 1)
      return
    }
    // rede social: vazia = sem rede; preenchida tem de passar na regex do banco
    const texto = redeTexto.trim()
    const social = texto ? normalizarRedeSocial(texto) : null
    if (texto && !social) {
      setRedeErro('Use um link do Instagram, TikTok, X (Twitter) ou LinkedIn, como instagram.com/seu.usuario')
      return
    }
    setRedeErro(null)
    handleComplete({ ...answers, social_url: social })
  }

  const handleComplete = (finalAnswers: QuizAnswers) => {
    gsap.to(containerRef.current, {
      opacity: 0,
      scale: 0.96,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => {
        setStatus('saving')
        setTimeout(() => {
          saveProfile.mutate(finalAnswers, {
            onSuccess: () => {
              gsap.to(analyzingRef.current, {
                opacity: 0,
                scale: 1.02,
                duration: 0.5,
                delay: 1.2,
                ease: 'power2.in',
                onComplete: onComplete,
              })
            },
            // erro não some: volta ao questionário com as respostas e avisa
            onError: (err) => {
              toast.error(err.message || 'Não foi possível salvar suas respostas.')
              setStatus('quiz')
            },
          })
        }, 1200)
      },
    })
  }

  // ============================================================
  // GSAP: Progress bar animation
  // ============================================================
  useGSAP(
    () => {
      if (progressRef.current) {
        gsap.to(progressRef.current, {
          width: `${progress}%`,
          duration: 0.6,
          ease: 'power2.out',
        })
      }
    },
    { dependencies: [progress, status], scope: containerRef }
  )

  // ============================================================
  // GSAP: Initial entrance
  // ============================================================
  useGSAP(
    () => {
      if (status !== 'quiz') return

      const tl = gsap.timeline()
      tl.fromTo(
        containerRef.current,
        { opacity: 0, scale: 1 },
        { opacity: 1, duration: 0.5, ease: 'power2.out' }
      )
      tl.fromTo(
        cardRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
        '-=0.3'
      )
      animarOpcoes(tl)
    },
    { dependencies: [status], scope: containerRef }
  )

  // ============================================================
  // GSAP: Analyzing screen particles
  // ============================================================
  useGSAP(
    () => {
      if (status !== 'saving') return
      if (!particlesRef.current) return

      const particles = particlesRef.current.querySelectorAll('.particle')
      const tl = gsap.timeline({ repeat: -1 })

      particles.forEach((p, i) => {
        gsap.set(p, {
          x: Math.random() * 300 - 150,
          y: Math.random() * 300 - 150,
          opacity: 0,
          scale: 0.5,
        })

        gsap.to(p, {
          y: `-=${200 + Math.random() * 200}`,
          x: `+=${Math.random() * 100 - 50}`,
          opacity: Math.random() * 0.6 + 0.2,
          scale: Math.random() * 1.5 + 0.5,
          duration: 2 + Math.random() * 3,
          repeat: -1,
          delay: i * 0.2,
          ease: 'power1.out',
        })
      })

      tl.fromTo(
        analyzingRef.current?.querySelector('.center-pulse') || [],
        { scale: 1, opacity: 0.6 },
        { scale: 1.3, opacity: 0, duration: 1.5, ease: 'power2.out' },
        0
      )
      tl.fromTo(
        analyzingRef.current?.querySelector('.center-pulse') || [],
        { scale: 1, opacity: 0.6 },
        { scale: 1.3, opacity: 0, duration: 1.5, ease: 'power2.out' },
        0.75
      )

      return () => {
        tl.kill()
        gsap.killTweensOf(particles)
      }
    },
    { dependencies: [status], scope: analyzingRef }
  )

  // ============================================================
  // Analyzing Screen
  // ============================================================
  if (status === 'saving') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-void">
        <AuroraBackground />
        <div
          ref={analyzingRef}
          className="relative z-10 flex flex-col items-center justify-center text-center px-6"
        >
          <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
            <div className="center-pulse absolute inset-0 rounded-full bg-plum/20 blur-xl" />
            <div className="relative z-10 w-16 h-16 rounded-full bg-plum/10 border border-plum/30 flex items-center justify-center animate-pulse-glow">
              <Loader2 className="w-8 h-8 text-plum animate-spin" />
            </div>
          </div>

          <h2 className="font-serif text-3xl md:text-4xl text-cream mb-3 tracking-tight">
            Salvando suas respostas...
          </h2>
          <p className="text-cream/70 text-sm md:text-base max-w-sm">
            Você pode mudar ou apagar tudo depois, em "Sua mesa".
          </p>

          <div className="mt-10 flex items-center gap-3 text-cream/70 text-xs uppercase tracking-widest">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Salvando</span>
          </div>

          {/* Particles */}
          <div
            ref={particlesRef}
            className="absolute inset-0 pointer-events-none"
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="particle absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-plum/40"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const opcaoCls = (sel: boolean) => `
    quiz-option will-change-transform
    w-full flex items-center gap-4 p-4 md:p-5 rounded-2xl
    border text-left transition-colors duration-200
    ${sel ? 'border-plum/50 bg-plum/10 shadow-glow' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10'}
  `

  // ============================================================
  // Quiz Screen
  // ============================================================
  return (
    <div className="fixed inset-0 z-50 flex bg-void overflow-y-auto" style={{ paddingBottom: 'calc(var(--cookie-banner-h, 0px) + 1rem)' }}>
      <AuroraBackground />

      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-2xl m-auto px-4 md:px-6 py-8" // m-auto: centraliza sem cortar o topo quando rola
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-plum/10 border border-plum/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-plum" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-cream/70 font-medium">
                Match de Mesa
              </span>
              <div className="text-cream/70 text-xs font-medium">
                Perfil de mesa · tudo opcional
              </div>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-cream/70 hover:text-cream hover:bg-white/10 hover:border-white/20 transition-all duration-200"
            aria-label="Fechar questionário"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-cream/70 font-medium">
              Progresso
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-cream/70 font-medium">
              <span className="text-plum">{step + 1}</span>
              <span className="mx-1">/</span>
              <span>{totalSteps}</span>
            </span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              ref={progressRef}
              className="h-full bg-plum rounded-full shadow-glow"
              style={{ width: '0%' }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div ref={cardRef} className="will-change-transform">
          <div className="mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-plum/80 font-medium">
              Pergunta {step + 1} · opcional
            </span>
          </div>

          {currentStep.kind === 'single' && (
            <>
              <h2 className="font-serif text-3xl md:text-4xl text-cream mb-2 leading-tight">{currentStep.question}</h2>
              <p className="text-cream/70 text-sm mb-6">{currentStep.subtitle}</p>
              <div ref={optionsRef} className="space-y-3">
                {currentStep.options.map((option) => {
                  const isSelected = answers[currentStep.id] === option.value
                  return (
                    <button
                      key={option.value}
                      data-value={option.value}
                      aria-pressed={isSelected}
                      onClick={() => selectAnswer(currentStep.id, option.value)}
                      className={opcaoCls(isSelected)}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${isSelected ? 'bg-plum/20 text-plum' : 'bg-white/5 text-cream/70'}`}>
                        {option.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-cream font-medium text-base md:text-lg">{option.label}</div>
                        {option.description && <div className="text-cream/70 text-sm leading-relaxed">{option.description}</div>}
                      </div>
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isSelected ? 'border-plum bg-plum scale-100' : 'border-white/15 scale-90'}`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cream" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {currentStep.kind === 'tags' && (() => {
            const cat = currentStep.cat
            const escolhidas = answers.tags[cat] ?? []
            return (
              <>
                <h2 className="font-serif text-3xl md:text-4xl text-cream mb-2 leading-tight">{MESA_TAGS[cat].rotulo}: do que você gosta?</h2>
                <p className="text-cream/70 text-sm mb-6">Escolha até {MESA_TAGS_MAX}. Os colegas veem as etiquetas e as que vocês têm em comum.</p>
                <div ref={optionsRef} className="flex flex-wrap gap-2">
                  {Object.entries(MESA_TAGS[cat].itens).map(([slug, rotulo]) => {
                    const sel = escolhidas.includes(slug)
                    const cheio = !sel && escolhidas.length >= MESA_TAGS_MAX
                    return (
                      <button
                        key={slug}
                        aria-pressed={sel}
                        disabled={cheio}
                        onClick={() => toggleTag(cat, slug)}
                        className={`quiz-option px-4 py-2 rounded-full border text-sm transition-colors ${sel ? 'border-plum/60 bg-plum/20 text-cream' : 'border-white/10 bg-white/[0.03] text-cream/80 hover:bg-white/[0.06]'} ${cheio ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {sel && <Check className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                        {rotulo}
                      </button>
                    )
                  })}
                </div>
                <p className="text-cream/70 text-xs mt-3">{escolhidas.length} de {MESA_TAGS_MAX}</p>
              </>
            )
          })()}

          {currentStep.kind === 'social' && (
            <>
              <h2 className="font-serif text-3xl md:text-4xl text-cream mb-2 leading-tight">Quer deixar sua rede social?</h2>
              <p className="text-cream/70 text-sm mb-6">Instagram, TikTok, X (Twitter) ou LinkedIn.</p>
              <div ref={optionsRef}>
                <label className="quiz-option flex items-center gap-3 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                  <AtSign className="w-5 h-5 text-cream/70 flex-shrink-0" />
                  <span className="sr-only">Link da rede social</span>
                  <input
                    type="url"
                    inputMode="url"
                    value={redeTexto}
                    onChange={(e) => { setRedeTexto(e.target.value); setRedeErro(null) }}
                    placeholder="instagram.com/seu.usuario"
                    maxLength={140}
                    className="flex-1 bg-transparent text-cream placeholder:text-cream/40 outline-none text-base"
                  />
                </label>
                {redeErro && <p role="alert" className="text-sm text-red-300 mt-2">{redeErro}</p>}
                <p className="quiz-option text-cream/70 text-xs mt-3 leading-relaxed">
                  Sua rede social só aparece para os colegas de mesa se você der um segundo aceite, separado do
                  termo da mesa ("Mostrar minha rede social"). Sem ele, ela fica guardada só para você.
                </p>
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => irPara(step - 1)}
              disabled={step === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${step === 0 ? 'text-cream/10 cursor-not-allowed' : 'text-cream/70 hover:text-cream hover:bg-white/5'}`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>

            <button
              onClick={avancar}
              className={`flex items-center gap-2 px-7 py-3 rounded-full text-sm font-medium transition-all duration-200 ${isLast || respondido ? 'bg-plum text-cream hover:shadow-glow' : 'text-cream/70 hover:text-cream hover:bg-white/5'}`}
            >
              <span>{isLast ? 'Finalizar' : respondido ? 'Continuar' : 'Pular'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom hint */}
        <div className="mt-8 text-center">
          <p className="text-cream/70 text-xs">
            Tudo aqui é opcional: pule o que quiser. Para participar, bastam nome, data de nascimento e foto do seu Perfil.
          </p>
        </div>
      </div>
    </div>
  )
}
