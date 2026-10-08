import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useAuthStore } from '../stores/authStore'
import { isDemoAccount } from '../lib/demo'
import { diaBR } from '../lib/visaoEvento'
import { hashConfere } from '../lib/moderacaoEvento'

// dados de exemplo só para conta de demonstração em desenvolvimento (lib/demo.ts)
const demoAtual = () => isDemoAccount(useAuthStore.getState().user?.id)

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
  inclui_bebida?: boolean // F1: ingresso com bebida alcoólica
  quantity_total?: number | null // coluna real no banco (capacity é legado)
  min_per_order?: number // mínimo por pedido (coluna real, padrão 1)
  max_per_order?: number | null // máximo por pedido (nulo: vale 10; ver tetoPorPedido)
  max_por_cpf?: number | null // limite por CPF do comprador (nulo: sem limite)
  lot_number?: number // só nos dados de exemplo; não existe no banco
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
  category: string | null // slug do formato (lib/tipoEvento.ts); eventos antigos têm texto livre
  temas?: string[]
  estilos?: string[]
  classificacao?: string | null
  local_modo?: 'presencial' | 'online' | 'hibrido' | 'a_definir'
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
  capacity: number | null
  branding: any
  settings: any
  meta_title: string | null
  meta_description: string | null
  created_at: string
  updated_at: string
  location?: string | null
  approval_status?: 'pending' | 'approved' | 'rejected'
  approved_at?: string | null
  approved_by?: string | null
  rejection_reason?: string | null
  featured_carousel?: boolean
  ingressos_alterados_em?: string | null // S8: preço, quantidade ou tipo novo de ingresso depois da aprovação (aviso ao admin)
  accent_color?: string | null // cor do evento, #rrggbb (V6a)
  capa_na_cor?: boolean | null // Decisão 173: true pinta a capa em duotone na cor do evento; senão, foto original
  accent_intensity?: number | null // 10 a 100 (%): 100 = cor cheia; ausente = 100
  ticket_types?: DbTicketType[]
}

const MOCK_EVENTS: DbEvent[] = [
  {
    id: 'evt-001',
    producer_id: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4',
    title: 'Festival de Verão 2026',
    subtitle: 'O maior festival de música ao ar livre',
    slug: 'festival-de-verao-2026',
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
    date: '2026-12-15',
    time: '18:00',
    start_date: '2026-12-15T18:00:00',
    end_date: '2026-12-16T04:00:00',
    status: 'published',
    visibility: 'public',
    capacity: 5000,
    branding: {},
    settings: {},
    meta_title: null,
    meta_description: null,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
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
    date: '2026-11-20',
    time: '14:00',
    start_date: '2026-11-20T14:00:00',
    end_date: '2026-11-20T18:00:00',
    status: 'published',
    visibility: 'public',
    capacity: 200,
    branding: {},
    settings: {},
    meta_title: null,
    meta_description: null,
    created_at: '2026-02-01T00:00:00',
    updated_at: '2026-02-01T00:00:00',
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
    date: '2026-12-10',
    time: '19:00',
    start_date: '2026-12-10T19:00:00',
    end_date: '2026-12-10T23:00:00',
    status: 'published',
    visibility: 'public',
    capacity: 100,
    branding: {},
    settings: {},
    meta_title: null,
    meta_description: null,
    created_at: '2026-03-01T00:00:00',
    updated_at: '2026-03-01T00:00:00',
    ticket_types: [
      { id: 'tt-006', event_id: 'evt-003', name: 'Entrada Geral', description: 'Acesso à noite de networking', price: 50, capacity: 100, sold: 0, type: 'individual', perks: ['Welcome drink', 'Badge personalizado'], is_active: true, lot_number: 1, sale_start: null, sale_end: null, created_at: '', updated_at: '' },
    ]
  }
]

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

          if (isDemoAccount(user.id)) return MOCK_EVENTS
          return []
        })()

        return await Promise.race([
          fetchPromise,
          new Promise<DbEvent[]>((_, reject) =>
            setTimeout(() => reject(new Error('Tempo esgotado ao buscar eventos')), 6000)
          )
        ])
      } catch (err) {
        console.error('[useProducerEvents] Erro:', err)
        // conta real: o erro sobe (a tela mostra "Tentar de novo"); lista vazia aqui virava "você não tem eventos"
        if (isDemoAccount(user?.id)) return MOCK_EVENTS
        throw err
      }
    },
    enabled: !!user?.id,
  })
}

