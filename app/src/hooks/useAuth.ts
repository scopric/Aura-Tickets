import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { toast } from 'sonner'

export interface ExtendedUser {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'producer' | 'user'
  producer_profile?: import('../stores/authStore').ProducerProfile | null
  name?: string
  avatar?: string
}

export function useAuth() {
  const queryClient = useQueryClient()
  const { user, isAuthenticated, isLoading, fetchProfile } = useAuthStore()

  const extendedUser = user ? {
    ...user,
    name: user.full_name || undefined,
    avatar: user.avatar_url || undefined,
  } as ExtendedUser : null
  const signInMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data
    },
    onSuccess: async (data) => {
      if (data.session) {
        useAuthStore.getState().setSession(data.session)
        useAuthStore.getState().setUser({
          id: data.user.id,
          email: data.user.email || '',
          full_name: data.user.user_metadata?.full_name || null,
          avatar_url: data.user.user_metadata?.avatar_url || null,
          role: (data.user.user_metadata?.role || 'user') as 'admin' | 'producer' | 'user',
        })
        await fetchProfile()
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  const signUpMutation = useMutation({
    mutationFn: async ({ email, password, userData }: any) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: userData },
      })
      if (error) throw error
      return data
    },
    onSuccess: async (data) => {
      if (data.session) {
        useAuthStore.getState().setSession(data.session)
        await fetchProfile()
      }
    }
  })

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      useAuthStore.getState().setUser(null)
      useAuthStore.getState().setSession(null)
      queryClient.clear()
      window.location.href = '/'
    },
  })

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      await signInMutation.mutateAsync({ email, password })
      return true
    } catch (error: any) {
      toast.error(error.message || 'Erro ao realizar login')
      return false
    }
  }

  const register = async (name: string, email: string, password: string, role: 'user' | 'producer' | 'admin'): Promise<boolean> => {
    try {
      const userData = {
        full_name: name,
        role: role,
      }
      const data = await signUpMutation.mutateAsync({ email, password, userData })
      
      // Workaround de segurança: se o trigger no banco não inseriu a role no profile, atualizamos
      if (data.user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role })
          .eq('id', data.user.id)
        
        if (updateError) {
          console.warn('Erro ao atualizar role no perfil:', updateError.message)
        }
      }
      return true
    } catch (error: any) {
      toast.error(error.message || 'Erro ao realizar cadastro')
      return false
    }
  }

  const logout = async () => {
    try {
      await signOutMutation.mutateAsync()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao realizar logout')
    }
  }

  return {
    user: extendedUser,
    isAuthenticated,
    isLoading: isLoading || signInMutation.isPending || signUpMutation.isPending || signOutMutation.isPending,
    role: user?.role ?? null,
    login,
    logout,
    register,
    isSigningIn: signInMutation.isPending,
  }
}
export type { User, ProducerProfile } from '../stores/authStore'
export type { Role } from '../contexts/AuthContext'
