// Planos vendidos aos produtores — fonte única de nome e preço (Decisão 67, Ricardo, 29/09/2026).
// Antes havia três tabelas diferentes (página de planos, assinatura do produtor e admin) com
// preços que não batiam. Os ids são os mesmos do banco (producer_subscriptions.plan).
export type PlanId = 'free' | 'starter' | 'plus' | 'pro' | 'enterprise'

export const PLANS: { id: PlanId; name: string; monthlyPrice: number }[] = [
  { id: 'free', name: 'Evo Free', monthlyPrice: 0 },
  { id: 'starter', name: 'Evo Starter', monthlyPrice: 37 },
  { id: 'plus', name: 'Evo Plus', monthlyPrice: 97 },
  { id: 'pro', name: 'Evo Pro', monthlyPrice: 167 },
  { id: 'enterprise', name: 'Evo Enterprise', monthlyPrice: 312 },
]

// Planos pagos (os que aceitam cupom de plano)
export const PAID_PLANS = PLANS.filter(p => p.monthlyPrice > 0)

export const planName = (id: string) => PLANS.find(p => p.id === id)?.name ?? id
export const planPrice = (id: PlanId) => PLANS.find(p => p.id === id)!.monthlyPrice
