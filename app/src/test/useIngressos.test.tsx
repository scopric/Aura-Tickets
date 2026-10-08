import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useReordenarIngressos } from '../hooks/useIngressos'

const m = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ update: (v: unknown) => ({ eq: (_c: string, id: string) => ({ eq: () => ({ select: () => m.update(v, id) }) }) }) }) },
}))

const eventos = () => [{ id: 'e1', ticket_types: [{ id: 'a', sort_order: 0 }, { id: 'b', sort_order: 1 }] }, { id: 'e2', ticket_types: [{ id: 'z', sort_order: 0 }] }]
const ordemDe = (qc: QueryClient) => (qc.getQueryData(['producer-events', 'u1']) as ReturnType<typeof eventos>)[0].ticket_types.map(t => `${t.id}:${t.sort_order}`)

describe('useReordenarIngressos', () => {
  beforeEach(() => { m.update.mockReset() })
  const montar = () => {
    const qc = new QueryClient(); qc.setQueryData(['producer-events', 'u1'], eventos())
    const w = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    return { qc, ...renderHook(() => useReordenarIngressos(), { wrapper: w }) }
  }
  const ordens = [{ id: 'b', sort_order: 0 }, { id: 'a', sort_order: 1 }]

  it('muda a lista na hora (otimista), grava um UPDATE por ingresso e não toca outro evento', async () => {
    let solta!: () => void
    m.update.mockImplementation(() => new Promise(r => { solta = () => r({ data: [{ id: 'x' }], error: null }) }))
    const { qc, result } = montar()
    act(() => { result.current.mutate({ eventId: 'e1', ordens }) })
    await waitFor(() => expect(ordemDe(qc)).toEqual(['a:1', 'b:0']))
    expect((qc.getQueryData(['producer-events', 'u1']) as ReturnType<typeof eventos>)[1].ticket_types[0]).toEqual({ id: 'z', sort_order: 0 })
    solta(); solta()
    await waitFor(() => expect(m.update).toHaveBeenCalledTimes(2))
    expect(m.update).toHaveBeenCalledWith({ sort_order: 0 }, 'b')
  })

  it('erro do banco devolve a ordem que era', async () => {
    m.update.mockResolvedValue({ data: null, error: { code: '42501' } })
    const { qc, result } = montar()
    await act(async () => { await result.current.mutateAsync({ eventId: 'e1', ordens }).catch(() => undefined) })
    expect(ordemDe(qc)).toEqual(['a:0', 'b:1'])
  })

  it('falha parcial (um UPDATE vale, outro não): reverte a lista e refaz a leitura', async () => {
    m.update.mockResolvedValueOnce({ data: [{ id: 'x' }], error: null }).mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    const { qc, result } = montar()
    const refaz = vi.spyOn(qc, 'invalidateQueries')
    await act(async () => { await result.current.mutateAsync({ eventId: 'e1', ordens }).catch(() => undefined) })
    expect(m.update).toHaveBeenCalledTimes(2)
    expect(ordemDe(qc)).toEqual(['a:0', 'b:1'])
    expect(refaz).toHaveBeenCalledWith({ queryKey: ['producer-events', 'u1'] })
  })

  it('RLS que barra (0 linhas, sem erro) também reverte', async () => {
    m.update.mockResolvedValue({ data: [], error: null })
    const { qc, result } = montar()
    await act(async () => { await result.current.mutateAsync({ eventId: 'e1', ordens }).catch(() => undefined) })
    expect(ordemDe(qc)).toEqual(['a:0', 'b:1'])
  })
})
