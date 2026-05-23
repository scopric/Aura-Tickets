import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface DbTicketType {
  id: string
  event_id: string
  name: string
  description: string | null
  price: number
  capacity: number | null
  sold: number
  type: 'individual' | 'vip' | 'coletiva' | 'mesa'
  perks: string[] | null
  is_active: boolean
  lot_number: number
  sale_start: string | null
  sale_end: string | null
  created_at: string
  updated_at: string
}

export interface DbEvent {
  id: string
  producer_id: string
  title: string
  subtitle: string | null
  slug: string
  description: string | null
  short_description: string | null
  cover_image: string | null
  image_url: string | null
  gallery: any
  category: string | null
  tags: string[]
  venue_name: string | null
  venue_address: string | null
  venue_city: string | null
  venue_state: string | null
  venue_zip: string | null
  venue_lat: number | null
  venue_lng: number | null
  date: string | null
  time: string | null
  start_date: string
  end_date: string | null
  status: 'draft' | 'published' | 'cancelled' | 'ended'
  visibility: 'public' | 'private' | 'unlisted' | 'password'
  password: string | null
  capacity: number | null
  branding: any
  settings: any
  meta_title: string | null
  meta_description: string | null
  created_at: string
  updated_at: string
  location?: string | null
  ticket_types?: DbTicketType[]
}

export function useProducerEvents() {
  const { user } = useAuth()

  return useQuery<DbEvent[]>({
    queryKey: ['producer-events', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          ticket_types (*)
        `)
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Mapear tipos de ingressos e garantir que perks sejam array de strings
      return (data || []).map((event: any) => ({
        ...event,
        ticket_types: (event.ticket_types || []).map((t: any) => ({
          ...t,
          price: Number(t.price) || 0,
          perks: Array.isArray(t.perks) ? t.perks : []
        }))
      })) as DbEvent[]
    },
    enabled: !!user?.id,
  })
}

export function useCreateEvent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ event, tickets }: { event: Partial<DbEvent>; tickets: Partial<DbTicketType>[] }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      // Gerar slug único a partir do título
      const titleSlug = (event.title || 'evento')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
      const slug = `${titleSlug}-${Date.now()}`

      // 1. Inserir o evento
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          producer_id: user.id,
          title: event.title || 'Novo Evento',
          subtitle: event.subtitle || null,
          slug: slug,
          description: event.description || null,
          short_description: event.short_description || null,
          cover_image: event.cover_image || '/images/hero-bg.jpg',
          image_url: event.image_url || '/images/hero-bg.jpg',
          gallery: event.gallery || [],
          category: event.category || 'Outros',
          tags: event.tags || [],
          venue_name: event.venue_name || event.location || null,
          venue_address: event.venue_address || null,
          date: event.date || null,
          time: event.time || null,
          start_date: event.start_date || new Date().toISOString(),
          status: event.status || 'draft',
          visibility: event.visibility || 'public',
          capacity: event.capacity || null,
          branding: event.branding || {},
          settings: event.settings || {},
        })
        .select()
        .single()

      if (eventError) throw eventError

      // 2. Inserir os tipos de ingressos vinculados ao evento
      if (tickets && tickets.length > 0) {
        const ticketsToInsert = tickets.map((t, idx) => ({
          event_id: eventData.id,
          name: t.name || `Ingresso ${idx + 1}`,
          description: t.description || null,
          price: Number(t.price) || 0,
          capacity: t.capacity ? Number(t.capacity) : null,
          quantity_total: t.capacity ? Number(t.capacity) : 0,
          sold: 0,
          quantity_sold: 0,
          type: t.type || 'individual',
          perks: t.perks || [],
          is_active: true,
          lot_number: 1,
        }))

        const { error: ticketsError } = await supabase
          .from('ticket_types')
          .insert(ticketsToInsert)

        if (ticketsError) throw ticketsError
      }

      return eventData
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-events', user?.id] })
    }
  })
}

export function useDeleteEvent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-events', user?.id] })
    }
  })
}

export function usePublicEvent(eventIdOrSlug: string | undefined) {
  return useQuery<DbEvent | null>({
    queryKey: ['public-event', eventIdOrSlug],
    queryFn: async () => {
      if (!eventIdOrSlug) return null

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventIdOrSlug)
      
      let query = supabase
        .from('events')
        .select(`
          *,
          ticket_types (*)
        `)

      if (isUuid) {
        query = query.eq('id', eventIdOrSlug)
      } else {
        query = query.eq('slug', eventIdOrSlug)
      }

      const { data, error } = await query.maybeSingle()

      if (error) throw error
      if (!data) return null

      return {
        ...data,
        ticket_types: (data.ticket_types || []).map((t: any) => ({
          ...t,
          price: Number(t.price) || 0,
          perks: Array.isArray(t.perks) ? t.perks : []
        }))
      } as DbEvent
    },
    enabled: !!eventIdOrSlug,
  })
}

export function usePublicEvents() {
  return useQuery<DbEvent[]>({
    queryKey: ['public-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          ticket_types (*)
        `)
        .eq('status', 'published')
        .order('date', { ascending: true })

      if (error) throw error

      return (data || []).map((event: any) => ({
        ...event,
        ticket_types: (event.ticket_types || []).map((t: any) => ({
          ...t,
          price: Number(t.price) || 0,
          perks: Array.isArray(t.perks) ? t.perks : []
        }))
      })) as DbEvent[]
    }
  })
}


