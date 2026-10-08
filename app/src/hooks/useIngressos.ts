import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/exportCsv'
import { vendasPagas } from '../lib/vendasPagas'
import { useAuth } from './useAuth'
import type { DbEvent } from './useEvents'

// Tela Ingressos do produtor. Criar e editar ingresso NÃO passa por aqui: usa useUpdateEvent (o mesmo caminho do editor do evento).

/** Ingressos por tipo, no mesmo critério da trava de venda do banco e do editor: tudo que não foi cancelado nem reembolsado. */
export function useVendidosPorTipo(eventId: string | null) {
  return useQuery({
    queryKey: ['ingressos-vendidos', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const linhas = await fetchAllRows<{ ticket_type_id: string }>((de, ate) =>
        supabase.from('tickets').select('ticket_type_id').eq('event_id', eventId!).or('status.is.null,status.not.in.(cancelled,refunded)')
          .order('id').range(de, ate) as unknown as PromiseLike<{ data: { ticket_type_id: string }[] | null; error: unknown }>)
      const porTipo: Record<string, number> = {}
      for (const t of linhas) porTipo[t.ticket_type_id] = (porTipo[t.ticket_type_id] ?? 0) + 1
      return porTipo
    },
  })
}

/** Receita bruta dos pedidos pagos do evento (a mesma RPC do Resumo financeiro; reembolsado fica de fora) */
export function useReceitaDoEvento(eventId: string | null) {
  return useQuery({ queryKey: ['ingressos-receita', eventId], enabled: !!eventId, queryFn: async () => (await vendasPagas({ eventId })).total })
}

/** Grava o sort_order só dos ingressos que mudaram. Otimista: a lista muda na hora e volta ao que era se o banco recusar. */
export function useReordenarIngressos() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const chave = ['producer-events', user?.id]
  return useMutation({
    mutationFn: async ({ eventId, ordens }: { eventId: string; ordens: { id: string; sort_order: number }[] }) => {
      const r = await Promise.all(ordens.map(o => supabase.from('ticket_types').update({ sort_order: o.sort_order } as never).eq('id', o.id).eq('event_id', eventId).select('id')))
      const falha = r.find(x => x.error || x.data?.length !== 1) // RLS que barra devolve 0 linhas sem erro
      if (falha) throw falha.error ?? new Error('Não foi possível reordenar')
    },
    onMutate: async ({ eventId, ordens }) => {
      await qc.cancelQueries({ queryKey: chave })
      const antes = qc.getQueryData<DbEvent[]>(chave)
      const nova = new Map(ordens.map(o => [o.id, o.sort_order]))
      qc.setQueryData<DbEvent[]>(chave, l => l?.map(e => (e.id !== eventId ? e : { ...e, ticket_types: e.ticket_types?.map(t => (nova.has(t.id) ? { ...t, sort_order: nova.get(t.id)! } : t)) })))
      return { antes }
    },
    onError: (_e, _v, ctx) => { if (ctx?.antes) qc.setQueryData(chave, ctx.antes) },
    onSettled: () => { void qc.invalidateQueries({ queryKey: chave }) },
  })
}

/** Liga e desliga a venda (is_active). Ingresso com venda nunca é apagado: só oculto. */
export function useAlternarIngresso() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ eventId, id, ativo }: { eventId: string; id: string; ativo: boolean }) => {
      const { error } = await supabase.from('ticket_types').update({ is_active: ativo } as never).eq('id', id).eq('event_id', eventId).select('id').single()
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['producer-events', user?.id] }) },
  })
}
