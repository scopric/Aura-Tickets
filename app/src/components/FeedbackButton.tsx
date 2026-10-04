import { useState } from 'react'
import { MessageSquarePlus, X, Send, Star, Bug, Lightbulb, HelpCircle, ThumbsUp, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useFeedback, MAX_MENSAGEM } from '../hooks/useFeedback'
import type { FeedbackType } from '../hooks/useFeedback'

type FeedbackTypeConfig = {
  icon: typeof Star
  label: string
  color: string
}

const typeConfig: Record<FeedbackType, FeedbackTypeConfig> = {
  melhoria: { icon: Lightbulb, label: 'Melhoria', color: 'text-amber-600' },
  bug: { icon: Bug, label: 'Bug', color: 'text-red-500' },
  duvida: { icon: HelpCircle, label: 'Dúvida', color: 'text-blue-600' },
  sugestao: { icon: Star, label: 'Sugestão', color: 'text-violet-600' },
  elogio: { icon: ThumbsUp, label: 'Elogio', color: 'text-green-600' },
}

/** Formulário de feedback, usado no botão flutuante (páginas públicas) e no ícone de Feedback do topo (FeedbackTopButton). */
export function FeedbackForm({ onDone }: { onDone?: () => void }) {
  const [type, setType] = useState<FeedbackType>('melhoria')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)
  const { mutateAsync: sendFeedback, isPending: isSubmitting } = useFeedback()
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) {
      toast.error('Escreva uma mensagem antes de enviar.')
      return
    }

    try {
      await sendFeedback({
        type,
        message: message.trim(),
        rating,
      })

      setSent(true)
      toast.success('Feedback enviado! Obrigado.')
      setTimeout(() => {
        setSent(false)
        setMessage('')
        setRating(0)
        setType('melhoria')
        onDone?.()
      }, 2000)
    } catch (err) {
      console.error('[Feedback]', err)
      toast.error('Erro ao enviar feedback: ' + (err as Error).message)
    }
  }

  if (sent) {
    return (
      <div className="text-center py-6" role="status">
        <Check className="w-10 h-10 text-green-500 mx-auto mb-3" />
        <h3 className="font-medium text-espresso">Obrigado!</h3>
        <p className="text-xs text-espresso mt-1">Seu feedback foi enviado com sucesso.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-medium text-sm text-espresso">Envie seu feedback</h3>

      <div className="flex gap-1" role="group" aria-label="Tipo de feedback">
        {(Object.keys(typeConfig) as FeedbackType[]).map((t) => {
          const { icon: Icon, label, color } = typeConfig[t]
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum ${
                type === t ? 'border border-plum' : 'border border-transparent hover:border-slate-500/40'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-espresso">{label}</span>
            </button>
          )
        })}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={MAX_MENSAGEM}
        placeholder="Conte-nos o que você pensa..."
        aria-label="Mensagem do feedback"
        className="w-full px-3 py-2 bg-canvas border border-slate-500/40 rounded-xl text-xs text-espresso placeholder:text-slate-500 focus:outline-none focus:border-plum focus-visible:ring-2 focus-visible:ring-plum transition-colors resize-none h-20"
      />

      <div className="flex items-center gap-1" role="group" aria-label="Nota de 1 a 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`Nota ${n} de 5`}
            aria-pressed={n === rating}
            className="p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum"
          >
            <Star
              className={`w-4 h-4 transition-colors ${
                n <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-500'
              }`}
            />
          </button>
        ))}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2.5 bg-plum text-white text-xs font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-plum"
      >
        {isSubmitting ? 'Enviando...' : <><Send className="w-3.5 h-3.5" /> Enviar</>}
      </button>
    </form>
  )
}

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Fechar feedback' : 'Enviar feedback'}
        className={`fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 z-50 p-3 rounded-full shadow-lg transition-all duration-300 ${
          isOpen ? 'bg-plum text-white rotate-90' : 'bg-plum text-cream hover:shadow-glow'
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquarePlus className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-6 z-50 w-80 glass-panel rounded-2xl p-4">
          <FeedbackForm onDone={() => setIsOpen(false)} />
        </div>
      )}
    </>
  )
}
