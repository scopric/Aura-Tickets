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
    await expect(aprovar('2026-10-04T12:00:00.123456+00:00')).rejects.toThrow('O evento mudou: recarregue antes de aprovar')
  })

  it('sem updatedAt continua como antes: só o id, e devolve a linha', async () => {
    const eqs = simula({ id: 'e1' })
    await expect(aprovar()).resolves.toEqual({ id: 'e1' })
    expect(eqs).toEqual([['id', 'e1']])
  })
})
