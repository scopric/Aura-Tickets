import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface DailyRevenue {
  date: string
  revenue: number
  orders: number
}

export interface EventRevenue {
  event_id: string
  event_title: string
  revenue: number
  tickets_sold: number
  orders_count: number
}

export interface PaymentMethodSummary {
  method: string
  total: number
  count: number
}

export interface FinancialSummary {
  totalRevenue: number
  totalOrders: number
  totalTicketsSold: number
  avgTicketPrice: number
  pendingRevenue: number
  confirmedRevenue: number
}

export function useFinancialDashboard() {
  const { user } = useAuth()

  const summaryQuery = useQuery<FinancialSummary>({
    queryKey: ['financial-summary', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return { totalRevenue: 0, totalOrders: 0, totalTicketsSold: 0, avgTicketPrice: 0, pendingRevenue: 0, confirmedRevenue: 0 }
      }

      const { data: events } = await supabase
        .from('events')
        .select('id, title')
        .eq('producer_id', user.id)

      if (!events || events.length === 0) {
        return { totalRevenue: 0, totalOrders: 0, totalTicketsSold: 0, avgTicketPrice: 0, pendingRevenue: 0, confirmedRevenue: 0 }
      }

      const eventIds = events.map(e => e.id)

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total, status, created_at')
        .in('event_id', eventIds)

      if (ordersError) throw ordersError

      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id')
        .in('event_id', eventIds)

      if (ticketsError) throw ticketsError

      const totalRevenue = orders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0
      const confirmedRevenue = orders?.filter(o => o.status === 'paid').reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0
      const pendingRevenue = orders?.filter(o => o.status === 'pending').reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0
      const totalOrders = orders?.length || 0
      const totalTicketsSold = tickets?.length || 0
      const avgTicketPrice = totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0

      return {
        totalRevenue,
        totalOrders,
        totalTicketsSold,
        avgTicketPrice,
        pendingRevenue,
        confirmedRevenue,
      }
    },
    enabled: !!user?.id,
  })

  const dailyRevenueQuery = useQuery<DailyRevenue[]>({
    queryKey: ['financial-daily', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('producer_id', user.id)

      if (!events || events.length === 0) return []

      const eventIds = events.map(e => e.id)

      const { data: orders, error } = await supabase
        .from('orders')
        .select('total, created_at, status')
        .in('event_id', eventIds)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      const grouped = new Map<string, { revenue: number; orders: number }>()

      orders?.forEach(o => {
        const day = o.created_at.split('T')[0]
        const current = grouped.get(day) || { revenue: 0, orders: 0 }
        current.revenue += Number(o.total) || 0
        current.orders += 1
        grouped.set(day, current)
      })

      return Array.from(grouped.entries()).map(([date, vals]) => ({
        date: new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        revenue: vals.revenue,
        orders: vals.orders,
      }))
    },
    enabled: !!user?.id,
  })

  const eventRevenueQuery = useQuery<EventRevenue[]>({
    queryKey: ['financial-by-event', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data: events } = await supabase
        .from('events')
        .select('id, title')
        .eq('producer_id', user.id)

      if (!events || events.length === 0) return []

      const eventIds = events.map(e => e.id)

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('event_id, total, status')
        .in('event_id', eventIds)

      if (ordersError) throw ordersError

      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('event_id')
        .in('event_id', eventIds)

      if (ticketsError) throw ticketsError

      const result: EventRevenue[] = events.map(e => {
        const eventOrders = orders?.filter(o => o.event_id === e.id) || []
        const eventTickets = tickets?.filter(t => t.event_id === e.id) || []
        return {
          event_id: e.id,
          event_title: e.title,
          revenue: eventOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
          tickets_sold: eventTickets.length,
          orders_count: eventOrders.length,
        }
      })

      return result.sort((a, b) => b.revenue - a.revenue)
    },
    enabled: !!user?.id,
  })

  const paymentMethodsQuery = useQuery<PaymentMethodSummary[]>({
    queryKey: ['financial-payment-methods', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('producer_id', user.id)

      if (!events || events.length === 0) return []

      const eventIds = events.map(e => e.id)

      const { data: orders, error } = await supabase
        .from('orders')
        .select('payment_method, total')
        .in('event_id', eventIds)
        .not('payment_method', 'is', null)

      if (error) throw error

      const grouped = new Map<string, { total: number; count: number }>()

      orders?.forEach(o => {
        const method = o.payment_method || 'outro'
        const current = grouped.get(method) || { total: 0, count: 0 }
        current.total += Number(o.total) || 0
        current.count += 1
        grouped.set(method, current)
      })

      const methodLabels: Record<string, string> = {
        pix: 'PIX',
        credit_card: 'Cartão de Crédito',
        debit_card: 'Cartão de Débito',
        boleto: 'Boleto',
        cash: 'Dinheiro',
        transfer: 'Transferência',
      }

      return Array.from(grouped.entries()).map(([method, vals]) => ({
        method: methodLabels[method] || method,
        total: vals.total,
        count: vals.count,
      })).sort((a, b) => b.total - a.total)
    },
    enabled: !!user?.id,
  })

  return {
    summary: summaryQuery.data,
    isSummaryLoading: summaryQuery.isLoading,
    dailyRevenue: dailyRevenueQuery.data,
    isDailyLoading: dailyRevenueQuery.isLoading,
    eventRevenue: eventRevenueQuery.data,
    isEventRevenueLoading: eventRevenueQuery.isLoading,
    paymentMethods: paymentMethodsQuery.data,
    isPaymentMethodsLoading: paymentMethodsQuery.isLoading,
  }
}
