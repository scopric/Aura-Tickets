import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CheckoutPayment from '../pages/checkout/Payment'

// Tela 06 fatia 2: cupom opcional e recusas do servidor (reservar_ingressos devolve ok:false, o hook as transforma em erro com motivo)
const h = vi.hoisted(() => ({ mutate: vi.fn(), toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../hooks/useCheckout', () => ({ useCreateOrder: () => ({ mutate: h.mutate, isPending: false }) }))
vi.mock('../hooks/usePayment', () => ({ usePayment: () => ({ pagarPix: vi.fn(async () => ({ ok: false, mensagem: 'sem gateway no teste', tentarDeNovo: true })) }) }))
vi.mock('../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { email: 'a@a.com', full_name: 'Ana' } }) }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(async () => ({ error: null })), channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: vi.fn() } }))

const pago = [{ ticket_type_id: 'tt1', quantity: 1, name: 'Pista', price: 50 }]
const comMeia = [...pago, { ticket_type_id: 'tt1', quantity: 1, name: 'Pista (meia-entrada)', price: 25, taxa_unit: 3, beneficio: 'meia', meia_tipo: 'estudante' }]
const montar = (itemsSummary: unknown[]) => render(
  <MemoryRouter initialEntries={[{ pathname: '/checkout/payment', state: { eventId: 'e1', cart: { tt1: 1 }, itemsSummary } }]}>
    <Routes>
      <Route path="/checkout/payment" element={<CheckoutPayment />} />
      <Route path="/checkout" element={<p>volta ao pedido</p>} />
    </Routes>
  </MemoryRouter>
)
const pagar = async () => {
  fireEvent.change(await screen.findByLabelText('CPF do comprador'), { target: { value: '52998224725' } })
  fireEvent.click(screen.getByRole('button', { name: /Pagar Agora/ }))
}
const recusa = (motivo: string, message: string) => h.mutate.mockImplementationOnce((_v, o) => o.onError(Object.assign(new Error(message), { motivo })))

describe('Pagamento: cupom e recusas do servidor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cupom opcional vai ao pedido; sem cupom, vai undefined', async () => {
    montar(pago)
    fireEvent.change(await screen.findByLabelText('Cupom (opcional)'), { target: { value: 'VERAO10' } })
    await pagar()
    expect(h.mutate.mock.calls[0][0]).toMatchObject({ cupom: 'VERAO10', items: [{ ticket_type_id: 'tt1', quantity: 1, beneficio: 'inteira', meia_tipo: null }] })
  })

  it('cupom_invalido: erro inline no campo, sem toast, e libera o botão', async () => {
    recusa('cupom_invalido', 'Cupom inválido ou expirado')
    montar(pago)
    await pagar()
    expect((await screen.findByRole('alert')).textContent).toBe('Cupom inválido ou expirado')
    expect(h.toast.error).not.toHaveBeenCalled()
    expect(screen.queryByText('volta ao pedido')).toBeNull()
  })

  it.each(['cpf_da_conta', 'indisponivel'])('%s: mostra a mensagem do servidor sem reescrever', async (motivo) => {
    recusa(motivo, 'Mensagem fixa do servidor.')
    montar(pago)
    await pagar()
    expect(h.toast.error).toHaveBeenCalledWith('Mensagem fixa do servidor.', expect.anything())
  })

  it('22023 "Muitas tentativas" cai no tratamento de mesaErro (texto do servidor), não em "Erro ao criar pedido"', async () => {
    h.mutate.mockImplementationOnce((_v, o) => o.onError(Object.assign(new Error('Muitas tentativas. Tente mais tarde.'), { code: '22023' })))
    montar(pago)
    await pagar()
    expect(h.toast.error).toHaveBeenCalledWith('Muitas tentativas. Tente mais tarde.', expect.anything())
  })

  it('com meia no pedido, avisa que o cupom não vale nela', async () => {
    montar(comMeia)
    expect((await screen.findByText(/cupom não vale para a meia-entrada/)).textContent).toMatch(/inteiras/)
  })

  it('sucesso: mostra subtotal, desconto, taxa e total do servidor e o cronômetro; prazo zerado vira "Tempo esgotado" e volta ao pedido', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    try {
      h.mutate.mockImplementationOnce((_v, o) => o.onSuccess({ id: 'o1', total: 40, subtotal: 50, desconto: 20, taxa: 10, venceEm: Date.now() + 3000, customer_name: 'Ana', customer_email: 'a@a.com' }))
      montar(pago)
      await pagar()
      expect((await screen.findByText(/Desconto do cupom/)).parentElement!.textContent).toMatch(/20,00/)
      expect(screen.getByRole('timer').textContent).toMatch(/Seus ingressos ficam reservados por 00:0[23]/)
      await vi.advanceTimersByTimeAsync(4000)
      expect(await screen.findByText('Tempo esgotado')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Voltar ao pedido' }))
      expect(await screen.findByText('volta ao pedido')).toBeTruthy()
    } finally { vi.useRealTimers() }
  })

  it('clique duplo em Pagar não cria 2 pedidos', async () => {
    montar(pago)
    const botao = await screen.findByRole('button', { name: /Pagar Agora/ })
    fireEvent.change(screen.getByLabelText('CPF do comprador'), { target: { value: '52998224725' } })
    fireEvent.click(botao)
    fireEvent.click(botao)
    expect(h.mutate).toHaveBeenCalledTimes(1)
  })

  it('depois do pedido criado, o CPF fica travado (Pix falhou: o novo clique reaproveita o pedido)', async () => {
    h.mutate.mockImplementationOnce((_v, o) => o.onSuccess({ id: 'o1', total: 50, subtotal: 50, desconto: 0, taxa: 0, venceEm: Date.now() + 300_000 }))
    montar(pago)
    await pagar()
    await waitFor(() => expect((screen.getByLabelText('CPF do comprador') as HTMLInputElement).disabled).toBe(true))
  })
})
