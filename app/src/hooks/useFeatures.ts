import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

interface CustomFeature {
  feature_key: string
  expires_at: string | null
}

interface Subscription {
  plan: 'free' | 'starter' | 'plus' | 'pro' | 'enterprise'
  is_active: boolean
  expires_at: string | null
}

export function useFeatures() {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [customFeatures, setCustomFeatures] = useState<CustomFeature[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadFeaturesData = async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    try {
      // 1. Carregar assinatura do produtor
      const { data: subData, error: subError } = await supabase
        .from('producer_subscriptions')
        .select('plan, is_active, expires_at')
        .eq('producer_id', user.id)
        .maybeSingle()

      if (!subError && subData) {
        setSubscription(subData as Subscription)
      } else {
        setSubscription(null)
      }

      // 2. Carregar features customizadas (bypass individual)
      const { data: featData, error: featError } = await supabase
        .from('user_custom_features')
        .select('feature_key, expires_at')
        .eq('user_id', user.id)

      if (!featError && featData) {
        setCustomFeatures(featData as CustomFeature[])
      } else {
        setCustomFeatures([])
      }
    } catch (err) {
      console.error('[useFeatures] Erro ao buscar limites do plano no Supabase:', err)
      // Mocks de fallback caso a base de dados local ainda não tenha as tabelas
      setSubscription({ plan: 'pro', is_active: true, expires_at: null })
      setCustomFeatures([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadFeaturesData()
  }, [user])

  // ponytail: sem Stripe/Woovi no ar, ninguém paga plano de verdade — liberado para todo
  // mundo poder testar e ajustar. Voltar a checar `subscription`/`customFeatures` (já
  // carregados acima) quando o pagamento estiver funcionando de fato.
  const hasFeature = (featureKey: string): boolean => {
    void featureKey
    return true
  }

  return {
    subscription,
    customFeatures,
    hasFeature,
    isLoading,
    refresh: loadFeaturesData
  }
}
