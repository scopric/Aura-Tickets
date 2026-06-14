import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: 'participante' | 'produtor' | 'admin'
  plan: string
  status: 'ativo' | 'bloqueado' | 'pendente'
  joinedAt: string
  events: number
  revenue: number
  lastLogin: string
  phone: string
  avatar: string
  paymentMethod: string
  planDueDate: string
  planValue: number
  totalSpent: number
  termsAccepted: string
  features: string[]
}

function mapRole(role?: string | null): AdminUser['role'] {
  if (role === 'producer') return 'produtor'
  if (role === 'admin') return 'admin'
  return 'participante'
}

const planLabels: Record<string, string> = {
  free: 'Gratuito',
  starter: 'Evokaa Starter',
  plus: 'Evokaa Plus',
  pro: 'Evokaa Pro',
  enterprise: 'Evokaa Enterprise',
}

/**
 * Lista real de usuários (tabela `profiles`) para o painel admin.
 * Tolerante a schema/RLS: tenta o join com `producer_subscriptions` e cai num
 * select simples se a relação não existir. Campos sem fonte real recebem defaults.
 */
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<AdminUser[]> => {
      let rows: any[] | null = null
      const withSub = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, is_authorized, created_at, avatar_url, producer_subscriptions(plan, is_active)')
        .order('created_at', { ascending: false })
      if (withSub.error) {
        const simple = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, role, is_authorized, created_at, avatar_url')
          .order('created_at', { ascending: false })
        if (simple.error) throw simple.error
        rows = simple.data as any[]
      } else {
        rows = withSub.data as any[]
      }

      return (rows || []).map((r) => {
        const sub = Array.isArray(r.producer_subscriptions) ? r.producer_subscriptions[0] : r.producer_subscriptions
        const planKey = sub?.plan || 'free'
        return {
          id: String(r.id),
          name: r.full_name || 'Sem nome',
          email: r.email || '',
          role: mapRole(r.role),
          plan: planLabels[planKey] || 'Gratuito',
          status: r.is_authorized === false ? 'bloqueado' : 'ativo',
          joinedAt: r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '-',
          events: 0,
          revenue: 0,
          lastLogin: '-',
          phone: r.phone || '-',
          avatar: r.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.full_name || 'U')}&background=7a3b69&color=fff`,
          paymentMethod: '-',
          planDueDate: '-',
          planValue: 0,
          totalSpent: 0,
          termsAccepted: r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '-',
          features: [],
        } as AdminUser
      })
    },
  })
}

/** Bloqueia/desbloqueia um usuário persistindo em profiles.is_authorized. */
export function useToggleUserBlock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, block }: { id: string; block: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_authorized: !block })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}
