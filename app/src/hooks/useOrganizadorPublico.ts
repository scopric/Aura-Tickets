import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface Rede { rotulo: string; url: string }

// retorno de meu_organizador_publico (docs/sql/20261007_organizador_publico.sql); null se nunca salvou. cnpj vem do cadastro (só leitura)
export interface OrganizadorPublico {
  nome_publico: string | null
  whatsapp: string | null
  instagram: string | null
  site: string | null
  email_contato: string | null
  outras_redes: Rede[] | null
  mostrar_nome: boolean
  mostrar_whatsapp: boolean
  mostrar_instagram: boolean
  mostrar_site: boolean
  mostrar_email: boolean
  mostrar_outras_redes: boolean
  cnpj: string | null
}

export type SalvarOrganizador = Omit<OrganizadorPublico, 'cnpj'>

export function useOrganizadorPublico() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const chave = ['organizador-publico', user?.id]

  const query = useQuery({
    queryKey: chave,
    queryFn: async (): Promise<OrganizadorPublico | null> => {
      const { data, error } = await supabase.rpc('meu_organizador_publico' as never)
      if (error) throw error
      return (data as unknown as OrganizadorPublico | null) ?? null
    },
    enabled: !!user?.id,
  })

  const salvar = useMutation({
    mutationFn: async (v: SalvarOrganizador) => {
      const { error } = await supabase.rpc('salvar_organizador_publico' as never, {
        p_nome_publico: v.nome_publico,
        p_whatsapp: v.whatsapp,
        p_instagram: v.instagram,
        p_site: v.site,
        p_email_contato: v.email_contato,
        p_outras_redes: v.outras_redes,
        p_mostrar_nome: v.mostrar_nome,
        p_mostrar_whatsapp: v.mostrar_whatsapp,
        p_mostrar_instagram: v.mostrar_instagram,
        p_mostrar_site: v.mostrar_site,
        p_mostrar_email: v.mostrar_email,
        p_mostrar_outras_redes: v.mostrar_outras_redes,
      } as never)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chave }),
  })

  return {
    data: query.data,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
    salvar: salvar.mutateAsync,
    salvando: salvar.isPending,
  }
}
