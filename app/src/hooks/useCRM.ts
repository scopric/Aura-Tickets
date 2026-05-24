import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface Customer {
  id: string
  event_id: string | null
  user_id: string | null
  email: string
  name: string | null
  phone: string | null
  tags: string[] | null
  notes: string | null
  total_spent: number
  events_attended: number
  created_at: string
}

const DEMO_CUSTOMERS: Customer[] = [
  { id: 'c1', event_id: 'evt-001', user_id: 'u1', email: 'ana.silva@email.com', name: 'Ana Carolina Silva', phone: '(11) 98765-4321', tags: ['VIP', 'recorrente'], notes: 'Cliente desde 2024', total_spent: 1250.00, events_attended: 5, created_at: '2024-01-15T10:00:00Z' },
  { id: 'c2', event_id: 'evt-001', user_id: 'u2', email: 'bruno.costa@email.com', name: 'Bruno Mendes Costa', phone: '(11) 91234-5678', tags: ['primeira_compra'], notes: null, total_spent: 450.00, events_attended: 2, created_at: '2025-02-20T14:30:00Z' },
  { id: 'c3', event_id: 'evt-002', user_id: 'u3', email: 'camila.rocha@email.com', name: 'Camila Rocha Oliveira', phone: '(11) 99876-5432', tags: ['workshop', 'tech'], notes: 'Interessada em workshops avançados', total_spent: 800.00, events_attended: 3, created_at: '2024-12-10T09:00:00Z' },
]

export function useCustomers(eventId?: string) {
  const { user } = useAuth()

  return useQuery<Customer[]>({
    queryKey: ['customers', eventId, user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      // Demo fallback
      if (user.id === 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4') {
        return eventId ? DEMO_CUSTOMERS.filter(c => c.event_id === eventId) : DEMO_CUSTOMERS
      }

      let query = supabase.from('customers').select('*')
      if (eventId) query = query.eq('event_id', eventId)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) {
        console.warn('Erro ao buscar customers:', error)
        return eventId ? DEMO_CUSTOMERS.filter(c => c.event_id === eventId) : DEMO_CUSTOMERS
      }
      return (data || []) as Customer[]
    },
    enabled: !!user?.id,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (customer: Partial<Customer>) => {
      const { data, error } = await supabase.from('customers').insert(customer).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
