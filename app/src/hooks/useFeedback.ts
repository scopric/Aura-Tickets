import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Tipos aceitos pelo schema do banco (CHECK constraint alinhado com setup.sql)
export type FeedbackType = 'melhoria' | 'bug' | 'duvida' | 'sugestao' | 'elogio'

export interface FeedbackData {
  type: FeedbackType
  message: string
  rating: number
  page?: string
  user_agent?: string
}

export function useFeedback() {
  return useMutation({
    mutationFn: async (data: FeedbackData) => {
      const { error } = await supabase.from('feedback').insert({
        type: data.type,
        message: data.message.trim(),
        rating: data.rating,
        page: data.page || window.location.pathname,
        user_agent: data.user_agent || navigator.userAgent,
      })

      if (error) throw error
      return true
    },
  })
}

// ---------------------------------------------------------------------------
// Admin: leitura e gestão de feedbacks reais (tabela `feedback`)
// ---------------------------------------------------------------------------
export type FeedbackRole = 'cliente' | 'produtor' | 'admin'
export type FeedbackStatus = 'novo' | 'lido' | 'respondido' | 'resolvido'

export interface AdminFeedbackItem {
  id: string
  type: FeedbackType
  role: FeedbackRole
  name: string
  email: string
  message: string
  rating: number
  page: string
  status: FeedbackStatus
  createdAt: string
}

const VALID_TYPES: FeedbackType[] = ['melhoria', 'bug', 'duvida', 'sugestao', 'elogio']
const VALID_STATUS: FeedbackStatus[] = ['novo', 'lido', 'respondido', 'resolvido']

function mapRole(profileRole?: string | null): FeedbackRole {
  if (profileRole === 'producer') return 'produtor'
  if (profileRole === 'admin') return 'admin'
  return 'cliente'
}

/**
 * Lista feedbacks reais do banco para o painel admin.
 * Tolerante a schema: usa `select('*')` + join opcional com `profiles` e normaliza
 * campos ausentes (rating/page/autor) com defaults — nunca quebra a tela.
 */
export function useAdminFeedback() {
  return useQuery({
    queryKey: ['admin-feedback'],
    queryFn: async (): Promise<AdminFeedbackItem[]> => {
      // Tenta trazer dados do autor via join; se a relação/RLS não permitir, cai no select simples.
      let rows: any[] | null = null
      const withJoin = await supabase
        .from('feedback')
        .select('*, profiles:user_id(full_name, email, role)')
        .order('created_at', { ascending: false })
      if (withJoin.error) {
        const simple = await supabase
          .from('feedback')
          .select('*')
          .order('created_at', { ascending: false })
        if (simple.error) throw simple.error
        rows = simple.data as any[]
      } else {
        rows = withJoin.data as any[]
      }

      return (rows || []).map((r) => {
        const type = (VALID_TYPES.includes(r.type) ? r.type : 'sugestao') as FeedbackType
        const status = (VALID_STATUS.includes(r.status) ? r.status : 'novo') as FeedbackStatus
        return {
          id: String(r.id),
          type,
          role: mapRole(r.profiles?.role),
          name: r.profiles?.full_name || 'Anônimo',
          email: r.profiles?.email || '',
          message: r.message || '',
          rating: Number(r.rating) || 0,
          page: r.page || '-',
          status,
          createdAt: r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '',
        }
      })
    },
  })
}

export function useUpdateFeedbackStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FeedbackStatus }) => {
      const { error } = await supabase.from('feedback').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-feedback'] }),
  })
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feedback').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-feedback'] }),
  })
}
