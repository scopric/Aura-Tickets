import { useMutation } from '@tanstack/react-query'
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

// A política gf_feedback_insert aceita mensagem de 1 a 2000 caracteres e nota vazia (NULL) ou de 1 a 5.
export const MAX_MENSAGEM = 2000

// Nota 0 = sem estrela: vai NULL (0 é recusado pelo banco).
export function linhaDoFeedback(data: FeedbackData) {
  return {
    type: data.type,
    message: data.message.trim().slice(0, MAX_MENSAGEM),
    rating: data.rating >= 1 && data.rating <= 5 ? data.rating : null,
    page: data.page || window.location.pathname,
    user_agent: data.user_agent || navigator.userAgent,
  }
}

export function useFeedback() {
  return useMutation({
    mutationFn: async (data: FeedbackData) => {
      const { error } = await supabase.from('feedback').insert(linhaDoFeedback(data))

      if (error) throw error
      return true
    },
  })
}
