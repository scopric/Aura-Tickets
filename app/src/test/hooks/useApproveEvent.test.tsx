import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApproveEvent } from '../../hooks/useEvents'
import { supabase } from '../../lib/supabase'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin1' } }) }))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

// Simula o update de aprovação: guarda os .eq() e devolve `linha` no maybeSingle.
function simula(linha: unknown) {
  const eqs: [string, unknown][] = []
  const builder = {
    eq: (col: string, val: unknown) => { eqs.push([col, val]); return builder },
    select: () => ({ maybeSingle: () => Promise.resolve({ data: linha, error: null }) }),
  }
  vi.mocked(supabase.from).mockReturnValue({ update: () => builder } as never)
  return eqs
}

const aprovar = (updatedAt?: string) => {
  const { result } = renderHook(() => useApproveEvent(), { wrapper })
  return result.current.mutateAsync({ eventId: 'e1', status: 'approved', updatedAt })
}

describe('useApproveEvent com o updated_at lido', () => {
  beforeEach(() => vi.clearAllMocks())

  it('com updatedAt manda .eq("updated_at") com o texto bruto, sem passar por Date', async () => {
    const eqs = simula({ id: 'e1' })
    const bruto = '2026-10-04T12:00:00.123456+00:00'
    await aprovar(bruto)
    expect(eqs).toEqual([['id', 'e1'], ['updated_at', bruto]])
  })

  it('linha que não casa (null) lança o erro de evento mudado', async () => {
    simula(null)
    await expect(aprovar('2026-10-04T12:00:00.123456+00:00')).rejects.toThrow('O evento mudou ou você não tem permissão para esta ação: recarregue a página.')
  })

  it('sem updatedAt continua como antes: só o id, e devolve a linha', async () => {
    const eqs = simula({ id: 'e1' })
    await expect(aprovar()).resolves.toEqual({ id: 'e1' })
    expect(eqs).toEqual([['id', 'e1']])
  })

  it('recusar com updatedAt: o 1º update filtra updated_at; o 2º (rascunho) continua filtrando status published', async () => {
    const eqs1: [string, unknown][] = []
    const eqs2: [string, unknown][] = []
    const payloads: unknown[] = []
    const montar = (eqs: [string, unknown][], linha: unknown) => {
      const b = {
        eq: (c: string, v: unknown) => { eqs.push([c, v]); return b },
        select: () => ({ maybeSingle: () => Promise.resolve({ data: linha, error: null }) }),
      }
      return b
    }
    const builders = [montar(eqs1, { id: 'e1', approval_status: 'rejected' }), montar(eqs2, { id: 'e1', status: 'draft' })]
    vi.mocked(supabase.from).mockReturnValue({ update: (p: unknown) => { payloads.push(p); return builders.shift() } } as never)
    const bruto = '2026-10-04T12:00:00.123456+00:00'
    const { result } = renderHook(() => useApproveEvent(), { wrapper })
    await expect(result.current.mutateAsync({ eventId: 'e1', status: 'rejected', rejectionReason: 'Faltou o alvará', updatedAt: bruto }))
      .resolves.toEqual({ id: 'e1', status: 'draft' })
    expect(eqs1).toEqual([['id', 'e1'], ['updated_at', bruto]])
    expect(eqs2).toEqual([['id', 'e1'], ['status', 'published']])
    expect(payloads[0]).toMatchObject({ approval_status: 'rejected', rejection_reason: 'Faltou o alvará', featured_carousel: false })
    expect(payloads[1]).toEqual({ status: 'draft' })
  })

  it('recusar com updatedAt que não casa: erro e o 2º update (rascunho) não roda', async () => {
    const from = vi.mocked(supabase.from)
    simula(null)
    const { result } = renderHook(() => useApproveEvent(), { wrapper })
    await expect(result.current.mutateAsync({ eventId: 'e1', status: 'rejected', rejectionReason: 'x', updatedAt: 'a' })).rejects.toThrow('O evento mudou')
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('a lista do admin é recarregada também quando falha (onSettled)', async () => {
    simula(null)
    const client = new QueryClient()
    const invalida = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useApproveEvent(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    await expect(result.current.mutateAsync({ eventId: 'e1', status: 'approved', updatedAt: 'a' })).rejects.toThrow()
    await vi.waitFor(() => expect(invalida).toHaveBeenCalledWith({ queryKey: ['admin-events'] }))
  })
})
