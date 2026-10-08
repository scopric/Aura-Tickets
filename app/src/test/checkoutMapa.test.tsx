import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import Checkout from '../pages/checkout/Checkout'

const h = vi.hoisted(() => ({
  mapa: null as unknown,
  eq: [] as unknown[][],
  ocupados: [] as { seat_key: string; estado: string }[],
  reservar: vi.fn(),
  vitrine: [] as unknown[],
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'u1', birth_date: '1990-01-01' } }) }))
vi.mock('../hooks/useEvents', () => ({
  usePublicEvent: () => ({
    isLoading: false,
    error: null,
    data: { id: 'e1', title: 'Festa', ticket_types: [{ id: 'tt1', name: 'Pista', price: 50, type: 'individual' }] },
  }),
}))
vi.mock('../lib/supabase', () => {
  const consulta = { eq: (...a: unknown[]) => { h.eq.push(a); return consulta }, maybeSingle: async () => ({ data: h.mapa, error: null }) }
  return {
    supabase: {
      from: () => ({ select: () => consulta }),
      rpc: async (nome: string, args: unknown) => nome === 'assentos_ocupados' ? { data: h.ocupados, error: null } : nome === 'vitrine_ingressos' ? { data: h.vitrine, error: null } : nome === 'meia_beneficios' ? { data: null, error: { message: 'não existe' } } : h.reservar(args),
    },
  }
})

const Pagamento = () => <p data-testid="pagamento">{JSON.stringify((useLocation().state as { orderId?: string; itemsSummary?: unknown })?.orderId)}</p>
const montar = (cart: Record<string, number> = { tt1: 2 }, abrirMapa = false) => render(
  <QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[{ pathname: '/checkout', state: { eventId: 'e1', cart, abrirMapa } }]}>
    <Routes>
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/checkout/payment" element={<Pagamento />} />
    </Routes>
  </MemoryRouter></QueryClientProvider>
)

describe('Checkout com mapa de assentos (lugar marcado)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
    h.eq = []
    h.ocupados = []
    h.vitrine = []
    h.reservar.mockResolvedValue({ data: { order_id: 'ord-1', expira_em: '2026-10-08T12:10:00Z', agora: '2026-10-08T12:00:00Z' }, error: null })
    h.mapa = {
      environments: [{
        id: 'terreo', name: 'Térreo', sections: [{ id: 'vip', name: 'VIP', color: '#000', price: 99, ticketTypeId: 'tt1' }, { id: 'sem', name: 'Sem', color: '#000', price: 1 }],
        seats: [
          { id: 's1', type: 'seat', label: 'A1', x: 2, y: 2, sectionId: 'vip', status: 'free', price: 99, color: '#000' },
          { id: 's2', type: 'seat', label: 'A2', x: 4, y: 2, sectionId: 'vip', status: 'free', price: 99, color: '#000' },
          { id: 's3', type: 'seat', label: 'A3', x: 6, y: 2, sectionId: 'sem', status: 'free', price: 1, color: '#000' },
        ],
      }],
    }
  })

  it('só lê mapa ativo; abre na seleção rápida e o carrinho da página do evento não é zerado, com ou sem o mapa na tela', async () => {
    montar()
    const alternar = await screen.findByRole('button', { name: 'Ver o mapa do salão' })
    expect(h.eq).toContainEqual(['is_active', true])
    await waitFor(() => expect(screen.getAllByText(/100,00/).length).toBeGreaterThan(0)) // 2 x R$ 50
    fireEvent.click(alternar)
    expect((await screen.findByRole('note')).textContent).toMatch(/reservados para você por 10 minutos/)
    expect(screen.getAllByText(/100,00/).length).toBeGreaterThan(0) // continua 2 x R$ 50
  })

  it('escolher lugar: seleciona, soma o preço do banco e Continuar reserva e leva ao pagamento com o pedido criado', async () => {
    montar({}, true)
    const a1 = await screen.findByRole('button', { name: 'A1' })
    expect(screen.queryByRole('button', { name: 'A3' })).toBeNull() // setor sem ingresso ligado não é vendável
    fireEvent.click(a1)
    fireEvent.click(screen.getByRole('button', { name: 'A2' }))
    expect(screen.getByRole('button', { name: 'A1, escolhido' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('2 lugares escolhidos')).toBeTruthy()
    expect(screen.getByText('2 × Pista')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Continuar para Pagamento/ }))
    await waitFor(() => expect(screen.getByTestId('pagamento').textContent).toBe('"ord-1"'))
    expect(h.reservar).toHaveBeenCalledWith({ p_event: 'e1', p_seats: ['terreo:s1', 'terreo:s2'] })
  })

  it('lugar vendido ou reservado por outra pessoa não é escolhível', async () => {
    h.ocupados = [{ seat_key: 'terreo:s2', estado: 'vendido' }]
    montar({}, true)
    await screen.findByRole('button', { name: 'A1' })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'A2' })).toBeNull())
    expect(screen.queryByText(/lugar escolhido|lugares escolhidos/)).toBeNull()
  })

  it('lugar tomado na hora: o banco recusa, o aviso aparece e o lugar sai da escolha', async () => {
    montar({}, true)
    fireEvent.click(await screen.findByRole('button', { name: 'A1' }))
    h.reservar.mockResolvedValue({ data: null, error: { message: 'Lugar acabou de ser escolhido' } })
    h.ocupados = [{ seat_key: 'terreo:s1', estado: 'reservado' }]
    fireEvent.click(screen.getByRole('button', { name: /Continuar para Pagamento/ }))
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Lugar acabou de ser escolhido', expect.anything()))
    await waitFor(() => expect(screen.queryByText('1 lugar escolhido')).toBeNull())
    expect(screen.queryByTestId('pagamento')).toBeNull()
  })

  it('com ingressos na seleção rápida, escolher lugar avisa e não mistura os dois', async () => {
    montar({ tt1: 2 }, true)
    fireEvent.click(await screen.findByRole('button', { name: 'A1' }))
    expect(h.toast.info).toHaveBeenCalledWith(expect.stringMatching(/seleção rápida/))
    expect(screen.queryByText('1 lugar escolhido')).toBeNull()
  })

  it('meia por lugar: p_meias leva só o lugar de meia (sem nulos) e o pedido mostra a meia', async () => {
    h.vitrine = [{ ticket_type_id: 'tt1', nome: 'Pista', preco: 99, taxa: 9.9, preco_meia: 49.5, taxa_meia: 4.95, permite_meia: true, disponiveis: 10, meias_disponiveis: 4, meias_total: 4 }]
    montar({}, true)
    fireEvent.click(await screen.findByRole('button', { name: 'A1' }))
    fireEvent.click(screen.getByRole('button', { name: 'A2' }))
    fireEvent.change(await screen.findByLabelText('Ingresso do lugar A2'), { target: { value: 'estudante' } })
    expect(screen.getByText('1 × Pista (meia-entrada)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Continuar para Pagamento/ }))
    await waitFor(() => expect(screen.getByTestId('pagamento').textContent).toBe('"ord-1"'))
    const chamada = h.reservar.mock.calls.map(c => c[0]).find(a => a?.p_seats)
    expect(chamada).toEqual({ p_event: 'e1', p_seats: ['terreo:s1', 'terreo:s2'], p_meias: [{ seat_key: 'terreo:s2', meia_tipo: 'estudante' }] })
  })
})
