import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

// A mensagem que o servidor mandou (ex.: limite de 3 envios por hora) está em error.context, uma Response.
async function mensagemDoServidor(error: unknown, padrao: string) {
  try {
    const corpo = await (error as { context?: Response }).context?.json()
    return typeof corpo?.error === 'string' ? corpo.error : padrao
  } catch { return padrao }
}

// PDF e e-mail do ingresso: as duas funções conferem no servidor que o pedido é de quem pediu e que está pago.
export { mensagemDoServidor }
export function useEntregaIngresso(orderId: string) {
  const [ocupado, setOcupado] = useState<'pdf' | 'email' | null>(null)

  const baixarPdf = async () => {
    setOcupado('pdf')
    const { data, error } = await supabase.functions.invoke('ticket-pdf', { body: { orderId } })
    setOcupado(null)
    if (error || !(data instanceof Blob)) { toast.error('Não consegui gerar o PDF. Tente de novo em instantes.'); return }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ingresso-evokaa.pdf'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000) // Safari e Firefox cancelam o download se revogar antes
  }

  const enviarEmail = async () => {
    setOcupado('email')
    const { error } = await supabase.functions.invoke('send-email', { body: { orderId, emailType: 'ticket_delivery' } })
    setOcupado(null)
    if (error) toast.error(await mensagemDoServidor(error, 'Não consegui enviar o e-mail. Baixe o PDF por aqui.'))
    else toast.success('Enviamos o ingresso para o seu e-mail.')
  }

  return { ocupado, baixarPdf, enviarEmail }
}
