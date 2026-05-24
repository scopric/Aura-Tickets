import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface Affiliate {
  id: string
  event_id: string
  user_id: string | null
  name: string
  email: string
  code: string
  commission_rate: number
  total_sales: number
  total_earnings: number
  clicks: number
  conversions: number
  is_active: boolean
  created_at: string
}

const DEMO_AFFILIATES: Affiliate[] = [
  { id: 'af1', event_id: 'evt-001', user_id: null, name: 'Pedro Afiliado', email: 'pedro@afiliado.com', code: 'PEDRO10', commission_rate: 10.00, total_sales: 500.00, total_earnings: 50.00, clicks: 120, conversions: 5, is_active: true, created_at: '2025-01-10T10:00:00Z' },
  { id: 'af2', event_id: 'evt-001', user_id: null, name: 'Blog da Cidade', email: 'contato@blogdacidade.com', code: 'BLOG20', commission_rate: 15.00, total_sales: 800.00, total_earnings: 120.00, clicks: 350, conversions: 8, is_active: true, created_at: '2025-02-15T14:00:00Z' },
  { id: 'af3', event_id: 'evt-002', user_id: null, name: 'Canal Tech', email: 'parceria@canaltech.com', code: 'TECH15', commission_rate: 12.00, total_sales: 1200.00, total_earnings: 144.00, clicks: 500, conversions: 12, is_active: true, created_at: '2025-03-01T09:00:00Z' },
]

export function useAffiliates(eventId?: string) {
  const { user } = useAuth()

  return useQuery<Affiliate[]>({
    queryKey: ['affiliates', eventId, user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      if (user.id === 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4') {
        return eventId ? DEMO_AFFILIATES.filter(a => a.event_id === eventId) : DEMO_AFFILIATES
      }

      let query = supabase.from('affiliates').select('*')
      if (eventId) query = query.eq('event_id', eventId)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) {
        console.warn('Erro ao buscar affiliates:', error)
        return eventId ? DEMO_AFFILIATES.filter(a => a.event_id === eventId) : DEMO_AFFILIATES
      }
      return (data || []) as Affiliate[]
    },
    enabled: !!user?.id,
  })
}

export function useCreateAffiliate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (affiliate: Partial<Affiliate>) => {
      const { data, error } = await supabase.from('affiliates').insert(affiliate).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] })
    },
  })
}
