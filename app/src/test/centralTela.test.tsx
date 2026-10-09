import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerCentral from '../pages/producer/Central'

// jsdom não tem ResizeObserver (o ResponsiveContainer do recharts precisa)
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

const banco = vi.hoisted(() => ({ soma: vi.fn(), fator: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festa Um', ticket_types: [] }], isSuccess: true, isPending: false, isError: false }) }))
vi.mock('../lib/vendasPagas', async orig => ({ ...(await orig<typeof import('../lib/vendasPagas')>()), vendasPagas: banco.soma, faltaSegundoFator: banco.fator }))

const soma = (extra: object = {}) => ({ total: 0, pedidos: 0, reembolsados: { pedidos: 0, total: 0 }, por_evento: [], por_dia: [], por_forma: [], ...extra })
const montar = (url = '/producer/central') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[url]}><ProducerCentral /></MemoryRouter>
  </QueryClientProvider>,
)

describe('Dashboards (Central de comando)', () => {
  afterEach(() => { vi.clearAllMocks(); localStorage.clear(); cleanup() })

  it('tem os 4 tipos como abas', async () => {
    banco.soma.mockResolvedValue(soma()); banco.fator.mockResolvedValue(false)
    montar()
    for (const n of ['Ritmo de vendas', 'Dia do evento', 'Dinheiro', 'Público e conversão']) expect(screen.getByRole('tab', { name: n })).toBeInTheDocument()
  })

  it('zero vendas com 2FA pendente avisa e não mostra R$ 0', async () => {
    banco.soma.mockResolvedValue(soma()); banco.fator.mockResolvedValue(true)
    montar()
    await waitFor(() => expect(screen.getByText(/Confirme o 2FA/)).toBeInTheDocument())
    expect(screen.queryByText(/R\$\s*0,00/)).toBeNull()
  })

  it('com venda mostra o bruto e "Ver como tabela" abre a tabela com legenda', async () => {
    banco.fator.mockResolvedValue(false)
    banco.soma.mockResolvedValue(soma({ total: 250, pedidos: 2, por_dia: [{ dia: '2026-10-07', pedidos: 2, total: 250 }], por_evento: [{ event_id: 'e1', titulo: 'Festa Um', pedidos: 2, total: 250 }], por_forma: [{ forma: 'pix', pedidos: 2, total: 250 }] }))
    montar('/producer/central?tipo=ritmo&periodo=30d&comparar=0')
    await waitFor(() => expect(screen.getAllByText(/250,00/).length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByRole('button', { name: /Ver como tabela/ })[0])
    expect(document.querySelector('table caption')).toBeTruthy()
  })

  it('Dinheiro com a consulta falhando não mostra reembolso zerado nem R$ 0', async () => {
    banco.soma.mockRejectedValue(new Error('rpc')); banco.fator.mockResolvedValue(false)
    montar('/producer/central?tipo=dinheiro')
    await waitFor(() => expect(screen.getByText(/Não deu para carregar os reembolsos/)).toBeInTheDocument(), { timeout: 6000 })
    expect(screen.queryByText(/0 pedidos reembolsados/)).toBeNull()
  })

  it('clicar numa forma de pagamento filtra pela URL e evento desconhecido vira todos', async () => {
    banco.fator.mockResolvedValue(false)
    banco.soma.mockResolvedValue(soma({ total: 250, pedidos: 2, por_dia: [{ dia: '2026-10-07', pedidos: 2, total: 250 }], por_forma: [{ forma: 'pix', pedidos: 2, total: 250 }] }))
    montar('/producer/central?tipo=ritmo&periodo=30d&comparar=0&evento=de-outro-produtor')
    await waitFor(() => expect(banco.soma).toHaveBeenCalled())
    expect(banco.soma.mock.calls[0][0].eventId).toBeNull()
    const botao = await screen.findByRole('button', { name: 'Pix' })
    fireEvent.click(botao)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pix' })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('o seletor de métrica troca o gráfico: Pedidos e Ticket médio por dia (tabela e mini-tendências)', async () => {
    banco.fator.mockResolvedValue(false)
    banco.soma.mockResolvedValue(soma({ total: 500, pedidos: 4, por_dia: [{ dia: '2026-10-06', pedidos: 1, total: 100 }, { dia: '2026-10-07', pedidos: 3, total: 400 }], por_forma: [{ forma: 'pix', pedidos: 4, total: 500 }] }))
    const { container } = montar('/producer/central?tipo=ritmo&periodo=30d&comparar=0')
    await waitFor(() => expect(screen.getAllByText(/500,00/).length).toBeGreaterThan(0))
    expect(container.querySelectorAll('polyline').length).toBe(3) // bruto, pedidos e ticket médio
    fireEvent.click(screen.getByRole('button', { name: 'Pix' })) // com forma escolhida a curva (de todas as formas) sai dos cartões
    expect(container.querySelectorAll('polyline').length).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Pix' }))
    expect(container.querySelectorAll('polyline').length).toBe(3)
    fireEvent.click(screen.getByRole('radio', { name: 'Pedidos' }))
    expect(container.querySelector('[role=img][aria-label^="Pedidos por dia"]')?.getAttribute('aria-label')).not.toMatch(/R\$/) // o texto do leitor de tela acompanha a métrica
    fireEvent.click(screen.getAllByRole('button', { name: /Ver como tabela/ })[0])
    expect(document.querySelector('table caption')!.textContent).toBe('Pedidos por dia')
    fireEvent.click(screen.getByRole('radio', { name: 'Ticket médio' }))
    expect(document.querySelector('table caption')!.textContent).toBe('Ticket médio por dia')
    const celulas = () => [...document.querySelectorAll('table tbody td')].map(c => c.textContent?.replace(/\s/g, ' ')) // brl usa espaço inseparável
    expect(celulas()).toContain('R$ 100,00') // dia 6: 100 / 1 pedido
    expect(celulas()).toContain('—') // dias sem pedido: sem ticket médio (nunca R$ 0,00)
    expect(celulas().filter(c => c === 'R$ 0,00')).toEqual([])
    fireEvent.click(screen.getByRole('radio', { name: 'Pedidos' }))
    expect(celulas()).toContain('3') // inteiro, sem R$
    expect(celulas().some(c => c?.includes('R$'))).toBe(false)
    const pts = [...container.querySelectorAll('polyline')].map(l => l.getAttribute('points'))
    expect(new Set(pts).size).toBeGreaterThan(1) // as 3 mini-tendências são de séries diferentes
  })
})
