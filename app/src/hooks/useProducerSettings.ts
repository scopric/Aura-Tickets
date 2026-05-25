import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { useAuth } from './useAuth'

export interface ProducerSettingsData {
  profile: {
    id: string
    full_name: string | null
    email: string
    phone: string | null
    avatar_url: string | null
    bio: string | null
    city: string | null
    website: string | null
    instagram: string | null
    tiktok: string | null
    linkedin: string | null
  }
  producer_profile: {
    id: string
    company_name: string
    cnpj: string
    bank_account: {
      bankName?: string
      accountType?: string
      agency?: string
      account?: string
      holder?: string
    }
    pix_key: string | null
    notification_settings: {
      newSale?: boolean
      newMessage?: boolean
      eventReminder?: boolean
      payoutComplete?: boolean
      marketingEmails?: boolean
      pushEnabled?: boolean
      smsEnabled?: boolean
    }
    api_key: string | null
    webhook_url: string | null
  } | null
  team: Array<{
    id: string
    name: string
    email: string
    role: string
    status: 'active' | 'pending'
  }>
}

export function useProducerSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['producer-settings', user?.id],
    queryFn: async (): Promise<ProducerSettingsData | null> => {
      if (!user?.id) return null

      // 1. Carregar perfil base
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url, bio, city, website, instagram, tiktok, linkedin')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      // 2. Carregar producer_profile
      const { data: producerProfile, error: producerError } = await supabase
        .from('producer_profiles')
        .select('id, company_name, cnpj, bank_account, pix_key, notification_settings, api_key, webhook_url')
        .eq('id', user.id)
        .single()

      // Pode não existir ainda — criamos vazio
      let pp = producerProfile
      if (producerError && producerError.code === 'PGRST116') {
        const { data: newPp, error: createError } = await supabase
          .from('producer_profiles')
          .insert({
            id: user.id,
            company_name: profile.full_name || 'Minha Empresa',
            cnpj: '',
            bank_account: {},
            pix_key: '',
            notification_settings: {},
            api_key: `ak_live_${Math.random().toString(36).substring(2, 18)}`,
            webhook_url: `https://api.aura.events/webhook/producer-${user.id.substring(0, 8)}`,
          })
          .select()
          .single()
        if (!createError) pp = newPp
      }

      // 3. Carregar equipe (team_members + profiles)
      const { data: teamData, error: teamError } = await supabase
        .from('team_members')
        .select(`
          id,
          role,
          invited_at,
          accepted_at,
          user_id,
          profiles:user_id (full_name, email)
        `)
        .eq('producer_id', user.id)

      if (teamError) throw teamError

      const team = (teamData || []).map((t: any) => ({
        id: t.id,
        name: t.profiles?.full_name || t.user_id.substring(0, 8),
        email: t.profiles?.email || '',
        role: t.role.charAt(0).toUpperCase() + t.role.slice(1), // admin -> Admin
        status: t.accepted_at ? ('active' as const) : ('pending' as const),
      }))

      return {
        profile: profile || {
          id: user.id,
          full_name: '',
          email: '',
          phone: '',
          avatar_url: '',
          bio: '',
          city: '',
          website: '',
          instagram: '',
          tiktok: '',
          linkedin: '',
        },
        producer_profile: pp || null,
        team,
      }
    },
    enabled: !!user?.id,
  })

  const saveProfileMutation = useMutation({
    mutationFn: async (payload: Partial<ProducerSettingsData['profile']>) => {
      if (!user?.id) throw new Error('Usuário não autenticado')
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-settings', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  const saveProducerProfileMutation = useMutation({
    mutationFn: async (payload: Partial<ProducerSettingsData['producer_profile']>) => {
      if (!user?.id) throw new Error('Usuário não autenticado')
      const { error } = await supabase
        .from('producer_profiles')
        .upsert({ id: user.id, ...payload }, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-settings', user?.id] })
    },
  })

  const inviteTeamMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      // Verificar se o e-mail já está cadastrado
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      if (existingUser) {
        // Convidar usuário existente
        const { error } = await supabase
          .from('team_members')
          .insert({
            producer_id: user.id,
            user_id: existingUser.id,
            role: role.toLowerCase(),
          })
        if (error) throw error
      } else {
        // Criar um convite "placeholder" — na prática ideal teria um sistema de invites por email
        // Aqui criamos um registro com user_id apontando para o produtor temporariamente,
        // ou podemos simplesmente notificar que o usuário precisa se cadastrar primeiro
        throw new Error('Usuário não encontrado. Peça para ele criar uma conta primeiro.')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-settings', user?.id] })
      toast.success('Convite enviado!')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao convidar membro')
    },
  })

  const removeTeamMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-settings', user?.id] })
      toast.success('Membro removido')
    },
    onError: () => toast.error('Erro ao remover membro'),
  })

  const updateTeamRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const { error } = await supabase
        .from('team_members')
        .update({ role: role.toLowerCase() })
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-settings', user?.id] })
    },
  })

  return {
    data,
    isLoading,
    saveProfile: saveProfileMutation.mutateAsync,
    isSavingProfile: saveProfileMutation.isPending,
    saveProducerProfile: saveProducerProfileMutation.mutateAsync,
    isSavingProducerProfile: saveProducerProfileMutation.isPending,
    inviteTeamMember: inviteTeamMemberMutation.mutateAsync,
    removeTeamMember: removeTeamMemberMutation.mutateAsync,
    updateTeamRole: updateTeamRoleMutation.mutateAsync,
    isTeamActionPending: inviteTeamMemberMutation.isPending || removeTeamMemberMutation.isPending || updateTeamRoleMutation.isPending,
  }
}
