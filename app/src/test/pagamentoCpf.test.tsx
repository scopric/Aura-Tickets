import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CheckoutPayment from '../pages/checkout/Payment'

const h = vi.hoisted(() => ({ mutate: vi.fn(), toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../hooks/useCheckout', () => ({ useCreateOrder: () => ({ mutate: h.mutate, isPending: false }) }))
vi.mock('../hooks/usePayment', () => ({ usePayment: () => ({ pagarPix: vi.fn(async () => ({ ok: false, mensagem: 'sem gateway no teste', tentarDeNovo: true })) }) }))
vi.mock('../stores/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { email: 'a@a.com', full_name: 'Ana' } }) }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: vi.fn() } }))

// Carrinho velho: sem max_por_cpf no item (grátis, para não exigir cartão)
const montar = () => render(
  <MemoryRouter initialEntries={[{ pathname: '/checkout/payment', state: { eventId: 'e1', cart: { tt1: 1 }, itemsSummary: [{ ticket_type_id: 'tt1', quantity: 1, name: 'Pista', price: 0 }] } }]}>
    <Routes><Route path="/checkout/payment" element={<CheckoutPayment />} /></Routes>
  </MemoryRouter>
)

describe('Pagamento: CPF exigido pelo banco com carrinho velho', () => {
  beforeEach(() => vi.clearAllMocks())

  it('22023 "Informe o CPF…": mostra o campo com foco e erro; ao reenviar, manda só os dígitos', async () => {
    h.mutate.mockImplementationOnce((_v, o) => o.onError(Object.assign(new Error('Informe o CPF do comprador para este ingresso'), { code: '22023' })))
    montar()
    expect(screen.queryByLabelText('CPF do comprador')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /Garantir ingresso grátis/ }))
    const campo = await screen.findByLabelText('CPF do comprador')
    expect(screen.getByRole('alert').textContent).toBe('Informe o CPF para continuar')
    await waitFor(() => expect(document.activeElement).toBe(campo))
    expect(h.toast.error).not.toHaveBeenCalled()
    expect(h.mutate.mock.calls[0][0]).not.toHaveProperty('customer_cpf')

    fireEvent.change(campo, { target: { value: '52998224725' } })
    expect((campo as HTMLInputElement).value).toBe('529.982.247-25')
    fireEvent.click(screen.getByRole('button', { name: /Garantir ingresso grátis/ }))
    expect(h.mutate).toHaveBeenCalledTimes(2)
    expect(h.mutate.mock.calls[1][0]).toMatchObject({ event_id: 'e1', items: [{ ticket_type_id: 'tt1', quantity: 1 }], customer_cpf: '52998224725' })
  })

  it('CPF inválido não envia e põe o foco no campo', async () => {
    h.mutate.mockImplementationOnce((_v, o) => o.onError(Object.assign(new Error('Informe o CPF do comprador para este ingresso'), { code: '22023' })))
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Garantir ingresso grátis/ }))
    const campo = await screen.findByLabelText('CPF do comprador')
    fireEvent.change(campo, { target: { value: '11111111111' } })
    campo.blur()
    fireEvent.click(screen.getByRole('button', { name: /Garantir ingresso grátis/ }))
    expect(screen.getByRole('alert').textContent).toMatch(/CPF inválido/)
    await waitFor(() => expect(document.activeElement).toBe(campo))
    expect(h.mutate).toHaveBeenCalledTimes(1)
  })
})
