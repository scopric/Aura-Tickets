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

const MOCK_EVENTS: DbEvent[] = [
  {
    id: 'evt-001',
    producer_id: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4',
    title: 'Festival de Verão 2025',
    subtitle: 'O maior festival de música ao ar livre',
    slug: 'festival-de-verao-2025',
    description: 'Um evento incrível com as melhores bandas nacionais e internacionais.',
    short_description: 'Festival de música ao ar livre',
    cover_image: '/images/hero-bg.jpg',
    image_url: '/images/hero-bg.jpg',
    gallery: [],
    category: 'Música',
    tags: ['festival', 'música', 'verão'],
    venue_name: 'Parque Ibirapuera',
    venue_address: 'Av. Pedro Álvares Cabral, s/n',
    venue_city: 'São Paulo',
    venue_state: 'SP',
    venue_zip: '04094-050',
    venue_lat: -23.5874,
    venue_lng: -46.6576,
    date: '2025-12-15',
    time: '18:00',
    start_date: '2025-12-15T18:00:00',
    end_date: '2025-12-16T04:00:00',
    status: 'published',
    visibility: 'public',
    password: null,
    capacity: 5000,
    branding: {},
    settings: {},
    meta_title: null,
    meta_description: null,
    created_at: '2025-01-01T00:00:00',
    updated_at: '2025-01-01T00:00:00',
    ticket_types: [
      { id: 'tt-001', event_id: 'evt-001', name: 'Ingresso Geral', description: 'Acesso completo ao festival', price: 150, capacity: 3000, sold: 1245, type: 'individual', perks: ['Acesso à área geral'], is_active: true, lot_number: 1, sale_start: null, sale_end: null, created_at: '', updated_at: '' },
      { id: 'tt-002', event_id: 'evt-001', name: 'VIP', description: 'Área VIP com open bar', price: 450, capacity: 500, sold: 389, type: 'vip', perks: ['Open bar', 'Área exclusiva', 'Banheiro VIP'], is_active: true, lot_number: 1, sale_start: null, sale_end: null, created_at: '', updated_at: '' },
      { id: 'tt-003', event_id: 'evt-001', name: 'Mesa Coletiva', description: 'Mesa para 6 pessoas', price: 1200, capacity: 50, sold: 42, type: 'mesa', perks: ['Mesa reservada', 'Garçom dedicado', ' welcome drink'], is_active: true, lot_number: 1, sale_start: null, sale_end: null, created_at: '', updated_at: '' },
    ]
  },
  {
    id: 'evt-002',
    producer_id: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4',
    title: 'Workshop de Marketing Digital',
    subtitle: 'Aprenda as estratégias que funcionam',
    slug: 'workshop-marketing-digital',
    description: 'Workshop prático com cases reais de growth hacking.',
    short_description: 'Workshop de marketing',
    cover_image: '/images/hero-bg.jpg',
    image_url: '/images/hero-bg.jpg',
    gallery: [],
    category: 'Negócios',
    tags: ['marketing', 'workshop', 'negócios'],
    venue_name: 'WeWork Faria Lima',
    venue_address: 'Rua Faria Lima, 1000',
    venue_city: 'São Paulo',
    venue_state: 'SP',
    venue_zip: '04538-132',
    venue_lat: -23.5836,
    venue_lng: -46.6818,
    date: '2025-11-20',
    time: '14:00',
    start_date: '2025-11-20T14:00:00',
    end_date: '2025-11-20T18:00:00',
    status: 'published',
    visibility: 'public',
    password: null,
    capacity: 200,
    branding: {},
    settings: {},
    meta_title: null,
    meta_description: null,
    created_at: '2025-02-01T00:00:00',
    updated_at: '2025-02-01T00:00:00',
    ticket_types: [
      { id: 'tt-004', event_id: 'evt-002', name: 'Presencial', description: 'Acesso ao workshop presencial', price: 299, capacity: 150, sold: 87, type: 'individual', perks: ['Material didático', 'Coffee break'], is_active: true, lot_number: 1, sale_start: null, sale_end: null, created_at: '', updated_at: '' },
      { id: 'tt-005', event_id: 'evt-002', name: 'Online', description: 'Transmissão ao vivo', price: 149, capacity: 500, sold: 234, type: 'individual', perks: ['Acesso à gravação'], is_active: true, lot_number: 1, sale_start: null, sale_end: null, created_at: '', updated_at: '' },
    ]
  },
  {
    id: 'evt-003',
    producer_id: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4',
    title: 'Noite de Networking',
    subtitle: 'Conecte-se com profissionais da área',
    slug: 'noite-de-networking',
    description: 'Um evento exclusivo para networking e troca de experiências.',
    short_description: 'Networking empresarial',
    cover_image: '/images/hero-bg.jpg',
    image_url: '/images/hero-bg.jpg',
    gallery: [],
    category: 'Networking',
    tags: ['networking', 'negócios', 'conexões'],
    venue_name: 'Casa das Rosas',
    venue_address: 'Av. Paulista, 37',
    venue_city: 'São Paulo',
    venue_state: 'SP',
    venue_zip: '01311-902',
    venue_lat: -23.5707,
    venue_lng: -46.6446,
    date: '2026-01-10',
    time: '19:00',
    start_date: '2026-01-10T19:00:00',
    end_date: '2026-01-10T23:00:00',
    status: 'draft',
    visibility: 'public',
    password: null,
    capacity: 100,
    branding: {},
    settings: {},
    meta_title: null,
    meta_description: null,
    created_at: '2025-03-01T00:00:00',
    updated_at: '2025-03-01T00:00:00',
    ticket_types: [
      { id: 'tt-006', event_id: 'evt-003', name: 'Entrada Geral', description: 'Acesso à noite de networking', price: 50, capacity: 100, sold: 0, type: 'individual', perks: ['Welcome drink', 'Badge personalizado'], is_active: true, lot_number: 1, sale_start: null, sale_end: null, created_at: '', updated_at: '' },
    ]
  }
]

