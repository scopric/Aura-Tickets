import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

export interface TicketCheck {
  id: string
  name: string
  email: string
  ticketType: string
  ticketCode: string
  status: 'pendente' | 'usado' | 'cancelado'
  checkInTime: string | null
  seat: string
  avatar: string
  eventName: string
}

// ============================================
// Mapear dados do banco para o frontend
// ============================================
function mapDbTicketToTicketCheck(dbTicket: any): TicketCheck {
  let checkStatus: TicketCheck['status'] = 'pendente'
  if (dbTicket.status === 'used') {
    checkStatus = 'usado'
  } else if (dbTicket.status === 'cancelled' || dbTicket.status === 'refunded') {
    checkStatus = 'cancelado'
  }

  return {
    id: dbTicket.id,
    name: dbTicket.buyer_name || 'Participante',
    email: dbTicket.buyer_email || '',
    ticketType: dbTicket.ticket_types?.name || 'Ingresso Comum',
    ticketCode: dbTicket.qr_code,
    status: checkStatus,
    checkInTime: dbTicket.checked_in_at
      ? new Date(dbTicket.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : null,
    seat: '-',
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${dbTicket.buyer_name || 'U'}`,
    eventName: dbTicket.events?.title || 'Evento'
  }
}

// ============================================
// Hook: Carregar ingressos de um evento
// ============================================
export function useEventTickets(eventId: string) {

  return useQuery<TicketCheck[]>({
    queryKey: ['event-tickets', eventId],
    queryFn: async () => {
      if (!eventId) return []

      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          ticket_types (name),
          events (title)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data.map(mapDbTicketToTicketCheck)
    },
    enabled: !!eventId,
  })
}

// ============================================
// Hook: Escanear/validar ingresso
// ============================================
export function useScanTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ qrCode, eventId }: { qrCode: string; eventId: string }) => {
      const { data, error } = await supabase.functions.invoke('check-in-validate', {
        body: { qrCode: qrCode.trim(), eventId },
      })

      if (error) throw error
      return data as { valid: boolean; message: string; buyerName?: string; checkedInAt?: string; ticketType?: string }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-tickets', variables.eventId] })
    },
  })
}
