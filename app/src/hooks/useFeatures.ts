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

// Mapeamento de quais features estão inclusas em cada plano por padrão
const planFeatures: Record<string, string[]> = {
  free: [],
  starter: ['support', 'caixinha', 'calculator'],
  plus: ['support', 'caixinha', 'calculator', 'crm', 'affiliates', 'communications', 'coupons'],
  pro: ['support', 'caixinha', 'calculator', 'crm', 'affiliates', 'communications', 'coupons', 'seating_map', 'banners', 'checkin', 'collective_tables'],
  enterprise: ['support', 'caixinha', 'calculator', 'crm', 'affiliates', 'communications', 'coupons', 'seating_map', 'banners', 'checkin', 'collective_tables', 'api_access']
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

  /**
   * Verifica se o usuário tem acesso a uma funcionalidade
   */
  const hasFeature = (featureKey: string): boolean => {
    // 1. Administradores têm acesso ilimitado a todas as ferramentas
    if (user?.role === 'admin') return true

    // 2. Verificar se o plano atual ativo possui a feature
    const currentPlan = subscription?.is_active ? subscription.plan : 'free'
    const hasInPlan = planFeatures[currentPlan]?.includes(featureKey)
    if (hasInPlan) return true

    // 3. Verificar se há liberação individual customizada (bypass) e se não expirou
    const customFeat = customFeatures.find(f => f.feature_key === featureKey)
    if (customFeat) {
      if (!customFeat.expires_at) return true // Acesso vitalício ou prazo indefinido
      return new Date(customFeat.expires_at) > new Date() // Se a expiração for futura, libera
    }

    return false
  }

  return {
    subscription,
    customFeatures,
    hasFeature,
    isLoading,
    refresh: loadFeaturesData
  }
}
