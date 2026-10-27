import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface DbNotification {
  id: string
  user_id: string
  title: string
  body: string | null
  type: string
  is_read: boolean
  metadata: { url?: string; [k: string]: unknown } | null
  created_at: string
}

/** Caminho interno do aviso (metadata.url), ou null. Só aceita "/algo": nunca endereço de fora, "//" nem "/\\".
 *  Também barra espaço, tab, quebra de linha e outros caracteres de controle: o navegador apaga tab e quebra de
 *  linha antes de ler a URL, e "/\t/x.com" viraria "//x.com" (outro site); os demais viram %xx e só atrapalham. */
export function urlDoAviso(n: Pick<DbNotification, 'metadata'>): string | null {
  const url = n.metadata?.url
  // eslint-disable-next-line no-control-regex -- barrar caractere de controle é o objetivo da regra
  return typeof url === 'string' && /^\/(?![/\\])[^\s\\\x00-\x1f\x7f]*$/.test(url) ? url : null
}

export function useUserNotifications() {
  const { user } = useAuth()

  return useQuery<DbNotification[]>({
    queryKey: ['user-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, body, type, is_read, metadata, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return (data || []) as DbNotification[]
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true, // voltar para a aba traz os avisos novos
  })
}

export function useMarkNotificationRead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user?.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('Aviso não encontrado') // a RLS esconde sem erro: 0 linhas = não gravou
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', user?.id] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', user?.id] })
    },
  })
}

export function useDeleteNotification() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user?.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('Aviso não encontrado')
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', user?.id] })
    },
  })
}