// date, time e start_date andam juntos: início em Brasília (sem horário de verão desde 2019). A hora "20:00:00",
// como o banco devolve, vira "20:00".
const inicioEm = (date: string, time?: string | null) => `${date}T${(time || '00:00').slice(0, 5)}:00-03:00`

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
          accent_color: event.accent_color || null,
          capa_na_cor: event.capa_na_cor || undefined, // como as colunas da F1: só vai se marcada (o banco tem o padrão)
          accent_intensity: event.accent_intensity && event.accent_intensity !== 100 ? event.accent_intensity : undefined, // idem: só se != 100
          gallery: event.gallery || [],
          category: event.category || null,
          // colunas da F1: só vão preenchidas (o banco tem o padrão), assim criar não depende de elas existirem
          temas: event.temas?.length ? event.temas : undefined,
          estilos: event.estilos?.length ? event.estilos : undefined,
          classificacao: event.classificacao || undefined,
          local_modo: event.local_modo || undefined,
          tags: event.tags || [],
          venue_name: event.venue_name || event.location || null,
          venue_address: event.venue_address || null,
          venue_city: event.venue_city || null,
          venue_state: event.venue_state || null,
          venue_zip: event.venue_zip || undefined,
          date: event.date || null,
          time: event.date ? event.time || null : null, // hora sem data não existe
          // sem data, sem start_date: o banco grava a hora da criação (start_date é not null default now())
          start_date: event.date ? inicioEm(event.date, event.time) : undefined,
          end_date: event.end_date || null,
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
          is_active: t.is_active ?? true,
          inclui_bebida: !!t.inclui_bebida, // sempre booleano: em lote, chave undefined vira coluna listada e NULL (23502)
          // sem lot_number: a coluna não existe em ticket_types (Decisão 20: o código se adapta ao banco)
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

// Lista branca das colunas de events que as telas do produtor gravam (Events e o painel do evento).
export function colunasDoEvento(event: Partial<DbEvent>): Record<string, unknown> {
  // Lista branca: só grava a coluna que a tela mandou. Chave ausente não é regravada:
  // "Arquivar" manda só status e não apaga o resto; location, approval_status e afins
  // ficam de fora (moderação é do banco, F0a).
  const enviados = new Set(Object.keys(event))
  if (enviados.has('date')) ['time', 'start_date'].forEach(k => enviados.add(k)) // gravados sempre juntos
  const colunas = {
    title: event.title,
    subtitle: event.subtitle || null,
    description: event.description || null,
    short_description: event.short_description || null,
    cover_image: event.cover_image || '/images/hero-bg.jpg',
    image_url: event.image_url || '/images/hero-bg.jpg',
    accent_color: event.accent_color || null,
    capa_na_cor: event.capa_na_cor === true,
    accent_intensity: event.accent_intensity ?? 100,
    category: event.category || null,
    temas: event.temas || [],
    estilos: event.estilos || [],
    classificacao: event.classificacao || null,
    local_modo: event.local_modo || 'presencial',
    tags: event.tags || [],
    venue_name: event.venue_name || null,
    venue_address: event.venue_address || null,
    venue_city: event.venue_city || null,
    venue_state: event.venue_state || null,
    venue_zip: event.venue_zip || null,
    date: event.date || null,
    time: event.date ? event.time || null : null, // hora sem data não existe
    // sem data o start_date não é enviado: o início anterior fica (não vira "agora")
    ...(event.date ? { start_date: inicioEm(event.date, event.time) } : {}),
    end_date: event.end_date || null,
    status: event.status || 'draft',
    visibility: event.visibility || 'public',
    capacity: event.capacity || null,
    branding: event.branding || {},
    settings: event.settings || {},
  }
  return Object.fromEntries(Object.entries(colunas).filter(([k]) => enviados.has(k)))
}

