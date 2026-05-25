import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// ─── Tasks ───
export interface DbTask {
  id: string
  producer_id: string
  title: string
  description: string | null
  category: string
  priority: 'alta' | 'media' | 'baixa'
  status: 'pendente' | 'em-andamento' | 'concluida'
  due_date: string | null
  assignee: string | null
  event_name: string | null
  tags: string[]
  subtasks: any[]
  comments: any[]
  created_at: string
  updated_at: string
}

export function useProducerTasks() {
  const { user } = useAuth()

  return useQuery<DbTask[]>({
    queryKey: ['producer-tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('producer_tasks')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as DbTask[]
    },
    enabled: !!user?.id,
  })
}

export function useCreateTask() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (task: Omit<Partial<DbTask>, 'id' | 'producer_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Nao autenticado')
      const { data, error } = await supabase
        .from('producer_tasks')
        .insert({ ...task, producer_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-tasks', user?.id] })
    },
  })
}

export function useUpdateTask() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<DbTask>) => {
      const { data, error } = await supabase
        .from('producer_tasks')
        .update(updates)
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-tasks', user?.id] })
    },
  })
}

export function useDeleteTask() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('producer_tasks')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-tasks', user?.id] })
    },
  })
}

// ─── Partners ───
export interface DbPartner {
  id: string
  producer_id: string
  type: 'patrocinador' | 'fornecedor'
  name: string
  contact: string | null
  email: string | null
  phone: string | null
  category: string | null
  value: number
  status: 'confirmado' | 'pendente' | 'cancelado'
  event_name: string | null
  notes: string | null
  contract_url: string | null
  deliverables: string | null
  created_at: string
  updated_at: string
}

export function useProducerPartners() {
  const { user } = useAuth()

  return useQuery<DbPartner[]>({
    queryKey: ['producer-partners', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((p: any) => ({ ...p, value: Number(p.value) || 0 })) as DbPartner[]
    },
    enabled: !!user?.id,
  })
}

export function useCreatePartner() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (partner: Omit<Partial<DbPartner>, 'id' | 'producer_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Nao autenticado')
      const { data, error } = await supabase
        .from('partners')
        .insert({ ...partner, producer_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-partners', user?.id] })
    },
  })
}

export function useUpdatePartner() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<DbPartner>) => {
      const { data, error } = await supabase
        .from('partners')
        .update(updates)
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-partners', user?.id] })
    },
  })
}

export function useDeletePartner() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-partners', user?.id] })
    },
  })
}

// ─── Coupons ───
export interface DbCoupon {
  id: string
  producer_id: string
  code: string
  type: 'percent' | 'fixed'
  value: number
  min_purchase: number
  max_uses: number
  used: number
  status: 'ativo' | 'expirado' | 'esgotado' | 'desativado'
  event_name: string | null
  start_date: string | null
  end_date: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export function useProducerCoupons() {
  const { user } = useAuth()

  return useQuery<DbCoupon[]>({
    queryKey: ['producer-coupons', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((c: any) => ({
        ...c,
        value: Number(c.value) || 0,
        min_purchase: Number(c.min_purchase) || 0,
      })) as DbCoupon[]
    },
    enabled: !!user?.id,
  })
}

export function useCreateCoupon() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (coupon: Omit<Partial<DbCoupon>, 'id' | 'producer_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Nao autenticado')
      const { data, error } = await supabase
        .from('coupons')
        .insert({ ...coupon, producer_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-coupons', user?.id] })
    },
  })
}

export function useUpdateCoupon() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<DbCoupon>) => {
      const { data, error } = await supabase
        .from('coupons')
        .update(updates)
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-coupons', user?.id] })
    },
  })
}

export function useDeleteCoupon() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-coupons', user?.id] })
    },
  })
}

// ─── Timeline ───
export interface DbTimelineItem {
  id: string
  producer_id: string
  event_id: string | null
  time: string
  title: string
  description: string | null
  type: 'soundcheck' | 'abertura' | 'show' | 'comida' | 'transporte' | 'decoracao' | 'vip' | 'encerramento'
  responsible: string | null
  status: 'concluido' | 'atual' | 'futuro'
  duration: string | null
  location: string | null
  created_at: string
  updated_at: string
}

export function useEventTimeline(eventId: string | null) {
  const { user } = useAuth()

  return useQuery<DbTimelineItem[]>({
    queryKey: ['event-timeline', eventId],
    queryFn: async () => {
      if (!user?.id || !eventId) return []
      const { data, error } = await supabase
        .from('event_timeline_items')
        .select('*')
        .eq('producer_id', user.id)
        .eq('event_id', eventId)
        .order('time', { ascending: true })

      if (error) throw error
      return (data || []) as DbTimelineItem[]
    },
    enabled: !!user?.id && !!eventId,
  })
}

