import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCreateOrder } from '../../hooks/useCheckout'
import { supabase } from '../../lib/supabase'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user_456', email: 'a@b.com', name: 'Ana' } }),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)

// Preço 50, 2 ingressos: subtotal 100 + taxa 10% (5 por ingresso) = 110.
const ITENS = [{ ticket_type_id: 'tt_1', quantity: 2 }]
const minutosAtras = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const pendente = (total: number, min: number, metodo = 'pix') => ({
  id: 'order_old', total, status: 'pending', payment_method: metodo, gateway_payment_id: 'PAY-OLD',
  created_at: minutosAtras(min), order_items: [{ ticket_type_id: 'tt_1', quantity: 2 }],
})

// from('orders'): select().eq().eq().eq() -> pendentes; insert().select().single() -> novo pedido. from('order_items'): insert.
function mockBanco(pendentes: unknown[], preco: number | null = 50, orderInsert: unknown = { data: { id: 'order_new', total: 110, gateway_payment_id: 'PAY-NEW' }, error: null }) {
  const inserts: Record<string, unknown[]> = { orders: [], order_items: [] }
  vi.mocked(supabase.from).mockImplementation(((t: string) => ({
    select: () => { const q: any = { eq: () => q, then: (r: any) => r({ data: pendentes, error: null }) }; return q },
    insert: (v: unknown) => { inserts[t].push(v); return { select: () => ({ single: () => Promise.resolve(orderInsert) }), then: (r: any) => r({ error: null }) } },
  })) as any)
  vi.mocked(supabase.rpc).mockResolvedValue({ data: { evento: { start_date: '2099-01-01T21:00:00Z', end_date: null, date: '2099-01-01', time: '18:00' }, ingressos: [{ id: 'tt_1', price: preco }] }, error: null } as any)
  return inserts
}

const criar = (metodo: 'pix' | 'credit_card' = 'pix') => {
  const { result } = renderHook(() => useCreateOrder(), { wrapper })
  return result.current.mutateAsync({ event_id: 'event_123', items: ITENS, payment_method: metodo })
}

describe('useCheckout — criar pedido', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cria pedido novo com total, subtotal e taxa calculados com o preço do banco (evento_publico)', async () => {
    const ins = mockBanco([])
    const o = await criar()
    expect(supabase.rpc).toHaveBeenCalledWith('evento_publico', { p_ref: 'event_123' })
    expect(ins.orders[0]).toMatchObject({ user_id: 'user_456', subtotal: 100, service_fee: 10, total: 110, status: 'pending', payment_method: 'pix' })
    expect(ins.order_items[0]).toEqual([{ order_id: 'order_new', ticket_type_id: 'tt_1', quantity: 2, unit_price: 50, subtotal: 100 }])
    expect(o.id).toBe('order_new')
  })

  it('reaproveita pedido pendente < 20 min com mesmo total, itens e forma de pagamento', async () => {
    const ins = mockBanco([pendente(110, 5)])
    const o = await criar()
    expect(o.id).toBe('order_old')
    expect(o.total_amount).toBe(110)
    expect(ins.orders).toHaveLength(0)
  })

  it.each([
    ['total diferente (preço mudou)', [pendente(90, 5)]],
    ['mais de 20 min', [pendente(110, 25)]],
    ['outra forma de pagamento', [pendente(110, 5, 'credit_card')]],
  ])('cria pedido novo quando %s', async (_n, pend) => {
    const ins = mockBanco(pend)
    const o = await criar()
    expect(o.id).toBe('order_new')
    expect(ins.orders).toHaveLength(1)
  })

  it('ingresso sem preço no banco dá erro e não grava nada', async () => {
    const ins = mockBanco([], null)
    await expect(criar()).rejects.toThrow('Ingresso sem preço')
    expect(ins.orders).toHaveLength(0)
  })

  it('tipo com venda encerrada não cria pedido', async () => {
    const ins = mockBanco([], 50)
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { evento: { start_date: '2099-01-01T21:00:00Z', end_date: null, date: '2099-01-01', time: '18:00' }, ingressos: [{ id: 'tt_1', name: 'Pista', price: 50, sale_end: '2020-01-01T00:00:00Z' }] }, error: null } as any)
    await expect(criar()).rejects.toThrow('Pista: Vendas encerradas')
    expect(ins.orders).toHaveLength(0)
  })

  it('acima do máximo por pedido não cria pedido (pago com max_per_order)', async () => {
    const ins = mockBanco([], 50)
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { evento: { start_date: '2099-01-01T21:00:00Z', end_date: null, date: '2099-01-01', time: '18:00' }, ingressos: [{ id: 'tt_1', name: 'Pista', price: 50, max_per_order: 1 }] }, error: null } as never)
    await expect(criar()).rejects.toThrow('Pista: máximo de 1 por pedido')
    expect(ins.orders).toHaveLength(0)
  })

  it('propaga erro do banco ao criar o pedido', async () => {
    mockBanco([], 50, { data: null, error: { message: 'Database error' } })
    await expect(criar()).rejects.toMatchObject({ message: 'Database error' })
  })
})
