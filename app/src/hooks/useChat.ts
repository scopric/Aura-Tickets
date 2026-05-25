import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface ChatMessage {
  id: string
  event_id: string
  sender_id: string
  sender_role: 'user' | 'producer'
  sender_name: string
  content: string
  attachments: any[]
  read_at: string | null
  created_at: string
}

export function useChat(eventId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)

  // Buscar histórico de mensagens
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ['chat-messages', eventId],
    queryFn: async () => {
      if (!eventId) return []

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as ChatMessage[]
    },
    enabled: !!eventId,
  })

  // Enviar mensagem
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!eventId || !user?.id) throw new Error('Evento ou usuário não identificado')

      const { data, error } = await supabase
        .from('messages')
        .insert({
          event_id: eventId,
          sender_id: user.id,
          sender_role: user.role === 'producer' ? 'producer' : 'user',
          sender_name: user.name || user.full_name || 'Participante',
          content: content.trim(),
          attachments: [],
        })
        .select()
        .single()

      if (error) throw error
      return data as ChatMessage
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', eventId] })
    },
  })

  // Supabase Realtime: ouvir novas mensagens
  useEffect(() => {
    if (!eventId) return

    setRealtimeEnabled(true)

    const channel = supabase
      .channel(`chat-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          // Adiciona a nova mensagem ao cache sem refetch completo
          const newMessage = payload.new as ChatMessage
          queryClient.setQueryData<ChatMessage[]>(
            ['chat-messages', eventId],
            (old) => {
              if (!old) return [newMessage]
              // Evita duplicatas
              if (old.some((m) => m.id === newMessage.id)) return old
              return [...old, newMessage]
            }
          )
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      setRealtimeEnabled(false)
    }
  }, [eventId, queryClient])

  // Marcar mensagens como lidas (quando o usuário abre o chat)
  const markAsRead = useMutation({
    mutationFn: async () => {
      if (!eventId || !user?.id) return

      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .neq('sender_id', user.id)
        .is('read_at', null)

      if (error) throw error
    },
  })

  return {
    messages,
    isLoading,
    sendMessage,
    markAsRead,
    realtimeEnabled,
  }
}
