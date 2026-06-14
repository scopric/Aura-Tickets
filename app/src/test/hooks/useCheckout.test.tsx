import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCreateOrder } from '../../hooks/useCheckout'
import { supabase } from '../../lib/supabase'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve criar um pedido com sucesso', async () => {
    const mockOrder = {
      id: 'order_abc',
      event_id: 'event_123',
      user_id: 'user_456',
      total: 150,
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: mockOrder, error: null })),
        })),
      })),
    } as any)

    const { result } = renderHook(() => useCreateOrder(), { wrapper: createWrapper() })

    await result.current.mutateAsync({
      event_id: 'event_123',
      items: [{ ticket_type_id: 'tt_1', quantity: 2 }],
      payment_method: 'credit_card',
      total_amount: 150,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockOrder)
  })

  it('deve falhar quando o Supabase retorna erro', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Database error' } })),
        })),
      })),
    } as any)

    const { result } = renderHook(() => useCreateOrder(), { wrapper: createWrapper() })

    await expect(
      result.current.mutateAsync({
        event_id: 'event_123',
        items: [{ ticket_type_id: 'tt_1', quantity: 1 }],
        payment_method: 'pix',
        total_amount: 50,
      })
    ).rejects.toThrow('Database error')
  })
})
