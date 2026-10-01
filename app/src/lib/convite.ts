import { supabase } from './supabase'

// Chama a Edge Function admin-invite (supabase/functions/admin-invite). Recusa ({ ok:false }) e erro HTTP viram
// Error com a mensagem da função e o motivo (ex.: 'conta_existe'), para a tela decidir o que fazer.
export async function chamarConvite<T extends object = object>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-invite', { body })
  if (error) {
    // Em 4xx/5xx o invoke não devolve o JSON: lê a mensagem real da função
    const ctx = (error as { context?: unknown }).context
    const corpo = ctx instanceof Response ? await ctx.json().catch(() => null) : null
    throw Object.assign(
      new Error(corpo?.message || corpo?.error || (ctx instanceof Response
        ? `O servidor respondeu com erro ${ctx.status}. Tente de novo.`
        : 'Sem conexão com o servidor. Tente de novo.')),
      { motivo: corpo?.motivo as string | undefined },
    )
  }
  if (!data?.ok) throw Object.assign(new Error(data?.message || 'Não foi possível concluir. Tente de novo.'), { motivo: data?.motivo as string | undefined })
  return data as T
}

export const motivoDe = (e: unknown) => (e as { motivo?: string } | null)?.motivo
export const mensagemDe = (e: unknown) => (e as { message?: string } | null)?.message || 'Erro inesperado. Tente de novo.'
