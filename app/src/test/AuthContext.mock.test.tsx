import { it, expect, vi, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { AuthProvider } from '../contexts/AuthContext'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '@/lib/supabase'

afterEach(() => vi.unstubAllEnvs())

// PR 3D: em produção, a sessão nula do Supabase limpa uma sessão "mock-token-" gravada à mão no navegador
// (antes o AuthContext a preservava e a interface de admin aparecia).
it('fora de desenvolvimento, INITIAL_SESSION nula limpa a sessão mock-token do store', async () => {
  vi.stubEnv('DEV', false)
  let onChange: ((event: string, session: null) => Promise<void> | void) | undefined
  vi.mocked(supabase.auth.onAuthStateChange).mockImplementationOnce(((fn: typeof onChange) => {
    onChange = fn
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  }) as never)
  useAuthStore.setState({ session: { access_token: 'mock-token-admin' }, user: { id: 'x', role: 'admin' }, isAuthenticated: true } as never)

  render(<AuthProvider><div /></AuthProvider>)
  await waitFor(() => expect(onChange).toBeDefined())
  await onChange!('INITIAL_SESSION', null)

  await waitFor(() => expect(useAuthStore.getState().user).toBeNull())
  expect(useAuthStore.getState().session).toBeNull()
})
