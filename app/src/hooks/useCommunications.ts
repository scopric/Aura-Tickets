import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface Communication {
  id: string
  event_id: string
  type: 'email' | 'sms' | 'push'
  segment: string | null
  subject: string | null
  content: string | null
  sent_count: number
  open_count: number
  sent_at: string | null
  created_at: string
}

const DEMO_COMMS: Communication[] = [
  { id: 'cm1', event_id: 'evt-001', type: 'email', segment: 'todos', subject: 'Ingressos à venda!', content: 'Os ingressos para o Festival de Verão 2025 já estão à venda.', sent_count: 450, open_count: 180, sent_at: '2025-11-01T10:00:00Z', created_at: '2025-11-01T10:00:00Z' },
  { id: 'cm2', event_id: 'evt-001', type: 'email', segment: 'compradores', subject: 'Seu ingresso está confirmado!', content: 'Obrigado pela compra!', sent_count: 120, open_count: 95, sent_at: '2025-11-05T14:00:00Z', created_at: '2025-11-05T14:00:00Z' },
  { id: 'cm3', event_id: 'evt-002', type: 'push', segment: 'interessados', subject: 'Early bird acabando!', content: 'O preço early bird termina em 24h.', sent_count: 300, open_count: 120, sent_at: '2025-10-20T09:00:00Z', created_at: '2025-10-20T09:00:00Z' },
]

export function useCommunications(eventId?: string) {
  const { user } = useAuth()

  return useQuery<Communication[]>({
    queryKey: ['communications', eventId, user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      if (user.id === 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4') {
        return eventId ? DEMO_COMMS.filter(c => c.event_id === eventId) : DEMO_COMMS
      }

      let query = supabase.from('communications').select('*')
      if (eventId) query = query.eq('event_id', eventId)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) {
        console.warn('Erro ao buscar communications:', error)
        return eventId ? DEMO_COMMS.filter(c => c.event_id === eventId) : DEMO_COMMS
      }
      return (data || []) as Communication[]
    },
    enabled: !!user?.id,
  })
}

export function useCreateCommunication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (comm: Partial<Communication>) => {
      const { data, error } = await supabase.from('communications').insert(comm).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
  })
}
