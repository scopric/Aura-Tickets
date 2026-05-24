import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

export function useOnboarding() {
  const user = useAuthStore((state) => state.user)

  const markStepComplete = useCallback(async (stepName: string, stepNumber: number, metadata?: Record<string, unknown>) => {
    if (!user?.id) return

    await supabase.from('onboarding_logs').insert({
      user_id: user.id,
      step_name: stepName,
      step_number: stepNumber,
      completed_at: new Date().toISOString(),
      metadata: metadata || {},
    })

    await supabase.from('profiles').update({
      onboarding_step: stepNumber,
    }).eq('id', user.id)
  }, [user])

  const completeOnboarding = useCallback(async () => {
    if (!user?.id) return

    await supabase.from('profiles').update({
      onboarding_completed: true,
      onboarding_step: 999,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)
  }, [user])

  const skipStep = useCallback(async (stepName: string, stepNumber: number) => {
    if (!user?.id) return

    await supabase.from('onboarding_logs').insert({
      user_id: user.id,
      step_name: stepName,
      step_number: stepNumber,
      skipped: true,
    })
  }, [user])

  return {
    markStepComplete,
    completeOnboarding,
    skipStep,
  }
}
