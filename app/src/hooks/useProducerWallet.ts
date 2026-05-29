import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface DbTransaction {
  id: string
  producer_id: string
  event_id: string | null
  order_id: string | null
  type: 'income' | 'expense' | 'withdrawal' | 'refund' | 'fee'
  amount: number
  description: string | null
  status: 'pending' | 'completed' | 'failed'
  created_at: string
  events?: { title: string } | null
}

export interface DbWithdrawal {
  id: string
  producer_id: string
  amount: number
  pix_key: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  processed_at: string | null
  bank_info?: any
}

export function useProducerTransactions() {
  const { user } = useAuth()

  return useQuery<DbTransaction[]>({
    queryKey: ['producer-transactions', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          events (title)
        `)
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((t: any) => ({
        ...t,
        amount: Number(t.amount) || 0,
      })) as DbTransaction[]
    },
    enabled: !!user?.id,
  })
}

export function useProducerWithdrawals() {
  const { user } = useAuth()

  return useQuery<DbWithdrawal[]>({
    queryKey: ['producer-withdrawals', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((w: any) => ({
        ...w,
        amount: Number(w.amount) || 0,
      })) as DbWithdrawal[]
    },
    enabled: !!user?.id,
  })
}

export function useRequestWithdrawal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ amount, pixKey }: { amount: number; pixKey: string }) => {
      if (!user?.id) throw new Error('Autenticacao necessaria')

      const { data, error } = await supabase
        .from('withdrawals')
        .insert({
          producer_id: user.id,
          amount,
          pix_key: pixKey,
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-withdrawals', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['producer-transactions', user?.id] })
    },
  })
}
