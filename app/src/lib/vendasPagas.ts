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

export async function vendasPagas(f: { de?: string | null; ate?: string | null; eventId?: string | null }, sinal?: AbortSignal): Promise<VendasPagas> {
  let q = supabase.rpc('produtor_vendas_pagas' as never, { p_de: f.de ?? null, p_ate: f.ate ?? null, p_event_id: f.eventId ?? null } as never)
  if (sinal) q = q.abortSignal(sinal)
  const { data, error } = await q
  if (error) throw error
  return data as unknown as VendasPagas
}

/** Zero vendas pode ser sessão sem 2FA concluído (o banco devolve zero, sem erro): true quando falta o segundo fator. */
export async function faltaSegundoFator(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2'
}
