import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const refetch = vi.fn()
let estado: Record<string, unknown> = {}
vi.mock('../hooks/useCheckout', () => ({ useUserOrders: () => ({ refetch, ...estado }) }))
vi.mock('../hooks/useConversas', () => ({ useChatConfig: () => ({ data: { prazo: 'Respondemos em até 1 dia útil.' } }) }))
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
  const pedido = (status: string) => ({ id: 'abcdef12-0000-4000-8000-000000000000', event_id: 'e1', status, payment_method: 'pix', total_amount: 55, events: { title: 'Noite' } })
  it('"Ver ingressos" só aparece em pedido pago e leva ao evento do pedido', () => {
    for (const st of ['pending', 'failed', 'cancelled', 'refunded']) {
      estado = { isLoading: false, isError: false, data: [pedido(st)] }
      const { unmount } = tela()
      expect(screen.queryByRole('link', { name: /Ver ingressos/ })).toBeNull()
      unmount()
    }
    estado = { isLoading: false, isError: false, data: [pedido('paid')] }
    tela()
    expect(screen.getByRole('link', { name: /Ver ingressos/ }).getAttribute('href')).toBe('/app/tickets?evento=e1')
  })
  it('copia o número completo do pedido e avisa quando falha', async () => {
    estado = { isLoading: false, isError: false, data: [pedido('paid')] }
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('negado'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    tela()
    fireEvent.click(screen.getByRole('button', { name: /Copiar número do pedido/ }))
    expect(await screen.findByText('Copiado')).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith('abcdef12-0000-4000-8000-000000000000')
    fireEvent.click(screen.getByRole('button', { name: /Copiar número do pedido/ }))
    expect(await screen.findByText('Não foi possível copiar')).toBeTruthy()
  })
  it('suporte do pedido: mostra o prazo e pede o chat com o número do pedido', () => {
    estado = { isLoading: false, isError: false, data: [pedido('pending')] }
    const ouvir = vi.fn()
    window.addEventListener('evo:suporte', ouvir)
    tela()
    expect(screen.getByText('Respondemos em até 1 dia útil.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Falar com o suporte sobre este pedido/ }))
    window.removeEventListener('evo:suporte', ouvir)
    const d = (ouvir.mock.calls[0][0] as CustomEvent).detail
    expect(d.assunto).toBe('Pagamento: cobrança, Pix ou cartão')
    expect(d.texto).toContain('#ABCDEF12')
  })
})
