import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface DbOrder {
  id: string
  user_id: string
  event_id: string
  total_amount: number
  status: 'pending' | 'completed' | 'cancelled' | 'refunded'
  payment_method: 'credit_card' | 'pix' | 'boleto' | 'cashless'
  payment_id: string | null
  payment_split: any
  created_at: string
  updated_at: string
  events?: {
    title: string
    cover_image: string | null
    date: string | null
    time: string | null
    venue_name: string | null
  }
}

export interface DbTicket {
  id: string
  order_id: string
  ticket_type_id: string
  user_id: string
  code: string
  status: 'active' | 'used' | 'cancelled' | 'transferred'
  seat_info: string | null
  checked_in_at: string | null
  created_at: string
  updated_at: string
  ticket_types?: {
    name: string
    price: number
    type: string
  }
  events?: {
    id: string
    title: string
    cover_image: string | null
    date: string | null
    time: string | null
    venue_name: string | null
  }
}

export function useCreateOrder() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      event_id,
      items,
      payment_method,
      total_amount,
    }: {
      event_id: string
      items: { ticket_type_id: string; quantity: number; seat_info?: string }[]
      payment_method: DbOrder['payment_method']
      total_amount: number
    }) => {
      if (!user?.id) throw new Error('Usuário precisa estar autenticado para realizar compras')

      // 1. Criar o registro do pedido
      const { data: order, error: orderError } = await supabase
        .from('ticket_orders')
        .insert({
          user_id: user.id,
          event_id,
          total_amount,
          status: payment_method === 'pix' || payment_method === 'credit_card' ? 'completed' : 'pending', // Simulação simplificada de checkout aprovado
          payment_method,
          payment_id: `PAY-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          payment_split: {
            platform_fee: Number((total_amount * 0.1).toFixed(2)), // 10% Platform fee
            producer_share: Number((total_amount * 0.9).toFixed(2)) // 90% Producer
          }
        })
        .select()
        .single()

      if (orderError) throw orderError

      // 2. Criar os ingressos (tickets) individuais para cada item
      const ticketsToInsert: any[] = []

      for (const item of items) {
        for (let i = 0; i < item.quantity; i++) {
          const code = `TK-${Math.random().toString(36).substr(2, 6).toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
          
          ticketsToInsert.push({
            order_id: order.id,
            ticket_type_id: item.ticket_type_id,
            user_id: user.id,
            code,
            status: order.status === 'completed' ? 'active' : 'cancelled', // Ativo se o pedido já estiver concluído
            seat_info: item.seat_info || null,
          })
        }
      }

      if (ticketsToInsert.length > 0) {
        const { error: ticketsError } = await supabase
          .from('tickets')
          .insert(ticketsToInsert)

        if (ticketsError) throw ticketsError
      }

      return order
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-orders', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['user-tickets', user?.id] })
    }
  })
}

export function useUserOrders() {
  const { user } = useAuth()

  return useQuery<DbOrder[]>({
    queryKey: ['user-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('ticket_orders')
        .select(`
          *,
          events (
            title,
            cover_image,
            date,
            time,
            venue_name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as any[]
    },
    enabled: !!user?.id,
  })
}

export function useUserTickets() {
  const { user } = useAuth()

  return useQuery<DbTicket[]>({
    queryKey: ['user-tickets', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      // Buscar ingressos do usuário e trazer dados do tipo de ingresso (ticket_types)
      // E também do evento relacionado através do ticket_types
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          ticket_types (
            name,
            price,
            type,
            events (
              id,
              title,
              cover_image,
              date,
              time,
              venue_name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Mapear retorno aninhado para facilitar o consumo no frontend
      return (data || []).map((t: any) => ({
        ...t,
        ticket_types: {
          name: t.ticket_types?.name,
          price: Number(t.ticket_types?.price) || 0,
          type: t.ticket_types?.type,
        },
        events: t.ticket_types?.events ? {
          id: t.ticket_types.events.id,
          title: t.ticket_types.events.title,
          cover_image: t.ticket_types.events.cover_image,
          date: t.ticket_types.events.date,
          time: t.ticket_types.events.time,
          venue_name: t.ticket_types.events.venue_name,
        } : undefined
      })) as DbTicket[]
    },
    enabled: !!user?.id,
  })
}

export function useOrderTickets(orderId?: string) {
  return useQuery<DbTicket[]>({
    queryKey: ['order-tickets', orderId],
    queryFn: async () => {
      if (!orderId) return []

      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          ticket_types (
            name,
            price,
            type,
            events (
              id,
              title,
              cover_image,
              date,
              time,
              venue_name
            )
          )
        `)
        .eq('order_id', orderId)

      if (error) throw error

      return (data || []).map((t: any) => ({
        ...t,
        ticket_types: {
          name: t.ticket_types?.name,
          price: Number(t.ticket_types?.price) || 0,
          type: t.ticket_types?.type,
        },
        events: t.ticket_types?.events ? {
          id: t.ticket_types.events.id,
          title: t.ticket_types.events.title,
          cover_image: t.ticket_types.events.cover_image,
          date: t.ticket_types.events.date,
          time: t.ticket_types.events.time,
          venue_name: t.ticket_types.events.venue_name,
        } : undefined
      })) as DbTicket[]
    },
    enabled: !!orderId,
  })
}

