import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// ─── Tasks ───
// Só as colunas reais de producer_tasks (conferido em produção em 04/10/2026); sem updated_at.
export type StatusTarefa = 'todo' | 'in_progress' | 'done'
export type PrioridadeTarefa = 'low' | 'medium' | 'high'
export interface DbTask {
  id: string
  producer_id: string
  event_id: string | null
  assigned_to: string | null
  title: string
  description: string | null
  due_date: string | null
  status: StatusTarefa
  priority: PrioridadeTarefa
  created_at: string
}
type CamposTarefa = Omit<DbTask, 'id' | 'producer_id' | 'created_at'>

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
    mutationFn: async (task: Partial<CamposTarefa>) => {
      if (!user?.id) throw new Error('Não autenticado')
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
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CamposTarefa>) => {
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
      const { data, error } = await supabase
        .from('producer_tasks')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('Nada foi apagado') // RLS que barra devolve 0 linhas sem erro
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-tasks', user?.id] })
    },
  })
}

// ─── Partners ───
// Colunas reais de public.partners (baseline); categoria, e-mail, telefone, valor, evento, entregáveis e status ainda não existem (Decisão 20, módulo M2)
export interface DbPartner {
  id: string
  producer_id: string
  type: string | null
  name: string
  contact: string | null
  logo_url: string | null
  notes: string | null
  created_at: string
}

export type PartnerInput = Pick<DbPartner, 'name' | 'type' | 'contact' | 'notes'>

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
      return (data || []) as DbPartner[]
    },
    enabled: !!user?.id,
  })
}

export function useCreatePartner() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (partner: PartnerInput) => {
      if (!user?.id) throw new Error('Não autenticado')
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
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<PartnerInput>) => {
      const { data, error } = await supabase
        .from('partners')
        .update(updates)
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('Nada foi alterado') // RLS que barra devolve 0 linhas sem erro
      return true
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
      const { data, error } = await supabase
        .from('partners')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('Nada foi apagado') // RLS que barra devolve 0 linhas sem erro
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
  event_id: string | null
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_order_value: number | null
  max_uses: number | null
  uses: number
  is_active: boolean
  valid_from: string | null
  valid_until: string | null
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
        discount_value: Number(c.discount_value) || 0,
        min_order_value: c.min_order_value == null ? null : Number(c.min_order_value),
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

/** Cupons em massa (lote e CSV): blocos de 100 pelo mesmo INSERT do produtor (RLS: producer_id e evento dele).
 *  O código é único por produtor (upper(code), SQL 20261031d; antes era global): bloco que bate num código repetido é regravado linha a linha para achar quais. */
export function useCreateCouponsBulk() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ cupons, eventId }: { cupons: Omit<Partial<DbCoupon>, 'id' | 'producer_id' | 'created_at' | 'updated_at'>[]; eventId: string | null }) => {
      if (!user?.id) throw new Error('Nao autenticado')
      const linhas = cupons.map(c => ({ ...c, producer_id: user.id, event_id: eventId, is_active: true }))
      const criados: string[] = []
      const falhas: { code: string; erro?: string }[] = []
      for (let i = 0; i < linhas.length; i += 100) {
        const bloco = linhas.slice(i, i + 100)
        const { error } = await supabase.from('coupons').insert(bloco as never)
        if (!error) { criados.push(...bloco.map(c => c.code!)); continue }
        if (error.code !== '23505') { falhas.push(...bloco.map(c => ({ code: c.code!, erro: error.code }))); continue }
        for (const c of bloco) {
          const { error: e } = await supabase.from('coupons').insert(c as never)
          if (e) falhas.push({ code: c.code!, erro: e.code }); else criados.push(c.code!)
        }
      }
      return { criados, falhas }
    },
    onSettled: () => {
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
        .update({ ...updates, updated_at: new Date().toISOString() }) // sem trigger de updated_at no banco
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
      const { data, error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('Nada foi apagado') // RLS que barra devolve 0 linhas sem erro
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
      const { data, error } = await supabase
        .from('event_banners')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('Nada foi apagado') // RLS que barra devolve 0 linhas sem erro
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
      const { data, error } = await supabase
        .from('event_photos')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('Nada foi apagado') // RLS que barra devolve 0 linhas sem erro
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
  template: unknown
  is_active: boolean
  created_at: string
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
      return (data || []) as DbCertificate[]
    },
    enabled: !!user?.id && !!eventId,
  })
}

// Emissão (B3, docs/sql/20261005_produtor_acesso.sql, DECISÕES 16): o produtor insere só (certificate_id, user_id)
// para quem tem ingresso ativo ou usado do evento; um por pessoa (23505); revogar = apagar.
// Sem e-mail: a tela não usa (minimização, LGPD)
export interface Participante {
  user_id: string
  nome: string
  checkin: boolean // algum ingresso da pessoa está 'used'
}

