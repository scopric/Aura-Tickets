import { comTempo, definirCopia, falhaDeRede, guardarIngressos, lerIngressos } from '../lib/ingressosOffline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { isDemoAccount } from '../lib/demo'
import { useAuth } from './useAuth'
import { vendaBloqueada } from '../lib/pedido'
import { tetoPorPedido } from '../lib/lotacao'

export interface DbOrder {
  id: string
  user_id: string
  event_id: string
  total_amount: number
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' // igual ao CHECK de orders.status
  payment_method: 'credit_card' | 'pix' | 'boleto' | 'cashless'
  payment_id: string | null
  payment_split: any
  created_at: string
  updated_at: string
  events?: {
    title: string
    cover_image: string | null
    capa_na_cor?: boolean | null
    date: string | null
    time: string | null
    venue_name: string | null
    status?: string | null
  }
  // quantidade e tipo de cada item do pedido (só a lista de compras pede)
  order_items?: { quantity: number; ticket_types: { name: string } | null }[]
}

export interface DbTicket {
  id: string
  order_id: string
  event_id: string
  ticket_type_id: string
  user_id: string
  code: string
  qr_code?: string
  status: 'active' | 'used' | 'cancelled' | 'refunded' | 'transferred'
  seat_info: string | null
  buyer_name?: string | null
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
    // só a carteira (useUserTickets) preenche estes; a cor e o endereço do ingresso (V10a)
    image_url?: string | null
    accent_color?: string | null
    capa_na_cor?: boolean | null
    accent_intensity?: number | null
    end_date?: string | null
    status?: string | null
    venue_address?: string | null
    venue_city?: string | null
    venue_state?: string | null
  }
}

// Colunas lidas de orders e tickets: nunca '*' (customer_cpf, customer_phone e buyer_cpf ficam sem grant de SELECT,
// docs/sql/20261011_orders_tickets_colunas_pessoais.sql; o teste colunasPessoais.test.ts barra o '*').
const COLUNAS_PEDIDO = 'id, user_id, event_id, total, status, payment_method, gateway_payment_id, created_at, updated_at'
const COLUNAS_INGRESSO = 'id, order_id, event_id, ticket_type_id, user_id, qr_code, status, buyer_name, checked_in_at, created_at, updated_at'

// Resultado de reservar_ingressos (docs/sql/20261030a_venda_servidor_meia.sql): ok:false = recusa de regra, sem exceção
type Reserva = { ok: boolean; motivo?: string; mensagem?: string; order_id?: string; subtotal?: number; desconto?: number; taxa?: number; total?: number; reservado_ate?: string; agora?: string }

