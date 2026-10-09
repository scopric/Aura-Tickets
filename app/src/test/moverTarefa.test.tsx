import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { useMoverTarefa, type DbTask } from '../hooks/useProducerTools'

// producer_tasks simulada: update().eq('id').eq('producer_id').eq('updated_at').select() só grava se o updated_at bate,
// como o banco (o gatilho carimba um novo a cada gravação)
let noBanco: string
let carimbo = 0
const from = vi.fn(() => ({
  update: (mudanca: Record<string, unknown>) => {
    const filtros: Record<string, unknown> = {}
    const q = {
      eq: (c: string, v: unknown) => { filtros[c] = v; return q },
      select: () => {
        if (filtros.updated_at !== undefined && filtros.updated_at !== noBanco) return Promise.resolve({ data: [], error: null })
        noBanco = `t${++carimbo}`
        return Promise.resolve({ data: [{ id: filtros.id, ...mudanca, updated_at: noBanco }], error: null })
      },
    }
    return q
  },
}))
vi.mock('../lib/supabase', () => ({ supabase: { from: () => from() } }))

const tarefa: DbTask = {
  id: 'x', producer_id: 'u-1', event_id: null, assigned_to: null, title: 'T', description: null, due_date: null,
  status: 'todo', priority: 'medium', created_at: '2026-10-01T00:00:00Z', column_id: 'c1', position: 1000, updated_at: 't0',
}

let cliente: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>

beforeEach(() => {
  cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  noBanco = 't0'; carimbo = 0
  act(() => { useAuthStore.setState({ user: { id: 'u-1', email: 'x@y.z', full_name: 'X', avatar_url: null, role: 'producer' }, isAuthenticated: true, isLoading: false }) })
  cliente.setQueryData(['producer-tasks', 'u-1'], [tarefa])
})

describe('useMoverTarefa', () => {
  it('dois movimentos seguidos do mesmo cartão (com a tarefa lida antes do 1º) não dão conflito falso', async () => {
    const { result } = renderHook(() => useMoverTarefa(), { wrapper })
    let r1!: Promise<unknown>, r2!: Promise<unknown>
    act(() => {
      r1 = result.current.mutateAsync({ tarefa, mudanca: { column_id: 'c2', position: 1000 } })
      r2 = result.current.mutateAsync({ tarefa, mudanca: { column_id: 'c3', position: 1000 } })
    })
    await act(async () => { await expect(r1).resolves.toBeUndefined(); await expect(r2).resolves.toBeUndefined() })
    await waitFor(() => expect(noBanco).toBe('t2'))
  })

  it('outra pessoa gravou antes: conflito', async () => {
    noBanco = 'de-outra-pessoa'
    const { result } = renderHook(() => useMoverTarefa(), { wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync({ tarefa, mudanca: { column_id: 'c2' } })).rejects.toThrow('Outra pessoa mexeu')
    })
  })
})
