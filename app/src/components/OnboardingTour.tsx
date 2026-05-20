import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles, Check, User, Building } from 'lucide-react'
import { toast } from 'sonner'

interface TourStep {
  title: string
  description: string
  target?: string
  position?: 'center' | 'right' | 'left'
}

const producerSteps: TourStep[] = [
  { title: 'Bem-vindo ao Aura!', description: 'Esta e a sua central de comandos. Aqui voce gerencia todos os seus eventos, vendas e equipe em um so lugar.' },
  { title: 'Criar Evento', description: 'Comece clicando em "Nova Festa". Escolha o tipo, configure ingressos, preços e publique em minutos.' },
  { title: 'Afiliados', description: 'Cadastre vendedores que divulgarao seu evento. Cada um tem codigo unico, cupom e limite de ingressos. Acompanhe em tempo real.' },
  { title: 'Check-in', description: 'No dia do evento, use o scanner para liberar entrada. Rapido, funciona offline e atualiza em tempo real.' },
  { title: 'Financeiro', description: 'Controle receitas e despesas com formas de pagamento (PIX, cartao, boleto). Veja saldo, pendentes e atrasados.' },
  { title: 'Caixinha', description: 'Separe dinheiro por categoria: Marketing, Decoracao, Emergencia. Defina metas e acompanhe o progresso.' },
  { title: 'Comunicacao', description: 'Envie emails, SMS e push para seus participantes. Use templates prontos e agende envios automaticos.' },
  { title: 'Cupons', description: 'Crie cupons de desconto para impulsionar vendas. Percentual ou valor fixo, com limite de usos e validade.' },
  { title: 'Cronograma', description: 'Monte a timeline do evento: soundcheck, abertura, shows, encerramento. Marque itens como concluidos.' },
  { title: 'Voce esta pronto!', description: 'Explore o menu lateral para descobrir todas as ferramentas. Precisa de ajuda? O FAQ esta no menu "Ajuda".' },
]

const buyerSteps: TourStep[] = [
  { title: 'Bem-vindo ao Aura!', description: 'Aqui voce descobre os melhores eventos, compra ingressos e vive experiencias unicas.' },
  { title: 'Descobrir Eventos', description: 'Navegue pela lista de eventos. Filtre por tipo (festa, show, workshop), data e localidade.' },
  { title: 'Mesa Coletiva', description: 'Nao tem grupo? A Mesa Coletiva une 6 pessoas por afinidade. Responda o questionario e deixe o resto conosco!' },
  { title: 'Comprar Ingresso', description: 'Escolha o tipo (Pista, VIP, Mesa), aplique um cupom de desconto e pague via PIX ou cartao.' },
  { title: 'Meus Ingressos', description: 'Acesse seus ingressos com QR code. Mostre na entrada do evento para o check-in. Funciona sem internet!' },
  { title: 'Pre-Order', description: 'Compre bebidas e comidas antecipadamente pelo Pre-Order. Evite filas e ganhe descontos exclusivos.' },
  { title: 'Favoritos', description: 'Salve eventos que voce curtiu. Receba notificacoes quando novos ingressos forem liberados.' },
  { title: 'Voce esta pronto!', description: 'Explore o app e encontre seu proximo evento. Duvidas? O FAQ esta no menu "Ajuda".' },
]

interface OnboardingTourProps {
  role: 'producer' | 'buyer'
  onComplete: () => void
}

export default function OnboardingTour({ role, onComplete }: OnboardingTourProps) {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  const steps = role === 'producer' ? producerSteps : buyerSteps

  useEffect(() => {
    const key = `aura_tour_${role}_v1`
    const seen = localStorage.getItem(key)
    if (!seen) {
      setTimeout(() => setShow(true), 800)
    }
  }, [role])

  const complete = () => {
    localStorage.setItem(`aura_tour_${role}_v1`, 'done')
    setShow(false)
    onComplete()
    toast.success('Tour concluido! Bom trabalho.')
  }

  const skip = () => {
    localStorage.setItem(`aura_tour_${role}_v1`, 'done')
    setShow(false)
    onComplete()
  }

  if (!show) return null

  const s = steps[step]
  const progress = ((step + 1) / steps.length) * 100

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-espresso/30 backdrop-blur-sm" onClick={skip} />
      <div className="relative w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="w-full h-1 bg-canvas">
          <div className="h-full bg-plum rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-6">
          {/* Close */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {role === 'producer' ? <Building className="w-4 h-4 text-plum" /> : <User className="w-4 h-4 text-plum" />}
              <span className="text-[10px] font-medium text-espresso/30 uppercase tracking-wider">
                {role === 'producer' ? 'Tour do Produtor' : 'Tour do Participante'}
              </span>
            </div>
            <button onClick={skip} className="p-1.5 rounded-full hover:bg-canvas text-espresso/30 hover:text-espresso transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step counter */}
          <div className="text-[10px] text-espresso/30 mb-4">Passo {step + 1} de {steps.length}</div>

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-plum/10 flex items-center justify-center mb-5">
            {step === steps.length - 1 ? (
              <Sparkles className="w-7 h-7 text-plum" />
            ) : (
              <span className="text-xl font-serif text-plum">{step + 1}</span>
            )}
          </div>

          {/* Content */}
          <h3 className="font-serif text-xl text-espresso mb-2">{s.title}</h3>
          <p className="text-sm text-espresso/50 leading-relaxed mb-6">{s.description}</p>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => step > 0 && setStep(step - 1)}
              className={`flex items-center gap-1 px-4 py-2 text-sm rounded-full transition-all ${step > 0 ? 'text-espresso/50 hover:text-espresso hover:bg-canvas' : 'text-espresso/15 cursor-not-allowed'}`}
              disabled={step === 0}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>

            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1 px-6 py-2.5 bg-plum text-cream text-sm font-medium rounded-full hover:shadow-glow transition-all"
              >
                Proximo <ChevronRight className="w-4 h-4" />
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
