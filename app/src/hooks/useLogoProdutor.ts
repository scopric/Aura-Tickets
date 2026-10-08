import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// A logo do produtor (producer_profiles.logo_url): lida e gravada aqui para a tela de Configurações e para a prévia do ingresso.
export function useLogoProdutor() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const chave = ['logo-produtor', user?.id]

  const logo = useQuery({
    queryKey: chave,
    enabled: !!user?.id,
    queryFn: async () => {
      // ponytail: os tipos do banco ainda não têm logo_url; cast até regenerar types/database.ts
      const { data, error } = await supabase.from('producer_profiles').select('logo_url' as never).eq('id', user!.id).maybeSingle()
      if (error) throw error
      return ((data as unknown as { logo_url: string | null } | null)?.logo_url) ?? null
    },
  })

  const gravar = useMutation({
    mutationFn: async (url: string | null) => {
      const { data, error } = await supabase.from('producer_profiles').update({ logo_url: url } as never).eq('id', user!.id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Nenhuma linha atualizada') // RLS ou perfil ausente: não reportar sucesso sem gravar
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chave }),
  })

  return { user, logo, gravar }
}

/** Mensagem para o produtor quando enviar ou gravar a logo falha. */
export function mensagemDaLogo(err: unknown): string {
  const code = (err as { code?: string })?.code
  if (code === '42501') return 'Confirme o segundo fator de novo e tente outra vez.'
  if (code === '23514') return 'Endereço da logo não aceito. Tente enviar de novo.'
  return err instanceof Error && !code ? err.message : 'Não foi possível salvar a logo.'
}
