import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerFinance from '../pages/producer/Finance'

// Resumo financeiro: "Ver mais" da lista de pedidos, textos novos e seletor de evento no estado de erro
const TOTAL = 45
const banco = vi.hoisted(() => ({ soma: vi.fn(), intervalos: [] as [number, number][], falha: false }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festa Um' }], isPending: false, isError: false }) }))
vi.mock('../lib/vendasPagas', async orig => ({ ...(await orig<typeof import('../lib/vendasPagas')>()), vendasPagas: banco.soma }))
const linha = (n: number) => ({ id: `p${n}`, event_id: 'e1', total: 10, payment_method: 'pix', created_at: '2026-01-01T00:00:00Z', events: { title: `Evento ${n}` } })
vi.mock('../lib/supabase', () => {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'order']) q[m] = () => q
  q.range = (a: number, z: number) => {
    banco.intervalos.push([a, z])
    const fim = Math.min(z, TOTAL - 1)
    return Promise.resolve({ data: Array.from({ length: Math.max(fim - a + 1, 0) }, (_, i) => linha(a + i)), error: null })
  }
  return { supabase: { from: () => q } }
})

const soma = (extra: object = {}) => ({ total: TOTAL * 10, pedidos: TOTAL, reembolsados: { pedidos: 0, total: 0 }, por_evento: [], por_dia: [], por_forma: [], ...extra })
const montar = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/producer/finance']}><ProducerFinance /></MemoryRouter>
  </QueryClientProvider>,
)
const itens = () => document.querySelectorAll('#fin-pedidos')[0].closest('section')!.querySelectorAll('li').length

describe('Financeiro do produtor', () => {
  afterEach(() => { vi.clearAllMocks(); banco.intervalos = []; cleanup() })

  it('Ver mais: 20, depois 40, depois 45, sem duplicado, e o botão some', async () => {
    banco.soma.mockResolvedValue(soma())
    montar()
    await screen.findByText('Mostrando 20 de 45. O CSV traz todos.')
    expect(itens()).toBe(20)
    fireEvent.click(screen.getByRole('button', { name: 'Ver mais' }))
    await screen.findByText('Mostrando 40 de 45. O CSV traz todos.')
    expect(itens()).toBe(40)
    fireEvent.click(screen.getByRole('button', { name: 'Ver mais' }))
    await waitFor(() => expect(itens()).toBe(45))
    expect(screen.queryByRole('button', { name: 'Ver mais' })).toBeNull()
    expect(banco.intervalos).toEqual([[0, 19], [20, 39], [40, 59]])
    expect(new Set([...document.querySelectorAll('#fin-pedidos')[0].closest('section')!.querySelectorAll('li p.truncate')].map(p => p.textContent)).size).toBe(45)
  })

  it('rótulo do cartão e textos de reembolso', async () => {
    banco.soma.mockResolvedValue(soma({ reembolsados: { pedidos: 2, total: 20 } }))
    montar()
    expect(await screen.findByText('Ticket médio por pedido (bruto)')).toBeInTheDocument()
    expect(screen.getByText(/Pedido reembolsado sai da soma e da lista, no período em que o pedido foi feito, não no do reembolso\./)).toBeInTheDocument()
    expect(screen.getByText(/não entram na soma \(contados pela data do pedido\)\./)).toBeInTheDocument()
  })

  it('sem pedidos o CSV fica desabilitado com explicação', async () => {
    banco.soma.mockResolvedValue(soma({ pedidos: 0, total: 0 }))
    montar()
    await screen.findByText('Nenhum pedido pago ainda')
    const b = screen.getByRole('button', { name: /Exportar CSV/ })
    expect(b).toBeDisabled()
    expect(b).toHaveAttribute('title', 'Sem pedidos pagos para exportar')
  })

  it('no erro mostra a mensagem nova e o seletor de eventos', async () => {
    banco.soma.mockRejectedValue(new Error('x'))
    montar()
    expect(await screen.findByText('Não foi possível carregar o resumo financeiro.')).toBeInTheDocument()
    expect(screen.getByLabelText('Evento')).toBeInTheDocument()
  })
})
