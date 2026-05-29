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

      // 2. Dispara o e-mail real via Edge Function para a equipe da Evokaa
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: 'contato@evokaa.com.br',
            subject: `[Contato Site] ${data.subject || 'Nova Mensagem'} - ${data.name}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="background-color: #0c2340; padding: 30px 24px; text-align: center; color: white;">
                  <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Evokaa Eventos</h2>
                  <p style="margin: 6px 0 0 0; opacity: 0.8; font-size: 14px;">Nova mensagem de suporte recebida pelo formulário do site</p>
                </div>
                <div style="padding: 30px 24px; color: #1c1917; font-size: 15px; line-height: 1.6;">
                  <p style="margin-top: 0;">Olá, Equipe de Suporte,</p>
                  <p>Um novo contato foi enviado pelo site. Veja os detalhes abaixo:</p>
                  
                  <div style="background-color: #f5f5f4; border-radius: 12px; padding: 20px; margin: 25px 0;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                      <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
                        <td style="padding: 8px 0; font-weight: bold; color: #78716c; width: 140px;">Nome:</td>
                        <td style="padding: 8px 0; color: #1c1917; font-weight: bold;">${data.name}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
                        <td style="padding: 8px 0; font-weight: bold; color: #78716c;">E-mail:</td>
                        <td style="padding: 8px 0; color: #1d68c4; font-weight: bold;">
                          <a href="mailto:${data.email}" style="color: #1d68c4; text-decoration: none;">${data.email}</a>
                        </td>
                      </tr>
                      <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
                        <td style="padding: 8px 0; font-weight: bold; color: #78716c;">Telefone:</td>
                        <td style="padding: 8px 0; color: #1c1917;">${data.phone || 'Não informado'}</td>
                      </tr>
                      <tr style="border-bottom: 1px solid rgba(0,0,0,0.06);">
                        <td style="padding: 8px 0; font-weight: bold; color: #78716c;">Assunto:</td>
                        <td style="padding: 8px 0; color: #1c1917; font-weight: bold;">${data.subject || 'Contato geral'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold; color: #78716c;">Página de origem:</td>
                        <td style="padding: 8px 0; color: #78716c; font-family: monospace; font-size: 12px;">${data.page || window.location.pathname}</td>
                      </tr>
                    </table>
                  </div>

                  <div style="background-color: #faf8f5; border: 1px solid rgba(0,0,0,0.05); border-radius: 12px; padding: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #0c2340; font-size: 14px; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 8px;">Mensagem enviada:</h4>
                    <p style="margin: 0; color: #292524; white-space: pre-wrap; font-size: 14px;">${data.message}</p>
                  </div>
                  
                  <p style="margin-top: 30px; margin-bottom: 0; font-size: 13px; color: #78716c; text-align: center;">
                    Este é um e-mail transacional gerado automaticamente pelo sistema Evokaa.
                  </p>
                </div>
                <div style="background-color: #0c2340; padding: 20px; text-align: center; color: rgba(255,255,255,0.6); font-size: 12px;">
                  Evokaa — Gestão de Eventos e Ingressos
                </div>
              </div>
            `
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
