import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '@/lib/supabase'

// Mock do useAuthStore para isolar o hook
// O hook também chama useAuthStore.getState() (login e logout), por isso o mock tem getState
vi.mock('../stores/authStore', () => {
  const acoes = { fetchProfile: vi.fn(() => Promise.resolve()), setSession: vi.fn(), setUser: vi.fn() }
  const useAuthStore = Object.assign(
    vi.fn(() => ({ user: null, isAuthenticated: false, isLoading: false, ...acoes })),
    { getState: () => acoes },
  )
  return { useAuthStore }
})

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
    // O login() para em 'não configurado' sem estas variáveis (e deixaria um mockResolvedValueOnce sem uso para o teste seguinte)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://teste.local')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chave-de-teste')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
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

  it('entrega a causa traduzida a quem chamou (e-mail não confirmado, erro desconhecido)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    for (const [msg, esperado] of [
      ['Email not confirmed', /Confirme seu e-mail/],
      ['Database error granting user', /Não foi possível entrar agora/],
    ] as const) {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { session: null, user: null },
        error: { message: msg } as any,
      })
      const onErro = vi.fn()
      expect(await result.current.login('a@b.com', 'x', onErro)).toBe(false)
      expect(onErro).toHaveBeenCalledWith(expect.stringMatching(esperado))
    }
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
