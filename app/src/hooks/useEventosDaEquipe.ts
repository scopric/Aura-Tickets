import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

export interface ConviteEquipe {
  id: string
  producer_id: string
  producer_name: string
  role: 'admin' | 'editor' | 'viewer'
  invited_at: string
  accepted_at: string | null
}

// Vínculos da própria conta (pendentes e aceitos, sem os bloqueados): docs/sql/20261028_equipe_portaria.sql
export function useMeusConvites() {
  const { user } = useAuth()
  return useQuery<ConviteEquipe[]>({
    queryKey: ['team-meus-convites', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('team_meus_convites' as never)
      if (error) throw error
      return (data ?? []) as ConviteEquipe[]
    },
    enabled: !!user?.id,
  })
}

// Eventos publicados dos produtores em que a conta é da equipe aceita com cargo de check-in (o banco decide: team_eventos)
export function useEventosDaEquipe() {
  const { user } = useAuth()
  return useQuery<{ id: string; title: string; status: string; start_date: string; producer_name: string }[]>({
    queryKey: ['team-eventos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('team_eventos' as never)
      if (error) throw error
      return ((data ?? []) as { id: string; title: string; start_date: string; producer_name: string }[]).map(e => ({ ...e, status: 'published' }))
    },
    enabled: !!user?.id,
  })
}
