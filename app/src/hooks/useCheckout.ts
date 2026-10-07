import { comTempo, definirCopia, falhaDeRede, guardarIngressos, lerIngressos } from '../lib/ingressosOffline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { isDemoAccount } from '../lib/demo'
import { useAuth } from './useAuth'
import { itensDoPedido, pedidoReaproveitavel, vendaBloqueada, type Pendente } from '../lib/pedido'
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

export function useCreateOrder() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      event_id,
      items,
      payment_method,
    }: {
      event_id: string
      items: { ticket_type_id: string; quantity: number; seat_info?: string }[]
      payment_method: DbOrder['payment_method'] | null // null = pedido gratuito (sem forma de pagamento)
    }) => {
      if (!user?.id) throw new Error('Usuário precisa estar autenticado para realizar compras')

      // 0. Pedido pendente igual (mesmo evento, itens e forma de pagamento): reaproveita em vez de criar outro.
      // O cliente não tem UPDATE em orders (RLS): quem cancela o pendente anterior ao nascer o novo é o gatilho orders_um_pendente
      // (docs/sql/20261022_pedido_gratis_e_estoque.sql); o vencimento (20261021_pedidos_pendentes_expiram.sql) cancela os esquecidos.
      const { data: pendentes, error: pendError } = await supabase
        .from('orders')
        .select(`${COLUNAS_PEDIDO}, customer_name, customer_email, order_items ( ticket_type_id, quantity )`)
        .eq('user_id', user.id).eq('event_id', event_id).eq('status', 'pending')
      if (pendError) throw pendError
      // Preço de cada tipo vem do banco, pela mesma fonte da página do evento (evento_publico): a RLS de ticket_types
      // só libera evento 'aberto', e a compra também aceita 'link' (Só com link).
      const { data: pub, error: pubError } = await supabase.rpc('evento_publico' as never, { p_ref: event_id } as never)
      if (pubError) throw pubError
      const r = pub as { evento?: Parameters<typeof vendaBloqueada>[0]; ingressos?: { id: string; name?: string; price: number | string | null; max_per_order?: number | null; sale_start?: string | null; sale_end?: string | null }[] } | null
      if (!r?.evento) throw new Error('Evento indisponível para compra')
      const ingressos = r.ingressos ?? []
      for (const i of items) {
        const t = ingressos.find(x => x.id === i.ticket_type_id)
        const motivo = t && vendaBloqueada(r.evento, t)
        if (motivo) throw new Error(`${t.name ?? 'Ingresso'}: ${motivo}`)
      }
      // Máximo por pedido (soma das linhas do tipo): o banco recusa acima dele, mas só depois de o gatilho cancelar o pendente bom.
      for (const t of ingressos) {
        const teto = tetoPorPedido(t)
        const qtd = items.filter(i => i.ticket_type_id === t.id).reduce((n, i) => n + i.quantity, 0)
        if (teto !== null && qtd > teto) throw new Error(`${t.name ?? 'Ingresso'}: máximo de ${teto} por pedido`)
      }
      const precos = Object.fromEntries(ingressos.map(t => [t.id, t.price == null ? null : Number(t.price)]))
      const ped = itensDoPedido(items, precos)
      // Só reaproveita se o total recalculado com o preço atual do banco for igual ao gravado.
      // ponytail: duplo clique rápido ainda pode criar dois pedidos (sem trava nem índice único); resolvido na Fase 4 com o gateway.
      // ponytail: Fase 4 — boleto vence em dias e Pix pode ser pago após 30 min; o cron (pedidos_pendentes_expirar) terá de excluir boleto
      // ou usar o vencimento do gateway, e o webhook tratar pedido já 'cancelled'.
      const o = pedidoReaproveitavel((pendentes || []) as unknown as Pendente[], items, payment_method)
      if (o && Number(o.total) === ped.total) {
        return { ...o, total_amount: Number(o.total) || 0, payment_id: o.gateway_payment_id } as any
      }

      // 1. Criar o registro do pedido na tabela 'orders'
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          event_id,
          subtotal: ped.subtotal,
          service_fee: ped.service_fee,
          total: ped.total,
          // ponytail: sem gateway publicado, todo pedido nasce pendente — só uma confirmação
          // real de pagamento (Fase 4) deveria gravar 'paid'. O status do ticket (abaixo)
          // já deriva daqui.
          status: 'pending',
          payment_method,
          gateway_payment_id: `PAY-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          customer_name: user.name || user.full_name || null,
          customer_email: user.email
        })
        .select(`${COLUNAS_PEDIDO}, customer_name, customer_email`)
        .single()

      if (orderError) throw orderError

      // 2. Criar order_items para cada tipo de ingresso, com o preço do tipo
      const { error: orderItemsError } = await supabase
        .from('order_items')
        .insert(ped.linhas.map(l => ({ order_id: order.id, ...l })).sort((a, b) => a.ticket_type_id.localeCompare(b.ticket_type_id))) // mesma ordem de trava em todo pedido (sem impasse)

      if (orderItemsError) throw orderItemsError

      // Ingressos (tickets) não são mais criados aqui: o cliente só grava o próprio pedido
      // pendente e seus itens. Criar o ticket é ato de quem confirma o pagamento (service_role,
      // no webhook do gateway — Fase 4); dar esse INSERT ao cliente permitia gravar um ticket
      // 'active' sem pagar nada (RLS não tinha como distinguir "meu ticket" de "meu ticket já
      // pago"). Enquanto não há gateway publicado, nenhum pedido vira ingresso — correto, já
      // que nenhuma compra é real hoje.

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
          date: t.ticket_types.events.date,
          time: t.ticket_types.events.time,
          venue_name: t.ticket_types.events.venue_name,
        } : undefined
      })) as DbTicket[]
    },
    enabled: !!orderId,
  })
}

