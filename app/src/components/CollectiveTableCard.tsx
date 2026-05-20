import { useState } from 'react'
import { Users, Sparkles, ChevronDown, ChevronUp, Check, Info } from 'lucide-react'
import type { Ticket } from '../data/mockData'
import ProfileQuiz from './ProfileQuiz'

interface Props {
  ticket: Ticket
  cartQty: number
  onAdd: () => void
  onRemove: () => void
  onQuantityChange: (qty: number) => void
}

export default function CollectiveTableCard({ ticket, cartQty, onAdd, onRemove, onQuantityChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const [consented, setConsented] = useState(false)

  const fillPercent = (ticket.sold / ticket.capacity) * 100

  const handleAdd = () => {
    if (!quizCompleted) {
      setShowQuiz(true)
      return
    }
    if (!consented) {
      setShowConsent(true)
      return
    }
    onAdd()
  }

  const handleQuizComplete = () => {
    setQuizCompleted(true)
    setShowQuiz(false)
    setShowConsent(true)
  }

  const handleConsent = () => {
    setConsented(true)
    setShowConsent(false)
    onAdd()
  }

  return (
    <>
      <div className="ticket-card group relative rounded-3xl overflow-hidden backdrop-blur-sm transition-all duration-500 hover:shadow-glow border-2 border-plum/30 bg-gradient-to-br from-plum/10 via-white/5 to-plum/5">
        {/* Badge */}
        <div className="absolute top-4 right-4 z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-plum text-cream text-xs font-medium rounded-full animate-pulse-glow">
            <Sparkles className="w-3 h-3" />
            Experiência Social
          </span>
        </div>

        {/* Header */}
        <div className="p-6 lg:p-8 pb-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-plum flex items-center justify-center">
              <Users className="w-5 h-5 text-cream" />
            </div>
            <div>
              <h3 className="font-serif text-2xl text-cream">{ticket.name}</h3>
              <p className="text-xs text-cream/40">Matchmaking por afinidade</p>
            </div>
          </div>

          <p className="text-sm text-cream/60 mb-4 leading-relaxed">{ticket.description}</p>

          <div className="font-serif text-4xl text-cream mb-4">
            R$ {ticket.price}
            <span className="text-sm text-cream/40 font-sans ml-2">/pessoa</span>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-cream/40 mb-2">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ticket.sold} pessoas na comunidade</span>
              <span>{ticket.capacity} vagas</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-plum rounded-full transition-all duration-1000" style={{ width: `${fillPercent}%` }} />
            </div>
          </div>

          {/* Perks */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-plum hover:text-cream transition-colors mb-2"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? 'Ocultar benefícios' : 'Ver benefícios'}
          </button>
          <div className={`space-y-2 transition-all overflow-hidden ${expanded ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
            {ticket.perks.map((perk, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-cream/60">
                <Check className="w-4 h-4 text-plum flex-shrink-0" />
                {perk}
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="px-6 lg:px-8 py-4 border-t border-white/10">
          <div className="flex items-start gap-3 mb-3">
            <Info className="w-4 h-4 text-cream/40 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-cream/40 leading-relaxed">
              Nosso algoritmo analisa perfis de temperamento, interesses e objetivos para montar mesas com alta compatibilidade. 
              Você recebe seus "colegas de mesa" 48h antes do evento.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {['Temperamento', 'Interesses', 'Vibe', 'Idade'].map((tag) => (
              <span key={tag} className="px-2.5 py-1 bg-white/5 text-cream/50 text-[10px] rounded-full border border-white/10">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 lg:p-8 pt-0">
          {cartQty > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={onRemove} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-cream hover:bg-white/20 transition-colors">-</button>
                <span className="text-cream font-medium">{cartQty}</span>
                <button onClick={() => onQuantityChange(cartQty + 1)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-cream hover:bg-white/20 transition-colors">+</button>
              </div>
              <span className="text-cream/60 text-sm">R$ {ticket.price * cartQty}</span>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              className="w-full py-3 bg-plum text-cream font-medium rounded-full transition-all duration-300 hover:shadow-glow flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {quizCompleted ? (consented ? 'Adicionar ao Carrinho' : 'Aceitar Termos') : 'Fazer Matchmaking'}
            </button>
          )}
        </div>
      </div>

      {/* Quiz Modal */}
      {showQuiz && (
        <ProfileQuiz onComplete={handleQuizComplete} onClose={() => setShowQuiz(false)} />
      )}

      {/* Consent Modal */}
      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-void border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-elevated">
            <div className="w-12 h-12 rounded-2xl bg-plum/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-plum" />
            </div>
            <h3 className="font-serif text-xl text-cream text-center mb-2">Mesa Coletiva</h3>
            <p className="text-sm text-cream/50 text-center mb-6 leading-relaxed">
              Ao comprar este ingresso, você concorda em compartilhar uma mesa com outras pessoas 
              selecionadas por nosso algoritmo de afinidade. Seus dados de perfil serão usados 
              exclusivamente para formar grupos compatíveis.
            </p>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                <input type="checkbox" className="mt-1 accent-plum" onChange={(e) => e.target.checked && handleConsent()} />
                <span className="text-sm text-cream/70">
                  Entendo que os lugares serão compartilhados e concordo em participar da experiência de matchmaking social.
                </span>
              </label>
              <button onClick={() => setShowConsent(false)} className="w-full py-2.5 text-sm text-cream/40 hover:text-cream transition-colors">
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
