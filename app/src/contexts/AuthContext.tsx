import { useEffect } from 'react'
import { TERMS_VERSION, PRIVACY_VERSION } from '../lib/legal'
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
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) {
          setSession(session)
          
          // Sempre relê o perfil ao carregar: o papel salvo no navegador pode estar desatualizado.
          fetchProfile()
        } else {
          const activeSession = useAuthStore.getState().session
          if (activeSession?.access_token && !activeSession.access_token.startsWith('mock-token-')) {
            // Se o Supabase não tem sessão mas o Zustand tem (ex: após reload da página),
            // restaura a sessão no Supabase client
            supabase.auth.setSession({
              access_token: activeSession.access_token,
              refresh_token: activeSession.refresh_token,
            })
              .then(() => {
                fetchProfile()
              })
              .catch((err) => {
                console.error('[AuthContext] Erro ao restaurar sessão:', err)
                setLoading(false)
              })
          } else {
            setLoading(false)
          }
        }
      })
      .catch((err) => {
        console.error('[AuthContext] Erro ao obter sessão inicial:', err)
        setLoading(false)
      })

    // Escuta mudanças de auth para sincronização automática em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session) {
          // Login de verdade traz token NOVO (senha, login social, retorno do provedor); recarga e
          // troca de aba reemitem SIGNED_IN com o token que a memória já tem. Só o novo é registrado:
          // o servidor grava data/hora + IP (Marco Civil, art. 15) e, no 1º login, o aceite dos termos.
          // Fica antes da trava abaixo porque o `user` pode estar persistido de uma sessão antiga.
          const prevToken = useAuthStore.getState().session?.access_token
          setSession(session)
          if (event === 'SIGNED_IN' && session.access_token !== prevToken) {
            supabase.functions.invoke('record-access', { body: { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION } })
              .then(({ error }) => { if (error) console.warn('[AuthContext] record-access:', error.message) })
              .catch((err) => console.warn('[AuthContext] record-access:', err))
          }

          const currentUser = useAuthStore.getState().user
          if (currentUser && currentUser.id === session.user.id) {
            setLoading(false)
            return
          }
          await fetchProfile()
        } else {
          // Se a sessao atual salva no Zustand for mock, nao devemos limpar a autenticacao
          // O Supabase real sempre disparara INITIAL_SESSION com session: null se nao houver login real
          const currentSession = useAuthStore.getState().session
          if (currentSession?.access_token && currentSession.access_token.startsWith('mock-token-')) {
            setLoading(false)
            return
          }

          setSession(null)
          setUser(null)
          setLoading(false)
        }
      } catch (err) {
        console.error('[AuthContext] Erro no onAuthStateChange:', err)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile, setSession, setUser, setLoading])

  return <>{children}</>
}