export function useCreateOrder() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      event_id,
      items,
      cupom,
      customer_cpf,
    }: {
      event_id: string
      items: { ticket_type_id: string; quantity: number; beneficio?: 'inteira' | 'meia'; meia_tipo?: string | null }[]
      cupom?: string
      customer_cpf?: string // só dígitos; vai ao banco só se algum tipo do carrinho tem limite por CPF (o servidor guarda só o hash)
    }) => {
      if (!user?.id) throw new Error('Usuário precisa estar autenticado para realizar compras')

      // Checagens antes de reservar (só para avisar cedo; o servidor confere tudo de novo). Preço de cada tipo vem do banco, pela mesma
      // fonte da página do evento (evento_publico): a RLS de ticket_types só libera evento 'aberto', e a compra também aceita 'link'.
      const { data: pub, error: pubError } = await supabase.rpc('evento_publico' as never, { p_ref: event_id } as never)
      if (pubError) throw pubError
      const r = pub as { evento?: Parameters<typeof vendaBloqueada>[0]; ingressos?: { id: string; name?: string; price: number | string | null; max_per_order?: number | null; max_por_cpf?: number | null; sale_start?: string | null; sale_end?: string | null }[] } | null
      if (!r?.evento) throw new Error('Evento indisponível para compra')
      const ingressos = r.ingressos ?? []
      for (const i of items) {
        const t = ingressos.find(x => x.id === i.ticket_type_id)
        const motivo = t && vendaBloqueada(r.evento, t)
        if (motivo) throw new Error(`${t.name ?? 'Ingresso'}: ${motivo}`)
      }
      // Máximo por pedido (soma das linhas do tipo, inteira + meia)
      for (const t of ingressos) {
        const teto = tetoPorPedido(t)
        const qtd = items.filter(i => i.ticket_type_id === t.id).reduce((n, i) => n + i.quantity, 0)
        if (qtd > teto) throw new Error(`${t.name ?? 'Ingresso'}: máximo de ${teto} por pedido`)
      }
      const exigeCpf = items.some(i => ingressos.find(t => t.id === i.ticket_type_id)?.max_por_cpf != null)

      // Uma porta só: o servidor calcula preço, meia, taxa, cupom e prazo, cria o pedido e os itens e cancela a reserva anterior da conta.
      const { data, error } = await supabase.rpc('reservar_ingressos' as never, {
        p_event_id: event_id,
        p_itens: items.map(i => ({ ticket_type_id: i.ticket_type_id, quantidade: i.quantity, beneficio: i.beneficio ?? 'inteira', ...(i.meia_tipo ? { meia_tipo: i.meia_tipo } : {}) })), // sem meia_tipo na inteira: o servidor recusa o JSON null (jsonb_typeof = 'null')
        p_cupom: cupom?.trim() || null,
        p_cpf: exigeCpf ? (customer_cpf ?? '').replace(/\D/g, '') || null : null,
      } as never)
      if (error) throw error
      const res = data as unknown as Reserva
      if (!res?.ok) throw Object.assign(new Error(res?.mensagem || 'Não foi possível reservar os ingressos.'), { motivo: res?.motivo })

      return {
        id: res.order_id!,
        total: Number(res.total) || 0,
        subtotal: Number(res.subtotal) || 0,
        desconto: Number(res.desconto) || 0,
        taxa: Number(res.taxa) || 0,
        // prazo pelo relógio do servidor: a diferença vale no relógio deste aparelho
        venceEm: Date.now() + (new Date(res.reservado_ate!).getTime() - new Date(res.agora!).getTime()),
        customer_name: user.name || user.full_name || null,
        customer_email: user.email,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-orders', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['user-tickets', user?.id] })
    }
  })
}

const MOCK_ORDERS: DbOrder[] = [
  { id: 'ord-001', user_id: 'u1s2e3r4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', event_id: 'evt-001', total_amount: 450, status: 'paid', payment_method: 'credit_card', payment_id: 'PAY-001', payment_split: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), events: { title: 'Festival de Verão 2025', cover_image: '/images/hero-bg.jpg', date: '2025-12-15', time: '18:00', venue_name: 'Parque Ibirapuera' } },
  { id: 'ord-002', user_id: 'u1s2e3r4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', event_id: 'evt-002', total_amount: 299, status: 'paid', payment_method: 'pix', payment_id: 'PAY-002', payment_split: null, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), events: { title: 'Workshop de Marketing Digital', cover_image: '/images/hero-bg.jpg', date: '2025-11-20', time: '14:00', venue_name: 'WeWork Faria Lima' } },
]

