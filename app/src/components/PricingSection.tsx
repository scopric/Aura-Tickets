import { useState } from 'react'
import { Crown, Check, X, Sparkles, Shield, Zap, Star, Gift, TrendingUp, Calculator } from 'lucide-react'

interface PlanFeature { name: string; included: boolean }

interface Plan {
  id: string
  name: string
  tagline: string
  monthlyPrice: number
  color: string
  bg: string
  border: string
  popular?: boolean
  free?: boolean
  fee: number
  feeMin: number
  features: PlanFeature[]
}

const plans: Plan[] = [
  {
    id: 'free', name: 'Gratuito', tagline: 'Comece sem pagar nada',
    monthlyPrice: 0, color: '#22c55e', bg: 'bg-green-50/40', border: 'border-green-200/40',
    free: true, fee: 12, feeMin: 3.99,
    features: [
      { name: '1 evento/mes', included: true },
      { name: '50 ingressos', included: true },
      { name: 'Venda de ingressos', included: true },
      { name: 'Check-in basico', included: true },
      { name: 'Relatorio basico', included: true },
      { name: 'Suporte email', included: true },
      { name: 'Grupos de ingressos', included: false },
      { name: 'Meia-entrada', included: false },
      { name: 'Formularios personalizados', included: false },
      { name: 'Evokaa Store', included: false },
      { name: 'Certificados', included: false },
      { name: 'Afiliados', included: false },
      { name: 'CRM Pipeline', included: false },
      { name: 'Bordero avancado', included: false },
      { name: 'Antecipacao de receita', included: false },
      { name: 'Parcelamento sem juros', included: false },
    ]
  },
  {
    id: 'starter', name: 'Starter', tagline: 'Para quem esta comecando',
    monthlyPrice: 49, color: '#8b5cf6', bg: 'bg-violet-50/40', border: 'border-violet-200/40',
    fee: 8, feeMin: 2.99,
    features: [
      { name: '5 eventos/mes', included: true },
      { name: '200 ingressos', included: true },
      { name: 'Venda de ingressos', included: true },
      { name: 'Check-in completo', included: true },
      { name: 'Relatorio completo', included: true },
      { name: 'Grupos de ingressos', included: true },
      { name: 'Meia-entrada', included: true },
      { name: 'Formularios personalizados', included: true },
      { name: 'Limite por CPF', included: true },
      { name: 'Evokaa Store', included: true },
      { name: 'Lista de interesse', included: true },
      { name: 'Suporte prioritario', included: true },
      { name: 'Certificados', included: false },
      { name: 'Afiliados', included: false },
      { name: 'CRM Pipeline', included: false },
      { name: 'Antecipacao de receita', included: false },
    ]
  },
  {
    id: 'plus', name: 'Plus', tagline: 'Mais alcance',
    monthlyPrice: 99, color: '#d97706', bg: 'bg-amber-50/40', border: 'border-amber-200/40',
    popular: true, fee: 6, feeMin: 1.99,
    features: [
      { name: '15 eventos/mes', included: true },
      { name: '1.000 ingressos', included: true },
      { name: 'Tudo do Starter', included: true },
      { name: 'Certificados', included: true },
      { name: 'Afiliados + Cupons', included: true },
      { name: 'CRM Pipeline', included: true },
      { name: 'Comunicacao integrada', included: true },
      { name: 'Bordero avancado', included: true },
      { name: 'Parcelamento sem juros', included: true },
      { name: 'Marketing integrado', included: true },
      { name: 'Mesa Coletiva', included: false },
      { name: 'Antecipacao de receita', included: false },
      { name: 'Lugar marcado', included: false },
      { name: 'API Access', included: false },
      { name: 'White label', included: false },
      { name: 'Suporte 24/7', included: false },
    ]
  },
  {
    id: 'pro', name: 'Pro', tagline: 'Sem limites',
    monthlyPrice: 199, color: '#7a3b69', bg: 'bg-blue-500/5', border: 'border-blue-500/15',
    fee: 4, feeMin: 0,
    features: [
      { name: 'Eventos ilimitados', included: true },
      { name: 'Ingressos ilimitados', included: true },
      { name: 'Tudo do Plus', included: true },
      { name: 'Mesa Coletiva', included: true },
      { name: 'Antecipacao de receita', included: true },
      { name: 'Lugar marcado', included: true },
      { name: 'Check-in App', included: true },
      { name: 'Evokaa Academy', included: true },
      { name: 'Relatorios avancados', included: true },
      { name: 'API Access', included: true },
      { name: 'Multiplos produtores', included: false },
      { name: 'White label', included: false },
      { name: 'Gerente dedicado', included: false },
      { name: 'SLA garantido', included: false },
      { name: 'Custom integrations', included: false },
      { name: 'Suporte 24/7', included: false },
    ]
  },
  {
    id: 'enterprise', name: 'Enterprise', tagline: 'Para empresas',
    monthlyPrice: 499, color: '#1a0e14', bg: 'bg-slate-900/5', border: 'border-slate-900/10',
    fee: 2.5, feeMin: 0,
    features: [
      { name: 'Tudo do Pro', included: true },
      { name: 'Multiplos produtores', included: true },
      { name: 'White label', included: true },
      { name: 'API completa', included: true },
      { name: 'Gerente dedicado', included: true },
      { name: 'SLA garantido', included: true },
      { name: 'Custom integrations', included: true },
      { name: 'Treinamento equipe', included: true },
      { name: 'Suporte 24/7', included: true },
      { name: 'Taxa negociavel', included: true },
      { name: 'Onboarding VIP', included: true },
      { name: 'Consultoria estrategica', included: true },
      { name: 'Eventos ilimitados', included: true },
      { name: 'Ingressos ilimitados', included: true },
      { name: 'Prioridade maxima', included: true },
      { name: 'Dashboard exclusivo', included: true },
    ]
  },
]

