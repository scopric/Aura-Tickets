import { useState } from 'react'
import { MessageSquarePlus, X, Send, Star, Bug, Lightbulb, HelpCircle, ThumbsUp, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useFeedback } from '../hooks/useFeedback'
import type { FeedbackType } from '../hooks/useFeedback'

type FeedbackTypeConfig = {
  icon: typeof Star
  label: string
  color: string
}

const typeConfig: Record<FeedbackType, FeedbackTypeConfig> = {
  melhoria: { icon: Lightbulb, label: 'Melhoria', color: 'text-amber-600' },
  bug: { icon: Bug, label: 'Bug', color: 'text-red-500' },
  duvida: { icon: HelpCircle, label: 'Duvida', color: 'text-blue-600' },
  sugestao: { icon: Star, label: 'Sugestao', color: 'text-violet-600' },
  elogio: { icon: ThumbsUp, label: 'Elogio', color: 'text-green-600' },
}

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false)
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
        setIsOpen(false)
        setMessage('')
        setRating(0)
        setType('melhoria')
      }, 2000)
    } catch (err) {
      console.error('[Feedback]', err)
      toast.error('Erro ao enviar feedback.')
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-3 rounded-full shadow-lg transition-all duration-300 ${
          isOpen ? 'bg-espresso text-cream rotate-90' : 'bg-plum text-cream hover:shadow-glow'
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquarePlus className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-80 bg-canvas border border-white/60 rounded-2xl shadow-xl p-4">
          {sent ? (
            <div className="text-center py-6">
              <Check className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <h3 className="font-medium text-espresso">Obrigado!</h3>
              <p className="text-xs text-espresso/50 mt-1">Seu feedback foi enviado com sucesso.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <h3 className="font-medium text-sm text-espresso">Envie seu feedback</h3>

              <div className="flex gap-1">
                {(Object.keys(typeConfig) as FrontendFeedbackType[]).map((t) => {
                  const { icon: Icon, label, color } = typeConfig[t]
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] transition-all ${
                        type === t ? 'bg-white/60 border border-white/60' : 'hover:bg-white/30'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                      <span className="text-espresso/60">{label}</span>
                    </button>
                  )
                })}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Conte-nos o que voce pensa..."
                className="w-full px-3 py-2 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso placeholder:text-espresso/30 focus:outline-none focus:border-plum/30 transition-colors resize-none h-20"
              />

              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className="p-0.5"
                  >
                    <Star
                      className={`w-4 h-4 transition-colors ${
                        n <= rating ? 'text-amber-400 fill-amber-400' : 'text-espresso/15'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando...' : <><Send className="w-3.5 h-3.5" /> Enviar</>}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  )
}
