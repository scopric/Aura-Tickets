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
      // 1. Persiste o contato no banco de dados
      const { error } = await supabase.from('contact_messages').insert({
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone?.trim() || null,
        subject: data.subject?.trim() || 'Contato via site',
        message: data.message.trim(),
        page: data.page || window.location.pathname,
      })

      if (error) throw error

      // 2. Dispara o e-mail real via Edge Function para a equipe da Evokaa.
      // A função (já publicada) monta o HTML no servidor — mandar `to`/`subject`/`html`
      // prontos não é mais aceito. `invoke` nunca lança: erro vem em `error`, tem que ser
      // lido explicitamente (não travar o formulário, mas não pode ficar em silêncio).
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          emailType: 'contact',
          name: data.name.trim(),
          email: data.email.trim(),
          phone: data.phone?.trim() || '',
          subject: data.subject?.trim() || 'Contato via site',
          message: data.message.trim(),
        }
      })
      if (emailError) console.error('[Contact Email Send Error]', emailError)

      return true
    },
  })
}
