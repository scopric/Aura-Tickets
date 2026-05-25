import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useAuth as useNewAuth } from '../hooks/useAuth'

export type Role = 'user' | 'producer' | 'admin'

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
  const storedSession = useAuthStore((state) => state.session)

  useEffect(() => {
    // Sincroniza sessÃ£o ativa inicial do Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
        fetchProfile()
      } else if (storedSession?.access_token && !storedSession.access_token.startsWith('mock-token-')) {
        // Se o Supabase nÃ£o tem sessÃ£o mas o Zustand tem (ex: apÃ³s reload da pÃ¡gina),
        // restaura a sessÃ£o no Supabase client
        supabase.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token,
        }).then(() => fetchProfile()).catch(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Escuta mudanÃ§as de auth para sincronizaÃ§Ã£o automÃ¡tica em tempo real
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
  }, [fetchProfile, setSession, setUser, setLoading, storedSession])

  return <>{children}</>
}

export function useAuth() {
  return useNewAuth()
}
