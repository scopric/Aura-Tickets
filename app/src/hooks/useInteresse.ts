import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { CONSENTIMENTO_VERSAO } from '../lib/interesse'
import { useAuth } from './useAuth'

// "Avise-me" do participante (P4): public.interest_lists, uma linha por (evento, pessoa). Só o papel `user` usa.
// O banco grava a data do consentimento; aqui só vai a versão do texto aceito. Toast só depois que o banco confirma.
const userIdDoUser = () => {
  const { user, role } = useAuth()
  return role === 'user' ? user?.id : undefined
}

export function useInteresse(eventId: string) {
  const userId = userIdDoUser()
  const queryClient = useQueryClient()
  const chave = ['interesse', userId, eventId]

  const { data: inscrito = false } = useQuery<boolean>({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await supabase.from('interest_lists').select('id').eq('user_id', userId!).eq('event_id', eventId).maybeSingle()
      if (error) throw error
      return !!data
    },
    enabled: !!userId,
  })

  // 42501: a regra do banco barrou. O motivo mais comum é a verificação em dois fatores pendente.
  const falhou = (acao: string) => (e: { code?: string }) =>
    toast.error(e.code === '42501'
      ? `Não foi possível ${acao}. Se você usa verificação em dois fatores, confirme o código e tente de novo.`
      : `Não foi possível ${acao}. Tente de novo.`)

  const entrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('interest_lists').insert({ user_id: userId!, event_id: eventId, consentimento_versao: CONSENTIMENTO_VERSAO } as never) // `as never`: os tipos gerados de insert estão defasados (como em useFavoritos)
      if (error && error.code !== '23505') throw error // 23505: já estava inscrito (outra aba)
    },
    onSuccess: () => { queryClient.setQueryData(chave, true); toast.success('Pronto! Avisaremos você quando as vendas abrirem.') },
    onError: falhou('ativar o aviso'),
  })

  const sair = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('interest_lists').delete().eq('user_id', userId!).eq('event_id', eventId)
      if (error) throw error
    },
    onSuccess: () => { queryClient.setQueryData(chave, false); toast.success('Aviso removido.') },
    onError: falhou('remover o aviso'),
  })

  return { userId, inscrito, entrar, sair }
}

/** Linha da lista do produtor (interesse_lista). nome, e-mail e cidade vêm nulos de quem não consentiu. */
export interface Interessado {
  id: string; event_id: string; event_title: string; full_name: string | null; email: string | null; city: string | null
  notified: boolean; notified_at: string | null; consentiu: boolean; created_at: string
}

export function useInteressados() {
  const { user } = useAuth()
  return useQuery<Interessado[]>({
    queryKey: ['producer-interesse', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('interesse_lista' as never)
      if (error) throw error
      return (data ?? []) as Interessado[]
    },
    enabled: !!user?.id,
  })
}

/** Tira SÓ da lista: o lead que a inscrição criou no CRM continua lá. */
export function useRemoverInteressado() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('interesse_remover' as never, { p_id: id } as never)
      if (error) throw error
      if (data !== true) throw new Error('Nada foi removido')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['producer-interesse', user?.id] }),
  })
}
