import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type MeiaBeneficio = { codigo: string; nome: string; documento: string; cota: boolean }

// Lista antiga (4 nacionais, sem texto de documento): vale se a RPC meia_beneficios ainda não existe no banco ou falha
export const BENEFICIOS_NACIONAIS: MeiaBeneficio[] = [
  { codigo: 'estudante', nome: 'Estudante', documento: '', cota: true },
  { codigo: 'pcd', nome: 'Pessoa com deficiência', documento: '', cota: true },
  { codigo: 'pcd_acompanhante', nome: 'Acompanhante de pessoa com deficiência', documento: '', cota: true },
  { codigo: 'jovem_baixa_renda', nome: 'Jovem de baixa renda', documento: '', cota: true },
]

// Categorias de meia do evento (nacionais + as da UF). Erro ou lista vazia: só os 4 nacionais, sem idoso nem estaduais.
export function useMeiaBeneficios(eventId?: string) {
  return useQuery({
    queryKey: ['meia_beneficios', eventId],
    enabled: !!eventId,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meia_beneficios' as never, { p_event_id: eventId } as never)
      return !error && Array.isArray(data) && data.length ? (data as MeiaBeneficio[]) : BENEFICIOS_NACIONAIS
    },
  })
}
