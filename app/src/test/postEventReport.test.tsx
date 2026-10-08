import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PostEventReport from '../pages/producer/PostEventReport'

const m = vi.hoisted(() => ({ vendas: { total: 1500.5, pedidos: 3 }, baixar: vi.fn(), sem2fa: false }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festa Junina' }], isLoading: false, isError: false }) }))
vi.mock('../hooks/useProducerTools', () => ({
  useEventSurveys: () => ({ data: [{ id: 's1', score: 10, comment: 'ótimo', participant_email: 'a@x.com', created_at: '2026-10-01' }], isLoading: false, isError: false }),
}))
vi.mock('../lib/vendasPagas', () => ({ vendasPagas: vi.fn(async () => m.vendas), faltaSegundoFator: vi.fn(async () => m.sem2fa) }))
vi.mock('../lib/exportCsv', async (orig) => ({ ...(await orig<typeof import('../lib/exportCsv')>()), downloadCsv: m.baixar }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ in: async () => ({ count: 7, error: null }) }) }) }) },
}))

const montar = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><PostEventReport /></MemoryRouter>
  </QueryClientProvider>,
)

beforeEach(() => { m.baixar.mockClear(); m.vendas = { total: 1500.5, pedidos: 3 }; m.sem2fa = false })

describe('PostEventReport', () => {
  it('usa a soma exata do banco e exporta CSV sem e-mail de comprador', async () => {
    montar()
    await waitFor(() => expect(screen.getByText(/1\.500,50/)).toBeInTheDocument())
    expect(screen.queryByText(/Ainda não há pedidos pagos/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    const [nome, csv] = m.baixar.mock.calls[0]
    expect(nome).toMatch(/^evokaa-pos-evento-festa-junina-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(csv).toContain('Indicador;Valor')
    expect(csv).toContain('Vendas bruto (R$);"1.500,50"')
    expect(csv).toContain('Participantes (ingressos ativos ou usados);7')
    expect(csv).not.toContain('a@x.com')
  })

  it('sem pedido pago, explica a causa', async () => {
    m.vendas = { total: 0, pedidos: 0 }
    montar()
    expect(await screen.findByText('Ainda não há pedidos pagos neste evento; as vendas aparecem zeradas.')).toBeInTheDocument()
    // participantes (7, de tickets/cortesias) não são declarados zerados
    expect(screen.queryByText(/participantes aparecem zerados/i)).toBeNull()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('sem 2FA concluído, avisa do 2FA em vez de "não há pedidos"', async () => {
    m.vendas = { total: 0, pedidos: 0 }; m.sem2fa = true
    montar()
    expect(await screen.findByText('Confirme o 2FA para ver as vendas')).toBeInTheDocument()
    expect(screen.queryByText(/Ainda não há pedidos pagos/)).toBeNull()
  })
})
