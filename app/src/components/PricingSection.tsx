import { useState } from 'react'
import { Crown, Check, X, Sparkles, Shield, Zap, Star, Gift, TrendingUp, Calculator, ChevronDown, ChevronUp } from 'lucide-react'

interface Plan {
  id: string
  name: string
  tagline: string
  monthlyPrice: number
  color: string
  popular?: boolean
  free?: boolean
  fee: number
  feeMin: number
  highlights: string[]
}

const pricingPlans: Plan[] = [
  {
    id: 'free',
    name: 'Gratuito',
    tagline: 'Perfeito para começar sem custos fixos',
    monthlyPrice: 0,
    color: '#10b981', // Verde
    free: true,
    fee: 12,
    feeMin: 3.99,
    highlights: [
      '1 evento ativo por vez',
      'Até 50 ingressos por mês',
      'Venda de ingressos online',
      'Check-in básico via painel web',
      'Suporte por e-mail (até 48h)'
    ]
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Ideal para produtores iniciantes',
    monthlyPrice: 49,
    color: '#8f33f5', // Roxo Evokaa
    fee: 8,
    feeMin: 2.99,
    highlights: [
      'Até 5 eventos ativos simultâneos',
      'Até 200 ingressos por mês',
      'Check-in completo via aplicativo',
      'Formulários personalizados de inscrição',
      'Lista de interesse e espera ativada',
      'Suporte prioritário por e-mail (até 24h)'
    ]
  },
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'Melhor alcance e vendas ampliadas',
    monthlyPrice: 99,
    color: '#1d68c4', // Azul Royal Evokaa
    popular: true,
    fee: 6,
    feeMin: 1.99,
    highlights: [
      'Até 15 eventos ativos simultâneos',
      'Até 1.000 ingressos por mês',
      'Sistema de Afiliados e Cupons exclusivos',
      'CRM de vendas e CRM Pipeline',
      'Certificados automáticos pós-evento',
      'Parcelamento sem juros para clientes'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Liberdade e recursos para escalar',
    monthlyPrice: 199,
    color: '#4a60e3', // Azul Violeta
    fee: 4,
    feeMin: 0,
    highlights: [
      'Eventos ativos ilimitados',
      'Ingressos emitidos ilimitados',
      'Mesa Coletiva (Matchmaking por perfil)',
      'Lugar Marcado interativo 3D',
      'Antecipação de receitas de vendas',
      'Acesso à API de integrações e Webhooks'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Solução sob medida para grandes marcas',
    monthlyPrice: 499,
    color: '#0c2340', // Navy profundo
    fee: 2.5,
    feeMin: 0,
    highlights: [
      'Taxas de vendas negociáveis e personalizadas',
      'White-label de marca completo (sem logo Evokaa)',
      'Múltiplas contas de produtores vinculadas',
      'Contrato de SLA garantido por suporte',
      'Onboarding VIP e Consultoria de marketing',
      'Suporte 24/7 via WhatsApp dedicado'
    ]
  }
]

const comparisonCategories = [
  {
    name: 'Vendas e Ingressos',
    features: [
      { name: 'Venda de ingressos online', values: { free: 'Disponível', starter: 'Disponível', plus: 'Disponível', pro: 'Disponível', enterprise: 'Disponível' } },
      { name: 'Lotes e tipos de ingressos', values: { free: '1 lote por evento', starter: 'Ilimitados', plus: 'Ilimitados', pro: 'Ilimitados', enterprise: 'Ilimitados' } },
      { name: 'Formulários de inscrição personalizados', values: { free: false, starter: true, plus: true, pro: true, enterprise: true } },
      { name: 'Mesa Coletiva (Matchmaking por perfil)', values: { free: false, starter: false, plus: false, pro: true, enterprise: true } },
      { name: 'Lugar marcado interativo', values: { free: false, starter: false, plus: false, pro: true, enterprise: true } },
      { name: 'Parcelamento sem juros para o cliente', values: { free: false, starter: false, plus: true, pro: true, enterprise: true } }
    ]
  },
  {
    name: 'Gestão e Operação',
    features: [
      { name: 'Eventos simultâneos ativos', values: { free: '1 evento', starter: '5 eventos', plus: '15 eventos', pro: 'Ilimitados', enterprise: 'Ilimitados' } },
      { name: 'Check-in de participantes', values: { free: 'Painel Web', starter: 'App Completo', plus: 'App Completo', pro: 'App Scanner', enterprise: 'App Scanner' } },
      { name: 'Relatórios pós-evento', values: { free: 'Básico', starter: 'Completo', plus: 'Avançado', pro: 'Avançado', enterprise: 'Customizado' } },
      { name: 'Certificados automáticos pós-evento', values: { free: false, starter: false, plus: true, pro: true, enterprise: true } },
      { name: 'Múltiplos usuários administradores', values: { free: false, starter: false, plus: false, pro: false, enterprise: true } }
    ]
  },
  {
    name: 'Marketing e Divulgação',
    features: [
      { name: 'Lista de interesse e espera', values: { free: false, starter: true, plus: true, pro: true, enterprise: true } },
      { name: 'Afiliados + Cupons de desconto', values: { free: false, starter: false, plus: true, pro: true, enterprise: true } },
      { name: 'Evokaa Store (Upgrades e temas)', values: { free: false, starter: true, plus: true, pro: true, enterprise: true } },
      { name: 'Marketing integrado (E-mail/WhatsApp)', values: { free: false, starter: false, plus: true, pro: true, enterprise: true } },
      { name: 'White-label de marca completo', values: { free: false, starter: false, plus: false, pro: false, enterprise: true } }
    ]
  },
  {
    name: 'Integrações e Suporte',
    features: [
      { name: 'Acesso à API e Webhooks', values: { free: false, starter: false, plus: false, pro: true, enterprise: true } },
      { name: 'Canal de atendimento principal', values: { free: 'E-mail', starter: 'Suporte VIP (24h)', plus: 'Suporte VIP (24h)', pro: 'Suporte VIP 24/7', enterprise: 'WhatsApp & Telefone 24/7' } },
      { name: 'Gerente de Contas dedicado', values: { free: false, starter: false, plus: false, pro: false, enterprise: true } },
      { name: 'Onboarding e Treinamento de equipe', values: { free: false, starter: false, plus: false, pro: false, enterprise: true } }
    ]
  }
]

export default function PricingSection() {
  const [period, setPeriod] = useState<'mensal' | 'trimestral' | 'semestral' | 'anual'>('mensal')
  const [showComparison, setShowComparison] = useState(false)

  // Estados da Calculadora
  const [ticketPrice, setTicketPrice] = useState(80)
  const [ticketsCount, setTicketsCount] = useState(250)

  const getPeriodMultiplier = (p: 'mensal' | 'trimestral' | 'semestral' | 'anual') => {
    switch (p) {
      case 'trimestral': return 0.95
      case 'semestral': return 0.90
      case 'anual': return 0.80
      default: return 1.0
    }
  }

  // Lista dos planos calculados com base no período atual
  const calculatedPlans = pricingPlans.map(plan => {
    const multiplier = getPeriodMultiplier(period)
    const monthlyCost = Math.round(plan.monthlyPrice * multiplier)
    
    let feePerTicket = 0
    if (ticketPrice > 0) {
      const calculatedFee = ticketPrice * (plan.fee / 100)
      feePerTicket = plan.feeMin > 0 ? Math.max(plan.feeMin, calculatedFee) : calculatedFee
    }
    const totalCost = monthlyCost + (ticketsCount * feePerTicket)
    return { ...plan, monthlyCost, totalCost }
  })

  // Encontra o plano economicamente mais vantajoso (menor totalCost)
  const bestPlan = calculatedPlans.reduce((best, current) => {
    return current.totalCost < best.totalCost ? current : best
  }, calculatedPlans[0])

  // Cálculos decompostos para o painel recomendado
  const grossSales = ticketsCount * ticketPrice
  const bestMultiplier = getPeriodMultiplier(period)
  
  const getPlanFees = (plan: Plan) => {
    let feePerTicket = 0
    if (ticketPrice > 0) {
      const calculatedFee = ticketPrice * (plan.fee / 100)
      feePerTicket = plan.feeMin > 0 ? Math.max(plan.feeMin, calculatedFee) : calculatedFee
    }
    return feePerTicket * ticketsCount
  }

  const bestPlanFees = getPlanFees(bestPlan)
  const bestPlanMonthlyCost = Math.round(bestPlan.monthlyPrice * bestMultiplier)
  
  // Faturamento líquido
  const netSales = Math.max(0, grossSales - bestPlanFees)

  // Economia em taxas de conveniência em relação ao plano Starter (ou Free)
  const starterPlan = pricingPlans[1]
  const starterMultiplier = getPeriodMultiplier(period)
  const starterCost = Math.round(starterPlan.monthlyPrice * starterMultiplier) + getPlanFees(starterPlan)
  const bestPlanTotalCost = bestPlanMonthlyCost + bestPlanFees
  
  // Economia projetada
  const savingsAmount = Math.max(0, starterCost - bestPlanTotalCost)

  return (
    <section className="py-24 bg-slate-50 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-0 w-[500px] h-[500px] bg-[#1d68c4]/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#8f33f5]/[0.02] rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Header Section */}
        <div className="text-center mb-16">
          <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-[#1d68c4] bg-[#1d68c4]/5 px-4 py-1.5 rounded-full">
            Planos & Tarifas
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold mt-6 mb-4 text-slate-900 tracking-tight font-serif">
            Preços transparentes, <span className="text-gradient">sem surpresas</span>
          </h2>
          <p className="text-base max-w-lg mx-auto leading-relaxed text-slate-500 font-light">
            Crie seus eventos gratuitamente. Só pague taxas sobre ingressos vendidos. À medida que suas vendas sobem, suas taxas despencam.
          </p>
        </div>

        {/* 1. CALCULADORA DINÂMICA DE TAXAS (Inovação UX) */}
        <div className="max-w-4xl mx-auto mb-12 bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#1d68c4]/10 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-[#1d68c4]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 font-serif">Simule sua Economia Real</h3>
              <p className="text-xs text-slate-400">Descubra qual plano é o mais vantajoso com base no seu volume de vendas.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Sliders */}
            <div className="space-y-6 flex flex-col justify-center">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Preço médio do ingresso</span>
                  <span className="font-semibold text-slate-900">R$ {ticketPrice}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="5"
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1d68c4]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>R$ 0 (Gratuito)</span>
                  <span>R$ 500</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Volume de vendas (Ingressos/mês)</span>
                  <span className="font-semibold text-slate-900">{ticketsCount} ingressos</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="2000"
                  step="10"
                  value={ticketsCount}
                  onChange={(e) => setTicketsCount(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1d68c4]"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>10 ingressos</span>
                  <span>2.000 ingressos</span>
                </div>
              </div>
            </div>

            {/* Painel do Recomendado (UX Decomposta) */}
            <div className="bg-[#0c2340] rounded-2xl p-6 text-white relative overflow-hidden shadow-lg flex flex-col justify-between min-h-[220px]">
              {/* Glow background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#1d68c4] to-[#8f33f5] rounded-full blur-2xl opacity-40 pointer-events-none" />

              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className="text-[9px] uppercase tracking-widest font-bold text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-full">
                    Plano Ideal Recomendado: {bestPlan.name}
                  </span>
                  {savingsAmount > 0 && (
                    <span className="text-[9px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Economia de R$ {Math.round(savingsAmount)}/mês
                    </span>
                  )}
                </div>

                {/* Decomposição detalhada dos custos simulados */}
                <div className="border-t border-b border-white/10 py-3.5 space-y-2 text-xs font-light text-white/80">
                  <div className="flex justify-between">
                    <span>Faturamento Estimado:</span>
                    <span className="font-semibold text-white">R$ {grossSales.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mensalidade Fixa do Plano:</span>
                    <span className="font-semibold text-white">R$ {bestPlanMonthlyCost}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxa de Vendas Acumulada ({bestPlan.fee}%):</span>
                    <span className="font-semibold text-white">R$ {Math.round(bestPlanFees).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold border-t border-white/10 pt-2 mt-1">
                    <span>Repasse Líquido Estimado:</span>
                    <span className="text-cyan-400 text-sm">R$ {Math.round(netSales).toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                <p className="text-[9px] text-white/40 leading-relaxed font-light">
                  * As taxas de vendas por ingresso são descontadas diretamente de cada venda realizada e não vêm cobradas no seu boleto/fatura mensal.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Switcher Multi-Período (Mensal, Trimestral, Semestral, Anual) */}
        <div className="flex justify-center mb-16">
          <div className="bg-white/85 backdrop-blur-sm border border-slate-200/50 rounded-full p-1 flex gap-1 w-full sm:w-auto overflow-x-auto no-scrollbar shadow-sm">
            {(['mensal', 'trimestral', 'semestral', 'anual'] as const).map((p) => {
              const label = p.charAt(0).toUpperCase() + p.slice(1)
              const isActive = period === p
              const discount = p === 'trimestral' ? '5% OFF' : p === 'semestral' ? '10% OFF' : p === 'anual' ? '20% OFF' : ''
              
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`flex-1 sm:flex-initial px-5 py-2 text-xs font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    isActive 
                      ? 'bg-plum text-cream shadow-md scale-[1.02]' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{label}</span>
                  {discount && (
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-green-500/10 text-green-600'
                    }`}>
                      {discount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. GRID DE CARDS DE PLANOS (Visual Premium) */}
        {/* Mobile: Horizontal scroll container | Desktop/Tablet: Flex grid */}
        <div className="flex overflow-x-auto pb-8 -mx-6 px-6 sm:-mx-0 sm:px-0 sm:overflow-x-visible lg:grid lg:grid-cols-5 gap-6 snap-x snap-mandatory scroll-smooth no-scrollbar">
          {calculatedPlans.map(p => {
            const Icon = p.id === 'free' ? Gift : p.id === 'starter' ? Zap : p.id === 'plus' ? Star : p.id === 'pro' ? Crown : Shield
            const isBest = p.id === bestPlan.id

            // Renderização do Card do Plano Popular (Plus) com borda gradiente de design sênior
            if (p.popular) {
              return (
                <div 
                  key={p.id} 
                  className="flex-shrink-0 w-[290px] sm:w-[320px] lg:w-auto snap-center relative p-[2px] rounded-3xl bg-gradient-to-br from-[#1d68c4] via-[#4a60e3] to-[#8f33f5] shadow-[0_15px_40px_rgba(29,104,196,0.18)] hover:-translate-y-1.5 transition-all duration-300"
                >
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[9px] font-bold text-white uppercase tracking-wider bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] z-20">
                    Mais Popular
                  </span>
                  
                  {isBest && (
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-wider bg-green-500 shadow-md z-20">
                      Ideal para Você
                    </span>
                  )}

                  <div className="h-full bg-white rounded-[22px] p-6 flex flex-col justify-between">
                    <div>
                      {/* Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#1d68c4]/10">
                          <Icon className="w-5 h-5 text-[#1d68c4]" />
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 font-serif">{p.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 min-h-[32px] leading-relaxed">{p.tagline}</p>

                      {/* Preço */}
                      <div className="flex items-baseline gap-1 mt-5 mb-5">
                        <span className="text-3xl font-extrabold text-slate-900">R$ {p.monthlyCost}</span>
                        <span className="text-xs text-slate-400">/mês</span>
                      </div>

                      {/* Info de Taxas */}
                      <div className="mb-6 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Taxa de venda</span>
                          <span className="text-xs font-bold text-[#1d68c4]">{p.fee}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Valor mínimo</span>
                          <span className="text-[10px] text-slate-600 font-medium">R$ {p.feeMin}</span>
                        </div>
                      </div>

                      {/* Lista de Features Simplificada */}
                      <div className="space-y-3 mb-6">
                        {p.highlights.map((feat, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-[11px] text-slate-500 leading-snug">
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button className="w-full py-3 text-xs font-bold text-white rounded-full transition-all duration-300 hover:shadow-lg focus:outline-none" style={{ background: 'linear-gradient(135deg, #1d68c4, #8f33f5)' }}>
                      Escolher Plano
                    </button>
                  </div>
                </div>
              )
            }

            // Cards para os demais planos
            return (
              <div 
                key={p.id} 
                className={`flex-shrink-0 w-[290px] sm:w-[320px] lg:w-auto snap-center relative p-6 bg-white/70 backdrop-blur-md border border-slate-200/50 rounded-3xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-slate-300/80 ${p.free ? 'border-green-200/50 hover:border-green-300/80' : ''}`}
              >
                {p.free && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-bold text-white uppercase tracking-wider bg-green-500 z-20">
                    Gratuito
                  </span>
                )}
                
                {isBest && (
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-wider bg-green-500 shadow-md z-20">
                    Ideal para Você
                  </span>
                )}

                <div>
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${p.color}10` }}>
                      <Icon className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 font-serif">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 min-h-[32px] leading-relaxed">{p.tagline}</p>

                  {/* Preço */}
                  <div className="flex items-baseline gap-1 mt-5 mb-5">
                    {p.free ? (
                      <span className="text-3xl font-extrabold text-green-600">Grátis</span>
                    ) : (
                      <>
                        <span className="text-3xl font-extrabold text-slate-900">R$ {p.monthlyCost}</span>
                        <span className="text-xs text-slate-400">/mês</span>
                      </>
                    )}
                  </div>

                  {/* Info de Taxas */}
                  <div className="mb-6 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Taxa de venda</span>
                      <span className="text-xs font-bold text-slate-800" style={{ color: p.color }}>{p.fee}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Valor mínimo</span>
                      {p.feeMin > 0 ? (
                        <span className="text-[10px] text-slate-600 font-medium">R$ {p.feeMin}</span>
                      ) : (
                        <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider bg-green-50 px-1.5 py-0.5 rounded">Isento</span>
                      )}
                    </div>
                  </div>

                  {/* Lista de Features Simplificada */}
                  <div className="space-y-3 mb-6">
                    {p.highlights.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-[11px] text-slate-500 leading-snug">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  className={`w-full py-3 text-xs font-bold rounded-full transition-all duration-300 focus:outline-none ${p.free ? 'bg-green-500 hover:bg-green-600 text-white hover:shadow-lg' : 'border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'}`}
                >
                  {p.free ? 'Criar Evento Grátis' : 'Escolher Plano'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Indicadores de Scroll no Mobile */}
        <div className="flex justify-center gap-1.5 mt-4 lg:hidden">
          {pricingPlans.map((_, idx) => (
            <div key={idx} className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          ))}
        </div>

        {/* 3. TABELA COMPARATIVA DE RECURSOS (Accordion Retrátil) */}
        <div className="mt-16 text-center">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-200 hover:border-[#1d68c4] bg-white hover:bg-slate-50 font-semibold text-slate-700 hover:text-[#1d68c4] text-xs transition-all duration-300 shadow-sm"
          >
            <span>{showComparison ? 'Ocultar Comparação Detalhada' : 'Comparar Todos os Recursos'}</span>
            {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showComparison && (
          <div className="mt-10 max-w-5xl mx-auto overflow-hidden border border-slate-200/80 rounded-3xl bg-white shadow-xl animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-serif">
                    <th className="p-4 sm:p-5 text-xs uppercase tracking-wider font-bold min-w-[200px]">Recursos & Ferramentas</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider font-bold">Gratuito</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider font-bold">Starter</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider font-bold">Plus</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider font-bold">Pro</th>
                    <th className="p-4 text-center text-xs uppercase tracking-wider font-bold">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparisonCategories.map((category, catIdx) => (
                    <div key={catIdx} className="contents">
                      {/* Categoria Header */}
                      <tr className="bg-slate-50/80">
                        <td colSpan={6} className="p-4 font-bold text-slate-800 text-xs uppercase tracking-wider font-serif border-y border-slate-200/50">
                          {category.name}
                        </td>
                      </tr>
                      {category.features.map((feat, featIdx) => (
                        <tr key={featIdx} className="hover:bg-slate-50/40 transition-colors">
                          <td className="p-4 text-slate-700 text-xs font-medium">
                            {feat.name}
                          </td>
                          {['free', 'starter', 'plus', 'pro', 'enterprise'].map((pKey) => {
                            const val = feat.values[pKey as keyof typeof feat.values]
                            return (
                              <td key={pKey} className="p-4 text-center text-xs text-slate-500">
                                {typeof val === 'boolean' ? (
                                  val ? (
                                    <Check className="w-4 h-4 text-green-500 mx-auto" />
                                  ) : (
                                    <X className="w-4 h-4 text-slate-300 mx-auto" />
                                  )
                                ) : (
                                  <span className="font-semibold text-slate-600">{val}</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </div>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. TRUST BADGES E SEGURANÇA */}
        <div className="mt-20 border-t border-slate-200/60 pt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Shield, title: 'Transações Protegidas', desc: 'Criptografia SSL de 256 bits nas compras' },
            { icon: Sparkles, title: 'Sem Fidelidade', desc: 'Faça upgrades ou cancele a qualquer momento' },
            { icon: Crown, title: 'Sem Taxa de Adesão', desc: 'Só pague a mensalidade e taxas de vendas' },
            { icon: Zap, title: 'Ativação Rápida', desc: 'Crie sua conta e comece a vender em 5 minutos' },
          ].map((t, idx) => (
            <div key={idx} className="p-5 rounded-2xl bg-white border border-slate-200/60 text-center hover:shadow-md transition-shadow">
              <t.icon className="w-6 h-6 mx-auto mb-3 text-[#1d68c4]" />
              <h4 className="text-xs font-bold text-slate-900 tracking-tight">{t.title}</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
