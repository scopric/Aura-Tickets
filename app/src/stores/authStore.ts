import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'producer' | 'user'
  admin_permissions?: string[]
  producer_profile?: ProducerProfile | null
}

export interface ProducerProfile {
  company_name: string
  cnpj: string
  stripe_account_id: string | null
  woovi_account_id: string | null
  commission_rate: number
  is_verified: boolean
}

interface AuthState {
  user: User | null
  session: any | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setSession: (session: any) => void
  setLoading: (loading: boolean) => void
  fetchProfile: () => Promise<void>
}

function isMockSession(session: any): boolean {
  return session?.access_token?.startsWith('mock-token-')
}

let activeProfilePromise: Promise<void> | null = null

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSession: (session) => {
        set({ session })
        // Sincroniza sessÃ£o REAL com o cliente Supabase para que as queries autenticadas funcionem
        if (session?.access_token && session?.refresh_token && !isMockSession(session)) {
          supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }).catch(() => {})
        }
      },
      setLoading: (isLoading) => set({ isLoading }),


      fetchProfile: async () => {
        if (activeProfilePromise) {
          console.log('[DEBUG AuthStore] fetchProfile ja em andamento. Reaproveitando promessa ativa.')
          return activeProfilePromise
        }

        const runFetch = async () => {
          set({ isLoading: true })
          console.log('[DEBUG AuthStore] Iniciando fetchProfile...')
          try {
            const session = get().session
            console.log('[DEBUG AuthStore] Sessao atual no store:', session)

            // Modo demo: mock sessions
            if (isMockSession(session)) {
              console.log('[DEBUG AuthStore] Sessao identificada como MOCK')
              const token = session.access_token || '';
              const isProducer = token.endsWith('producer') || token.includes('d3f6ab7a');
              const isAdmin = token.endsWith('admin') || token.includes('a1b2c3d4');
              const role = isAdmin ? 'admin' : isProducer ? 'producer' : 'user';
              
              const name = role === 'admin' ? 'Admin Teste' : role === 'producer' ? 'Produtor Teste' : 'Usuario Teste'
              const id = role === 'admin' ? 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' : 
                         role === 'producer' ? 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4' : 
                         'b2c3d4e5-f6a7-8901-bcde-f23456789012'
              const email = role === 'admin' ? 'admin@aura.teste' : role === 'producer' ? 'produtor@aura.teste' : 'user@aura.teste'

              const mappedUser: User = {
                id,
                email,
                full_name: name,
                avatar_url: null,
                role,
                admin_permissions: role === 'admin' 
                  ? ['manage_users', 'manage_events', 'manage_finance', 'manage_tickets', 'manage_feedback', 'manage_settings', 'manage_newsletter', 'view_dashboard', 'view_analytics'] 
                  : [],
                producer_profile: role === 'producer' ? {
                  company_name: name,
                  cnpj: '',
                  stripe_account_id: null,
                  woovi_account_id: null,
                  commission_rate: 10,
                  is_verified: true
                } : null
              }
              console.log('[DEBUG AuthStore] Mapeado usuario MOCK:', mappedUser)
              set({ user: mappedUser, isAuthenticated: true, isLoading: false })
              return
            }

            let authUser: any = session?.user || null
            let authUserError: any = null

            if (authUser) {
              console.log('[DEBUG AuthStore] Usando usuario obtido diretamente da sessao:', authUser.id)
            } else {
              console.log('[DEBUG AuthStore] User nao encontrado na sessao. Chamando supabase.auth.getUser()...')
              try {
                // Executa getUser com timeout de 7 segundos para evitar travar a aplicacao se a API estiver lenta/indisponivel
                const getUserPromise = supabase.auth.getUser()
                const timeoutError = new Error('Timeout ao obter usuario do Supabase')
                const result = await Promise.race([
                  getUserPromise,
                  new Promise<never>((_, reject) => setTimeout(() => reject(timeoutError), 4000))
                ]) as any
                
                authUser = result?.data?.user || null
                authUserError = result?.error || null
                console.log('[DEBUG AuthStore] Retorno getUser:', { authUser, authUserError })
              } catch (timeoutErr: any) {
                console.warn('[DEBUG AuthStore] supabase.auth.getUser falhou ou estourou o timeout:', timeoutErr?.message || timeoutErr)
                authUserError = timeoutErr
              }
            }
            
            if (authUserError || !authUser) {
              console.warn('[DEBUG AuthStore] Usuario nao autenticado ou erro:', authUserError)
              set({ user: null, session: null, isAuthenticated: false, isLoading: false })
              return
            }

            console.log('[DEBUG AuthStore] Buscando profile na tabela para UUID:', authUser.id)
            let profile: any = null
            let profileError: any = null
            try {
              // Busca o perfil com um timeout de 7 segundos para evitar travamento
              const getProfilePromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single()
              
              const timeoutError = new Error('Timeout ao buscar perfil na tabela profiles')
              const result = await Promise.race([
                getProfilePromise,
                new Promise<never>((_, reject) => setTimeout(() => reject(timeoutError), 4000))
              ]) as any
              
              profile = result?.data || null
              profileError = result?.error || null
            } catch (profileTimeoutErr: any) {
              console.warn('[DEBUG AuthStore] Busca na tabela profiles falhou ou estourou o timeout:', profileTimeoutErr?.message || profileTimeoutErr)
              profileError = profileTimeoutErr
            }
            console.log('[DEBUG AuthStore] Retorno tabela profiles:', { profile, error: profileError })

            // Se nÃ£o encontrar profile, cria um user bÃ¡sico com dados do authUser
            // Isso evita que o user fique null e as queries fiquem in loading infinito
            if (profileError || !profile) {
              console.warn('[AuthStore] Profile nÃ£o encontrado, usando dados do authUser:', profileError?.message || profileError)
              const mappedUser: User = {
                id: authUser.id,
                email: authUser.email || '',
                full_name: authUser.user_metadata?.full_name || null,
                avatar_url: authUser.user_metadata?.avatar_url || null,
                role: (authUser.user_metadata?.role || 'user') as 'admin' | 'producer' | 'user',
                admin_permissions: authUser.user_metadata?.admin_permissions || [],
              }
              console.log('[DEBUG AuthStore] mappedUser provisorio (sem profile):', mappedUser)
              set({ user: mappedUser, isAuthenticated: true, isLoading: false })
              return
            }

            const mappedUser: User = {
              id: authUser.id,
              email: authUser.email || '',
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              role: profile.role as 'admin' | 'producer' | 'user',
              admin_permissions: profile.admin_permissions || [],
              producer_profile: profile.role === 'producer' ? {
                company_name: profile.full_name || 'Minha Empresa',
                cnpj: '',
                stripe_account_id: null,
                woovi_account_id: null,
                commission_rate: 10,
                is_verified: profile.is_verified || false
              } : null
            }
            console.log('[DEBUG AuthStore] mappedUser completo (com profile):', mappedUser)

            set({ user: mappedUser, isAuthenticated: true, isLoading: false })
          } catch (err) {
            console.error('[AuthStore] Erro ao buscar perfil (fetchProfile):', err)
            set({ user: null, session: null, isAuthenticated: false, isLoading: false })
          }
        }

        activeProfilePromise = runFetch().finally(() => {
          activeProfilePromise = null
        })
        return activeProfilePromise
      },
    }),
    {
      name: 'aura-auth',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
