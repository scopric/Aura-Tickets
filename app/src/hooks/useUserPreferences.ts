import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface UserPreferences {
  genres: string[]
  eventTypes: string[]
  maxDistance: string
}

const DEFAULTS: UserPreferences = {
  genres: [],
  eventTypes: [],
  maxDistance: '50',
}

/**
 * Preferências do participante persistidas em `user_preferences` (1 linha por usuário).
 * Tolerante: se a tabela ainda não existir / RLS bloquear, retorna defaults sem quebrar.
 */
export function useUserPreferences() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['user-preferences', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<UserPreferences> => {
      if (!user?.id) return DEFAULTS
      const { data, error } = await supabase
        .from('user_preferences')
        .select('genres, event_types, max_distance')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error || !data) return DEFAULTS
      const row = data as any
      return {
        genres: Array.isArray(row.genres) ? row.genres : [],
        eventTypes: Array.isArray(row.event_types) ? row.event_types : [],
        maxDistance: row.max_distance != null ? String(row.max_distance) : '50',
      }
    },
  })

  const save = useMutation({
    mutationFn: async (prefs: UserPreferences) => {
      if (!user?.id) throw new Error('Usuário não autenticado')
      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: user.id,
            genres: prefs.genres,
            event_types: prefs.eventTypes,
            max_distance: Number(prefs.maxDistance) || 0,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'user_id' }
        )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-preferences', user?.id] }),
  })

  return {
    preferences: query.data ?? DEFAULTS,
    isLoading: query.isLoading,
    savePreferences: save.mutateAsync,
    isSaving: save.isPending,
  }
}
