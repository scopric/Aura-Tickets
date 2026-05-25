import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, DollarSign, TrendingUp, Calendar,
  CheckCircle2, Banknote, Percent, Clock, Info
} from 'lucide-react'
import { toast } from 'sonner'

interface AdvanceOption {
  id: string
  label: string
  days: number
  fee: number
  icon: typeof DollarSign
}

const advanceOptions: AdvanceOption[] = import.meta.env.DEV ? [
  { id: '7', label: '7 dias', days: 7, fee: 3.5, icon: Clock },
  { id: '15', label: '15 dias', days: 15, fee: 2.9, icon: Calendar },
  { id: '30', label: '30 dias', days: 30, fee: 1.9, icon: TrendingUp },
] : []

const eventSales = import.meta.env.DEV ? [
  { event: 'Noite Eletro 2025', sold: 468, revenue: 79920, available: 53200 },
  { event: 'Jazz Sunset Session', sold: 188, revenue: 18240, available: 12160 },
  { event: 'Feira de Arte', sold: 823, revenue: 47910, available: 33537 },
] : []

export default function AdvancePayment() {
  const [selectedEvent, setSelectedEvent] = useState(0)
  const [selectedOption, setSelectedOption] = useState('15')
  const [acceptTerms, setAcceptTerms] = useState(false)

  const event = eventSales[selectedEvent]
  const option = advanceOptions.find(o => o.id === selectedOption)!
  const advanceAmount = event.available
  const feeAmount = (advanceAmount * option.fee) / 100
  const netAmount = advanceAmount - feeAmount

  const handleRequest = () => {
    if (!acceptTerms) { toast.error('Aceite os termos para continuar'); return }
    toast.success(`Solicitacao de R$ ${netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} enviada!`)
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/producer/dashboard" className="p-2 rounded-full bg-white/60 border border-white/60 text-espresso/50 hover:text-espresso transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-serif text-3xl text-espresso">Antecipacao de Receita</h1>
          <p className="text-sm text-espresso/50 mt-1">Receba o dinheiro dos seus ingressos vendidos antes do evento</p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Banknote, step: '01', title: 'Escolha o evento', desc: 'Selecione qual evento deseja antecipar' },
          { icon: Percent, step: '02', title: 'Defina o prazo', desc: 'Quanto mais dias, menor a taxa' },
          { icon: DollarSign, step: '03', title: 'Receba na conta', desc: 'Dinheiro cai em ate 24h' },
        ].map(s => (
          <div key={s.step} className="p-5 rounded-2xl bg-white/60 border border-white/60 text-center">
            <div className="font-serif text-3xl text-plum/20 mb-2">{s.step}</div>
            <s.icon className="w-5 h-5 text-plum mx-auto mb-2" />
            <div className="text-sm font-medium text-espresso mb-1">{s.title}</div>
            <div className="text-xs text-espresso/40">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Select Event */}
      <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
        <h2 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-plum" /> Selecione o Evento
        </h2>
        <div className="space-y-2">
          {eventSales.map((e, i) => (
            <button key={i} onClick={() => setSelectedEvent(i)}
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${selectedEvent === i ? 'bg-plum/5 border border-plum/20' : 'bg-white/40 border border-white/60 hover:bg-white/60'}`}>
              <div className="text-left">
                <div className="text-sm font-medium text-espresso">{e.event}</div>
                <div className="text-xs text-espresso/40">{e.sold} ingressos vendidos</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-espresso">R$ {e.revenue.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-green-600">R$ {e.available.toLocaleString('pt-BR')} disponivel</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Advance Options */}
      <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
        <h2 className="text-sm font-medium text-espresso mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-plum" /> Prazo de Antecipacao
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {advanceOptions.map(opt => (
            <button key={opt.id} onClick={() => setSelectedOption(opt.id)}
              className={`p-4 rounded-xl border transition-all text-center ${selectedOption === opt.id ? 'border-plum bg-plum/5' : 'border-white/60 bg-white/40 hover:bg-white/60'}`}>
              <opt.icon className={`w-5 h-5 mx-auto mb-2 ${selectedOption === opt.id ? 'text-plum' : 'text-espresso/30'}`} />
              <div className={`text-sm font-medium ${selectedOption === opt.id ? 'text-plum' : 'text-espresso'}`}>{opt.label}</div>
              <div className="text-xs text-espresso/40">{opt.fee}% taxa</div>
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="p-6 bg-white/60 border border-white/60 rounded-2xl mb-6">
        <h2 className="text-sm font-medium text-espresso mb-4">Resumo da Operacao</h2>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-white/60">
            <span className="text-sm text-espresso/60">Valor bruto disponivel</span>
            <span className="text-sm font-medium text-espresso">R$ {advanceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-white/60">
            <span className="text-sm text-espresso/60">Taxa de antecipacao ({option.fee}%)</span>
            <span className="text-sm font-medium text-red-500">- R$ {feeAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-white/60">
            <span className="text-sm text-espresso/60">IOF (0.0041% ao dia x {option.days} dias)</span>
            <span className="text-sm font-medium text-red-500">- R$ {(advanceAmount * 0.000041 * option.days).toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-3 border-t-2 border-plum/20">
            <span className="text-sm font-medium text-espresso">Voce recebe</span>
            <span className="text-lg font-medium text-plum">R$ {(netAmount - advanceAmount * 0.000041 * option.days).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-xs text-espresso/30">
            <span>Data da solicitacao</span>
            <span>{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
          <div className="flex justify-between text-xs text-espresso/30">
            <span>Previsao de repasse</span>
            <span>{new Date(Date.now() + option.days * 86400000).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="p-4 bg-amber-50/50 border border-amber-200/40 rounded-2xl mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-espresso/60 leading-relaxed">
            A antecipacao de receita e um servico de adiantamento de valores. O valor sera descontado automaticamente das vendas do evento. 
            Taxa minima de R$ 5,00. Em caso de cancelamento do evento, o valor antecipado devera ser reembolsado integralmente.
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => setAcceptTerms(!acceptTerms)} className="transition-all">
            {acceptTerms
              ? <CheckCircle2 className="w-5 h-5 text-plum" />
              : <div className="w-5 h-5 rounded-full border-2 border-espresso/20" />}
          </button>
          <span className="text-xs text-espresso/50">Li e aceito os termos de antecipacao de receita</span>
        </div>
      </div>

      {/* CTA */}
      <button onClick={handleRequest}
        className="w-full py-4 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2">
        <DollarSign className="w-5 h-5" /> Solicitar Antecipacao
      </button>
    </div>
  )
}
