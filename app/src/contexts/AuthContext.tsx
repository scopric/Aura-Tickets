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

// session_id do JWT do Supabase (claim obrigatória): o mesmo em recargas e renovações, novo a cada login.
// Ilegível → null, e o login é registrado (melhor registrar a mais que perder o registro).
function loginSessionId(accessToken: string): string | null {
  try {
    return JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id ?? null
  } catch {
    return null
  }
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
          // Sem sessão no Supabase não há o que restaurar: o token não é copiado de outro lugar. Limpa o
          // store persistido já aqui, senão ele libera a rota até o INITIAL_SESSION chegar (demo só em DEV).
          const currentSession = useAuthStore.getState().session
          if (!(import.meta.env.DEV && currentSession?.access_token?.startsWith('mock-token-'))) {
            setSession(null)
            setUser(null)
          }
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('[AuthContext] Erro ao obter sessão inicial:', err)
        setLoading(false)
      })

    // Escuta mudanças de auth para sincronização automática em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        // Depois do código do 2FA o token passa a aal2, mas o supabase-js só repassa token novo ao
        // Realtime em SIGNED_IN/TOKEN_REFRESHED: sem isto o tempo real seguiria com o aal1 e o banco
        // (regra gf_mfa_aal2) não entregaria nada até o próximo refresh (~1 h).
        if (event === 'MFA_CHALLENGE_VERIFIED' && session) supabase.realtime.setAuth(session.access_token)
        if (session) {
          // Login de verdade abre sessão NOVA no Supabase (senha, login social, retorno do provedor); recarga e
          // troca de aba reemitem SIGNED_IN da mesma sessão. Só a nova é registrada: o servidor grava
          // data/hora + IP (Marco Civil, art. 15) e, no 1º login, o aceite dos termos. A comparação usa o
          // session_id do token (guardado no store, não é credencial), que não muda com a renovação do token.
          // Fica antes da trava abaixo porque o `user` pode estar persistido de uma sessão antiga.
          setSession(session)
          const sid = loginSessionId(session.access_token)
          if (event === 'SIGNED_IN' && (!sid || sid !== useAuthStore.getState().loginSessionId)) {
            // Marca a sessão como registrada só depois do sucesso: se falhar, a próxima carga tenta de novo.
            supabase.functions.invoke('record-access', { body: { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION } })
              .then(({ error }) => {
                if (error) console.warn('[AuthContext] record-access:', error.message)
                else useAuthStore.setState({ loginSessionId: sid })
              })
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
          if (import.meta.env.DEV && currentSession?.access_token && currentSession.access_token.startsWith('mock-token-')) {
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