const DEMO_USER_IDS = new Set([
  'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4',
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
])

function normalizeEventTicketTypes(event: any): DbEvent {
  return {
    ...event,
    ticket_types: (event.ticket_types || []).map((t: any) => ({
      ...t,
      price: Number(t.price) || 0,
      perks: Array.isArray(t.perks) ? t.perks : []
    }))
  } as DbEvent
}

export function useProducerEvents() {
  const { user } = useAuth()

  return useQuery<DbEvent[]>({
    queryKey: ['producer-events', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      try {
        const fetchPromise = (async () => {
          const { data, error } = await supabase
            .from('events')
            .select(`*, ticket_types (*)`)
            .eq('producer_id', user.id)
            .order('created_at', { ascending: false })

          if (error) throw error

          const realEvents = (data || []).map(normalizeEventTicketTypes)
          if (realEvents.length > 0) return realEvents

          if (DEMO_USER_IDS.has(user.id)) return MOCK_EVENTS
          return []
        })()

        return await Promise.race([
          fetchPromise,
          new Promise<DbEvent[]>((resolve) => 
            setTimeout(() => {
              console.warn('[useProducerEvents] Timeout ao buscar eventos, usando fallback local.');
              resolve(DEMO_USER_IDS.has(user.id) ? MOCK_EVENTS : [])
            }, 6000)
          )
        ])
      } catch (err) {
        console.error('[useProducerEvents] Erro:', err)
        return DEMO_USER_IDS.has(user?.id || '') ? MOCK_EVENTS : []
      }
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

      const titleSlug = (event.title || 'evento')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
      const slug = `${titleSlug}-${Date.now()}`

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          producer_id: user.id,
          title: event.title || 'Novo Evento',
          subtitle: event.subtitle || null,
          slug,
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

export function useUpdateEvent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      eventId,
      event,
      tickets,
    }: {
      eventId: string
      event: Partial<DbEvent>
      tickets: Partial<DbTicketType>[]
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .update({
          title: event.title,
          subtitle: event.subtitle || null,
          description: event.description || null,
          short_description: event.short_description || null,
          cover_image: event.cover_image || '/images/hero-bg.jpg',
          image_url: event.image_url || '/images/hero-bg.jpg',
          category: event.category || 'Outros',
          tags: event.tags || [],
          venue_name: event.venue_name || event.location || null,
          venue_address: event.venue_address || null,
          date: event.date || null,
          time: event.time || null,
          start_date: event.start_date || new Date().toISOString(),
          end_date: event.end_date || null,
          status: event.status || 'draft',
          visibility: event.visibility || 'public',
          capacity: event.capacity || null,
          branding: event.branding || {},
          settings: event.settings || {},
        })
        .eq('id', eventId)
        .select()
        .single()

      if (eventError) throw eventError

      const { data: existingTickets } = await supabase
        .from('ticket_types')
        .select('id')
        .eq('event_id', eventId)

      const existingIds = new Set((existingTickets || []).map(t => t.id))

      const ticketsToUpsert = tickets.map((t, idx) => ({
        id: t.id && existingIds.has(t.id) ? t.id : undefined,
        event_id: eventId,
        name: t.name || `Ingresso ${idx + 1}`,
        description: t.description || null,
        price: Number(t.price) || 0,
        capacity: t.capacity ? Number(t.capacity) : null,
        quantity_total: t.capacity ? Number(t.capacity) : 0,
        type: t.type || 'individual',
        perks: t.perks || [],
        is_active: true,
        lot_number: 1,
      }))

      if (ticketsToUpsert.length > 0) {
        const { error: ticketsError } = await supabase
          .from('ticket_types')
          .upsert(ticketsToUpsert, { onConflict: 'id' })

        if (ticketsError) throw ticketsError
      }

      return eventData
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['producer-events', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['public-event', variables.eventId] })
    },
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
        .select(`*, ticket_types (*)`)

      if (isUuid) {
        query = query.eq('id', eventIdOrSlug)
      } else {
        query = query.eq('slug', eventIdOrSlug)
      }

      const { data, error } = await query.maybeSingle()

      if (error) throw error
      if (data) return normalizeEventTicketTypes(data)

      const mockEvent = MOCK_EVENTS.find(e => e.id === eventIdOrSlug || e.slug === eventIdOrSlug)
      return mockEvent || null
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
        .select(`*, ticket_types (*)`)
        .eq('status', 'published')
        .order('date', { ascending: true })

      if (error) throw error

      const realEvents = (data || []).map(normalizeEventTicketTypes)
      if (realEvents.length > 0) return realEvents

      return MOCK_EVENTS.filter(e => e.status === 'published')
    }
  })
}