export function useUserOrders() {
  const { user } = useAuth()

  return useQuery<DbOrder[]>({
    queryKey: ['user-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      // Modo demo
      if (isDemoAccount(user.id)) {
        return MOCK_ORDERS
      }

      const { data, error } = await supabase
        .from('orders')
        .select(`
          ${COLUNAS_PEDIDO},
          events (
            title,
            cover_image,
            capa_na_cor,
            date,
            time,
            venue_name,
            status
          ),
          order_items (
            quantity,
            ticket_types ( name )
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
  { id: 'tk-001', event_id: 'evt-001', order_id: 'ord-001', ticket_type_id: 'tt-002', user_id: 'u1s2e3r4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', code: 'TK-VIP-001', status: 'active', seat_info: null, checked_in_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ticket_types: { name: 'VIP', price: 450, type: 'vip' }, events: { id: 'evt-001', title: 'Festival de Verão 2025', cover_image: '/images/hero-bg.jpg', date: '2025-12-15', time: '18:00', venue_name: 'Parque Ibirapuera' } },
  { id: 'tk-002', event_id: 'evt-001', order_id: 'ord-001', ticket_type_id: 'tt-002', user_id: 'u1s2e3r4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', code: 'TK-VIP-002', status: 'active', seat_info: null, checked_in_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ticket_types: { name: 'VIP', price: 450, type: 'vip' }, events: { id: 'evt-001', title: 'Festival de Verão 2025', cover_image: '/images/hero-bg.jpg', date: '2025-12-15', time: '18:00', venue_name: 'Parque Ibirapuera' } },
  { id: 'tk-003', event_id: 'evt-002', order_id: 'ord-002', ticket_type_id: 'tt-004', user_id: 'u1s2e3r4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', code: 'TK-WSP-001', status: 'active', seat_info: null, checked_in_at: null, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), ticket_types: { name: 'Presencial', price: 299, type: 'individual' }, events: { id: 'evt-002', title: 'Workshop de Marketing Digital', cover_image: '/images/hero-bg.jpg', date: '2025-11-20', time: '14:00', venue_name: 'WeWork Faria Lima' } },
]

export function useUserTickets() {
  const { user } = useAuth()

  return useQuery<DbTicket[]>({
    queryKey: ['user-tickets', user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      // Modo demo
      if (isDemoAccount(user.id)) {
        return MOCK_TICKETS
      }

      // Buscar ingressos do usuário e trazer dados do tipo de ingresso (ticket_types)
      // E também do evento relacionado através do ticket_types.
      const copia = lerIngressos<DbTicket>(user.id)
      const consulta = supabase
        .from('tickets')
        .select(`
          ${COLUNAS_INGRESSO},
          ticket_types (
            name,
            price,
            type,
            events (
              id,
              title,
              cover_image,
              image_url,
              accent_color,
              capa_na_cor,
              accent_intensity,
              date,
              end_date,
              status,
              time,
              venue_name,
              venue_address,
              venue_city,
              venue_state
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      // com cópia, rede pendurada (ou renovação de token em espera) não segura a tela
      const { data, error }: { data: any[] | null; error: { code?: string } | null } = copia ? await comTempo<{ data: any[] | null; error: { code?: string } | null }>(consulta, 3500, () => ({ data: null, error: { code: '' } })) : await consulta

      if (error) {
        // falha de rede (sem internet, fetch caiu, timeout): mostra a cópia da última vez que carregou (D4); erro do banco segue como erro
        if (copia && falhaDeRede(error)) { definirCopia(copia.em); return copia.ingressos }
        throw error
      }
      definirCopia(null)

      // Mapear retorno aninhado para facilitar o consumo no frontend
      const lista = (data || []).map((t: any) => ({
        ...t,
        code: t.code ?? t.qr_code,
        ticket_types: {
          name: t.ticket_types?.name,
          price: Number(t.ticket_types?.price) || 0,
          type: t.ticket_types?.type,
        },
        events: t.ticket_types?.events ?? undefined,
      })) as DbTicket[]
      guardarIngressos(user.id, lista)
      return lista
    },
    enabled: !!user?.id,
    networkMode: 'always', // offline a consulta roda mesmo assim e cai na cópia guardada
    retry: (n) => n < 2 && !(user?.id && lerIngressos(user.id)), // com cópia não insiste: cai nela já
  })
}

// O pedido é do usuário? A RLS de orders só devolve o do dono; null = não é desta conta (ou não existe)
export function useOrderVisivel(orderId?: string) {
  return useQuery<{ id: string; subtotal: number | null; service_fee: number | null; total: number | null } | null>({
    queryKey: ['order-visivel', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('id, subtotal, service_fee, total').eq('id', orderId!).maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!orderId,
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
          ${COLUNAS_INGRESSO},
          ticket_types (
            name,
            price,
            type,
            events (
              id,
              title,
              cover_image,
              capa_na_cor,
              accent_intensity,
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
        code: t.code ?? t.qr_code,
        ticket_types: {
          name: t.ticket_types?.name,
          price: Number(t.ticket_types?.price) || 0,
          type: t.ticket_types?.type,
        },
        events: t.ticket_types?.events ? {
          id: t.ticket_types.events.id,
          title: t.ticket_types.events.title,
          cover_image: t.ticket_types.events.cover_image,
          capa_na_cor: t.ticket_types.events.capa_na_cor,
          accent_intensity: t.ticket_types.events.accent_intensity,
          date: t.ticket_types.events.date,
          time: t.ticket_types.events.time,
          venue_name: t.ticket_types.events.venue_name,
        } : undefined
      })) as DbTicket[]
    },
    enabled: !!orderId,
  })
}

