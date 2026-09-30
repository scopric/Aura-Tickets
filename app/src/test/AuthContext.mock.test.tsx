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

// PR seg-3: o token real não vai para o localStorage do Zustand, e o registro de login (record-access)
// dispara só em sessão nova (session_id do JWT), não a cada recarga ou renovação do token.
it('registra login só em sessão nova e não grava o token no aura-auth', async () => {
  const jwt = (sid: string, n: number) => `h.${btoa(JSON.stringify({ session_id: sid, n }))}.s`
  const sessao = (token: string) => ({ access_token: token, refresh_token: 'r', user: { id: 'u1' } })
  let onChange: ((event: string, session: unknown) => Promise<void> | void) | undefined
  vi.mocked(supabase.auth.onAuthStateChange).mockImplementationOnce(((fn: typeof onChange) => {
    onChange = fn
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  }) as never)
  vi.mocked(supabase.functions.invoke).mockClear()
  vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: null } as never)
  useAuthStore.setState({ session: null, loginSessionId: null, user: { id: 'u1', role: 'user' }, isAuthenticated: true } as never)

  render(<AuthProvider><div /></AuthProvider>)
  await waitFor(() => expect(onChange).toBeDefined())
  await onChange!('SIGNED_IN', sessao(jwt('A', 1))) // login
  await onChange!('SIGNED_IN', sessao(jwt('A', 1))) // recarga / troca de aba
  await onChange!('SIGNED_IN', sessao(jwt('A', 2))) // token renovado, mesma sessão
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  await onChange!('SIGNED_IN', sessao(jwt('B', 1))) // login novo
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(2)

  expect(localStorage.getItem('aura-auth')).not.toContain('h.')
  expect(JSON.parse(localStorage.getItem('aura-auth')!).state.loginSessionId).toBe('B')
})
