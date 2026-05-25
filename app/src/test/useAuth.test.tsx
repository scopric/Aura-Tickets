import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '@/lib/supabase'

// Mock do useAuthStore para isolar o hook
vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    fetchProfile: vi.fn(),
    setSession: vi.fn(),
    setUser: vi.fn(),
  })),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve retornar estado inicial não autenticado', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.role).toBeNull()
  })

  it('deve fazer login com credenciais demo de produtor', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    const success = await result.current.login('produtor@aura.teste', 'senha123')

    expect(success).toBe(true)
  })

  it('deve fazer login com credenciais demo de admin', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    const success = await result.current.login('admin@aura.teste', 'senha123')

    expect(success).toBe(true)
  })

  it('deve fazer login com credenciais demo de usuário', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    const success = await result.current.login('user@aura.teste', 'senha123')

    expect(success).toBe(true)
  })

  it('deve falhar com credenciais inválidas', async () => {
    // Mock do supabase para retornar erro
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' } as any,
    })

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    const success = await result.current.login('invalido@teste.com', 'errado')

    expect(success).toBe(false)
  })

  it('deve chamar supabase.auth.signInWithPassword para login real', async () => {
    const mockSession = {
      access_token: 'real-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'refresh',
    }
    const mockUser = {
      id: 'real-user-id',
      email: 'real@usuario.com',
      user_metadata: { full_name: 'Usuario Real', role: 'user' },
    }

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { session: mockSession as any, user: mockUser as any },
      error: null,
    })

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    const success = await result.current.login('real@usuario.com', 'senha123')

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'real@usuario.com',
      password: 'senha123',
    })
    expect(success).toBe(true)
  })
})
