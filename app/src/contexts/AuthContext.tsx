import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Role } from '../types/auth'

export interface UserProfile {
  id: string
  role: Role
  full_name: string | null
  avatar_url: string | null
  plan?: string
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const fetchProfile = useAuthStore((state) => state.fetchProfile)
  const setSession = useAuthStore((state) => state.setSession)
  const setUser = useAuthStore((state) => state.setUser)
  const setLoading = useAuthStore((state) => state.setLoading)

  useEffect(() => {
    // Sincroniza sessão ativa inicial do Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        fetchProfile()
      } else {
        setLoading(false)
      }
    })

    // Escuta mudanças de auth para sincronização automática em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setSession(session)
        await fetchProfile()
      } else {
        setSession(null)
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile, setSession, setUser, setLoading])

  return <>{children}</>
}