// Salvamento automático do painel: só as colunas mandadas, pela mesma lista branca, sem tocar nos ingressos.
// Sem coluna nenhuma não chama o banco (update vazio). select + single: RLS que filtra devolve 0 linhas sem erro.
export async function gravarEvento(eventId: string, event: Partial<DbEvent>): Promise<void> {
  const colunas = colunasDoEvento(event)
  if (Object.keys(colunas).length === 0) return
  const { error } = await supabase.from('events').update(colunas).eq('id', eventId).select('id, updated_at').single()
  if (error) throw error
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

      const colunas = colunasDoEvento(event)

      // "Salvar ingressos" do painel manda event {}: sem coluna nenhuma não há update (o corpo vazio não é confiável)
      let eventData = null
      if (Object.keys(colunas).length > 0) {
        const { data, error: eventError } = await supabase
          .from('events')
          .update(colunas)
          .eq('id', eventId)
          .select()
          .single()
        if (eventError) throw eventError
        eventData = data
      }

      const { data: existingTickets, error: lerErro } = await supabase
        .from('ticket_types')
        .select('id')
        .eq('event_id', eventId)
      if (lerErro) throw lerErro // sem a lista, todo ingresso viraria "novo" e o insert duplicaria

      const existingIds = new Set((existingTickets || []).map(t => t.id))

      // Existente: update só dos campos editáveis, sem type nem is_active (o gatilho mesa_tipo_guard recusa trocar
      // o tipo com venda; desativado continua desativado). Novo: insert com type (só individual ou coletiva, F1) e is_active.
      const novos: Record<string, unknown>[] = []
      for (const [idx, t] of tickets.entries()) {
        const campos = {
          name: t.name || `Ingresso ${idx + 1}`,
          ...(t.description !== undefined ? { description: t.description || null } : {}),
          price: Number(t.price) || 0,
          capacity: t.capacity ? Number(t.capacity) : null,
          quantity_total: t.capacity ? Number(t.capacity) : 0,
          ...(t.perks ? { perks: t.perks } : {}),
          ...(t.inclui_bebida !== undefined ? { inclui_bebida: t.inclui_bebida } : {}),
          ...(t.sale_start !== undefined ? { sale_start: t.sale_start } : {}),
          ...(t.sale_end !== undefined ? { sale_end: t.sale_end } : {}),
          ...(t.min_per_order !== undefined ? { min_per_order: t.min_per_order } : {}),
          ...(t.max_per_order !== undefined ? { max_per_order: t.max_per_order } : {}),
          ...(t.max_por_cpf !== undefined ? { max_por_cpf: t.max_por_cpf } : {}),
        }
        if (t.id && existingIds.has(t.id)) {
          const { data, error } = await supabase
            .from('ticket_types')
            .update(campos)
            .eq('id', t.id)
            .eq('event_id', eventId)
            .select('id')
          if (error) throw error
          if (data?.length !== 1) throw new Error('Não foi possível salvar um dos ingressos') // RLS que barra devolve 0 linhas sem erro
        } else {
          novos.push({ ...campos, perks: t.perks || [], inclui_bebida: !!t.inclui_bebida, event_id: eventId, type: t.type === 'coletiva' ? 'coletiva' : 'individual', is_active: true })
        }
      }

      if (novos.length > 0) {
        const { error: ticketsError } = await supabase.from('ticket_types').insert(novos)
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
      const { data, error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('Nada foi apagado') // RLS que barra devolve 0 linhas sem erro
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-events', user?.id] })
    }
  })
}

// Ingressos válidos (ativo ou usado) por evento do produtor. ticket_types.sold não é atualizado por nada no banco;
// transferido não conta (quem recebe fica com um ingresso ativo, como no Início).
export function useVendidosPorEvento() {
  const { user } = useAuth()

  return useQuery<{ porEvento: Record<string, number>; cortado: boolean }>({
    queryKey: ['producer-vendidos', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // ponytail: traz só event_id e conta no navegador, cortado no max_rows (1.000) do PostgREST; o count diz se
      // cortou e a tela avisa. Contagem exata quando houver RPC/view de vendas (F2).
      const { data, error, count } = await supabase
        .from('tickets')
        .select('event_id, events!inner(producer_id)', { count: 'exact' })
        .eq('events.producer_id', user!.id)
        .in('status', ['active', 'used'])
      if (error) throw error
      const linhas = (data ?? []) as unknown as { event_id: string }[]
      const porEvento: Record<string, number> = {}
      for (const t of linhas) porEvento[t.event_id] = (porEvento[t.event_id] ?? 0) + 1
      return { porEvento, cortado: (count ?? 0) > linhas.length }
    },
  })
}

