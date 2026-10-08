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
    cnpj: string | null // vazio é null (a UNIQUE não deixa dois '')
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

// retorno de pr7_produtor_financeiro (docs/sql/20261007_pr7_cripto_rpcs.sql)
interface Financeiro { cnpj: string | null; pix_key: string | null; bank_account: Record<string, string> | null }

export function useProducerSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['producer-settings', user?.id],
    queryFn: async (): Promise<ProducerSettingsData | null> => {
      if (!user?.id) return null

      // 1. Carregar perfil base
      // meu_perfil() (docs/sql/20261018a_admin_s4b_funcoes.sql): a tabela não entrega mais telefone, cidade e bio por select
      const { data: perfil, error: profileError } = await supabase.rpc('meu_perfil' as never)

      if (profileError) throw profileError
      if (!perfil) throw new Error('Perfil não encontrado')
      const profile = perfil as unknown as ProducerSettingsData['profile']

      // 2. Carregar producer_profile: company_name/notification_settings por select; cnpj, banco e Pix só pela RPC
      // (pr7_produtor_financeiro, docs/sql/20261007_pr7_cripto_rpcs.sql): as colunas em claro não são mais lidas.
      const lerBase = () =>
        supabase
          .from('producer_profiles')
          .select('id, company_name, notification_settings')
          .eq('id', user.id)
          .single()
      let { data: base, error: producerError } = await lerBase()

      // Pode não existir ainda (PGRST116) — criamos vazio. Outro erro sobe: com pp nulo as abas abririam com
      // padrões e "Salvar" gravaria vazio por cima dos dados bancários reais.
      if (producerError && producerError.code !== 'PGRST116') throw producerError
      if (producerError) {
        // a RPC cria a linha (company_name vem do perfil); webhook_url fica NULL: não há webhook para produtores (Decisão 37)
        const { error: createError } = await supabase.rpc('pr7_salvar_produtor_financeiro' as never, {
          p_cnpj: null,
          p_pix_key: '',
          p_bank_account: {},
        } as never)
        if (createError) throw createError
        ;({ data: base, error: producerError } = await lerBase())
        if (producerError) throw producerError
      }

      const { data: fin, error: finError } = await supabase.rpc('pr7_produtor_financeiro' as never)
      if (finError) throw finError
      const f = (fin as unknown as Financeiro[] | null)?.[0]
      const pp = base
        ? {
            ...(base as unknown as { id: string; company_name: string; notification_settings: object }),
            cnpj: f?.cnpj ?? null,
            pix_key: f?.pix_key ?? null,
            bank_account: (f?.bank_account ?? {}) as NonNullable<ProducerSettingsData['producer_profile']>['bank_account'],
          }
        : null

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
        producer_profile: pp as ProducerSettingsData['producer_profile'],
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
      const { cnpj, bank_account, pix_key, ...resto } = payload ?? {}
      // cnpj, banco e Pix gravam juntos pela RPC: completa o que não veio com o valor atual
      if (cnpj !== undefined || bank_account !== undefined || pix_key !== undefined) {
        const { data: fin, error: finError } = await supabase.rpc('pr7_produtor_financeiro' as never)
        if (finError) throw finError
        const atual = (fin as unknown as Financeiro[] | null)?.[0]
        const { error } = await supabase.rpc('pr7_salvar_produtor_financeiro' as never, {
          p_cnpj: cnpj !== undefined ? cnpj : (atual?.cnpj ?? null),
          p_pix_key: pix_key !== undefined ? (pix_key ?? '') : (atual?.pix_key ?? ''),
          p_bank_account: bank_account !== undefined ? (bank_account ?? {}) : (atual?.bank_account ?? {}),
        } as never)
        if (error) throw error
      }
      if (Object.keys(resto).length) {
        const { data, error } = await supabase
          .from('producer_profiles')
          .update(resto) // a linha já existe (criada na leitura); upsert faria INSERT sem company_name e falharia (23502)
          .eq('id', user.id)
          .select('id')
        if (error) throw error
        if (!data?.length) throw new Error('Nenhuma linha atualizada') // RLS ou linha ausente: não reportar sucesso sem gravar
      }
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
