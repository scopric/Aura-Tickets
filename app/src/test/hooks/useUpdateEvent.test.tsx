import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUpdateEvent } from '../../hooks/useEvents'
import { supabase } from '../../lib/supabase'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

// Devolve o que foi passado ao update de events.
async function gravado(event: Record<string, unknown>) {
  const update = vi.fn(() => ({
    eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'e1' }, error: null }) }) }),
  }))
  vi.mocked(supabase.from).mockReturnValue({
    update,
    select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
  } as any)
  const { result } = renderHook(() => useUpdateEvent(), { wrapper })
  await result.current.mutateAsync({ eventId: 'e1', event: event as any, tickets: [] })
  return (update.mock.calls[0] as unknown[])[0]
}

describe('useUpdateEvent grava só o que a tela mandou', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Arquivar manda só o status', async () => {
    expect(await gravado({ status: 'ended' })).toEqual({ status: 'ended' })
  })

  it('EditEvent: approval_status e location não vão ao banco; venue_name vai', async () => {
    const payload = await gravado({
      title: 'Show', description: null, date: '2026-10-10', time: '20:00',
      location: 'Arena', venue_name: 'Arena', category: 'Música', status: 'published', approval_status: 'pending',
      cover_image: '/c.jpg', image_url: '/c.jpg', capacity: 100,
    })
    expect(payload).toEqual({
      title: 'Show', description: null, date: '2026-10-10', time: '20:00',
      venue_name: 'Arena', category: 'Música', status: 'published',
      cover_image: '/c.jpg', image_url: '/c.jpg', capacity: 100,
    })
  })
})

// Ingressos: existente vai por update sem type/is_active; novo vai por insert.
async function salvaIngressos(tickets: Record<string, unknown>[], linhasDoUpdate = [{ id: 'a' }], erroLeitura: unknown = null) {
  const update = vi.fn((_: Record<string, unknown>) => ({ eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: linhasDoUpdate, error: null }) }) }) }))
  const insert = vi.fn((_: Record<string, unknown>[]) => Promise.resolve({ error: null }))
  vi.mocked(supabase.from).mockImplementation(((tabela: string) => tabela === 'events'
    ? { update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'e1' }, error: null }) }) }) }) }
    : { select: () => ({ eq: () => Promise.resolve({ data: erroLeitura ? null : [{ id: 'a' }], error: erroLeitura }) }), update, insert }) as any)
  const { result } = renderHook(() => useUpdateEvent(), { wrapper })
  await result.current.mutateAsync({ eventId: 'e1', event: {} as any, tickets: tickets as any })
  return { update, insert }
}

describe('useUpdateEvent preserva tipo e situação dos ingressos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('existente coletiva: update sem type', async () => {
    const { update, insert } = await salvaIngressos([{ id: 'a', name: 'Mesa', price: 100, capacity: 4, type: 'coletiva' }])
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0]).not.toHaveProperty('type')
    expect(insert).not.toHaveBeenCalled()
  })

  it('existente inativo: update sem is_active', async () => {
    const { update } = await salvaIngressos([{ id: 'a', name: 'X', price: 0, is_active: false }])
    expect(update.mock.calls[0][0]).not.toHaveProperty('is_active')
  })

  it('novo: insert com type individual e is_active true', async () => {
    const { update, insert } = await salvaIngressos([{ name: 'Novo', price: 10, capacity: 5 }])
    expect(update).not.toHaveBeenCalled()
    expect(insert.mock.calls[0][0]).toEqual([expect.objectContaining({ event_id: 'e1', type: 'individual', is_active: true })])
  })

  it('update que volta 0 linha gera erro', async () => {
    await expect(salvaIngressos([{ id: 'a', name: 'X', price: 1 }], [])).rejects.toThrow('Não foi possível salvar um dos ingressos')
  })

  it('leitura dos ingressos com erro: rejeita e não insere', async () => {
    const insert = vi.fn()
    vi.mocked(supabase.from).mockImplementation(((tabela: string) => tabela === 'events'
      ? { update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'e1' }, error: null }) }) }) }) }
      : { select: () => ({ eq: () => Promise.resolve({ data: null, error: new Error('falhou') }) }), insert }) as any)
    const { result } = renderHook(() => useUpdateEvent(), { wrapper })
    await expect(result.current.mutateAsync({ eventId: 'e1', event: {} as any, tickets: [{ name: 'M', price: 1, type: 'coletiva' }] as any })).rejects.toThrow('falhou')
    expect(insert).not.toHaveBeenCalled()
  })

  it('existente sem description: update não manda description', async () => {
    const { update } = await salvaIngressos([{ id: 'a', name: 'X', price: 1 }])
    expect(update.mock.calls[0][0]).not.toHaveProperty('description')
  })

  it('preço 0 grava price 0', async () => {
    const { update } = await salvaIngressos([{ id: 'a', name: 'X', price: 0 }])
    expect(update.mock.calls[0][0]).toMatchObject({ price: 0 })
  })
})
