import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// retorno de organizador_publico (docs/sql/20261007_organizador_publico.sql): só os campos que o produtor deixou públicos
export interface OrganizadorDoEvento {
  nome?: string
  razao_social?: string
  cnpj?: string
  whatsapp?: string
  instagram?: string
  site?: string
  email?: string
  outras_redes?: { rotulo: string; url: string }[]
  // Campos da vitrine nova: a RPC ainda não os devolve (em produção ficam ausentes). O componente valida tudo de novo.
  bio?: string
  eventos_realizados?: number
  desde?: number
  outros_eventos?: { id: string; title: string; date?: string | null; time?: string | null; cover_image?: string | null; image_url?: string | null; accent_color?: string | null }[]
}

// Página pública do evento: null = não mostrar bloco algum
export function useOrganizadorDoEvento(eventId: string) {
  return useQuery({
    queryKey: ['organizador-publico-evento', eventId],
    queryFn: async (): Promise<OrganizadorDoEvento | null> => {
      const { data, error } = await supabase.rpc('organizador_publico' as never, { p_evento: eventId } as never)
      if (error) throw error
      return (data as unknown as OrganizadorDoEvento | null) ?? null
    },
    staleTime: 60_000,
    retry: false,
  })
}
