import { supabase } from './supabase'
import type { Periodo } from './inicioProdutor'

// L6: somas de vendas pagas feitas no banco (RPC produtor_vendas_pagas, docs/sql/20261016), sem o teto de 1.000 linhas.
export type PorEvento = { event_id: string; titulo: string; pedidos: number; total: number }
export type VendasPagas = {
  total: number
  pedidos: number
  reembolsados: { pedidos: number; total: number }
  por_evento: PorEvento[]
  por_dia: { dia: string; pedidos: number; total: number }[]
  por_forma: { forma: string; pedidos: number; total: number }[]
}

/** Janela [de, ate) do período, em ISO. 'tudo' = sem limite. Dia sempre em Brasília (UTC-3, sem horário de verão), igual ao banco, qualquer que seja o fuso do navegador. */
export function janelaDoPeriodo(p: Periodo, agora = Date.now()): { de: string | null; ate: string | null } {
  if (p === 'tudo') return { de: null, ate: null }
  const dias = p === 'hoje' ? 0 : p === '7d' ? 6 : 29
  const dia = new Date(agora - 3 * 3600000 - dias * 86400000).toISOString().slice(0, 10)
  return { de: new Date(`${dia}T00:00:00-03:00`).toISOString(), ate: null }
}

/** Intervalo livre (datas AAAA-MM-DD do <input type="date">, "até" inclusivo) em ISO [de, ate), meia-noite de Brasília. Data inválida ou "de" depois de "até": { erro }. */
export function intervaloLivre(de: string, ate: string): { de: string | null; ate: string | null } | { erro: string } {
  // ida e volta: recusa dia que não existe (2026-02-30), que o Date aceitaria rolando para março
  const ms = (d: string) => {
    const t = /^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(`${d}T00:00:00-03:00`) : NaN
    return !Number.isNaN(t) && new Date(t - 3 * 3600000).toISOString().slice(0, 10) === d ? t : NaN
  }
  const [a, b] = [de ? ms(de) : null, ate ? ms(ate) : null]
  if (Number.isNaN(a) || Number.isNaN(b)) return { erro: 'Data inválida. Use o seletor de datas.' }
  if (a != null && b != null && a > b) return { erro: 'A data inicial não pode ser depois da final.' }
  return { de: a == null ? null : new Date(a).toISOString(), ate: b == null ? null : new Date(b + 86400000).toISOString() }
}

export async function vendasPagas(f: { de?: string | null; ate?: string | null; eventId?: string | null }, sinal?: AbortSignal): Promise<VendasPagas> {
  let q = supabase.rpc('produtor_vendas_pagas' as never, { p_de: f.de ?? null, p_ate: f.ate ?? null, p_event_id: f.eventId ?? null } as never)
  if (sinal) q = q.abortSignal(sinal)
  const { data, error } = await q
  if (error) throw error
  return data as unknown as VendasPagas
}

/** Zero vendas pode ser sessão sem 2FA concluído (o banco devolve zero, sem erro): true quando falta o segundo fator. */
export async function faltaSegundoFator(): Promise<boolean> {
  return (await segundoFatorOuNulo()) === true
}

/** Como faltaSegundoFator, mas null quando não deu para consultar (não sei): quem mostra zero não deve afirmar que está tudo certo. */
export async function segundoFatorOuNulo(): Promise<boolean | null> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) return null
  return data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2'
}
