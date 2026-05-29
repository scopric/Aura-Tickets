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
