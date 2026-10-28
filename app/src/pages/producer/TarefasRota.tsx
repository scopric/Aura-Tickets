import { Navigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import PageLoading from '../../components/PageLoading'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import ProducerTasks from './Tasks'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * /producer/tarefas: a lista de tarefas, como sempre foi. Só o link de cartão (?cartao=<id>, o dos avisos e dos favoritos antigos)
 * vai para o quadro certo do cartão (/producer/quadros/<quadro>?cartao=<id>); cartão que não existe mais ou sem acesso cai na lista.
 * ?eventId= continua filtrando a lista (a lista não é o kanban: não há o que redirecionar).
 */
export default function TarefasRota() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const cartao = params.get('cartao')
  const valido = !!cartao && UUID.test(cartao)
  const quadro = useQuery({
    queryKey: ['cartao-quadro', user?.id, cartao],
    enabled: valido && !!user?.id,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from('producer_tasks').select('board_id').eq('id', cartao!).maybeSingle()
      if (error) throw error
      return (data as { board_id: string | null } | null)?.board_id ?? null
    },
  })
  if (valido && quadro.isPending && quadro.fetchStatus !== 'idle') return <PageLoading />
  if (valido && quadro.data) return <Navigate replace to={`/producer/quadros/${quadro.data}?cartao=${cartao}`} />
  return <ProducerTasks />
}
