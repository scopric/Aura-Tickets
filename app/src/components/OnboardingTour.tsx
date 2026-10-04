import { useState, useEffect, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles, Check, User, Building } from 'lucide-react'
import { toast } from 'sonner'

interface TourStep {
  title: string
  description: string
  target?: string
  position?: 'center' | 'right' | 'left'
}

const producerSteps: TourStep[] = [
  { title: 'Boas-vindas à Evokaa!', description: 'Esta é a sua central. Aqui você gerencia seus eventos, vendas e equipe em um só lugar.' },
  { title: 'Criar evento', description: 'Comece em "Criar evento". Escolha o tipo, configure ingressos e preços e envie para a análise da Evokaa.' },
  { title: 'Afiliados', description: 'Vincule pessoas que vão divulgar seu evento e defina a comissão de cada uma.' },
  { title: 'Check-in', description: 'No dia do evento, use o scanner para liberar a entrada.' },
  { title: 'Financeiro', description: 'Veja o valor bruto dos pedidos pagos de cada evento e exporte em CSV. O repasse aparece quando o pagamento estiver ligado.' },
  { title: 'Orçamento do evento', description: 'Anote o previsto de cada gasto (marketing, decoração, emergência) e acompanhe quanto já separou.' },
  { title: 'Comunicação', description: 'A comunicação com os participantes chega em breve.' },
  { title: 'Cupons', description: 'Crie cupons de desconto para impulsionar vendas. Percentual ou valor fixo, com limite de usos e validade.' },
  { title: 'Cronograma', description: 'Monte a linha do tempo do evento: soundcheck, abertura, shows e encerramento. Marque os itens concluídos.' },
  { title: 'Tudo pronto!', description: 'Explore o menu lateral para conhecer as ferramentas. Dúvidas? As perguntas frequentes estão em "Ajuda".' },
]

const buyerSteps: TourStep[] = [
  { title: 'Boas-vindas à Evokaa!', description: 'Aqui você descobre eventos, compra ingressos e vive experiências únicas.' },
  { title: 'Descobrir Eventos', description: 'Navegue pela lista de eventos. Filtre por tipo (festa, show, workshop), data e local.' },
  { title: 'Mesa Coletiva', description: 'Não tem grupo? Com o ingresso de Mesa Coletiva você senta com outras pessoas no evento. A formação automática por afinidade chega em breve.' },
  { title: 'Comprar Ingresso', description: 'Escolha o tipo (Pista, VIP, Mesa), aplique um cupom de desconto e pague por Pix ou cartão.' },
  { title: 'Meus Ingressos', description: 'Acesse seus ingressos com QR code. Mostre na entrada do evento para o check-in.' },
  { title: 'Cardápio', description: 'Veja as bebidas e comidas do evento no Hub. Pedidos pelo app chegam em breve.' },
  { title: 'Tudo pronto!', description: 'Explore o app e encontre seu próximo evento. Dúvidas? As perguntas frequentes estão em "Ajuda".' },
]

interface OnboardingTourProps {
  role: 'producer' | 'buyer'
  onComplete: () => void
}

export default function OnboardingTour({ role, onComplete }: OnboardingTourProps) {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)

  const steps = role === 'producer' ? producerSteps : buyerSteps

  useEffect(() => {
    const key = `aura_tour_${role}_v1`
    const seen = localStorage.getItem(key)
    if (seen) return
    // o layout só monta este componente na home do papel; ao sair da rota o timer é cancelado
    const t = setTimeout(() => setShow(true), 800)
    return () => clearTimeout(t)
  }, [role])

  const complete = () => {
    localStorage.setItem(`aura_tour_${role}_v1`, 'done')
    setShow(false)
    onComplete()
    toast.success('Tour concluído! Bom trabalho.')
  }

  const skip = () => {
    localStorage.setItem(`aura_tour_${role}_v1`, 'done')
    setShow(false)
    onComplete()
  }

  // Ao abrir, o foco vai para o diálogo; ao fechar, volta para onde estava
  useEffect(() => {
    if (!show) return
    const antes = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => antes?.focus?.()
  }, [show])
  // Esc fecha como o X (escolha explícita); clique fora só esconde nesta visita, sem marcar como visto.
  // Tab e Shift+Tab giram entre o primeiro e o último botão do diálogo.
  useEffect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { skip(); return }
      const el = dialogRef.current
      if (e.key !== 'Tab' || !el) return
      const focaveis = el.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (!focaveis.length) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      const atual = document.activeElement
      if (e.shiftKey && (atual === primeiro || !el.contains(atual) || atual === el)) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && (atual === ultimo || !el.contains(atual))) { e.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!show) return null

  const s = steps[step]
  const progress = ((step + 1) / steps.length) * 100

  // z-50 (não 70): o aviso da Política (z-50, depois do <main> no DOM) tem de ficar por cima do véu e clicável
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 glass-backdrop" onClick={() => setShow(false)} />
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tour-titulo" className="glass-panel relative w-full max-w-md overflow-hidden outline-none">
        {/* Progress bar */}
        <div className="w-full h-1 bg-canvas">
          <div className="h-full bg-plum rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-6">
          {/* Close */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {role === 'producer' ? <Building className="w-4 h-4 text-plum" /> : <User className="w-4 h-4 text-plum" />}
              <span className="text-[10px] font-medium text-espresso/70 uppercase tracking-wider">
                {role === 'producer' ? 'Tour do Produtor' : 'Tour do Participante'}
              </span>
            </div>
            <button onClick={skip} aria-label="Fechar tour" className="p-1.5 rounded-full hover:bg-canvas text-espresso/70 hover:text-espresso transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step counter */}
          <div className="text-[10px] text-espresso/70 mb-4">Passo {step + 1} de {steps.length}</div>

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-plum/10 flex items-center justify-center mb-5">
            {step === steps.length - 1 ? (
              <Sparkles className="w-7 h-7 text-plum" />
            ) : (
              <span className="text-xl font-serif text-plum">{step + 1}</span>
            )}
          </div>

          {/* Content */}
          <h3 id="tour-titulo" className="font-serif text-xl text-espresso mb-2">{s.title}</h3>
          <p className="text-sm text-espresso/70 leading-relaxed mb-6">{s.description}</p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => step > 0 && setStep(step - 1)}
              className={`flex items-center gap-1 px-4 py-2 text-sm rounded-full transition-all ${step > 0 ? 'text-espresso/70 hover:text-espresso hover:bg-canvas' : 'text-espresso/15 cursor-not-allowed'}`}
              disabled={step === 0}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>

            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1 px-6 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={complete}
                className="flex items-center gap-1 px-6 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
              >
                <Check className="w-4 h-4" /> Concluir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
