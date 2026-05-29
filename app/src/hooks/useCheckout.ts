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

      // 1. Criar o registro do pedido na tabela 'orders'
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id,
          total: total_amount,
          status: payment_method === 'pix' || payment_method === 'credit_card' ? 'paid' : 'pending',
          payment_method,
          gateway_payment_id: `PAY-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          customer_name: user.name || user.full_name || 'Participante',
          customer_email: user.email
        })
        .select()
        .single()

      if (orderError) throw orderError

      // 2. Criar order_items para cada tipo de ingresso
      const orderItemsToInsert = items.map((item) => ({
        order_id: order.id,
        ticket_type_id: item.ticket_type_id,
        quantity: item.quantity,
        unit_price: Number((total_amount / items.reduce((sum, it) => sum + it.quantity, 0)).toFixed(2)),
        subtotal: Number((total_amount / items.reduce((sum, it) => sum + it.quantity, 0) * item.quantity).toFixed(2)),
      }))

      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert)
        .select()

      if (orderItemsError) throw orderItemsError

      // 3. Criar os ingressos (tickets) individuais vinculados aos order_items
      const ticketsToInsert: any[] = []
      const orderItemsMap = new Map<string, string>()
      
      // Mapear ticket_type_id -> order_item_id
      for (const oi of (orderItemsData || [])) {
        orderItemsMap.set(oi.ticket_type_id, oi.id)
      }

      for (const item of items) {
        const orderItemId = orderItemsMap.get(item.ticket_type_id)
        const unitPrice = Number((total_amount / items.reduce((sum, it) => sum + it.quantity, 0)).toFixed(2))
        
        for (let i = 0; i < item.quantity; i++) {
          const code = `TK-${Math.random().toString(36).substr(2, 6).toUpperCase()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
          
          ticketsToInsert.push({
            order_item_id: orderItemId,
            order_id: order.id,
            ticket_type_id: item.ticket_type_id,
            event_id,
            user_id: user.id,
            buyer_name: user.name || user.full_name || 'Participante',
            buyer_email: user.email,
            qr_code: code,
            status: order.status === 'paid' ? 'active' : 'cancelled',
            price_paid: unitPrice
          })
        }
      }

      if (ticketsToInsert.length > 0) {
        const { error: ticketsError } = await supabase
          .from('tickets')
          .insert(ticketsToInsert)

        if (ticketsError) throw ticketsError
      }

      return {
        ...order,
        total_amount: Number(order.total) || 0,
        payment_id: order.gateway_payment_id,
      } as any
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-orders', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['user-tickets', user?.id] })
    }
  })
}

const MOCK_ORDERS: DbOrder[] = [
  { id: 'ord-001', user_id: 'u1s2e3r4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', event_id: 'evt-001', total_amount: 450, status: 'completed', payment_method: 'credit_card', payment_id: 'PAY-001', payment_split: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), events: { title: 'Festival de Verão 2025', cover_image: '/images/hero-bg.jpg', date: '2025-12-15', time: '18:00', venue_name: 'Parque Ibirapuera' } },
  { id: 'ord-002', user_id: 'u1s2e3r4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', event_id: 'evt-002', total_amount: 299, status: 'completed', payment_method: 'pix', payment_id: 'PAY-002', payment_split: null, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), events: { title: 'Workshop de Marketing Digital', cover_image: '/images/hero-bg.jpg', date: '2025-11-20', time: '14:00', venue_name: 'WeWork Faria Lima' } },
]

export function useUserOrders() {
  const { user } = useAuth()

  return useQuery<DbOrder[]>({
    queryKey: ['user-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      // Modo demo
      if (user.id === 'b2c3d4e5-f6a7-8901-bcde-f23456789012') {
        return MOCK_ORDERS
      }

      const { data, error } = await supabase
        .from('orders')
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
      
      // Mapear total para total_amount e gateway_payment_id para payment_id para compatibilidade do front
      return (data || []).map((o: any) => ({
        ...o,
        total_amount: Number(o.total) || 0,
        payment_id: o.gateway_payment_id,
      })) as DbOrder[]
    },
    enabled: !!user?.id,
  })
}

const MOCK_TICKETS: DbTicket[] = [
  { id: 'tk-001', order_id: 'ord-001', ticket_type_id: 'tt-002', user_id: 'u1s2e3r4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', code: 'TK-VIP-001', status: 'active', seat_info: null, checked_in_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ticket_types: { name: 'VIP', price: 450, type: 'vip' }, events: { id: 'evt-001', title: 'Festival de Verão 2025', cover_image: '/images/hero-bg.jpg', date: '2025-12-15', time: '18:00', venue_name: 'Parque Ibirapuera' } },
  { id: 'tk-002', order_id: 'ord-001', ticket_type_id: 'tt-002', user_id: 'u1s2e3r4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', code: 'TK-VIP-002', status: 'active', seat_info: null, checked_in_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ticket_types: { name: 'VIP', price: 450, type: 'vip' }, events: { id: 'evt-001', title: 'Festival de Verão 2025', cover_image: '/images/hero-bg.jpg', date: '2025-12-15', time: '18:00', venue_name: 'Parque Ibirapuera' } },
  { id: 'tk-003', order_id: 'ord-002', ticket_type_id: 'tt-004', user_id: 'u1s2e3r4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', code: 'TK-WSP-001', status: 'active', seat_info: null, checked_in_at: null, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), ticket_types: { name: 'Presencial', price: 299, type: 'individual' }, events: { id: 'evt-002', title: 'Workshop de Marketing Digital', cover_image: '/images/hero-bg.jpg', date: '2025-11-20', time: '14:00', venue_name: 'WeWork Faria Lima' } },
]

export function useUserTickets() {
  const { user } = useAuth()

  return useQuery<DbTicket[]>({
    queryKey: ['user-tickets', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      // Modo demo
      if (user.id === 'b2c3d4e5-f6a7-8901-bcde-f23456789012') {
        return MOCK_TICKETS
      }

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

