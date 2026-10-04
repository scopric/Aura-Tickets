import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMarkNotificationRead, useDeleteNotification } from '../hooks/useNotifications'

let linhas: { id: string }[] = []
let erro: { message: string } | null = null
const cadeia: Record<string, unknown> = {}
for (const m of ['update', 'delete', 'eq']) cadeia[m] = vi.fn(() => cadeia)
cadeia.select = vi.fn(() => Promise.resolve({ data: linhas, error: erro }))
vi.mock('../lib/supabase', () => ({ supabase: { from: () => cadeia } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
)

beforeEach(() => { linhas = []; erro = null })

describe('useNotifications: conferência de linhas afetadas', () => {
  it('marcar como lida: 0 linhas (a RLS escondeu o aviso) é erro, não sucesso', async () => {
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync('n1')).rejects.toThrow('Aviso não encontrado') })
  })

  it('marcar como lida: 1 linha é sucesso', async () => {
    linhas = [{ id: 'n1' }]
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync('n1')).resolves.toBe(true) })
  })

  it('apagar: 0 linhas é erro; erro do banco também', async () => {
    const { result } = renderHook(() => useDeleteNotification(), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync('n1')).rejects.toThrow('Aviso não encontrado') })
    erro = { message: 'permission denied' }
    await act(async () => { await expect(result.current.mutateAsync('n1')).rejects.toBeTruthy() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
