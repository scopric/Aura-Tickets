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
      const { error } = await supabase.from('contact_messages').insert({
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone?.trim() || null,
        subject: data.subject?.trim() || 'Contato via site',
        message: data.message.trim(),
        page: data.page || window.location.pathname,
      })

      if (error) throw error
      return true
    },
  })
}
