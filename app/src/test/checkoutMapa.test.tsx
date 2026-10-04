import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Checkout from '../pages/checkout/Checkout'

const h = vi.hoisted(() => ({ mapa: null as unknown }))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'u1', birth_date: '1990-01-01' } }) }))
vi.mock('../hooks/useEvents', () => ({
  usePublicEvent: () => ({
    isLoading: false,
    error: null,
    data: { id: 'e1', title: 'Festa', ticket_types: [{ id: 'tt1', name: 'Pista', price: 50, type: 'individual' }] },
  }),
}))
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.mapa, error: null }) }) }) }) },
}))

const montar = () => render(
  <MemoryRouter initialEntries={[{ pathname: '/checkout', state: { eventId: 'e1', cart: { tt1: 2 } } }]}><Checkout /></MemoryRouter>
)

describe('Checkout com mapa de assentos (E7a)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    h.mapa = {
      environments: [{
        id: 'terreo', name: 'Térreo', sections: [{ id: 'vip', name: 'VIP', color: '#000', price: 99, ticketTypeId: 'tt1' }],
        seats: [{ id: 's1', type: 'seat', label: 'A1', x: 2, y: 2, sectionId: 'vip', status: 'free', price: 99, color: '#000' }],
      }],
    }
  })

  it('abre na seleção rápida e o carrinho da página do evento não é zerado, com ou sem o mapa na tela', async () => {
    montar()
    const alternar = await screen.findByRole('button', { name: 'Ver o mapa do salão' })
    await waitFor(() => expect(screen.getAllByText(/100,00/).length).toBeGreaterThan(0)) // 2 x R$ 50
    fireEvent.click(alternar)
    expect((await screen.findByRole('note')).textContent).toMatch(/ainda não reserva o assento/)
    expect(screen.getAllByText(/100,00/).length).toBeGreaterThan(0) // continua 2 x R$ 50
  })

  it('o mapa é só visualização: clicar num assento livre não abre pedido de ocupante nem põe item no carrinho', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver o mapa do salão' }))
    await screen.findByRole('note')
    const assento = document.querySelector('div.absolute.origin-center') as HTMLElement // o assento A1
    expect(assento.className).not.toContain('cursor-pointer') // livre não parece clicável
    fireEvent.click(assento)
    expect(screen.queryByRole('textbox')).toBeNull() // sem modal do nome do ocupante
    expect(screen.queryByText(/assento\(s\)/)).toBeNull()
    expect(screen.getAllByText(/100,00/).length).toBeGreaterThan(0) // carrinho segue só com a seleção rápida
  })
})
