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