export function usePublicEvent(eventIdOrSlug: string | undefined) {
  return useQuery<DbEvent | null>({
    queryKey: ['public-event', eventIdOrSlug],
    queryFn: async () => {
      if (!eventIdOrSlug) return null

      // evento_publico (PR3e): uuid ou slug exato; respeita a visibilidade (Pública e Só com link abrem; o resto vem null)
      const { data, error } = await supabase.rpc('evento_publico' as never, { p_ref: eventIdOrSlug } as never)
      if (error) throw error
      const r = data as { evento?: DbEvent; ingressos?: DbTicketType[] } | null
      if (r?.evento) return normalizeEventTicketTypes({ ...r.evento, ticket_types: r.ingressos ?? [] })

      if (!demoAtual()) return null
      return MOCK_EVENTS.find(e => e.id === eventIdOrSlug || e.slug === eventIdOrSlug) || null
    },
    enabled: !!eventIdOrSlug,
  })
}

export function usePublicEvents() {
  return useQuery<DbEvent[]>({
    queryKey: ['public-events'],
    queryFn: async () => {
      const todayStr = diaBR(Date.now()) // dia de Brasília: em UTC, depois das 21h o evento de hoje sumia
      const { data, error } = await supabase
        .from('events')
        .select(`*, ticket_types (*)`)
        .eq('status', 'published')
        .eq('approval_status', 'approved')
        .eq('visibility', 'public')
        .gte('date', todayStr)
        .order('date', { ascending: true })

      if (error) throw error

      const realEvents = (data || []).map(normalizeEventTicketTypes)
      if (realEvents.length > 0 || !demoAtual()) return realEvents

      return MOCK_EVENTS.filter(e => e.status === 'published' && e.date && e.date >= todayStr)
    }
  })
}

export type AdminEvent = DbEvent & { profiles: { full_name: string | null; email: string } | null }

export function useAdminEvents() {
  return useQuery<AdminEvent[]>({
    queryKey: ['admin-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        // events tem duas FKs para profiles (producer_id e approved_by): sem o !producer_id o PostgREST devolve PGRST201
        .select(`*, profiles!producer_id (full_name, email), ticket_types (*)`)
        .order('created_at', { ascending: false })

      if (error) throw error

      const realEvents = (data || []).map((event: any) => normalizeEventTicketTypes(event))
      if (realEvents.length > 0 || !demoAtual()) {
        return realEvents as AdminEvent[]
      }

      return MOCK_EVENTS.map(e => ({
        ...e,
        profiles: { full_name: 'Produtor Teste', email: 'produtor@aura.teste' }
      })) as AdminEvent[]
    }
  })
}

