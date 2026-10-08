import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ProducerTimeline from '../pages/producer/Timeline'

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
const banco = vi.hoisted(() => ({ lista: { current: {} as Record<string, unknown> }, fator: vi.fn(), atualizar: vi.fn(), apagar: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festa Um', date: '2026-10-10' }], isLoading: false }) }))
vi.mock('../lib/vendasPagas', () => ({ faltaSegundoFator: banco.fator }))
vi.mock('../hooks/useProducerTools', () => ({
  useEventTimeline: () => banco.lista.current,
  useCreateTimelineItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTimelineItem: () => ({ mutateAsync: banco.atualizar, isPending: false }),
  useDeleteTimelineItem: () => ({ mutateAsync: banco.apagar, isPending: false }),
}))

const item = { id: 'i1', event_id: 'e1', time: '20:00:00', title: 'Show principal', description: 'Banda', type: 'show', responsible: 'Ana', status: 'futuro', duration: '1h', location: 'Palco' }
const ok = (items: unknown[]) => ({ data: items, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })
const montar = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><ProducerTimeline /></MemoryRouter>
  </QueryClientProvider>,
)

describe('tela Cronograma', () => {
  beforeEach(() => { banco.fator.mockReset().mockResolvedValue(false); banco.atualizar.mockReset().mockResolvedValue({}); banco.apagar.mockReset().mockResolvedValue({}) })

  it('editar reabre o modal com os dados e salva pelo update', async () => {
    banco.lista.current = ok([item]); montar()
    await userEvent.click(screen.getByRole('button', { name: 'Editar Show principal' }))
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByText('Editar Item')).toBeInTheDocument()
    expect(within(modal).getByLabelText('Hora')).toHaveValue('20:00')
    const titulo = within(modal).getByLabelText('Título *')
    expect(titulo).toHaveValue('Show principal')
    await userEvent.clear(titulo); await userEvent.type(titulo, 'Show final')
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar' }))
    expect(banco.atualizar).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', event_id: 'e1', title: 'Show final', time: '20:00', responsible: 'Ana' }))
  })

  it('apagar pede confirmação e só remove ao confirmar', async () => {
    banco.lista.current = ok([item]); montar()
    await userEvent.click(screen.getByRole('button', { name: 'Remover Show principal' }))
    expect(banco.apagar).not.toHaveBeenCalled()
    const aviso = screen.getByRole('alertdialog')
    await userEvent.click(within(aviso).getByRole('button', { name: 'Cancelar' }))
    expect(banco.apagar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Remover Show principal' }))
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover' }))
    expect(banco.apagar).toHaveBeenCalledWith({ id: 'i1', event_id: 'e1' })
  })

  it('erro de leitura mostra aviso com "Tentar de novo", não lista vazia', async () => {
    const refetch = vi.fn(); banco.lista.current = { data: undefined, isLoading: false, isError: true, isFetching: false, refetch }
    montar()
    expect(screen.getByText('Não foi possível carregar o cronograma.')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum item no cronograma.')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('2FA pendente não vira "Nenhum item"', async () => {
    banco.lista.current = ok([]); banco.fator.mockResolvedValue(true); montar()
    expect(await screen.findByText('Confirme o 2FA para ver o cronograma')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum item no cronograma.')).toBeNull()
  })

  it('vazio de verdade mostra o estado vazio', async () => {
    banco.lista.current = ok([]); montar()
    expect(await screen.findByText('Nenhum item no cronograma.')).toBeInTheDocument()
  })
})
