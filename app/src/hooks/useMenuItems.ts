import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface DbMenuItem {
  id: string
  event_id: string | null
  producer_id: string
  name: string
  description: string | null
  price: number
  category: 'bebida' | 'comida' | 'combo' | 'merch' | 'servico'
  image_url: string | null
  is_available: boolean
  stock: number | null
  created_at: string
}

const MOCK_MENU_ITEMS: DbMenuItem[] = [
  { id: 'mi-001', event_id: 'evt-001', producer_id: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4', name: 'Cerveja Artesanal', description: 'IPA 500ml', price: 18, category: 'bebida', image_url: null, is_available: true, stock: 200, created_at: '' },
  { id: 'mi-002', event_id: 'evt-001', producer_id: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4', name: 'Hambúrguer Gourmet', description: 'Pão brioche, 180g de carne', price: 35, category: 'comida', image_url: null, is_available: true, stock: 150, created_at: '' },
  { id: 'mi-003', event_id: 'evt-001', producer_id: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4', name: 'Combo Festival', description: '2 cervejas + 1 hambúrguer', price: 65, category: 'combo', image_url: null, is_available: true, stock: 100, created_at: '' },
  { id: 'mi-004', event_id: 'evt-001', producer_id: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4', name: 'Camiseta Oficial', description: 'Edição limitada', price: 80, category: 'merch', image_url: null, is_available: true, stock: 50, created_at: '' },
]

export function useProducerMenuItems(eventId?: string) {
  const { user } = useAuth()

  return useQuery<DbMenuItem[]>({
    queryKey: ['producer-menu-items', user?.id, eventId],
    queryFn: async () => {
      if (!user?.id) return []

      // Modo demo
      if (user.id === 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4') {
        if (eventId) return MOCK_MENU_ITEMS.filter(i => i.event_id === eventId)
        return MOCK_MENU_ITEMS
      }

      let query = supabase
        .from('menu_items')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (eventId) {
        query = query.eq('event_id', eventId)
      }

      const { data, error } = await query

      if (error) throw error
      return (data || []).map((item: any) => ({
        ...item,
        price: Number(item.price) || 0,
      })) as DbMenuItem[]
    },
    enabled: !!user?.id,
  })
}

export function useEventMenuItems(eventId?: string) {
  return useQuery<DbMenuItem[]>({
    queryKey: ['event-menu-items', eventId],
    queryFn: async () => {
      if (!eventId) return []

      // Modo demo
      if (eventId === 'evt-001') {
        return MOCK_MENU_ITEMS.filter(i => i.event_id === eventId && i.is_available)
      }

      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_available', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((item: any) => ({
        ...item,
        price: Number(item.price) || 0,
      })) as DbMenuItem[]
    },
    enabled: !!eventId,
  })
}

export function useCreateMenuItem() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: Omit<Partial<DbMenuItem>, 'id' | 'producer_id' | 'created_at'>) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      const { data, error } = await supabase
        .from('menu_items')
        .insert({
          producer_id: user.id,
          event_id: item.event_id || null,
          name: item.name || 'Novo Item',
          description: item.description || null,
          price: Number(item.price) || 0,
          category: item.category || 'bebida',
          image_url: item.image_url || null,
          is_available: item.is_available ?? true,
          stock: item.stock ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-menu-items'] })
      queryClient.invalidateQueries({ queryKey: ['event-menu-items'] })
    },
  })
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...item }: Partial<DbMenuItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_items')
        .update({
          name: item.name,
          description: item.description,
          price: item.price !== undefined ? Number(item.price) : undefined,
          category: item.category,
          image_url: item.image_url,
          is_available: item.is_available,
          stock: item.stock,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-menu-items'] })
      queryClient.invalidateQueries({ queryKey: ['event-menu-items'] })
    },
  })
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-menu-items'] })
      queryClient.invalidateQueries({ queryKey: ['event-menu-items'] })
    },
  })
}