export function useParticipantesCertificado(eventId: string | null) {
  const { user } = useAuth()

  return useQuery<{ lista: Participante[]; cortado: boolean }>({
    queryKey: ['certificado-participantes', eventId],
    queryFn: async () => {
      // a regra "Produtores leem ingressos dos próprios eventos" deixa ler os do evento dele.
      // ponytail: cortado no max_rows (1.000) do PostgREST; o count diz se cortou e a tela avisa. Paginar ou RPC
      // quando um evento passar de 1.000 ingressos.
      const { data, error, count } = await supabase
        .from('tickets')
        .select('user_id, buyer_name, status', { count: 'exact' })
        .eq('event_id', eventId!)
        .in('status', ['active', 'used'])
      if (error) throw error
      // uma linha por pessoa: quem tem vários ingressos aparece uma vez; check-in se algum foi usado
      const porPessoa = new Map<string, Participante>()
      const linhas = (data ?? []) as unknown as { user_id: string; buyer_name: string; status: string }[]
      for (const t of linhas) {
        const p = porPessoa.get(t.user_id)
        if (p) p.checkin ||= t.status === 'used'
        else porPessoa.set(t.user_id, { user_id: t.user_id, nome: t.buyer_name, checkin: t.status === 'used' })
      }
      return {
        lista: [...porPessoa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        cortado: (count ?? 0) > linhas.length,
      }
    },
    enabled: !!user?.id && !!eventId,
  })
}

export interface CertificadoEmitido {
  id: string
  user_id: string
  issued_at: string
  /** código de validação gerado pelo banco; vai no QR e no CSV */
  code: string
  /** quando foi revogado (a linha fica, com histórico); null = ativo */
  revoked_at: string | null
}

export function useCertificadosEmitidos(certificateId: string | null) {
  const { user } = useAuth()

  return useQuery<CertificadoEmitido[]>({
    queryKey: ['certificados-emitidos', certificateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issued_certificates')
        .select('id, user_id, issued_at, code, revoked_at')
        .eq('certificate_id', certificateId!)
      if (error) throw error
      return (data ?? []) as unknown as CertificadoEmitido[]
    },
    enabled: !!user?.id && !!certificateId,
  })
}

export function useEmitirCertificados() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ certificateId, userIds }: { certificateId: string; userIds: string[] }) => {
      const { data, error } = await supabase
        .from('issued_certificates')
        // as never: types/database.ts desatualizado (pendência supabase gen types); só estas 2 colunas têm INSERT
        .insert(userIds.map(user_id => ({ certificate_id: certificateId, user_id })) as never)
        .select('id')
      if (error) throw error
      if ((data ?? []).length !== userIds.length) throw new Error('Nem todos os certificados foram emitidos')
      return data
    },
    // inserção única (tudo ou nada): se um ingresso foi cancelado depois da carga, o banco recusa o lote inteiro.
    // Sucesso ou erro, relê emitidos e participantes.
    onSettled: (_d, _e, v) => {
      queryClient.invalidateQueries({ queryKey: ['certificados-emitidos', v.certificateId] })
      queryClient.invalidateQueries({ queryKey: ['certificado-participantes'] })
    },
  })
}

export function useRevogarCertificado() {
  const queryClient = useQueryClient()

  return useMutation({
    // Revoga = marca (quando e por quem) e a linha fica; só o dono do evento, com 2FA (docs/sql/20261101b_certificado_revogar.sql)
    mutationFn: async ({ id }: { id: string; certificateId: string }) => {
      // ponytail: os tipos do banco ainda não têm a função; cast até regenerar types/database.ts
      const { error } = await supabase.rpc('certificado_revogar' as never, { p_id: id } as never)
      if (error) throw error
    },
    onSettled: (_d, _e, v) => {
      queryClient.invalidateQueries({ queryKey: ['certificados-emitidos', v.certificateId] })
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

export function useDeleteBudgetBox() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('event_budget_boxes')
        .delete()
        .eq('id', id)
        .eq('producer_id', user?.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('Nada foi apagado') // RLS que barra devolve 0 linhas sem erro
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
      // Atômico no banco: trava a linha, confere o dono e o saldo e grava o movimento (docs/sql/20261005_produtor_acesso.sql).
      // Erros 22023/23514/42501 viram texto na tela por lib/orcamento.ts.
      // ponytail: `as never` é remendo temporário (types/database.ts desatualizado)
      const { data, error } = await supabase.rpc('caixinha_movimentar' as never, {
        p_box: box_id,
        p_tipo: type,
        p_valor: amount,
        p_nota: note || null,
      } as never)

      if (error) throw error
      return Number(data) // saldo novo
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['piggy-transactions', variables.box_id] })
      queryClient.invalidateQueries({ queryKey: ['budget-boxes', user?.id] })
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