export function useAdminEvents() {
  return useQuery<(DbEvent & { profiles: { full_name: string } | null })[]>({
    queryKey: ['admin-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`*, profiles (full_name), ticket_types (*)`)
        .order('created_at', { ascending: false })

      if (error) throw error

      const realEvents = (data || []).map((event: any) => normalizeEventTicketTypes(event))
      if (realEvents.length > 0) {
        return realEvents as (DbEvent & { profiles: { full_name: string } | null })[]
      }

      return MOCK_EVENTS.map(e => ({
        ...e,
        profiles: { full_name: 'Produtor Teste' }
      })) as (DbEvent & { profiles: { full_name: string } | null })[]
    }
  })
}

export interface AdminTicketType extends DbTicketType {
  event_title: string
  event_status: string
  producer_name: string | null
}

export function useAdminTickets() {
  return useQuery<AdminTicketType[]>({
    queryKey: ['admin-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_types')
        .select(`
          *,
          events (title, status, producer_id, profiles:producer_id (full_name))
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const realTickets = (data || []).map((t: any) => ({
        ...t,
        price: Number(t.price) || 0,
        perks: Array.isArray(t.perks) ? t.perks : [],
        event_title: t.events?.title || 'Evento desconhecido',
        event_status: t.events?.status || 'unknown',
        producer_name: t.events?.profiles?.full_name || null,
      })) as AdminTicketType[]

      if (realTickets.length > 0) return realTickets

      return MOCK_EVENTS.flatMap(e =>
        (e.ticket_types || []).map(t => ({
          ...t,
          event_title: e.title,
          event_status: e.status,
          producer_name: 'Produtor Teste',
        }))
      ) as AdminTicketType[]
    }
  })
}
