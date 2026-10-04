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
  it('erro com a lista já carregada não esconde a lista', () => {
    estado = { isLoading: false, isError: true, data: [{ id: 'abcdef12-0000', event_id: 'e1', status: 'paid', payment_method: 'pix', total_amount: 55, events: { title: 'Noite' } }] }
    tela()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(/Pedido #ABCDEF12/)).toBeTruthy()
  })
  it('evento de outro ano mostra o ano', () => {
    estado = { isLoading: false, isError: false, data: [{ id: 'abcdef12-0000', event_id: 'e1', status: 'paid', payment_method: 'pix', total_amount: 55, events: { title: 'Antigo', date: '2020-03-07' } }] }
    tela()
    expect(screen.getByText('Sáb, 7 mar de 2020')).toBeTruthy()
  })
  it('o cartão traz o número do pedido e a data do evento', () => {
    estado = { isLoading: false, isError: false, data: [{ id: 'abcdef12-0000', event_id: 'e1', status: 'paid', payment_method: 'pix', total_amount: 55, created_at: '2026-10-01T12:00:00Z', events: { title: 'Noite de Forró', date: `${new Date().getFullYear()}-12-12`, time: '22:00:00', venue_name: 'Espaço' } }] }
    tela()
    expect(screen.getByText(/Pedido #ABCDEF12/)).toBeTruthy()
    expect(screen.getByText(/, 12 dez · 22h$/)).toBeTruthy()
  })
  it('mostra a quantidade e o tipo de cada item do pedido', () => {
    estado = { isLoading: false, isError: false, data: [{ id: 'abcdef12-0000', event_id: 'e1', status: 'paid', payment_method: 'pix', total_amount: 55, events: { title: 'Noite', status: 'published' }, order_items: [{ quantity: 2, ticket_types: { name: 'Pista' } }, { quantity: 1, ticket_types: { name: 'VIP' } }] }] }
    tela()
    expect(screen.getByText('2× Pista, 1× VIP')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('evento que saiu do ar tem cartão próprio: sem data e local inventados, com o aviso', () => {
    estado = { isLoading: false, isError: false, data: [{ id: 'abcdef12-0000', event_id: 'e1', status: 'pending', payment_method: 'pix', total_amount: 55, events: null, order_items: [] }] }
    tela()
    expect(screen.getByRole('heading', { name: 'Evento indisponível' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Fale com o suporte')
    expect(screen.queryByText('Data a definir')).toBeNull()
    expect(screen.queryByText('Local a definir')).toBeNull()
  })
  it('evento cancelado (ainda legível) mostra o aviso junto da data', () => {
    estado = { isLoading: false, isError: false, data: [{ id: 'abcdef12-0000', event_id: 'e1', status: 'paid', payment_method: 'pix', total_amount: 55, events: { title: 'Noite', date: '2030-12-12', status: 'cancelled' } }] }
    tela()
    expect(screen.getByRole('status').textContent).toContain('Evento cancelado')
    expect(screen.getByRole('heading', { name: 'Noite' })).toBeTruthy()
  })
})