export function useCreateTimelineItem() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (item: Omit<Partial<DbTimelineItem>, 'id' | 'producer_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Nao autenticado')
      const { data, error } = await supabase
        .from('event_timeline_items')
        .insert({ ...item, producer_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-timeline', variables.event_id] })
    },
  })
}

export function useUpdateTimelineItem() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, event_id, ...updates }: { id: string; event_id?: string | null } & Partial<DbTimelineItem>) => {
      const { data, error } = await supabase
        .from('event_timeline_items')
        .update(updates)
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-timeline', variables.event_id] })
    },
  })
}

export function useDeleteTimelineItem() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, event_id }: { id: string; event_id: string | null }) => {
      const { error } = await supabase
        .from('event_timeline_items')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)

      if (error) throw error
      return true
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-timeline', variables.event_id] })
    },
  })
}

// ─── Leads / Lista de Interesse ───
export interface DbLead {
  id: string
  producer_id: string
  full_name: string
  email: string | null
  phone: string | null
  city: string | null
  source: string
  notified: boolean
  notified_at: string | null
  event_interest: string | null
  created_at: string
}

export function useProducerLeads() {
  const { user } = useAuth()

  return useQuery<DbLead[]>({
    queryKey: ['producer-leads', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('crm_leads')
        .select('id, producer_id, full_name, email, phone, city, source, notified, notified_at, event_interest, created_at')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as DbLead[]
    },
    enabled: !!user?.id,
  })
}

export function useNotifyLead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('crm_leads')
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-leads', user?.id] })
    },
  })
}

export function useNotifyAllLeads() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('crm_leads')
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq('producer_id', user?.id)
        .eq('notified', false)
        .select()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-leads', user?.id] })
    },
  })
}

export function useDeleteLead() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_leads')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-leads', user?.id] })
    },
  })
}

// ─── Banners ───
export interface DbBanner {
  id: string
  producer_id: string
  event_name: string | null
  name: string
  image_url: string | null
  position: 'hero' | 'top' | 'inline'
  active: boolean
  clicks: number
  created_at: string
  updated_at: string
}

export function useEventBanners() {
  const { user } = useAuth()

  return useQuery<DbBanner[]>({
    queryKey: ['event-banners', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('event_banners')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((b: any) => ({ ...b, clicks: Number(b.clicks) || 0 })) as DbBanner[]
    },
    enabled: !!user?.id,
  })
}

export function useCreateBanner() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (banner: Omit<Partial<DbBanner>, 'id' | 'producer_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Nao autenticado')
      const { data, error } = await supabase
        .from('event_banners')
        .insert({ ...banner, producer_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-banners', user?.id] })
    },
  })
}

export function useUpdateBanner() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<DbBanner>) => {
      const { data, error } = await supabase
        .from('event_banners')
        .update(updates)
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-banners', user?.id] })
    },
  })
}

export function useDeleteBanner() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('event_banners')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-banners', user?.id] })
    },
  })
}

// ─── Gallery Photos ───
export interface DbPhoto {
  id: string
  producer_id: string
  event_name: string | null
  url: string
  caption: string | null
  likes: number
  comments: number
  featured: boolean
  size: string | null
  created_at: string
  updated_at: string
}

export function useEventPhotos() {
  const { user } = useAuth()

  return useQuery<DbPhoto[]>({
    queryKey: ['event-photos', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('event_photos')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((p: any) => ({ ...p, likes: Number(p.likes) || 0, comments: Number(p.comments) || 0 })) as DbPhoto[]
    },
    enabled: !!user?.id,
  })
}

export function useCreatePhoto() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (photo: Omit<Partial<DbPhoto>, 'id' | 'producer_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Nao autenticado')
      const { data, error } = await supabase
        .from('event_photos')
        .insert({ ...photo, producer_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-photos', user?.id] })
    },
  })
}

export function useUpdatePhoto() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<DbPhoto>) => {
      const { data, error } = await supabase
        .from('event_photos')
        .update(updates)
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-photos', user?.id] })
    },
  })
}

export function useDeletePhoto() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('event_photos')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-photos', user?.id] })
    },
  })
}

// ─── Surveys / NPS ───
export interface DbSurvey {
  id: string
  event_id: string
  participant_email: string
  score: number
  comment: string | null
  zone: string | null
  created_at: string
}

