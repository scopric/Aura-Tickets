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

/** Janela [de, ate) do período, em ISO. 'tudo' = sem limite. Dia de São Paulo = dia do relógio do navegador (produtor no Brasil). */
export function janelaDoPeriodo(p: Periodo, agora = Date.now()): { de: string | null; ate: string | null } {
  if (p === 'tudo') return { de: null, ate: null }
  const d = new Date(agora)
  d.setHours(0, 0, 0, 0)
  if (p !== 'hoje') d.setDate(d.getDate() - (p === '7d' ? 6 : 29))
  return { de: d.toISOString(), ate: null }
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
