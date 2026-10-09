import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { tokenRecaptcha } from '@/lib/recaptcha'

export type PixResultado =
  | { ok: true; pixCopiaECola: string; expiraEm: string }
  // refazerReserva: 409, o pedido não serve mais; tentarDeNovo: falha passageira (limite, gateway, indisponível, rede)
  | { ok: false; mensagem: string; refazerReserva?: boolean; tentarDeNovo?: boolean; sessaoExpirada?: boolean }

const PASSAGEIRO: Record<number, string> = {
  429: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  502: 'O PagBank não respondeu. Tente de novo em instantes.',
  503: 'Pagamento indisponível no momento. Tente de novo em instantes.',
}

// Chama a Edge Function pagbank-criar-pedido (JWT do usuário). O CPF só vai nesta chamada: nunca é guardado aqui.
export function usePayment() {
  const [loading, setLoading] = useState(false)

  const pagarPix = async ({ orderId, cpf, phone }: { orderId: string; cpf: string; phone?: string }): Promise<PixResultado> => {
    setLoading(true)
    try {
      let captcha_token: string
      try { captcha_token = await tokenRecaptcha() } catch (e) {
        return { ok: false, mensagem: e instanceof Error ? e.message : 'Pagamento indisponível' }
      }
      const { data, error } = await supabase.functions.invoke('pagbank-criar-pedido', {
        body: { order_id: orderId, captcha_token, customer: { tax_id: cpf.replace(/\D/g, ''), ...(phone ? { phone } : {}) } },
      })
      if (error) {
        // FunctionsHttpError guarda a resposta em error.context; erro de rede não tem status
        const ctx = (error as { context?: Response }).context
        const status = typeof ctx?.status === 'number' ? ctx.status : 0
        const msg = typeof ctx?.json === 'function' ? await ctx.json().then((b: { error?: string }) => b?.error).catch(() => undefined) : undefined
        if (status === 401) return { ok: false, mensagem: 'Sua sessão expirou, entre de novo.', sessaoExpirada: true }
        if (status === 409) return { ok: false, mensagem: msg || 'Este pedido não pode mais ser pago. Refaça a reserva.', refazerReserva: true }
        if (status === 400) return { ok: false, mensagem: msg || 'Dados inválidos. Confira o CPF e tente de novo.' }
        if (status === 404) return { ok: false, mensagem: 'Pedido não encontrado. Refaça a reserva.', refazerReserva: true }
        return { ok: false, mensagem: PASSAGEIRO[status] || 'Sem conexão com o pagamento. Tente de novo.', tentarDeNovo: true }
      }
      if (!data?.pix_copia_e_cola || !data?.expira_em) return { ok: false, mensagem: 'Resposta inesperada do pagamento. Tente de novo.', tentarDeNovo: true }
      return { ok: true, pixCopiaECola: data.pix_copia_e_cola, expiraEm: data.expira_em }
    } finally {
      setLoading(false)
    }
  }

  return { pagarPix, loading }
}
