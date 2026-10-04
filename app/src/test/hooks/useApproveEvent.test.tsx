import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApproveEvent } from '../../hooks/useEvents'
import { supabase } from '../../lib/supabase'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin1' } }) }))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

// S8: a decisão vai por admin_evento_decidir (um UPDATE só no banco), sempre com a versão (updated_at) lida.
const rpc = vi.fn()
;(supabase as unknown as { rpc: typeof rpc }).rpc = rpc
const bruto = '2026-10-04T12:00:00.123456+00:00'
const decidir = (args: Parameters<ReturnType<typeof useApproveEvent>['mutateAsync']>[0]) => {
  const { result } = renderHook(() => useApproveEvent(), { wrapper })
  return result.current.mutateAsync(args)
}

describe('useApproveEvent chama admin_evento_decidir', () => {
  beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: { id: 'e1' }, error: null }) })

  it('aprovar: p_versao é o texto bruto do updated_at, sem passar por Date', async () => {
    await expect(decidir({ eventId: 'e1', status: 'approved', updatedAt: bruto })).resolves.toEqual({ id: 'e1' })
    expect(rpc).toHaveBeenCalledWith('admin_evento_decidir', { p_id: 'e1', p_decisao: 'aprovar', p_motivo: null, p_versao: bruto })
  })

  it('recusar manda o motivo; revogar (status pending) manda "revogar" sem motivo', async () => {
    await decidir({ eventId: 'e1', status: 'rejected', rejectionReason: 'Faltou o alvará', updatedAt: bruto })
    expect(rpc).toHaveBeenLastCalledWith('admin_evento_decidir', { p_id: 'e1', p_decisao: 'recusar', p_motivo: 'Faltou o alvará', p_versao: bruto })
    await decidir({ eventId: 'e1', status: 'pending', updatedAt: bruto })
    expect(rpc).toHaveBeenLastCalledWith('admin_evento_decidir', { p_id: 'e1', p_decisao: 'revogar', p_motivo: null, p_versao: bruto })
  })

  it('só uma chamada ao banco por decisão (nada de segundo UPDATE para despublicar)', async () => {
    const from = vi.mocked(supabase.from)
    await decidir({ eventId: 'e1', status: 'rejected', rejectionReason: 'x', updatedAt: bruto })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(from).not.toHaveBeenCalled()
  })

  it('P0002 do banco ("o evento mudou") sobe com a mensagem do banco', async () => {
    rpc.mockResolvedValue({ data: null, error: Object.assign(new Error('O evento mudou desde que você abriu; recarregue.'), { code: 'P0002' }) })
    await expect(decidir({ eventId: 'e1', status: 'approved', updatedAt: bruto })).rejects.toThrow('O evento mudou desde que você abriu; recarregue.')
  })

  it('a lista do admin é recarregada também quando falha (onSettled)', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('falha') })
    const client = new QueryClient()
    const invalida = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useApproveEvent(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    })
    await expect(result.current.mutateAsync({ eventId: 'e1', status: 'approved', updatedAt: 'a' })).rejects.toThrow()
    await vi.waitFor(() => expect(invalida).toHaveBeenCalledWith({ queryKey: ['admin-events'] }))
  })
})
