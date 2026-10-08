import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import CheckoutPayment from '../pages/checkout/Payment'

const h = vi.hoisted(() => ({
  mutate: vi.fn(),
  rpc: vi.fn(),
  pedido: { id: 'ord-1', total: 0, status: 'pending', customer_name: 'Ana', customer_email: 'a@a.com' } as Record<string, unknown> | null,
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../hooks/useCheckout', () => ({ useCreateOrder: () => ({ mutate: h.mutate, isPending: false }) }))
vi.mock('../hooks/usePayment', () => ({ usePayment: () => ({ processPayment: vi.fn() }) }))
vi.mock('../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { email: 'a@a.com', full_name: 'Ana' } }) }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.pedido, error: null }) }) }) }),
    rpc: (...a: unknown[]) => h.rpc(...a),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}))

const Mapa = () => <p data-testid="mapa">{JSON.stringify((useLocation().state as { abrirMapa?: boolean })?.abrirMapa)}</p>
const montar = (venceEm: number, preco = 0) => render(
  <MemoryRouter initialEntries={[{ pathname: '/checkout/payment', state: {
    eventId: 'e1', cart: {}, orderId: 'ord-1', venceEm, itemsSummary: [{ ticket_type_id: 'tt1', quantity: 1, name: 'Pista', price: preco }],
  } }]}>
    <Routes>
      <Route path="/checkout/payment" element={<CheckoutPayment />} />
      <Route path="/checkout" element={<Mapa />} />
      <Route path="/checkout/success" element={<p>sucesso</p>} />
    </Routes>
  </MemoryRouter>
)

describe('Pagamento de pedido com lugar marcado', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.clearAllMocks(); h.rpc.mockResolvedValue({ error: null }); h.pedido = { id: 'ord-1', total: 0, status: 'pending', customer_name: 'Ana', customer_email: 'a@a.com' } })
  afterEach(() => vi.useRealTimers())

  it('mostra a contagem do prazo do servidor e, ao zerar, "Tempo esgotado" e volta ao mapa', async () => {
    montar(Date.now() + 90_000)
    expect((await screen.findByRole('timer')).textContent).toMatch(/01:30|01:29/)
    await act(async () => { vi.advanceTimersByTime(91_000) })
    expect((await screen.findByRole('alert')).textContent).toMatch(/Tempo esgotado/)
    expect(screen.queryByRole('button', { name: /Garantir ingresso grátis/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao mapa' }))
    expect((await screen.findByTestId('mapa')).textContent).toBe('true')
  })

  it('reaproveita o pedido criado pela reserva: não cria outro e confirma o grátis nele', async () => {
    montar(Date.now() + 300_000)
    fireEvent.click(await screen.findByRole('button', { name: /Garantir ingresso grátis/ }))
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('confirmar_pedido_gratis', { p_order: 'ord-1' }))
    expect(h.mutate).not.toHaveBeenCalled()
    expect(await screen.findByText('sucesso')).toBeTruthy()
  })

  it('pedido que já não está pendente (vencido no banco): avisa e mostra "Tempo esgotado"', async () => {
    h.pedido = { id: 'ord-1', total: 0, status: 'cancelled', customer_name: null, customer_email: null }
    montar(Date.now() + 300_000)
    fireEvent.click(await screen.findByRole('button', { name: /Garantir ingresso grátis/ }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Tempo esgotado/)
    expect(h.rpc).not.toHaveBeenCalled()
  })
})
