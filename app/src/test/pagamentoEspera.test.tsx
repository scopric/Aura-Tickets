import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CheckoutPayment from '../pages/checkout/Payment'

// Espera do Pix: consulta o status a cada 5 s, continua depois que o Pix/reserva vencem e navega uma vez só ao pagar
const h = vi.hoisted(() => ({ status: 'pending', total: 77 as number | string, usuario: 'u1' as string | undefined, mutate: vi.fn(), consultas: vi.fn(), toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../hooks/useCheckout', () => ({ useCreateOrder: () => ({ mutate: h.mutate, isPending: false }) }))
vi.mock('../hooks/usePayment', () => ({ usePayment: () => ({ pagarPix: vi.fn() }) }))
vi.mock('../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: h.usuario ? { id: h.usuario } : null }) }))
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: (cols: string) => ({ eq: () => ({ maybeSingle: async () => { if (cols === 'status') h.consultas(); return { data: { status: h.status, total: h.total }, error: null } } }) }) }) },
}))

const montar = () => render(
  <MemoryRouter initialEntries={[{ pathname: '/checkout/payment', state: { eventId: 'e1', cart: { tt1: 1 }, itemsSummary: [{ ticket_type_id: 'tt1', quantity: 1, name: 'Pista', price: 50 }] } }]}>
    <Routes>
      <Route path="/checkout/payment" element={<CheckoutPayment />} />
      <Route path="/checkout/success" element={<p>sucesso</p>} />
    </Routes>
  </MemoryRouter>
)
const guardar = (extra: Record<string, unknown> = {}) => sessionStorage.setItem('aura_pix_pendente',
  JSON.stringify({ pedidoId: 'o1', expiraEm: new Date(Date.now() + 60_000).toISOString(), eventId: 'e1', userId: 'u1', ...extra }))
const avancar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

describe('Pagamento: espera do Pix', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    h.status = 'pending'
    h.usuario = 'u1'
    guardar()
  })
  afterEach(() => { vi.useRealTimers(); sessionStorage.clear() })

  it('retoma o pedido guardado, consulta a cada 5 s e continua depois que o Pix vence', async () => {
    montar()
    expect(screen.getByText('Pix já gerado, aguardando pagamento')).toBeTruthy()
    await avancar(5000)
    expect(h.consultas).toHaveBeenCalledTimes(1)
    await avancar(5000)
    expect(h.consultas).toHaveBeenCalledTimes(2)
    await avancar(60_000) // passou do expiraEm
    expect(screen.getByText('Este Pix venceu')).toBeTruthy()
    const antes = h.consultas.mock.calls.length
    await avancar(10_000)
    expect(h.consultas.mock.calls.length).toBe(antes + 2)
  })

  it('ao ver paid depois do vencimento navega ao sucesso uma vez e limpa a chave', async () => {
    montar()
    await avancar(65_000)
    h.status = 'paid'
    await avancar(5000)
    expect(screen.getByText('sucesso')).toBeTruthy()
    expect(h.toast.success).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('aura_pix_pendente')).toBeNull()
    const n = h.consultas.mock.calls.length
    await avancar(20_000)
    expect(h.consultas.mock.calls.length).toBe(n)
  })

  it('para de consultar ao desmontar', async () => {
    const { unmount } = montar()
    await avancar(5000)
    unmount()
    const n = h.consultas.mock.calls.length
    await avancar(30_000)
    expect(h.consultas.mock.calls.length).toBe(n)
  })

  it('desiste 5 min depois do vencimento', async () => {
    montar()
    await avancar(60_000 + 5 * 60_000 + 10_000)
    const n = h.consultas.mock.calls.length
    await avancar(30_000)
    expect(h.consultas.mock.calls.length).toBe(n)
    expect(sessionStorage.getItem('aura_pix_pendente')).toBeNull()
  })

  it.each([['outro evento', { eventId: 'e2' }], ['outro usuário', { userId: 'u2' }]])('chave de %s é ignorada e apagada: fluxo normal', async (_n, extra) => {
    guardar(extra)
    montar()
    expect(screen.queryByText('Pix já gerado, aguardando pagamento')).toBeNull()
    expect(screen.getByRole('button', { name: /Pagar Agora/ })).toBeTruthy()
    expect(sessionStorage.getItem('aura_pix_pendente')).toBeNull()
    await avancar(10_000)
    expect(h.consultas).not.toHaveBeenCalled()
  })

  it('retomada: pede o mesmo CPF e mostra o total do banco, não a prévia', async () => {
    montar()
    await avancar(0)
    expect(screen.getByText(/Informe seu CPF para mostrar o Pix de novo/)).toBeTruthy()
    expect(screen.getByLabelText('CPF do comprador')).toBeTruthy()
    expect(screen.getByText(/77,00/)).toBeTruthy()
    expect(screen.queryByText(/50,00/)).toBeNull()
  })

  it('Pix vencido ainda dentro dos 5 min: retoma a espera, sem criar pedido', async () => {
    guardar({ expiraEm: new Date(Date.now() - 60_000).toISOString() })
    montar()
    expect(screen.getByText('Este Pix venceu')).toBeTruthy()
    expect(sessionStorage.getItem('aura_pix_pendente')).not.toBeNull()
    expect(h.mutate).not.toHaveBeenCalled()
  })

  it('relógio do aparelho 10 min adiantado: com deltaMs não mostra "Pix venceu"; sem delta, mostra', async () => {
    const expiraEm = new Date(Date.now() - 10 * 60_000 + 60_000).toISOString() // para o servidor ainda falta 1 min
    guardar({ expiraEm, deltaMs: -10 * 60_000 })
    const { unmount } = montar()
    expect(screen.queryByText('Este Pix venceu')).toBeNull()
    expect(screen.getByText('Pix já gerado, aguardando pagamento')).toBeTruthy()
    unmount()
    guardar({ expiraEm: new Date(Date.now() - 60_000).toISOString() })
    montar()
    expect(screen.getByText('Este Pix venceu')).toBeTruthy()
  })

  it('usuário que chega depois do primeiro render retoma a espera', async () => {
    h.usuario = undefined
    const { rerender } = montar()
    expect(screen.queryByText('Pix já gerado, aguardando pagamento')).toBeNull()
    expect(sessionStorage.getItem('aura_pix_pendente')).not.toBeNull() // sem usuário não apaga
    h.usuario = 'u1'
    rerender(<MemoryRouter initialEntries={[{ pathname: '/checkout/payment', state: { eventId: 'e1', cart: { tt1: 1 }, itemsSummary: [{ ticket_type_id: 'tt1', quantity: 1, name: 'Pista', price: 50 }] } }]}>
      <Routes><Route path="/checkout/payment" element={<CheckoutPayment />} /></Routes></MemoryRouter>)
    await avancar(0)
    expect(screen.getByText('Pix já gerado, aguardando pagamento')).toBeTruthy()
  })
})
