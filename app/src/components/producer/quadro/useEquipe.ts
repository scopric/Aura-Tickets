import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

export interface Pessoa { id: string; nome: string }

/** Nome para mostrar; sem nome, "Sem nome". O e-mail não entra (LGPD): é dado de outra pessoa */
export const nomeOuSemNome = (nome?: string | null) => nome?.trim() || 'Sem nome'

/**
 * Quem pode entrar num cartão: o dono da conta e a equipe ativa (team_lista, 20261029_equipe_convidar.sql).
 * A RPC só responde à conta do produtor; se falhar (ou não existir), a lista fica só com o dono e a tela segue.
 */
export function useEquipeCartao(ativo = true): Pessoa[] {
  const { user } = useAuth()
  const { data = [] } = useQuery({
    queryKey: ['equipe-cartao', user?.id],
    enabled: !!user?.id && ativo,
    staleTime: 60_000,
    queryFn: async (): Promise<Pessoa[]> => {
      const { data, error } = await supabase.rpc('team_lista' as never) // ponytail: `as never`, tipos do banco desatualizados (como em TeamManager)
      if (error) return []
      return ((data ?? []) as unknown as { user_id: string; accepted_at: string | null; blocked_at: string | null; full_name: string | null; email: string | null }[])
        .filter(m => m.user_id && m.accepted_at && !m.blocked_at)
        .map(m => ({ id: m.user_id, nome: nomeOuSemNome(m.full_name) }))
    },
  })
  if (!user?.id) return []
  return [{ id: user.id, nome: nomeOuSemNome(user.name) }, ...data.filter(p => p.id !== user.id)]
}
