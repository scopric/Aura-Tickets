import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { usePublicEvent } from '../hooks/useEvents'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc, from: vi.fn(), auth: { getSession: vi.fn() } } }))

let qc: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
beforeEach(() => { vi.clearAllMocks(); qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }) })

describe('usePublicEvent (rpc evento_publico)', () => {
  it('chama a rpc com o slug/uuid e devolve o evento com os ingressos embutidos (mesmo formato de antes)', async () => {
    rpc.mockResolvedValue({ error: null, data: {
      acesso: 'link',
      evento: { id: 'e1', title: 'Festa', visibility: 'unlisted' },
      ingressos: [{ id: 't1', name: 'Pista', price: '50.00', perks: null }],
    } })
    const { result } = renderHook(() => usePublicEvent('festa-1'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    expect(rpc).toHaveBeenCalledWith('evento_publico', { p_ref: 'festa-1' })
    expect(result.current.data).toMatchObject({ id: 'e1', visibility: 'unlisted' })
    expect(result.current.data?.ticket_types).toEqual([{ id: 't1', name: 'Pista', price: 50, perks: [] }])
  })

  it('rpc que devolve null (rascunho, convidados, inexistente) vira null; cartão de senha ainda não abre a página', async () => {
    rpc.mockResolvedValueOnce({ error: null, data: null })
    const a = renderHook(() => usePublicEvent('nao-existe'), { wrapper })
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true))
    expect(a.result.current.data).toBeNull()

    qc.clear()
    rpc.mockResolvedValueOnce({ error: null, data: { acesso: 'senha', cartao: { id: 'e3', title: 'Com senha' } } })
    const b = renderHook(() => usePublicEvent('com-senha'), { wrapper })
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true))
    expect(b.result.current.data).toBeNull()
  })

  it('erro da rpc vira erro do hook', async () => {
    rpc.mockResolvedValue({ error: { message: 'falhou' }, data: null })
    const { result } = renderHook(() => usePublicEvent('x'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
