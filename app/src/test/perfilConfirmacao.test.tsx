import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const toast = vi.hoisted(() => Object.assign(vi.fn(), { loading: vi.fn(() => 'id'), success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

// Perfil: o banco responde ao update com zero linha (RLS filtrando) ou com a linha
let linhas: { id: string }[] = []
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ update: () => ({ eq: () => ({ select: () => Promise.resolve({ data: linhas, error: null }) }) }) }) },
}))
// usuário estável: um objeto novo a cada render refaria o efeito do Perfil em laço
const usuario = vi.hoisted(() => ({ id: 'u1', full_name: 'Ana', email: 'a@a.com', phone: '', city: '', bio: '', birth_date: null }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: usuario }) }))
vi.mock('../hooks/useTwoFactor', () => ({ useTwoFactor: () => ({ loading: false, enabled: false, toggle: vi.fn(), modal: null }) }))
vi.mock('../hooks/useMatchmaking', () => ({ useMatchmakingProfile: () => ({ profile: null }), consentimentoVigente: () => false }))
vi.mock('../hooks/useUserTickets', () => ({ useUserTickets: () => ({ data: [], isLoading: false }) }))
vi.mock('../hooks/useUserOrders', () => ({ useUserOrders: () => ({ data: [], isLoading: false }) }))
const pedidoLido = vi.hoisted(() => vi.fn())
const pedido = vi.hoisted(() => ({ vazio: false, meu: false }))
vi.mock('../hooks/useCheckout', () => ({
  useOrderVisivel: () => ({ data: pedido.meu ? { id: 'x', subtotal: 10, service_fee: 3, total: 13 } : null, isLoading: false }),
  useOrderTickets: (id?: string) => (pedidoLido(id), {
    isLoading: false,
    data: pedido.vazio ? [] : [{ id: 't1', status: 'cancelled', code: 'EVK-1', ticket_types: { name: 'Pista', price: 10, type: 'individual' }, events: { id: 'e1', title: 'Noite', date: '2026-12-12', time: '20:00:00' } }],
  }),
}))
vi.mock('../hooks/useEvents', () => ({ usePublicEvent: () => ({ data: undefined, isLoading: false }) }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
vi.mock('../components/YourTable', () => ({ default: () => null }))
vi.mock('../lib/confete', () => ({ soltarConfete: () => () => {} }))

import Profile from '../pages/app/Profile'
import Success from '../pages/checkout/Success'

beforeEach(() => vi.clearAllMocks())

describe('Perfil', () => {
  const editar = () => {
    render(<MemoryRouter><Profile /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
  }
  it('Salvar com zero linha gravada vira erro, não sucesso', async () => {
    linhas = []
    editar()
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
  })
  it('Salvar com a linha gravada dá sucesso; Cancelar desfaz a edição', async () => {
    linhas = [{ id: 'u1' }]
    editar()
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Outro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Nome')).toBeNull()
    expect(screen.getByText('Ana', { selector: 'div' })).toBeTruthy()
  })
})

describe('Confirmação da compra', () => {
  it('mostra ingresso, taxa e total do pedido gravado (R$ 10,00 + R$ 3,00 = R$ 13,00) e o horário sem segundos', () => {
    pedido.meu = true
    render(<MemoryRouter initialEntries={[{ pathname: '/checkout/success', state: { orderId: 'o1', totalAmount: 13 } }]}><Success /></MemoryRouter>)
    pedido.meu = false
    expect(screen.getByText('Taxa de serviço')).toBeTruthy()
    expect(screen.getByText(/R\$\s10,00/)).toBeTruthy()
    expect(screen.getByText(/R\$\s3,00/)).toBeTruthy()
    expect(screen.getByText(/R\$\s13,00/)).toBeTruthy()
    expect(screen.queryByText(/20:00:00/)).toBeNull()
    expect(screen.getAllByText(/20h/).length).toBeGreaterThan(0)
  })
  it('lê o pedido pelo link (?pedido=), sem o estado da navegação (outra aba, recarregar)', () => {
    const id = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d'
    render(<MemoryRouter initialEntries={[`/checkout/success?pedido=${id}`]}><Success /></MemoryRouter>)
    expect(pedidoLido).toHaveBeenLastCalledWith(id)
    expect(screen.getByRole('link', { name: /Instalar a Evokaa no celular/ })).toHaveAttribute('href', '/app/download')
  })
  it('?pedido= que não é um código de pedido é ignorado: vale o estado, se houver', () => {
    render(<MemoryRouter initialEntries={[{ pathname: '/checkout/success', search: '?pedido=lixo', state: { orderId: 'o1' } }]}><Success /></MemoryRouter>)
    expect(pedidoLido).toHaveBeenLastCalledWith('o1')
  })
  it('pedido só pelo link e sem ingresso visível nesta conta: diz que não achou, sem "Pedido registrado"', () => {
    pedido.vazio = true
    render(<MemoryRouter initialEntries={['/checkout/success?pedido=0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d']}><Success /></MemoryRouter>)
    pedido.vazio = false
    expect(screen.getByRole('heading', { name: /Não encontramos este pedido/ })).toBeTruthy()
    expect(screen.queryByText(/Pedido registrado/)).toBeNull()
  })
  it('pedido próprio sem ingresso (nasce pendente), aberto só pelo link: "Pedido registrado", não "não encontramos"', () => {
    pedido.vazio = true
    pedido.meu = true
    render(<MemoryRouter initialEntries={['/checkout/success?pedido=0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d']}><Success /></MemoryRouter>)
    pedido.vazio = false
    pedido.meu = false
    expect(screen.getByRole('heading', { name: /Pedido registrado/ })).toBeTruthy()
    expect(screen.queryByText(/Não encontramos este pedido/)).toBeNull()
  })
})
