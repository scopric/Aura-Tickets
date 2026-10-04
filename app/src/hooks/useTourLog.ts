import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// types/database.ts está desatualizado (sem onboarding_logs): cliente sem tipos só para esta tabela
const logs = () => (supabase as unknown as SupabaseClient).from('onboarding_logs')
const chave = (id?: string) => ['onboarding-logs', id]

// Só grava, sem consulta (usado no layout, que não precisa ler nada). Só por ação do usuário.
// Otimista: o registro já vale na tela; se a gravação falhar, avisa e volta a ler o banco.
export function useRegistrarTour() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return async function registrar(step_name: string, { skipped = false } = {}) {
    if (!user?.id) return
    await qc.cancelQueries({ queryKey: chave(user.id) }) // uma leitura em andamento não pode apagar o registro otimista
    qc.setQueryData<string[]>(chave(user.id), o => (o ? [...o, step_name] : o))
    const { error } = await logs().insert({ user_id: user.id, step_name, completed_at: new Date().toISOString(), skipped })
    if (error) toast.error('Não foi possível guardar sua escolha.')
    await qc.invalidateQueries({ queryKey: chave(user.id) }, { throwOnError: false })
  }
}

// Lê o que o usuário já concluiu, pulou ou dispensou. `ativo` false desliga a consulta (quem não tem tour não lê o banco)
export function useTourLog({ ativo = true } = {}) {
  const { user } = useAuth()
  const registrar = useRegistrarTour()
  const { data } = useQuery({
    queryKey: chave(user?.id),
    enabled: !!user?.id && ativo,
    queryFn: async () => {
      const { data, error } = await logs().select('step_name').eq('user_id', user!.id)
      if (error) return [] as string[] // leitura que falha = nada dispensado
      return (data ?? []).map(r => r.step_name as string)
    },
  })
  return { feitos: new Set(data ?? []), registrar, carregou: data !== undefined }
}
