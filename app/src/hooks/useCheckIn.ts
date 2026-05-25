import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
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
  const { user } = useAuth()

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

      // Se não houver ingressos, fazer auto-seed para teste
      if (!data || data.length === 0) {
        const seeded = await seedInitialTickets(eventId, user?.id)
        return seeded
      }

      return data.map(mapDbTicketToTicketCheck)
    },
    enabled: !!eventId,
  })
}

// ============================================
// Auto-seed de ingressos para teste
// ============================================
async function seedInitialTickets(eventId: string, userId?: string): Promise<TicketCheck[]> {
  try {
    const { data: ticketTypes, error: typeError } = await supabase
      .from('ticket_types')
      .select('id, name')
      .eq('event_id', eventId)

    if (typeError) throw typeError

    let typeId = ''
    if (ticketTypes && ticketTypes.length > 0) {
      typeId = ticketTypes[0].id
    } else {
      const { data: newType, error: createTypeError } = await supabase
        .from('ticket_types')
        .insert({
          event_id: eventId,
          name: 'Pista Geral',
          price: 50.00,
          capacity: 500,
          sold: 0,
          type: 'individual',
          lot_number: 1,
          is_active: true
        })
        .select()
        .single()

      if (createTypeError) throw createTypeError
      typeId = newType.id
    }

    const testTickets = [
      { event_id: eventId, ticket_type_id: typeId, user_id: userId || eventId, buyer_name: 'Ana Costa', buyer_email: 'ana@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-001`, status: 'active' },
      { event_id: eventId, ticket_type_id: typeId, user_id: userId || eventId, buyer_name: 'Pedro Lima', buyer_email: 'pedro@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-002`, status: 'used', checked_in_at: new Date(Date.now() - 3600000).toISOString() },
      { event_id: eventId, ticket_type_id: typeId, user_id: userId || eventId, buyer_name: 'Maria Souza', buyer_email: 'maria@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-003`, status: 'active' },
      { event_id: eventId, ticket_type_id: typeId, user_id: userId || eventId, buyer_name: 'João Silva', buyer_email: 'joao@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-004`, status: 'used', checked_in_at: new Date(Date.now() - 7200000).toISOString() },
      { event_id: eventId, ticket_type_id: typeId, user_id: userId || eventId, buyer_name: 'Fernanda Rocha', buyer_email: 'fernanda@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-005`, status: 'active' },
      { event_id: eventId, ticket_type_id: typeId, user_id: userId || eventId, buyer_name: 'Lucas Oliveira', buyer_email: 'lucas@email.com', qr_code: `AUR-${eventId.substring(0,4).toUpperCase()}-006`, status: 'cancelled' }
    ]

    await supabase.from('tickets').insert(testTickets)

    const { data: finalTickets } = await supabase
      .from('tickets')
      .select(`
        *,
        ticket_types (name),
        events (title)
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    return (finalTickets || []).map(mapDbTicketToTicketCheck)
  } catch (err) {
    console.error('Erro no auto-seed de ingressos:', err)
    return []
  }
}

// ============================================
// Hook: Escanear/validar ingresso
// ============================================
export function useScanTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ qrCode, eventId, operatorId }: { qrCode: string; eventId: string; operatorId?: string }) => {
      const { data, error } = await supabase.functions.invoke('check-in-validate', {
        body: { qrCode: qrCode.trim(), eventId, operatorId },
      })

      if (error) throw error
      return data as { valid: boolean; message: string; buyerName?: string; checkedInAt?: string; ticketType?: string }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-tickets', variables.eventId] })
    },
  })
}
