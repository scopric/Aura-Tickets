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

      // 2. Dispara o e-mail real via Edge Function para a equipe da Evokaa. O corpo é estruturado
      // (nunca HTML pronto): a função monta e escapa o e-mail no servidor, porque este formulário
      // é público (sem login) e um `html` livre viraria phishing assinado pelo domínio Evokaa.
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            emailType: 'contact',
            name: data.name,
            email: data.email,
            phone: data.phone,
            subject: data.subject,
            message: data.message,
          }
        })
      } catch (emailError) {
        // Apenas loga no console se falhar a Edge Function, mas permite a conclusão do formulário (resiliência)
        console.error('[Contact Email Send Error]', emailError)
      }

      return true
    },
  })
}
