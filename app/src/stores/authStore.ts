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
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, userData: any) => Promise<{ error: any }>
  signOut: () => Promise<void>
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

      signIn: async (email, password) => {
        set({ isLoading: true })
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        
        if (error) {
          set({ isLoading: false })
          return { error }
        }

        if (data.session) {
          set({ session: data.session })
          await get().fetchProfile()
        } else {
          set({ isLoading: false })
        }

        return { error: null }
      },

      signUp: async (email, password, userData) => {
        set({ isLoading: true })
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: userData,
          },
        })

        if (error) {
          set({ isLoading: false })
          return { error }
        }

        if (data.session) {
          set({ session: data.session })
          await get().fetchProfile()
        } else {
          set({ isLoading: false })
        }

        return { error: null }
      },

      signOut: async () => {
        set({ isLoading: true })
        await supabase.auth.signOut()
        set({ user: null, session: null, isAuthenticated: false, isLoading: false })
      },

      fetchProfile: async () => {
        set({ isLoading: true })
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (!authUser) {
          set({ user: null, session: null, isAuthenticated: false, isLoading: false })
          return
        }

        const { data: profile, error } = await supabase
          .from('profiles')
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
