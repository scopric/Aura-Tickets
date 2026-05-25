import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'producer' | 'user'
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSession: (session) => set({ session }),
      setLoading: (isLoading) => set({ isLoading }),

      fetchProfile: async () => {
        set({ isLoading: true })
        const session = get().session

        // Modo demo: mock sessions (apenas em desenvolvimento)
        if (import.meta.env.DEV && session?.access_token?.startsWith('mock-token-')) {
          const role = session.access_token === 'mock-token-admin' ? 'admin' : 
                       session.access_token === 'mock-token-producer' ? 'producer' : 'user'
          const name = role === 'admin' ? 'Admin Teste' : role === 'producer' ? 'Produtor Teste' : 'Usuario Teste'
          const id = role === 'admin' ? 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' : 
                     role === 'producer' ? 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4' : 
                     'u1s2e3r4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'
          const email = role === 'admin' ? 'admin@aura.teste' : role === 'producer' ? 'produtor@aura.teste' : 'user@aura.teste'

          const mappedUser: User = {
            id,
            email,
            full_name: name,
            avatar_url: null,
            role,
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

        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (!authUser) {
          set({ user: null, session: null, isAuthenticated: false, isLoading: false })
          return
        }

        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (error || !profile) {
          console.error('Erro ao carregar perfil:', error)
          set({ isLoading: false })
          return
        }

        const mappedUser: User = {
          id: authUser.id,
          email: authUser.email || '',
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: profile.role as 'admin' | 'producer' | 'user',
          producer_profile: profile.role === 'producer' ? {
            company_name: profile.full_name || 'Minha Empresa',
            cnpj: '',
            stripe_account_id: null,
            woovi_account_id: null,
            commission_rate: 10,
            is_verified: profile.is_verified || false
          } : null
        }

        set({ user: mappedUser, isAuthenticated: true, isLoading: false })
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
