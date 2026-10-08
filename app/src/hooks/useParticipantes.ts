import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/exportCsv'
import { agrupar, type Pedido, type Ingresso } from '../lib/participantes'
import { mensagemDoServidor } from './useEntregaIngresso'
import { useAuth } from './useAuth'

// Colunas uma a uma: nada de select('*') nem CPF e telefone (revogados para o produtor, docs/sql/20261011).
// A RLS "Produtores leem ... dos próprios eventos" já limita às linhas dos eventos do produtor; sem eventId lê todos.
const PEDIDO = 'id, status, customer_name, customer_email, total, payment_method, created_at, event_id'
const INGRESSO = 'id, order_id, ticket_type_id, status, buyer_name, buyer_email, price_paid, checked_in_at, created_at, ticket_types(name)'

/** idsDosEventos = eventos do produtor (a tela espera a lista carregar). Filtra SEMPRE por eles: a RLS também deixa passar linhas de admin e compras próprias. */
export function useParticipantes(eventId: string | null, idsDosEventos: string[] | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['producer-participantes', user?.id, eventId, idsDosEventos],
    enabled: !!user?.id && !!idsDosEventos && (!eventId || idsDosEventos.includes(eventId)),
    queryFn: async () => {
      const ids = eventId ? [eventId] : idsDosEventos!
      if (ids.length === 0) return []
      // ponytail: tudo no navegador, de 1.000 em 1.000; vira RPC paginada se um evento passar de alguns milhares de pedidos
      const [pedidos, ingressos] = await Promise.all([
        fetchAllRows<Pedido>((de, ate) => {
          const q = supabase.from('orders').select(PEDIDO)
          return q.in('event_id', ids).order('created_at', { ascending: false }).order('id').range(de, ate) as unknown as PromiseLike<{ data: Pedido[] | null; error: unknown }>
        }),
        fetchAllRows<Ingresso>((de, ate) => {
          const q = supabase.from('tickets').select(INGRESSO)
          return q.in('event_id', ids).order('created_at', { ascending: false }).order('id').range(de, ate) as unknown as PromiseLike<{ data: Ingresso[] | null; error: unknown }>
        }),
      ])
      // linha nova no meio da paginação desloca as páginas e repetiria uma linha: uma por id
      const unicos = <T extends { id: string }>(l: T[]) => [...new Map(l.map(x => [x.id, x])).values()]
      return agrupar(unicos(pedidos), unicos(ingressos))
    },
  })
}

/** Reenvia o ingresso por e-mail para a conta de quem comprou. A send-email confere no servidor que o pedido é de evento deste produtor. */
export function useReenviarIngresso() {
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.functions.invoke('send-email', { body: { orderId, emailType: 'ticket_delivery' } })
      if (error) throw new Error(await mensagemDoServidor(error, 'Não consegui reenviar o ingresso. Tente de novo em instantes.'))
    },
    onSuccess: () => toast.success('Ingresso reenviado por e-mail.'),
    onError: (e: Error) => toast.error(e.message),
  })
}
