import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'producer' | 'user' | 'editor'
  admin_permissions?: string[]
  producer_profile?: ProducerProfile | null
  // dados pessoais editáveis no Perfil do participante (colunas de public.profiles)
  phone?: string | null
  city?: string | null
  bio?: string | null
  birth_date?: string | null
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

// Sessão de demonstração só em desenvolvimento: em produção um `mock-token-` gravado no
// localStorage não pode virar interface de admin/produtor (os dados já eram barrados pelo RLS).
function isMockSession(session: any): boolean {
  return import.meta.env.DEV && !!session?.access_token?.startsWith('mock-token-')
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
      },
      setLoading: (isLoading) => set({ isLoading }),


      fetchProfile: async () => {
        if (activeProfilePromise) {
          return activeProfilePromise
        }

        const runFetch = async () => {
          set({ isLoading: true })
          try {
            const session = get().session

            // Modo demo: mock sessions
            if (isMockSession(session)) {
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
                  ? ['manage_users', 'manage_events', 'manage_finance', 'manage_tickets', 'manage_feedback', 'manage_support', 'manage_settings', 'manage_newsletter', 'view_dashboard', 'view_analytics'] 
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
              set({ user: mappedUser, isAuthenticated: true, isLoading: false })
              return
            }

            let authUser: any = session?.user || null
            let authUserError: any = null

            if (!authUser) {
              // sem usuário na sessão: pede ao Supabase, com timeout para não travar a aplicação se a API estiver lenta
              try {
                const getUserPromise = supabase.auth.getUser()
                const timeoutError = new Error('Timeout ao obter usuario do Supabase')
                const result = await Promise.race([
                  getUserPromise,
                  new Promise<never>((_, reject) => setTimeout(() => reject(timeoutError), 4000))
                ]) as any
                
                authUser = result?.data?.user || null
                authUserError = result?.error || null
              } catch (timeoutErr: any) {
                console.warn('[AuthStore] supabase.auth.getUser falhou ou estourou o timeout:', timeoutErr?.message || timeoutErr)
                authUserError = timeoutErr
              }
            }
            
            if (authUserError || !authUser) {
              console.warn('[AuthStore] Usuario nao autenticado ou erro:', authUserError)
              set({ user: null, session: null, isAuthenticated: false, isLoading: false })
              return
            }

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
              console.warn('[AuthStore] Busca na tabela profiles falhou ou estourou o timeout:', profileTimeoutErr?.message || profileTimeoutErr)
              profileError = profileTimeoutErr
            }

            if (profile && profile.is_authorized === false) {
              console.warn('[AuthStore] Usuario inativo ou nao autorizado pelo admin:', authUser.id)
              set({ user: null, session: null, isAuthenticated: false, isLoading: false })
              supabase.auth.signOut().catch(() => {})
              throw new Error('Sua conta ainda não foi autorizada por um administrador. Entre em contato com o suporte.')
            }

            // Se não encontrar profile, cria um user básico com dados do authUser
            // Isso evita que o user fique null e as queries fiquem in loading infinito
            if (profileError || !profile) {
              console.warn('[AuthStore] Profile não encontrado, usando dados do authUser:', profileError?.message || profileError)
              const mappedUser: User = {
                id: authUser.id,
                email: authUser.email || '',
                full_name: authUser.user_metadata?.full_name || null,
                avatar_url: authUser.user_metadata?.avatar_url || null,
                role: 'user', // sem profile: menor privilégio (user_metadata é editável pelo próprio usuário)
                admin_permissions: [],
              }
              set({ user: mappedUser, isAuthenticated: true, isLoading: false })
              return
            }

            const mappedUser: User = {
              id: authUser.id,
              email: authUser.email || '',
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              // papel desconhecido no banco vira 'user' (evita liberar rota por papel nulo ou loops)
              role: (['admin', 'producer', 'editor', 'user'].includes(profile.role) ? profile.role : 'user') as 'admin' | 'producer' | 'user' | 'editor',
              admin_permissions: profile.admin_permissions || [],
              phone: profile.phone ?? null,
              city: profile.city ?? null,
              bio: profile.bio ?? null,
              birth_date: profile.birth_date ?? null,
              producer_profile: (profile.role === 'producer' || profile.role === 'editor') ? {
                company_name: profile.full_name || 'Minha Empresa',
                cnpj: '',
                stripe_account_id: null,
                woovi_account_id: null,
                commission_rate: 10,
                is_verified: profile.is_verified || false
              } : null
            }

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
        // dados pessoais (telefone, cidade, bio, nascimento) não ficam no localStorage: o fetchProfile de cada carregamento repõe
        user: state.user && (Object.fromEntries(Object.entries(state.user).filter(([k]) => !['phone', 'city', 'bio', 'birth_date'].includes(k))) as User),
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
