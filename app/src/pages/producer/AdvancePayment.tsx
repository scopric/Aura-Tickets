import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, DollarSign, TrendingUp, Calendar,
  CheckCircle2, Banknote, Percent, Clock, Info, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useProducerEvents } from '../../hooks/useEvents'
import { useRequestAdvance } from '../../hooks/useProducerTools'

const advanceOptions = [
  { id: '7', label: '7 dias', days: 7, fee: 3.5, icon: Clock },
  { id: '15', label: '15 dias', days: 15, fee: 2.9, icon: Calendar },
  { id: '30', label: '30 dias', days: 30, fee: 1.9, icon: TrendingUp },
]

export default function AdvancePayment() {
  const { data: events = [], isLoading: eventsLoading } = useProducerEvents()
  const requestAdvance = useRequestAdvance()

  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id || null)
  const [selectedOption, setSelectedOption] = useState('15')
  const [acceptTerms, setAcceptTerms] = useState(false)

  const selectedEvent = events.find(e => e.id === selectedEventId)

  // Calculate available revenue from event
  const [eventRevenue, setEventRevenue] = useState({ sold: 0, revenue: 0, available: 0 })
  const [revenueLoading, setRevenueLoading] = useState(false)

  useState(() => {
    if (!selectedEventId) return
    setRevenueLoading(true)
    supabase.from('orders').select('total').eq('event_id', selectedEventId).eq('status', 'paid').then(({ data }) => {
      const revenue = (data || []).reduce((s: number, o: any) => s + (Number(o.total) || 0), 0)
      setEventRevenue({ sold: 0, revenue, available: Math.round(revenue * 0.7) })
    }).finally(() => setRevenueLoading(false))
  })

  const option = advanceOptions.find(o => o.id === selectedOption)!
  const advanceAmount = eventRevenue.available
  const feeAmount = (advanceAmount * option.fee) / 100
  const iofAmount = advanceAmount * 0.000041 * option.days
  const netAmount = advanceAmount - feeAmount - iofAmount

  const handleRequest = async () => {
    if (!acceptTerms) { toast.error('Aceite os termos para continuar'); return }
    if (!selectedEventId) { toast.error('Selecione um evento'); return }
    try {
      await requestAdvance.mutateAsync({
        event_id: selectedEventId,
        amount: advanceAmount,
        fee_pct: option.fee,
        fee_amount: feeAmount,
        iof_amount: iofAmount,
        net_amount: netAmount,
        days: option.days,
        status: 'requested',
      })
      toast.success(`Solicitacao de R$ ${netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} enviada!`)
    } catch {
      toast.error('Erro ao enviar solicitacao')
    }
  }

  const isLoading = eventsLoading || revenueLoading

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-plum animate-spin mb-4" />
        <p className="text-espresso/60 text-sm">Carregando dados...</p>
      </div>
    )
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
          {events.map(e => (
            <button key={e.id} onClick={() => setSelectedEventId(e.id)}
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${selectedEventId === e.id ? 'bg-plum/5 border border-plum/20' : 'bg-white/40 border border-white/60 hover:bg-white/60'}`}>
              <div className="text-left">
                <div className="text-sm font-medium text-espresso">{e.title}</div>
                <div className="text-xs text-espresso/40">{e.date ? new Date(e.date).toLocaleDateString('pt-BR') : 'Sem data'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-espresso">R$ {eventRevenue.revenue.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-green-600">R$ {eventRevenue.available.toLocaleString('pt-BR')} disponivel</div>
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
            <span className="text-sm font-medium text-red-500">- R$ {iofAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-3 border-t-2 border-plum/20">
            <span className="text-sm font-medium text-espresso">Voce recebe</span>
            <span className="text-lg font-medium text-plum">R$ {netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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
      <button onClick={handleRequest} disabled={requestAdvance.isPending}
        className="w-full py-4 bg-plum text-cream font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50">
        {requestAdvance.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><DollarSign className="w-5 h-5" /> Solicitar Antecipacao</>}
      </button>
    </div>
  )
}
