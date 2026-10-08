import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParticipantes } from '../hooks/useParticipantes'

const banco = vi.hoisted(() => ({ ins: [] as { tabela: string; ids: string[] }[] }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.in = (_c: string, ids: string[]) => { banco.ins.push({ tabela, ids }); return q }
      q.order = () => q
      q.range = () => Promise.resolve({ data: [], error: null })
      return q
    },
  },
}))

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>

describe('useParticipantes: só os eventos do produtor', () => {
  it('sem evento escolhido filtra por todos os ids dos eventos dele, em pedidos e ingressos', async () => {
    banco.ins.length = 0
    const { result } = renderHook(() => useParticipantes(null, ['e1', 'e2']), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(banco.ins).toEqual([{ tabela: 'orders', ids: ['e1', 'e2'] }, { tabela: 'tickets', ids: ['e1', 'e2'] }])
  })
  it('evento que não é dele não consulta nada; lista de eventos ainda carregando também não', () => {
    banco.ins.length = 0
    const a = renderHook(() => useParticipantes('alheio', ['e1']), { wrapper })
    const b = renderHook(() => useParticipantes(null, undefined), { wrapper })
    expect(a.result.current.fetchStatus).toBe('idle'); expect(b.result.current.fetchStatus).toBe('idle')
    expect(banco.ins).toHaveLength(0)
  })
})
