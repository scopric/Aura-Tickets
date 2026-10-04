import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const refetch = vi.fn()
let estado: Record<string, unknown> = {}
vi.mock('../hooks/useCheckout', () => ({ useUserOrders: () => ({ refetch, ...estado }) }))
import Orders from '../pages/app/Orders'

const tela = () => render(<MemoryRouter><Orders /></MemoryRouter>)

describe('Compras', () => {
  it('erro ao carregar não vira "nenhuma compra": mostra o erro e tenta de novo', () => {
    estado = { data: [], isLoading: false, isError: true }
    tela()
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar')
    expect(screen.queryByText(/nenhuma compra/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refetch).toHaveBeenCalled()
  })
  it('o cartão traz o número do pedido e a data do evento', () => {
    estado = { isLoading: false, isError: false, data: [{ id: 'abcdef12-0000', event_id: 'e1', status: 'paid', payment_method: 'pix', total_amount: 55, created_at: '2026-10-01T12:00:00Z', events: { title: 'Noite de Forró', date: '2026-12-12', time: '22:00:00', venue_name: 'Espaço' } }] }
    tela()
    expect(screen.getByText(/Pedido #ABCDEF12/)).toBeTruthy()
    expect(screen.getByText('Sáb, 12 dez · 22h')).toBeTruthy()
  })
})
