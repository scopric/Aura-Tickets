import { useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ContactMessage {
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
  page?: string
}

export function useContact() {
  return useMutation({
    mutationFn: async (data: ContactMessage) => {
      // Tudo pela Edge Function: ela valida, limita por IP, grava em `contact_messages` (o visitante não
      // tem mais INSERT direto na tabela) e avisa a equipe por e-mail. `invoke` nunca lança: o erro vem
      // em `error` e sobe para a tela mostrar a falha.
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          emailType: 'contact',
          name: data.name.trim(),
          email: data.email.trim(),
          phone: data.phone?.trim() || '',
          subject: data.subject?.trim() || 'Contato via site',
          message: data.message.trim(),
          page: data.page || window.location.pathname,
        }
      })
      if (error) throw error

      return true
    },
  })
}
