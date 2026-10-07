import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import ProducerEvents from '../pages/producer/Events'
import { SAIR_DO_AR_COM_VENDA, CANCELAR_COM_VENDA } from '../lib/eventoProdutor'

// Ganchos falsos: a tela é testada sem banco
const atualizar = vi.fn()
const apagar = vi.fn()
let lista: object[] = []
let vendidosMock: Record<string, number> = {}
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../hooks/useEvents', () => ({
  useProducerEvents: () => ({ data: lista, isLoading: false, isError: false, refetch: vi.fn(), isFetching: false }),
  useVendidosPorEvento: () => ({ data: { porEvento: vendidosMock, cortado: false } }),
  useDeleteEvent: () => ({ mutateAsync: apagar, isPending: false }),
  useUpdateEvent: () => ({ mutateAsync: atualizar, isPending: false }),
}))
vi.mock('../hooks/useDuplicarEvento', () => ({ useDuplicarEvento: () => ({ duplicar: vi.fn(), duplicando: false }) }))

const evento = (extra: object = {}) => ({
  id: 'e1', title: 'Noite de Forró', status: 'published', approval_status: 'approved', date: '2099-01-01', time: '22:00:00',
  start_date: '2099-01-01T22:00:00-03:00', end_date: null, venue_name: 'Espaço', cover_image: null, image_url: null, capacity: null, ticket_types: [], ...extra,
})
const montar = () => render(<MemoryRouter><ProducerEvents /></MemoryRouter>)

beforeEach(() => { atualizar.mockReset(); apagar.mockReset(); vi.mocked(toast.error).mockClear(); lista = [evento()]; vendidosMock = {} })

describe('Todos os eventos (tela 02)', () => {
  it('busca sem acento: "forro" acha "Forró"', () => {
    lista = [evento(), evento({ id: 'e2', title: 'Samba' })]
    montar()
    fireEvent.change(screen.getByLabelText('Buscar eventos'), { target: { value: 'forro' } })
    expect(screen.getByText('Noite de Forró')).toBeTruthy()
    expect(screen.queryByText('Samba')).toBeNull()
  })

  it('Encerrar abre a janela e confirmar grava status ended', async () => {
    atualizar.mockResolvedValue({})
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar Noite de Forró' }))
    expect(screen.getByRole('alertdialog').textContent).toMatch(/Encerrar "Noite de Forró"/)
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }))
    await waitFor(() => expect(atualizar).toHaveBeenCalledWith({ eventId: 'e1', event: { status: 'ended' }, tickets: [] }))
  })

  it('EV002 vindo do banco (cache velho) mostra a mensagem de venda', async () => {
    atualizar.mockRejectedValue({ code: 'EV002' })
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar Noite de Forró' }))
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(SAIR_DO_AR_COM_VENDA))
  })

  it('Encerrar só aparece em evento publicado', () => {
    lista = [evento({ status: 'draft' })]
    montar()
    expect(screen.queryByRole('button', { name: /^Encerrar/ })).toBeNull()
  })

  it('excluir com erro 23503 em orders diz que são pedidos', async () => {
    apagar.mockRejectedValue({ code: '23503', details: 'Key (id)=(e1) is still referenced from table "orders".' })
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Noite de Forró' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/tem pedidos/))
  })

  it('Cancelar abre a janela', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar Noite de Forró' }))
    expect(screen.getByRole('alertdialog').textContent).toMatch(/Cancelar o evento "Noite de Forró"/)
  })

  it('Cancelar e Encerrar com venda: toast, sem janela e sem update', () => {
    vendidosMock = { e1: 3 }
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar Noite de Forró' }))
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar Noite de Forró' }))
    expect(vi.mocked(toast.error).mock.calls.map(c => c[0])).toEqual([CANCELAR_COM_VENDA, SAIR_DO_AR_COM_VENDA])
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(atualizar).not.toHaveBeenCalled()
  })

  it('Encerrar com venda e data já passada abre a janela', () => {
    vendidosMock = { e1: 3 }
    lista = [evento({ date: '2020-01-01', start_date: '2020-01-01T22:00:00-03:00' })]
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar Noite de Forró' }))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('Excluir com venda: toast e sem janela', () => {
    vendidosMock = { e1: 3 }
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Noite de Forró' }))
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/3 ingressos vendidos/)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('sem botão Cancelar em evento cancelado', () => {
    lista = [evento({ status: 'cancelled' })]
    montar()
    expect(screen.queryByRole('button', { name: /^Cancelar/ })).toBeNull()
  })
})
