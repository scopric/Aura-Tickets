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
  const storedSession = useAuthStore((state) => state.session)

  useEffect(() => {
    console.log('[DEBUG AuthContext] Iniciando useEffect de sincronizacao de auth')
    // Sincroniza sessÃ£o ativa inicial do Supabase
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('[DEBUG AuthContext] getSession finalizado. Sessao ativa:', session)
        if (session) {
          console.log('[DEBUG AuthContext] Sessao encontrada em getSession. Buscando perfil...')
          setSession(session)
          
          const currentUser = useAuthStore.getState().user
          if (currentUser && currentUser.id === session.user.id) {
            console.log('[DEBUG AuthContext] Perfil ja presente em getSession. Bypass no fetchProfile.')
            setLoading(false)
            return
          }
          fetchProfile()
        } else {
          const activeSession = useAuthStore.getState().session
          if (activeSession?.access_token && !activeSession.access_token.startsWith('mock-token-')) {
            console.log('[DEBUG AuthContext] Sem sessao ativa, mas activeSession encontrada. Restaurando...', activeSession)
            // Se o Supabase nÃ£o tem sessÃ£o mas o Zustand tem (ex: apÃ³s reload da página),
            // restaura a sessÃ£o no Supabase client
            supabase.auth.setSession({
              access_token: activeSession.access_token,
              refresh_token: activeSession.refresh_token,
            })
              .then(() => {
                console.log('[DEBUG AuthContext] setSession resolvido. Buscando perfil...')
                fetchProfile()
              })
              .catch((err) => {
                console.error('[DEBUG AuthContext] Erro ao restaurar sessÃ£o:', err)
                setLoading(false)
              })
          } else {
            console.log('[DEBUG AuthContext] Sem sessao ativa e sem activeSession no Zustand. Finalizando loading.')
            setLoading(false)
          }
        }
      })
      .catch((err) => {
        console.error('[DEBUG AuthContext] Erro ao obter sessÃ£o inicial:', err)
        setLoading(false)
      })

    // Escuta mudanÃ§as de auth para sincronizaÃ§Ã£o automÃ¡tica em tempo real
    console.log('[DEBUG AuthContext] Registrando onAuthStateChange...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[DEBUG AuthContext] onAuthStateChange disparado. Evento:', event, 'Sessao:', session)
      try {
        if (session) {
          console.log('[DEBUG AuthContext] Sessao valida no onAuthStateChange. Buscando perfil...')
          setSession(session)
          
          const currentUser = useAuthStore.getState().user
          if (currentUser && currentUser.id === session.user.id) {
            console.log('[DEBUG AuthContext] Perfil ja ativo no store no evento', event, '. Bypass no fetchProfile.')
            setLoading(false)
            return
          }
          await fetchProfile()
        } else {
          // Se a sessao atual salva no Zustand for mock, nao devemos limpar a autenticacao
          // O Supabase real sempre disparara INITIAL_SESSION com session: null se nao houver login real
          const currentSession = useAuthStore.getState().session
          if (currentSession?.access_token && currentSession.access_token.startsWith('mock-token-')) {
            console.log('[DEBUG AuthContext] Sessao nula no onAuthStateChange recebida, mas a sessao atual no Zustand eh MOCK. Ignorando limpeza.')
            setLoading(false)
            return
          }

          console.log('[DEBUG AuthContext] Sessao nula no onAuthStateChange. Limpando auth...')
          setSession(null)
          setUser(null)
          setLoading(false)
        }
      } catch (err) {
        console.error('[DEBUG AuthContext] Erro no onAuthStateChange:', err)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile, setSession, setUser, setLoading])

  return <>{children}</>
}


