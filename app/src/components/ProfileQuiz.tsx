import { useState, useRef, useCallback } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  X,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  UserCircle,

  User,
  Briefcase,
  Heart,
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
  BrainCircuit,
  Loader2,
} from 'lucide-react'
import { useMatchmakingProfile, type QuizAnswers } from '../hooks/useMatchmaking'

// ============================================================
// Tipos
// ============================================================

interface ProfileQuizProps {
  onComplete: () => void
  onCancel: () => void
}

type StepValue =
  | QuizAnswers['temperament']
  | QuizAnswers['intention']
  | QuizAnswers['music_style']
  | QuizAnswers['energy_level']

interface QuestionOption {
  value: StepValue
  label: string
  description: string
  icon: React.ReactNode
}

interface QuizStep {
  id: keyof QuizAnswers
  question: string
  subtitle: string
  options: QuestionOption[]
}

// ============================================================
// Dados
// ============================================================

const QUIZ_STEPS: QuizStep[] = [
  {
    id: 'temperament',
    question: 'Como você descreveria seu temperamento em eventos?',
    subtitle: 'Seu jeito de ser define a energia da mesa',
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
    id: 'intention',
    question: 'Qual seu objetivo principal nesse evento?',
    subtitle: 'A intenção guia nosso algoritmo de matchmaking',
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
        value: 'romance',
        label: 'Romance',
        description: 'Quem sabe encontrar alguém especial?',
        icon: <Heart className="w-5 h-5" />,
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
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({})
  const [status, setStatus] = useState<'quiz' | 'saving'>('quiz')

  const { saveProfile } = useMatchmakingProfile()

  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const analyzingRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<HTMLDivElement>(null)

  const totalSteps = QUIZ_STEPS.length
  const currentStep = QUIZ_STEPS[step]
  const progress = ((step + 1) / totalSteps) * 100

  const selectAnswer = useCallback(
    (value: StepValue) => {
      const newAnswers = { ...answers, [currentStep.id]: value }
      setAnswers(newAnswers)

      // Animate selection then advance
      const tl = gsap.timeline()
      tl.to(optionsRef.current?.querySelectorAll('.quiz-option') || [], {
        opacity: 0.3,
        scale: 0.98,
        duration: 0.2,
        ease: 'power2.in',
      })
      tl.to(
        optionsRef.current?.querySelector(`[data-value="${value}"]`) || [],
        {
          scale: 1.02,
          duration: 0.15,
          ease: 'power2.out',
        },
        '-=0.1'
      )
      tl.call(() => {
        if (step < totalSteps - 1) {
          transitionToStep(step + 1, newAnswers)
        } else {
          setAnswers(newAnswers)
          // All questions answered
          handleComplete(newAnswers as QuizAnswers)
        }
      })
    },
    [step, answers, currentStep.id, totalSteps]
  )

  const transitionToStep = useCallback(
    (nextStep: number, currentAnswers: Partial<QuizAnswers>) => {
      const tl = gsap.timeline()

      // Exit current
      tl.to(cardRef.current, {
        opacity: 0,
        x: -60,
        duration: 0.35,
        ease: 'power3.in',
      })

      tl.call(() => {
        setStep(nextStep)
        setAnswers(currentAnswers)
      })

      // Enter next (after React re-render)
      tl.fromTo(
        cardRef.current,
        { opacity: 0, x: 60 },
        { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' }
      )

      // Stagger options
      tl.fromTo(
        optionsRef.current?.querySelectorAll('.quiz-option') || [],
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
          stagger: 0.06,
          ease: 'power2.out',
        },
        '-=0.25'
      )
    },
    []
  )

  const goBack = useCallback(() => {
    if (step === 0) return
    const prevStep = step - 1

    const tl = gsap.timeline()
    tl.to(cardRef.current, {
      opacity: 0,
      x: 60,
      duration: 0.35,
      ease: 'power3.in',
    })
    tl.call(() => setStep(prevStep))
    tl.fromTo(
      cardRef.current,
      { opacity: 0, x: -60 },
      { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' }
    )
    tl.fromTo(
      optionsRef.current?.querySelectorAll('.quiz-option') || [],
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.35,
        stagger: 0.06,
        ease: 'power2.out',
      },
      '-=0.25'
    )
  }, [step])

  const handleComplete = useCallback(
    (finalAnswers: QuizAnswers) => {
      // Animate to analyzing screen
      gsap.to(containerRef.current, {
        opacity: 0,
        scale: 0.96,
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => {
          setStatus('saving')

          // Small delay for cinematic feel, then save
          setTimeout(() => {
            saveProfile.mutate(finalAnswers, {
              onSuccess: () => {
                // Cinematic outro before completing
                gsap.to(analyzingRef.current, {
                  opacity: 0,
                  scale: 1.02,
                  duration: 0.5,
                  delay: 1.2,
                  ease: 'power2.in',
                  onComplete: onComplete,
                })
              },
              onError: () => {
                // Even on error, proceed after a moment
                gsap.to(analyzingRef.current, {
                  opacity: 0,
                  duration: 0.5,
                  delay: 1.2,
                  onComplete: onComplete,
                })
              },
            })
          }, 2800)
        },
      })
    },
    [saveProfile, onComplete]
  )

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
    { dependencies: [progress], scope: containerRef }
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
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'power2.out' }
      )
      tl.fromTo(
        cardRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
        '-=0.3'
      )
      tl.fromTo(
        optionsRef.current?.querySelectorAll('.quiz-option') || [],
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.07,
          ease: 'power2.out',
        },
        '-=0.3'
      )
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

      // Pulse the center icon
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
  // Hover effect helper
  // ============================================================
  const handleOptionHover = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, entering: boolean) => {
      const el = e.currentTarget
      if (answers[currentStep.id] === el.dataset.value) return
      gsap.to(el, {
        scale: entering ? 1.015 : 1,
        duration: 0.25,
        ease: 'power2.out',
      })
    },
    [answers, currentStep]
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
              <BrainCircuit className="w-8 h-8 text-plum" />
            </div>
          </div>

          <h2 className="font-serif text-3xl md:text-4xl text-cream mb-3 tracking-tight">
            Analisando seu perfil...
          </h2>
          <p className="text-cream/40 text-sm md:text-base max-w-sm">
            Nosso algoritmo está cruzando temperamentos, vibes e energias para
            encontrar sua mesa perfeita
          </p>

          <div className="mt-10 flex items-center gap-3 text-cream/30 text-xs uppercase tracking-widest">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Processando matchmaking</span>
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

  // ============================================================
  // Quiz Screen
  // ============================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void">
      <AuroraBackground />

      <div
        ref={containerRef}
        className="relative z-10 w-full max-w-2xl px-4 md:px-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-plum/10 border border-plum/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-plum" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-cream/30 font-medium">
                Mesa Coletiva
              </span>
              <div className="text-cream/60 text-xs font-medium">
                Matchmaking por afinidade
              </div>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-cream/30 hover:text-cream hover:bg-white/10 hover:border-white/20 transition-all duration-200"
            aria-label="Fechar quiz"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-cream/30 font-medium">
              Progresso
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-cream/30 font-medium">
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
              Pergunta {step + 1}
            </span>
          </div>
          <h2 className="font-serif text-3xl md:text-4xl text-cream mb-2 leading-tight">
            {currentStep.question}
          </h2>
          <p className="text-cream/30 text-sm mb-8">{currentStep.subtitle}</p>

          {/* Options */}
          <div ref={optionsRef} className="space-y-3">
            {currentStep.options.map((option) => {
              const isSelected = answers[currentStep.id] === option.value
              return (
                <button
                  key={option.value}
                  data-value={option.value}
                  onClick={() => selectAnswer(option.value)}
                  onMouseEnter={(e) => handleOptionHover(e, true)}
                  onMouseLeave={(e) => handleOptionHover(e, false)}
                  className={`
                    quiz-option will-change-transform
                    w-full flex items-center gap-4 p-5 md:p-6 rounded-2xl
                    border text-left transition-colors duration-200
                    ${
                      isSelected
                        ? 'border-plum/50 bg-plum/10 shadow-glow'
                        : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10'
                    }
                  `}
                >
                  {/* Icon */}
                  <div
                    className={`
                      w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                      transition-colors duration-200
                      ${
                        isSelected
                          ? 'bg-plum/20 text-plum'
                          : 'bg-white/5 text-cream/30'
                      }
                    `}
                  >
                    {option.icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="text-cream font-medium text-base md:text-lg mb-0.5">
                      {option.label}
                    </div>
                    <div className="text-cream/30 text-sm leading-relaxed">
                      {option.description}
                    </div>
                  </div>

                  {/* Check */}
                  <div
                    className={`
                      w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0
                      transition-all duration-300
                      ${
                        isSelected
                          ? 'border-plum bg-plum scale-100'
                          : 'border-white/15 scale-90'
                      }
                    `}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-cream" />}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            <button
              onClick={goBack}
              disabled={step === 0}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium
                transition-all duration-200
                ${
                  step === 0
                    ? 'text-cream/10 cursor-not-allowed'
                    : 'text-cream/40 hover:text-cream hover:bg-white/5'
                }
              `}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>

            {step === totalSteps - 1 && (
              <button
                onClick={() => {
                  const a = answers
                  if (
                    a.temperament &&
                    a.intention &&
                    a.music_style &&
                    a.energy_level
                  ) {
                    handleComplete(a as QuizAnswers)
                  }
                }}
                disabled={!answers[currentStep.id]}
                className={`
                  flex items-center gap-2 px-7 py-3 rounded-full text-sm font-medium
                  transition-all duration-200
                  ${
                    !answers[currentStep.id]
                      ? 'text-cream/10 cursor-not-allowed'
                      : 'bg-plum text-cream hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]'
                  }
                `}
              >
                <span>Finalizar</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom hint */}
        <div className="mt-10 text-center">
          <p className="text-cream/[0.15] text-xs">
            Suas respostas definem sua mesa ideal — seja você mesmo
          </p>
        </div>
      </div>
    </div>
  )
}