export function useEventSurveys(eventId: string | null) {
  const { user } = useAuth()

  return useQuery<DbSurvey[]>({
    queryKey: ['event-surveys', eventId],
    queryFn: async () => {
      if (!user?.id || !eventId) return []
      const { data, error } = await supabase
        .from('event_surveys')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((s: any) => ({ ...s, score: Number(s.score) || 0 })) as DbSurvey[]
    },
    enabled: !!user?.id && !!eventId,
  })
}

// ─── Event Zones ───
export interface DbZone {
  id: string
  event_id: string
  name: string
  avg_time_minutes: number
  satisfaction_score: number
  expected_visitors: number
  created_at: string
}

export function useEventZones(eventId: string | null) {
  const { user } = useAuth()

  return useQuery<DbZone[]>({
    queryKey: ['event-zones', eventId],
    queryFn: async () => {
      if (!user?.id || !eventId) return []
      const { data, error } = await supabase
        .from('event_zones')
        .select('*')
        .eq('event_id', eventId)
        .order('name', { ascending: true })

      if (error) throw error
      return (data || []).map((z: any) => ({ ...z, avg_time_minutes: Number(z.avg_time_minutes) || 0, satisfaction_score: Number(z.satisfaction_score) || 0, expected_visitors: Number(z.expected_visitors) || 0 })) as DbZone[]
    },
    enabled: !!user?.id && !!eventId,
  })
}

// ─── Certificates ───
export interface DbCertificate {
  id: string
  event_id: string
  ticket_id: string | null
  participant_name: string
  participant_email: string | null
  hours: number
  issued: boolean
  issue_date: string | null
  template_id: string | null
  created_at: string
  updated_at: string
}

export function useEventCertificates(eventId: string | null) {
  const { user } = useAuth()

  return useQuery<DbCertificate[]>({
    queryKey: ['event-certificates', eventId],
    queryFn: async () => {
      if (!user?.id || !eventId) return []
      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((c: any) => ({ ...c, hours: Number(c.hours) || 0 })) as DbCertificate[]
    },
    enabled: !!user?.id && !!eventId,
  })
}

export function useIssueCertificate() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, event_id }: { id: string; event_id: string }) => {
      const { data, error } = await supabase
        .from('certificates')
        .update({ issued: true, issue_date: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-certificates', variables.event_id] })
    },
  })
}

export function useBulkIssueCertificates() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ event_id, ids }: { event_id: string; ids: string[] }) => {
      const { data, error } = await supabase
        .from('certificates')
        .update({ issued: true, issue_date: new Date().toISOString() })
        .in('id', ids)
        .eq('event_id', event_id)
        .select()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-certificates', variables.event_id] })
    },
  })
}

// ─── Budget Boxes / PiggyBank ───
export interface DbBudgetBox {
  id: string
  producer_id: string
  event_id: string | null
  name: string
  target: number
  saved: number
  category: string
  notes: string | null
  created_at: string
  updated_at: string
}

export function useBudgetBoxes() {
  const { user } = useAuth()

  return useQuery<DbBudgetBox[]>({
    queryKey: ['budget-boxes', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('event_budget_boxes')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((b: any) => ({ ...b, target: Number(b.target) || 0, saved: Number(b.saved) || 0 })) as DbBudgetBox[]
    },
    enabled: !!user?.id,
  })
}

export function useCreateBudgetBox() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (box: Omit<Partial<DbBudgetBox>, 'id' | 'producer_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Nao autenticado')
      const { data, error } = await supabase
        .from('event_budget_boxes')
        .insert({ ...box, producer_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-boxes', user?.id] })
    },
  })
}

export function useUpdateBudgetBox() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<DbBudgetBox>) => {
      const { data, error } = await supabase
        .from('event_budget_boxes')
        .update(updates)
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-boxes', user?.id] })
    },
  })
}

export function useDeleteBudgetBox() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('event_budget_boxes')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-boxes', user?.id] })
    },
  })
}

// Piggy Transactions
export interface DbPiggyTransaction {
  id: string
  box_id: string
  type: 'deposit' | 'withdraw'
  amount: number
  note: string | null
  created_at: string
}

