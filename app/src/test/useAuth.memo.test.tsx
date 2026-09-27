import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useFeatures } from '../hooks/useFeatures'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)
const usuario = { id: 'u-1', email: 'x@y.z', full_name: 'X', avatar_url: null, role: 'producer' as const }

describe('useAuth: user memoizado (raiz do laço do Perfil e do FeatureGuard)', () => {
  it('devolve a mesma referência de user entre renders sem mudança no store', () => {
    act(() => { useAuthStore.setState({ user: usuario, isAuthenticated: true, isLoading: false }) })
    const { result, rerender } = renderHook(() => useAuth(), { wrapper })
    const primeiro = result.current.user
    rerender(); rerender()
    expect(result.current.user).toBe(primeiro)
  })

  it('useFeatures consulta o plano uma vez por usuário, não a cada render', async () => {
    act(() => { useAuthStore.setState({ user: usuario, isAuthenticated: true, isLoading: false }) })
    const from = vi.mocked(supabase.from)
    from.mockClear()
    const { rerender } = renderHook(() => useFeatures(), { wrapper })
    await act(async () => { await Promise.resolve() })
    rerender(); rerender(); rerender()
    await act(async () => { await Promise.resolve() })
    const consultasDePlano = from.mock.calls.filter(c => c[0] === 'producer_subscriptions').length
    expect(consultasDePlano).toBe(1)
  })
})
