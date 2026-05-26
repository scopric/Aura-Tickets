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

// Flag para forÃ§ar modo demo mesmo com Supabase configurado
const FORCE_DEMO = false

function isDemoUser(email: string, password: string) {
  const demoAccounts = [
    { email: 'produtor@aura.teste', password: 'senha123', role: 'producer' as const, name: 'Produtor Teste', id: 'd3f6ab7a-b847-4aa4-af6c-033a738c2ce4' },
    { email: 'admin@aura.teste', password: 'senha123', role: 'admin' as const, name: 'Admin Teste', id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' },
    { email: 'user@aura.teste', password: 'senha123', role: 'user' as const, name: 'Usuario Teste', id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012' },
  ]
  return demoAccounts.find(a => a.email === email && a.password === password)
}

function createMockSession(user: any) {
  return {
    access_token: `mock-token-${user.id.slice(0, 8)}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Date.now() + 3600000,
    refresh_token: 'mock-refresh',
    user,
  }
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
      // 1. Modo demo
      const demo = isDemoUser(email, password)
      if (demo || FORCE_DEMO) {
        if (demo) {
          const mockUser = {
            id: demo.id,
            email: demo.email,
            user_metadata: { full_name: demo.name, role: demo.role }
          }
          return { user: mockUser, session: createMockSession(mockUser) }
        }
      }

      // 2. Tentar login real via Supabase JS client com timeout
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rwaezeqyuhxrssntcxdv.supabase.co'
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_d6yhWhXNJnKHbALR-rdD2w_utpG-Kip'

      try {
        const signInPromise = supabase.auth.signInWithPassword({ email, password })
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout no login com Supabase')), 8000)
        )
        const { data, error } = await Promise.race([signInPromise, timeoutPromise]) as any
        if (!error && data.session) {
          return {
            user: data.user,
            session: {
              access_token: data.session.access_token,
              token_type: data.session.token_type,
              expires_in: data.session.expires_in,
              expires_at: data.session.expires_at,
              refresh_token: data.session.refresh_token,
              user: data.user,
            },
          }
        }
        if (error) {
          console.warn('[Supabase Auth Error]', error.message)
          // Se credenciais invÃ¡lidas, nÃ£o tenta fallback â€” propaga erro imediatamente
          if (error.message === 'Invalid login credentials') {
            throw new Error('E-mail ou senha incorretos.')
          }
        }
      } catch (e: any) {
        // Se jÃ¡ Ã© erro de credenciais, propaga sem tentar fallback
        if (e.message === 'E-mail ou senha incorretos.') throw e
        console.warn('[Supabase Auth Exception]', e.message || e)
      }

      // 3. Fallback: login via REST API raw fetch (usa mesma URL/key do supabase.ts)
      const url = `${supabaseUrl}/auth/v1/token?grant_type=password`
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        console.error('[Auth API Error]', resp.status, data)
        throw new Error(data.message || data.error_description || `Erro ${resp.status}`)
      }

      // Sincroniza a sessÃ£o do fallback com o cliente Supabase para queries autenticadas
      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
      }

      return {
        user: data.user,
        session: {
          access_token: data.access_token,
          token_type: data.token_type,
          expires_in: data.expires_in,
          expires_at: data.expires_at,
          refresh_token: data.refresh_token,
          user: data.user,
        },
      }
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
        await fetchProfile().catch(() => {})
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  const signUpMutation = useMutation({
    mutationFn: async ({ email, password, userData }: any) => {
      // Se forÃ§ar demo, cadastra localmente
      if (FORCE_DEMO) {
        const role = userData?.role || 'user'
        const mockUser = {
          id: `demo-${Date.now()}`,
          email,
          user_metadata: { full_name: userData?.full_name, role }
        }
        return { user: mockUser, session: createMockSession(mockUser) }
      }

      // Tentar cadastro real
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: userData },
      })
      if (error) {
        // Se for erro de usuÃ¡rio jÃ¡ existe, pode ser que estamos em modo limitado
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
          throw new Error('Este e-mail jÃ¡ estÃ¡ cadastrado. FaÃ§a login ou use outro e-mail.')
        }
        throw error
      }
      return data
    },
    onSuccess: async (data) => {
      if (data.session) {
        useAuthStore.getState().setSession(data.session)
        await fetchProfile().catch(() => {})
      }
    }
  })

  const signOutMutation = useMutation({
    mutationFn: async () => {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      } catch {
        // Silenciar erro se nÃ£o hÃ¡ sessÃ£o ativa (demo/expirada)
      }
    },
    onSuccess: () => {
      // Limpa TODAS as chaves de sessÃ£o â€” inclui localStorage do Zustand e do Supabase
      localStorage.removeItem('aura-auth')
      // Limpa todas as chaves do Supabase Auth no localStorage (sb-<ref>-auth-token etc.)
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key)
        }
      })
      // Limpa sessionStorage tambÃ©m (algumas configs do Supabase podem usar)
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('sb-')) {
          sessionStorage.removeItem(key)
        }
      })
      useAuthStore.getState().setUser(null)
      useAuthStore.getState().setSession(null)
      queryClient.clear()
      // ForÃ§a reload completo para garantir que nenhum estado persistido ressuscite
      window.location.href = '/'
    },
  })

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      await signInMutation.mutateAsync({ email, password })
      return true
    } catch (error: any) {
      console.error('[Login Error]', error)
      toast.error(error.message || 'Erro ao realizar login')
      return false
    }
  }

  const register = async (name: string, email: string, password: string, role: 'user' | 'producer' | 'admin'): Promise<boolean> => {
    try {
      const userData = { full_name: name, role }
      const data = await signUpMutation.mutateAsync({ email, password, userData })
      
      // ApÃ³s signup, se o trigger nÃ£o criou o profile com role, atualizamos
      if (data.user && !data.user.user_metadata?.role) {
        await supabase.from('users').update({ role, full_name: name }).eq('id', data.user.id).catch(() => {})
      }
      
      toast.success('Cadastro realizado! Verifique seu e-mail para confirmar.')
      return true
    } catch (error: any) {
      toast.error(error.message || 'Erro ao realizar cadastro')
      return false
    }
  }

  const logout = async () => {
    try {
      // Tentar signOut do Supabase (pode falhar se for sessao demo ou expirada)
      await signOutMutation.mutateAsync()
    } catch (error: any) {
      // Se falhar (ex: sessao demo, sessao expirada), fazer logout manual
      console.warn('[Logout] SignOut do Supabase falhou, fazendo logout manual:', error?.message)
    } finally {
      // SEMPRE limpar estado local, mesmo se o signOut do Supabase falhar
      localStorage.removeItem('aura-auth')
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key)
        }
      })
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('sb-')) {
          sessionStorage.removeItem(key)
        }
      })
      sessionStorage.removeItem('aura_pending_checkout')
      useAuthStore.getState().setUser(null)
      useAuthStore.getState().setSession(null)
      queryClient.clear()
      window.location.href = '/'
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
export type { Role } from '../types/auth'
