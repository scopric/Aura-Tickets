import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('deve retornar estado inicial não autenticado', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('deve fazer login com credenciais demo', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    const success = await result.current.login('produtor@aura.teste', 'senha123')

    expect(success).toBe(true)
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.role).toBe('producer')
    })
  })

  it('deve falhar login com credenciais inválidas', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { session: null, user: null, weakPassword: null },
      error: { message: 'Invalid login credentials', name: 'AuthApiError', status: 400 } as any,
    })

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    const success = await result.current.login('errado@email.com', 'senhaerrada')

    expect(success).toBe(false)
  })

  it('deve fazer logout corretamente', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    await result.current.login('produtor@aura.teste', 'senha123')
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

    await result.current.logout()
    // Após logout, o estado deve ser limpo
    expect(localStorage.getItem('aura-auth')).toBeNull()
  })
})
