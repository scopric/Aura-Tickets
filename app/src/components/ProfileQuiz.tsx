import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles, Check } from 'lucide-react'
import { profileQuestions } from '../data/mockData'

interface Props {
  onComplete: () => void
  onClose: () => void
}

export default function ProfileQuiz({ onComplete, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const question = profileQuestions[step]
  const totalSteps = profileQuestions.length

  const selectAnswer = (value: string) => {
    setAnswers(prev => ({ ...prev, [question.id]: value }))
    if (step < totalSteps - 1) {
      setTimeout(() => setStep(step + 1), 300)
    }
  }

  const canComplete = Object.keys(answers).length === totalSteps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-void border border-white/10 rounded-3xl p-6 lg:p-8 max-w-lg w-full shadow-elevated relative">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/5 text-cream/40 hover:text-cream hover:bg-white/10 transition-colors">
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-plum" />
          <span className="text-xs text-cream/40 uppercase tracking-widest">Matchmaking</span>
        </div>
        <h3 className="font-serif text-2xl text-cream mb-1">Seu Perfil</h3>
        <p className="text-sm text-cream/40 mb-6">Responda para montarmos sua mesa ideal</p>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {profileQuestions.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-plum' : 'bg-white/10'
            }`} />
          ))}
        </div>
        <div className="text-xs text-cream/30 mb-6 text-right">
          {step + 1} de {totalSteps}
        </div>

        {/* Question */}
        <div className="mb-6">
          <h4 className="text-lg text-cream font-medium mb-4">{question.question}</h4>
          <div className="space-y-2">
            {question.options.map((option) => (
              <button
                key={option.value}
                onClick={() => selectAnswer(option.value)}
                className={`w-full p-4 rounded-xl border text-left transition-all duration-200 ${
                  answers[question.id] === option.value
                    ? 'border-plum bg-plum/20'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    answers[question.id] === option.value
                      ? 'border-plum bg-plum'
                      : 'border-white/20'
                  }`}>
                    {answers[question.id] === option.value && <Check className="w-3 h-3 text-cream" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-cream">{option.label}</div>
                    <div className="text-xs text-cream/40">{option.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => step > 0 && setStep(step - 1)}
            disabled={step === 0}
            className={`flex items-center gap-1 text-sm transition-colors ${
              step === 0 ? 'text-cream/20 cursor-not-allowed' : 'text-cream/40 hover:text-cream'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          {canComplete ? (
            <button
              onClick={onComplete}
              className="px-6 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Ver Minha Mesa
            </button>
          ) : (
            <button
              onClick={() => answers[question.id] && step < totalSteps - 1 && setStep(step + 1)}
              disabled={!answers[question.id] || step >= totalSteps - 1}
              className={`flex items-center gap-1 text-sm transition-colors ${
                !answers[question.id] || step >= totalSteps - 1
                  ? 'text-cream/20 cursor-not-allowed'
                  : 'text-cream/40 hover:text-cream'
              }`}
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
