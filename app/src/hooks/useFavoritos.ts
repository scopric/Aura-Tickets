import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { limparSalvarPendente, pegarSalvarPendente } from '../lib/voltaEvento'
import { useAuth } from './useAuth'
import type { EventoCatalogo } from '../lib/explorar'

// Favoritos (VF): public.favoritos (user_id, event_id, criado_em). A RLS deixa cada pessoa ver e mexer só nas suas linhas.
// Só o papel `user` usa; produtor e equipe não veem o coração. Esta é a única regra de papel: `userId` é undefined para os outros.
// `as never`: a tabela ainda não está em types/database.ts (gerado e já defasado); some quando ele for regerado.
function useUserId() {
  const { user, role } = useAuth()
  return role === 'user' ? user?.id : undefined
}

/** `salvo` (ids que a pessoa salvou) e `definir`, com atualização otimista (volta ao estado anterior e avisa se falhar). */
export function useFavoritos() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  const chave = ['favoritos', userId]

  const { data: ids = [] } = useQuery<string[]>({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await supabase.from('favoritos' as never).select('event_id').eq('user_id', userId!)
      if (error) throw error
      return (data ?? []).map((l: { event_id: string }) => l.event_id)
    },
    enabled: !!userId,
  })

  const mutacao = useMutation({
    // uma de cada vez: dois toques rápidos no mesmo coração rodam em ordem e o último vence
    scope: { id: 'favoritos' },
    mutationFn: async ({ eventId, salvar }: { eventId: string; salvar: boolean }) => {
      const { error } = salvar
        ? await supabase.from('favoritos' as never).insert({ user_id: userId, event_id: eventId } as never)
        : await supabase.from('favoritos' as never).delete().eq('user_id', userId!).eq('event_id', eventId)
      if (error && error.code !== '23505') throw error // 23505: já estava salvo (outra aba): o resultado é o mesmo
    },
    onMutate: async ({ eventId, salvar }) => {
      await queryClient.cancelQueries({ queryKey: chave })
      const antes = queryClient.getQueryData<string[]>(chave)
      queryClient.setQueryData<string[]>(chave, (atual = []) => salvar ? [eventId, ...atual.filter(i => i !== eventId)] : atual.filter(i => i !== eventId))
      return { antes }
    },
    onError: (_e, { salvar }, ctx) => {
      queryClient.setQueryData(chave, ctx?.antes)
      toast.error(salvar ? 'Não deu para salvar o evento. Tente de novo.' : 'Não deu para remover o evento dos salvos. Tente de novo.')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['favoritos'] }), // os ids e a lista da tela Salvos
  })

  return {
    userId,
    salvo: (eventId: string) => ids.includes(eventId),
    definir: (eventId: string, salvar: boolean) => mutacao.mutate({ eventId, salvar }),
  }
}

/** Na página do evento: grava o favorito que a pessoa tocou antes de entrar (uma vez), avisa com "Desfazer" e limpa.
 *  Evento que não carregou (`carregando` já false, sem id) ou id diferente: limpa a marca, para não sobrar na aba. */
export function useSalvarPendente(eventId: string | undefined, carregando = false) {
  const { userId, definir } = useFavoritos()
  useEffect(() => {
    if (carregando) return
    if (!eventId) return limparSalvarPendente()
    if (!userId) return // login ainda resolvendo (ou papel sem favoritos): a marca espera
    if (pegarSalvarPendente(eventId)) {
      definir(eventId, true)
      toast.success('Evento salvo', { action: { label: 'Desfazer', onClick: () => definir(eventId, false) } })
    } else limparSalvarPendente()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `definir` muda a cada render; o gatilho é entrar com o evento carregado
  }, [eventId, userId, carregando])
}

/** Um favorito da tela Salvos: `evento` é null quando o evento não está mais publicado e aprovado (ou a RLS o escondeu). */
export interface Salvo { eventId: string; evento: EventoCatalogo | null }

/** Favoritos (mais recente primeiro). Os que saíram do ar vêm com `evento: null` para a tela mostrar "fora do ar" e deixar remover. */
export function useEventosSalvos() {
  const userId = useUserId()
  return useQuery<Salvo[]>({
    queryKey: ['favoritos', 'eventos', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('favoritos' as never)
        .select('event_id, criado_em, events (*, ticket_types (*))')
        .eq('user_id', userId!)
        .order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []).map((l: { event_id: string; events: (EventoCatalogo & { status?: string; approval_status?: string }) | null }) => ({
        eventId: l.event_id,
        evento: l.events && l.events.status === 'published' && l.events.approval_status === 'approved' ? l.events : null,
      }))
    },
    enabled: !!userId,
  })
}