export function usePiggyTransactions(boxId: string | null) {
  const { user } = useAuth()

  return useQuery<DbPiggyTransaction[]>({
    queryKey: ['piggy-transactions', boxId],
    queryFn: async () => {
      if (!user?.id || !boxId) return []
      const { data, error } = await supabase
        .from('piggy_transactions')
        .select('*')
        .eq('box_id', boxId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((t: any) => ({ ...t, amount: Number(t.amount) || 0 })) as DbPiggyTransaction[]
    },
    enabled: !!user?.id && !!boxId,
  })
}

export function useCreatePiggyTransaction() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ box_id, type, amount, note }: { box_id: string; type: 'deposit' | 'withdraw'; amount: number; note?: string }) => {
      if (!user?.id) throw new Error('Nao autenticado')

      const { data: tx, error: txError } = await supabase
        .from('piggy_transactions')
        .insert({ box_id, type, amount, note: note || null })
        .select()
        .single()

      if (txError) throw txError

      // Update box saved amount
      const { data: box } = await supabase
        .from('event_budget_boxes')
        .select('saved')
        .eq('id', box_id)
        .single()

      const currentSaved = Number(box?.saved) || 0
      const newSaved = type === 'deposit' ? currentSaved + amount : currentSaved - amount

      const { error: updateError } = await supabase
        .from('event_budget_boxes')
        .update({ saved: newSaved })
        .eq('id', box_id)

      if (updateError) throw updateError

      return tx
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['piggy-transactions', variables.box_id] })
      queryClient.invalidateQueries({ queryKey: ['budget-boxes', user?.id] })
    },
  })
}

// ─── Revenue Advances ───
export interface DbRevenueAdvance {
  id: string
  producer_id: string
  event_id: string
  amount: number
  fee_pct: number
  fee_amount: number
  iof_amount: number
  net_amount: number
  days: number
  status: 'requested' | 'approved' | 'transferred' | 'reconciled' | 'rejected'
  requested_at: string
  transferred_at: string | null
  created_at: string
  updated_at: string
}

export function useRevenueAdvances() {
  const { user } = useAuth()

  return useQuery<DbRevenueAdvance[]>({
    queryKey: ['revenue-advances', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('revenue_advances')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map((a: any) => ({
        ...a,
        amount: Number(a.amount) || 0,
        fee_pct: Number(a.fee_pct) || 0,
        fee_amount: Number(a.fee_amount) || 0,
        iof_amount: Number(a.iof_amount) || 0,
        net_amount: Number(a.net_amount) || 0,
      })) as DbRevenueAdvance[]
    },
    enabled: !!user?.id,
  })
}

export function useRequestAdvance() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (advance: Omit<Partial<DbRevenueAdvance>, 'id' | 'producer_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Nao autenticado')
      const { data, error } = await supabase
        .from('revenue_advances')
        .insert({ ...advance, producer_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-advances', user?.id] })
    },
  })
}

// ─── Academy Courses ───
export interface DbCourse {
  id: string
  title: string
  description: string | null
  instructor: string | null
  duration: string | null
  lessons: number
  level: 'iniciante' | 'intermediario' | 'avancado'
  category: string | null
  students: number
  rating: number
  locked: boolean
  created_at: string
}

export interface DbCourseProgress {
  id: string
  user_id: string
  course_id: string
  progress: number
  completed: boolean
  created_at: string
  updated_at: string
}

export function useAcademyCourses() {
  return useQuery<DbCourse[]>({
    queryKey: ['academy-courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academy_courses')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []).map((c: any) => ({ ...c, students: Number(c.students) || 0, rating: Number(c.rating) || 0, lessons: Number(c.lessons) || 0 })) as DbCourse[]
    },
  })
}

export function useMyCourseProgress() {
  const { user } = useAuth()

  return useQuery<DbCourseProgress[]>({
    queryKey: ['my-course-progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('user_course_progress')
        .select('*')
        .eq('user_id', user.id)

      if (error) throw error
      return (data || []).map((p: any) => ({ ...p, progress: Number(p.progress) || 0 })) as DbCourseProgress[]
    },
    enabled: !!user?.id,
  })
}

export function useEnrollCourse() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (courseId: string) => {
      if (!user?.id) throw new Error('Nao autenticado')
      const { data, error } = await supabase
        .from('user_course_progress')
        .insert({ user_id: user.id, course_id: courseId, progress: 5, completed: false })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-course-progress', user?.id] })
    },
  })
}

export function useUpdateCourseProgress() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ courseId, progress, completed }: { courseId: string; progress: number; completed?: boolean }) => {
      if (!user?.id) throw new Error('Nao autenticado')
      const { data, error } = await supabase
        .from('user_course_progress')
        .update({ progress, completed: completed ?? (progress >= 100), updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-course-progress', user?.id] })
    },
  })
}
