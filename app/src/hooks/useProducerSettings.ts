import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
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
    cnpj: string | null
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
  } | null
}

export function useProducerSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading, isPending, isError, refetch, isFetching } = useQuery({
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
        .select('id, company_name, cnpj, bank_account, pix_key, notification_settings')
        .eq('id', user.id)
        .single()

      // Pode não existir ainda (PGRST116) — criamos vazio. Outro erro sobe: com pp nulo as abas abririam com
      // padrões e "Salvar" gravaria vazio por cima dos dados bancários reais.
      if (producerError && producerError.code !== 'PGRST116') throw producerError
      let pp = producerProfile
      if (producerError) {
        const { data: newPp, error: createError } = await supabase
          .from('producer_profiles')
          .insert({
            id: user.id,
            company_name: profile.full_name || 'Minha Empresa',
            cnpj: `PENDENTE-${user.id}`, // coluna NOT NULL; mesmo marcador do cadastro pelo admin
            bank_account: {},
            pix_key: '',
            notification_settings: {},
            // webhook_url fica NULL: não há webhook para produtores (Decisão 37, 27/09/2026; api_key apagada no seg-6)
          })
          .select()
          .single()
        if (createError) throw createError
        pp = newPp
      }

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
      const { data, error } = await supabase
        .from('producer_profiles')
        .update(payload) // a linha já existe (criada na leitura); upsert faria INSERT sem company_name e falharia (23502)
        .eq('id', user.id)
        .select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Nenhuma linha atualizada') // RLS ou linha ausente: não reportar sucesso sem gravar
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer-settings', user?.id] })
    },
  })

  return {
    data,
    isLoading,
    isPending,
    isError,
    refetch,
    isFetching,
    saveProfile: saveProfileMutation.mutateAsync,
    isSavingProfile: saveProfileMutation.isPending,
    saveProducerProfile: saveProducerProfileMutation.mutateAsync,
    isSavingProducerProfile: saveProducerProfileMutation.isPending,
  }
}
