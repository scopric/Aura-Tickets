import { useState, useEffect } from 'react'
import {
  Crown, Check, X, ArrowRight, CreditCard, Calendar,
  Zap, Star, Shield, Sparkles, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface PlanFeature { name: string; included: boolean }

interface Plan {
  id: string; name: string; tagline: string; price: number; period: string;
  color: string; bg: string; border: string; icon: typeof Crown; features: PlanFeature[];
  popular?: boolean;
}

const plans: Plan[] = [
  { 
    id: 'starter', 
    name: 'Starter', 
    tagline: 'Para começar', 
    price: 49, 
    period: '/mes', 
    color: '#8b5cf6', 
    bg: 'bg-violet-50/60', 
    border: 'border-violet-200/60', 
    icon: Zap,
    features: [
      { name: 'Caixinha e Calculadora', included: true },
      { name: 'Suporte via E-mail', included: true },
      { name: 'CRM Pipeline', included: false },
      { name: 'Campanhas de E-mail', included: false },
      { name: 'Afiliados', included: false },
      { name: 'Mesa Coletiva', included: false },
      { name: 'Lugar Marcado', included: false },
      { name: 'Scanner de Portaria', included: false },
      { name: 'Banners Destaque', included: false },
      { name: 'Acesso à API', included: false }
    ] 
  },
  { 
    id: 'plus', 
    name: 'Plus', 
    tagline: 'Mais alcance', 
    price: 99, 
    period: '/mes', 
    color: '#d97706', 
    bg: 'bg-amber-50/60', 
    border: 'border-amber-200/60', 
    icon: Star,
    features: [
      { name: 'Caixinha e Calculadora', included: true },
      { name: 'Suporte via E-mail', included: true },
      { name: 'CRM Pipeline', included: true },
      { name: 'Campanhas de E-mail', included: true },
      { name: 'Afiliados', included: true },
      { name: 'Mesa Coletiva', included: false },
      { name: 'Lugar Marcado', included: false },
      { name: 'Scanner de Portaria', included: false },
      { name: 'Banners Destaque', included: false },
      { name: 'Acesso à API', included: false }
    ] 
  },
  { 
    id: 'pro', 
    name: 'Pro', 
    tagline: 'Sem limites', 
    price: 149, 
    period: '/mes', 
    color: '#7a3b69', 
    bg: 'bg-plum/5', 
    border: 'border-plum/20', 
    icon: Crown, 
    popular: true,
    features: [
      { name: 'Caixinha e Calculadora', included: true },
      { name: 'Suporte Prioritário', included: true },
      { name: 'CRM Pipeline', included: true },
      { name: 'Campanhas de E-mail', included: true },
      { name: 'Afiliados', included: true },
      { name: 'Mesa Coletiva', included: true },
      { name: 'Lugar Marcado', included: true },
      { name: 'Scanner de Portaria', included: true },
      { name: 'Banners Destaque', included: true },
      { name: 'Acesso à API', included: false }
    ] 
  },
  { 
    id: 'enterprise', 
    name: 'Enterprise', 
    tagline: 'Para empresas', 
    price: 349, 
    period: '/mes', 
    color: '#1a0e14', 
    bg: 'bg-espresso/5', 
    border: 'border-espresso/10', 
    icon: Shield,
    features: [
      { name: 'Caixinha e Calculadora', included: true },
      { name: 'Suporte Dedicado 24/7', included: true },
      { name: 'CRM Pipeline', included: true },
      { name: 'Campanhas de E-mail', included: true },
      { name: 'Afiliados', included: true },
      { name: 'Mesa Coletiva', included: true },
      { name: 'Lugar Marcado', included: true },
      { name: 'Scanner de Portaria', included: true },
      { name: 'Banners Destaque', included: true },
      { name: 'Acesso à API Completo', included: true }
    ] 
  },
]

export default function ProducerSubscription() {
  const { user } = useAuth()
  const [billingPeriod, setBillingPeriod] = useState<'mensal' | 'anual'>('mensal')
  const [selectedPlan, setSelectedPlan] = useState('pro')
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)

  // Dados da assinatura do Supabase
  const [subscription, setSubscription] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadSubscription = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('producer_subscriptions')
        .select('*')
        .eq('producer_id', user.id)
        .maybeSingle()

      if (!error && data) {
        setSubscription(data)
        // Se houver plano ativo, já pré-seleciona ele
        if (data.plan) {
          setSelectedPlan(data.plan)
        }
      } else {
        setSubscription(null)
      }
    } catch (err) {
      console.error('Erro ao buscar assinatura do produtor:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSubscription()
  }, [user])

  const currentPlan = plans.find(p => p.id === selectedPlan)

  const handleSubscribe = async () => {
    if (!user || !currentPlan) return
    setIsSubscribing(true)
    try {
      const planToSubscribe = currentPlan.id
      
      // Define a data de expiração (30 dias no futuro)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      // Se o plano que ele está assinando coincidir com o configurado com preco customizado,
      // nós mantemos, caso contrário passamos null (preço padrão)
      const customPriceVal = subscription?.plan === planToSubscribe ? subscription.custom_price : null

      const { error } = await supabase
        .from('producer_subscriptions')
        .upsert({
          producer_id: user.id,
          plan: planToSubscribe,
          custom_price: customPriceVal,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          started_at: new Date().toISOString()
        }, { onConflict: 'producer_id' })

      if (error) throw error

      toast.success(`Assinatura ${currentPlan.name} confirmada e ativa com sucesso!`)
      setShowConfirm(false)
      loadSubscription()
    } catch (err: any) {
      console.error('Erro ao assinar plano:', err)
      toast.error('Erro ao confirmar a assinatura: ' + (err.message || err))
    } finally {
      setIsSubscribing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-plum" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-10">
        <span className="text-[10px] font-semibold tracking-[0.3em] uppercase" style={{ color: 'var(--plum)' }}>Escolha seu plano</span>
        <h1 className="font-serif text-4xl mt-3 mb-3" style={{ color: 'var(--espresso)' }}>Planos Evokaa</h1>
        <p className="text-sm" style={{ color: 'var(--espresso)', opacity: 0.45 }}>Escalone seus eventos sem limites. Cancele quando quiser.</p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className={`text-sm ${billingPeriod === 'mensal' ? 'text-espresso font-medium' : 'text-espresso/30'}`}>Mensal</span>
          <button 
            onClick={() => setBillingPeriod(billingPeriod === 'mensal' ? 'anual' : 'mensal')} 
            aria-label="Alternar período de cobrança"
            className="w-14 h-7 rounded-full p-0.5 transition-colors" 
            style={{ background: billingPeriod === 'anual' ? 'var(--plum)' : 'var(--void-30)' }}
          >
            <div className={`w-6 h-6 rounded-full bg-cream shadow-sm transition-transform ${billingPeriod === 'anual' ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm ${billingPeriod === 'anual' ? 'text-espresso font-medium' : 'text-espresso/30'}`}>Anual</span>
          {billingPeriod === 'anual' && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">Economize 20%</span>}
        </div>
      </div>

      {/* Current Plan Banner */}
      {subscription && subscription.is_active ? (
        <div className="mb-10 p-5 rounded-2xl bg-plum/5 border border-plum/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-plum/10 flex items-center justify-center">
              <Crown className="w-6 h-6" style={{ color: 'var(--plum)' }} />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--espresso)' }}>
                Plano atual: <span style={{ color: 'var(--plum)' }}>Evokaa {plans.find(pl => pl.id === subscription.plan)?.name || subscription.plan}</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--espresso)', opacity: 0.45 }}>
                {subscription.expires_at ? (
                  <span>Próximo vencimento: {new Date(subscription.expires_at).toLocaleDateString('pt-BR')}</span>
                ) : (
                  <span>Assinatura ativa (Sem prazo de expiração)</span>
                )}
                {' · '}
                <span>
                  {subscription.custom_price !== null 
                    ? `R$ ${subscription.custom_price}/mês (Preço Customizado pelo Admin)` 
                    : `R$ ${plans.find(pl => pl.id === subscription.plan)?.price || 0}/mês`}
                </span>
              </div>
            </div>
          </div>
          <button className="px-4 py-2 rounded-full text-xs font-medium border transition-all hover:bg-plum/10" style={{ borderColor: 'var(--plum-30)', color: 'var(--plum)' }}>
            Gerenciar Assinatura
          </button>
        </div>
      ) : (
        <div className="mb-10 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--espresso)' }}>Você está no plano Gratuito</div>
              <div className="text-xs" style={{ color: 'var(--espresso)', opacity: 0.4 }}>Assine um plano premium abaixo para liberar ferramentas avançadas de CRM, Lugar Marcado e Afiliados.</div>
            </div>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {plans.map(p => {
          const I = p.icon
          
          // Se houver um preco customizado atribuido a este plano especifico, exibe ele!
          const hasCustomPrice = subscription?.plan === p.id && subscription.custom_price !== null
          const basePrice = hasCustomPrice ? subscription.custom_price : p.price
          const price = billingPeriod === 'anual' ? Math.round(basePrice * 0.8) : basePrice
          
          return (
            <div key={p.id} className={`relative p-6 rounded-3xl border backdrop-blur-sm transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer ${selectedPlan === p.id ? p.bg + ' ' + p.border + ' ring-2 ring-plum/20' : 'bg-white/60 border-white/60'}`}  onClick={() => setSelectedPlan(p.id)}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-medium text-cream" style={{ background: 'var(--plum)' }}>
                  Mais Popular
                </div>
              )}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${p.color}15` }}>
                <I className="w-5 h-5" style={{ color: p.color }} />
              </div>
              <h3 className="font-serif text-lg mb-0.5" style={{ color: 'var(--espresso)' }}>{p.name}</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--espresso)', opacity: 0.35 }}>{p.tagline}</p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="font-serif text-3xl animate-fade-in" style={{ color: p.color }}>R$ {price}</span>
                <span className="text-xs" style={{ color: 'var(--espresso)', opacity: 0.35 }}>{billingPeriod === 'anual' ? '/mes (anual)' : '/mes'}</span>
              </div>
              
              {hasCustomPrice && (
                <div className="text-[10px] mb-3 px-2 py-1 rounded bg-green-50 text-green-600 font-semibold inline-block">
                  Preço Customizado pelo Admin!
                </div>
              )}

              {billingPeriod === 'anual' && !hasCustomPrice && (
                <div className="text-[10px] mb-3 px-2 py-1 rounded-full bg-green-50 text-green-600 inline-block">
                  R$ {price * 12}/ano · 20% OFF
                </div>
              )}
              <div className="space-y-2.5 mb-6">
                {p.features.map(f => (
                  <div key={f.name} className="flex items-center gap-2 text-xs" style={{ color: f.included ? 'var(--espresso)' : 'var(--espresso)', opacity: f.included ? 0.6 : 0.3 }}>
                    {f.included ? (
                      <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-rose-500/60 dark:text-rose-450/40 flex-shrink-0" />
                    )}
                    {f.name}
                  </div>
                ))}
              </div>
              <button onClick={() => setSelectedPlan(p.id)} className={`w-full py-2.5 rounded-full text-xs font-medium transition-all ${selectedPlan === p.id ? 'text-cream hover:shadow-glow' : 'border hover:bg-plum/5'}`} style={selectedPlan === p.id ? { background: p.color } : { borderColor: `${p.color}40`, color: p.color }}>
                {selectedPlan === p.id ? 'Selecionado' : 'Escolher'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Confirm Button */}
      <div className="text-center mb-10">
        <button onClick={() => setShowConfirm(true)} className="px-10 py-3.5 rounded-full text-sm font-medium text-cream hover:shadow-glow transition-all flex items-center gap-2 mx-auto" style={{ background: 'var(--plum)' }}>
          Assinar {currentPlan?.name} <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-[10px] mt-3" style={{ color: 'var(--espresso)', opacity: 0.3 }}>Cancele a qualquer momento. Sem taxa de cancelamento.</p>
      </div>

      {/* Trust Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Shield, title: 'Pagamento seguro', desc: 'Criptografia SSL' },
          { icon: Calendar, title: 'Cancele quando quiser', desc: 'Sem compromisso' },
          { icon: CreditCard, title: 'Varias formas', desc: 'PIX, Cartao, Boleto' },
          { icon: Sparkles, title: 'Garantia 7 dias', desc: 'Dinheiro de volta' },
        ].map(t => (
          <div key={t.title} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
            <t.icon className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--plum)' }} />
            <div className="text-xs font-medium" style={{ color: 'var(--espresso)' }}>{t.title}</div>
            <div className="text-[10px]" style={{ color: 'var(--espresso)', opacity: 0.35 }}>{t.desc}</div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-espresso/20 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative w-full max-w-sm bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-elevated">
            <h3 className="font-serif text-xl text-espresso mb-2 text-center">Confirmar Assinatura</h3>
            
            {/* Preço de confirmação */}
            {(() => {
              const basePrice = subscription?.plan === currentPlan?.id && subscription.custom_price !== null
                ? subscription.custom_price
                : (currentPlan?.price || 0)
              const price = billingPeriod === 'anual' ? Math.round(basePrice * 0.8) : basePrice
              
              return (
                <p className="text-sm text-espresso/50 text-center mb-5">
                  Voce esta assinando o plano <strong style={{ color: 'var(--plum)' }}>{currentPlan?.name}</strong> por <strong>R$ {price}/mes</strong>.
                </p>
              )
            })()}

            <div className="space-y-2">
              <button 
                onClick={handleSubscribe} 
                disabled={isSubscribing}
                className="w-full py-3 rounded-full text-sm font-medium text-cream hover:shadow-glow transition-all flex items-center justify-center gap-1.5" 
                style={{ background: 'var(--plum)' }}
              >
                {isSubscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirmando...</span>
                  </>
                ) : (
                  <span>Confirmar e Pagar</span>
                )}
              </button>
              <button onClick={() => setShowConfirm(false)} disabled={isSubscribing} className="w-full py-3 text-sm text-espresso/40 hover:text-espresso transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