// Detalhe do evento na moderação: link da transmissão (evento_privado) e último aceite do produtor (evento_aceites).
// O admin lê as duas pela RLS (manage_events); o hash é conferido aqui, no navegador.
export function useEventoModeracao(eventId: string | null) {
  return useQuery({
    queryKey: ['admin-evento-moderacao', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const [priv, ace] = await Promise.all([
        supabase.from('evento_privado' as never).select('online_url').eq('event_id', eventId!).maybeSingle(),
        supabase.from('evento_aceites' as never).select('versao, aceito_em, texto, texto_hash').eq('event_id', eventId!).order('aceito_em', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (priv.error) throw priv.error
      if (ace.error) throw ace.error
      const p = priv.data as { online_url: string | null } | null
      const a = ace.data as { versao: string; aceito_em: string; texto: string; texto_hash: string } | null
      return {
        onlineUrl: p?.online_url ?? null,
        aceite: a ? { versao: a.versao, aceitoEm: a.aceito_em, hashConfere: await hashConfere(a.texto, a.texto_hash) } : null,
      }
    },
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

      if (realTickets.length > 0 || !demoAtual()) return realTickets

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

export function useFeaturedEvents() {
  return useQuery<DbEvent[]>({
    queryKey: ['featured-events'],
    queryFn: async () => {
      try {
        const todayStr = diaBR(Date.now())
        
        // Buscamos primeiro os eventos que são destaque manual e que estão ativos e futuros
        const { data: featuredData, error: featuredError } = await supabase
          .from('events')
          .select(`*, ticket_types (*)`)
          .eq('status', 'published')
          .eq('approval_status', 'approved')
          .eq('visibility', 'public')
          .eq('featured_carousel', true)
          .gte('date', todayStr)
          .order('date', { ascending: true })

        if (featuredError) throw featuredError

        const featuredReal = (featuredData || []).map(normalizeEventTicketTypes)

        // Se já tivermos 10 ou mais, retorna os 10 primeiros
        if (featuredReal.length >= 10) {
          return featuredReal.slice(0, 10)
        }

        // Se faltar para chegar em 10, preenchemos com eventos ordenados por proximidade
        const limitRemaining = 10 - featuredReal.length
        const excludeIds = featuredReal.map(e => e.id)
        
        let query = supabase
          .from('events')
          .select(`*, ticket_types (*)`)
          .eq('status', 'published')
          .eq('approval_status', 'approved')
          .eq('visibility', 'public')
          .gte('date', todayStr)

        if (excludeIds.length > 0) {
          query = query.not('id', 'in', `(${excludeIds.join(',')})`)
        }

        const { data: fallbackData, error: fallbackError } = await query
          .order('date', { ascending: true })
          .limit(limitRemaining)

        if (fallbackError) throw fallbackError

        const fallbackReal = (fallbackData || []).map(normalizeEventTicketTypes)
        
        // Ordenamos os fallbacks pela soma de ticket_types.sold (vendidos) de forma decrescente para priorizar maior demanda
        fallbackReal.sort((a, b) => {
          const soldA = (a.ticket_types || []).reduce((sum, t) => sum + (t.sold || 0), 0)
          const soldB = (b.ticket_types || []).reduce((sum, t) => sum + (t.sold || 0), 0)
          return soldB - soldA
        })

        const combined = [...featuredReal, ...fallbackReal]
        
        if (combined.length > 0 || !demoAtual()) return combined

        // banco vazio: eventos de exemplo só para conta demo em desenvolvimento
        return MOCK_EVENTS
          .filter(e => e.status === 'published' && e.date && e.date >= todayStr)
          .slice(0, 10)
      } catch (err) {
        console.error('[useFeaturedEvents] Erro:', err)
        if (!demoAtual()) return []
        const todayStr = diaBR(Date.now())
        return MOCK_EVENTS.filter(e => e.status === 'published' && e.date && e.date >= todayStr).slice(0, 10)
      }
    }
  })
}

export function useApproveEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    // 'pending' = revogar: tira o evento do ar e o devolve à moderação. Tudo vai em UM UPDATE no banco (admin_evento_decidir).
    // updatedAt: o updated_at lido, como texto do banco (sem Date: perderia os microssegundos). Se o produtor mexeu
    // no evento depois da leitura, o banco responde P0002 e a decisão não vale sobre conteúdo que o admin não viu. Revogar não usa a versão (o banco a ignora): é a saída de emergência.
    mutationFn: async ({ eventId, status, rejectionReason, updatedAt }: { eventId: string; status: 'pending' | 'approved' | 'rejected'; rejectionReason?: string; updatedAt?: string }) => {
      const { data, error } = await supabase.rpc('admin_evento_decidir' as never, {
        p_id: eventId,
        p_decisao: status === 'approved' ? 'aprovar' : status === 'rejected' ? 'recusar' : 'revogar',
        p_motivo: status === 'rejected' ? rejectionReason || null : null,
        p_versao: updatedAt,
      } as never)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-events'] })
      queryClient.invalidateQueries({ queryKey: ['featured-events'] })
    },
    // também na falha ("o evento mudou"): a lista do admin recarrega e mostra o que o produtor mudou
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin-events'] }),
  })
}

export function useToggleFeaturedCarousel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ eventId, featured }: { eventId: string; featured: boolean }) => {
      const { data, error } = await supabase
        .from('events')
        .update({ featured_carousel: featured })
        .eq('id', eventId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] })
      queryClient.invalidateQueries({ queryKey: ['public-events'] })
      queryClient.invalidateQueries({ queryKey: ['featured-events'] })
    }
  })
}
