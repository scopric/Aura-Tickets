import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// types/database.ts está desatualizado (sem onboarding_logs): cliente sem tipos só para esta tabela
const logs = () => (supabase as unknown as SupabaseClient).from('onboarding_logs')

// Registro dos tours e dicas dispensadas (public.onboarding_logs). Só grava por ação do usuário.
export function useTourLog() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const chave = ['onboarding-logs', user?.id]

  const { data } = useQuery({
    queryKey: chave,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await logs().select('step_name').eq('user_id', user!.id)
      if (error) return [] as string[] // leitura que falha = nada dispensado
      return (data ?? []).map(r => r.step_name as string)
    },
  })

  async function registrar(step_name: string, { skipped = false } = {}) {
    if (!user?.id) return
    const { error } = await logs()
      .insert({ user_id: user.id, step_name, completed_at: new Date().toISOString(), skipped })
    if (error) toast.error('Não foi possível guardar sua escolha.')
    else await qc.invalidateQueries({ queryKey: chave })
  }

  return { feitos: new Set(data ?? []), registrar, carregou: data !== undefined }
}