export default function PricingSection() {
  const [period, setPeriod] = useState<'mensal' | 'anual'>('mensal')

  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-0 w-[500px] h-[500px] bg-blue-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-500/[0.02] rounded-full blur-3xl" />
      </div>
      <div className="max-w-7xl mx-auto px-6 relative">
        <div className="text-center mb-14">
          <span className="text-[10px] font-medium tracking-[0.35em] uppercase text-blue-500">Planos</span>
          <h2 className="text-4xl mt-4 mb-3 text-slate-900">
            Comece <em className="text-blue-500">gratis</em>, escalone depois
          </h2>
          <p className="text-sm max-w-lg mx-auto leading-relaxed text-slate-500">
            Crie eventos sem pagar nada. So pague quando vender. Quanto mais voce cresce, menos paga por ingresso.
          </p>

          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm ${period === 'mensal' ? 'text-espresso font-medium' : 'text-slate-400'}`}>Mensal</span>
            <button onClick={() => setPeriod(period === 'mensal' ? 'anual' : 'mensal')} className="w-14 h-7 rounded-full p-0.5 transition-colors" style={{ background: period === 'anual' ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'rgba(15,23,42,0.15)' }}>
              <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${period === 'anual' ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm ${period === 'anual' ? 'text-espresso font-medium' : 'text-slate-400'}`}>Anual</span>
            {period === 'anual' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">-20%</span>}
          </div>
        </div>

        {/* How it works */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
          {[
            { icon: Gift, text: 'Crie eventos gratis' },
            { icon: Calculator, text: 'So pague quando vender' },
            { icon: TrendingUp, text: 'Quanto mais vende, menos paga' },
            { icon: Zap, text: 'Cancele quando quiser' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/40 border border-white/60">
              <item.icon className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-slate-500">{item.text}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {plans.map(p => {
            const price = period === 'anual' ? Math.round(p.monthlyPrice * 0.8) : p.monthlyPrice
            const Icon = p.id === 'free' ? Gift : p.id === 'starter' ? Zap : p.id === 'plus' ? Star : p.id === 'pro' ? Crown : Shield
            return (
              <div key={p.id} className={`relative p-5 rounded-3xl border backdrop-blur-sm transition-all hover:shadow-xl hover:-translate-y-1 ${p.bg} ${p.border} ${p.popular ? 'ring-2 ring-blue-500/30 scale-[1.02] lg:scale-[1.03]' : ''} ${p.free ? 'ring-2 ring-green-400/30' : ''}`}>
                {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-medium text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>Mais Popular</span>}
                {p.free && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-medium text-white bg-green-500">Gratis</span>}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${p.color}15` }}>
                  <Icon className="w-5 h-5" style={{ color: p.color }} />
                </div>
                <h3 className="text-lg mb-0.5 text-slate-900">{p.name}</h3>
                <p className="text-xs mb-3 text-slate-400">{p.tagline}</p>

                <div className="flex items-baseline gap-1 mb-2">
                  {p.free ? (
                    <span className="text-3xl text-green-600">Gratis</span>
                  ) : (
                    <>
                      <span className="text-3xl" style={{ color: p.color }}>R$ {price}</span>
                      <span className="text-xs text-slate-400">/mes</span>
                    </>
                  )}
                </div>

                {/* Tax info */}
                <div className="mb-4 p-2.5 rounded-xl bg-white/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400">Taxa por ingresso</span>
                    <span className="text-xs font-medium" style={{ color: p.color }}>{p.fee}%</span>
                  </div>
                  {p.feeMin > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Valor minimo</span>
                      <span className="text-[10px] text-slate-400">R$ {p.feeMin}</span>
                    </div>
                  )}
                  {p.feeMin === 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Valor minimo</span>
                      <span className="text-[10px] text-green-600 font-medium">Isento</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 mb-5">
                  {p.features.map(f => (
                    <div key={f.name} className={`flex items-center gap-2 text-[11px] ${f.included ? 'text-slate-500' : 'text-slate-300'}`}>
                      {f.included ? <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /> : <X className="w-3.5 h-3.5 flex-shrink-0" />}
                      {f.name}
                    </div>
                  ))}
                </div>
                <button className={`w-full py-2.5 rounded-full text-xs font-medium transition-all ${p.popular ? 'text-white hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]' : p.free ? 'text-white hover:shadow-lg' : 'border hover:bg-blue-50'}`} style={p.popular ? { background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' } : p.free ? { background: '#22c55e' } : { borderColor: 'rgba(59,130,246,0.3)', color: '#3b82f6' }}>
                  {p.free ? 'Criar Evento Gratis' : 'Comecar'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Comparison Note */}
        <div className="mt-8 p-4 rounded-2xl bg-white/40 border border-white/60 flex items-center gap-3">
          <Calculator className="w-5 h-5 text-plum flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-500">
              <strong>Exemplo:</strong> Um ingresso de R$ 100 — no plano <strong>Gratuito</strong> voce paga R$ 12 de taxa. 
              No plano <strong>Pro</strong>, voce paga R$ 4 + R$ 199/mes. A partir de 20 ingressos/mes, o Pro sai mais barato.
            </p>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Shield, title: 'Pagamento seguro', desc: 'SSL 256-bit' },
            { icon: Sparkles, title: 'Sem compromisso', desc: 'Cancele quando quiser' },
            { icon: Crown, title: 'Sem taxa de adesao', desc: 'So pague quando vender' },
            { icon: Zap, title: 'Ativacao imediata', desc: 'Comece em minutos' },
          ].map(t => (
            <div key={t.title} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
              <t.icon className="w-5 h-5 mx-auto mb-2 text-blue-500" />
              <div className="text-xs font-medium text-slate-900">{t.title}</div>
              <div className="text-[10px] text-slate-400">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
