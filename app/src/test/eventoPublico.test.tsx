import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../contexts/ThemeContext'
import EventPage from '../pages/EventPage'
import ContadorIngresso from '../components/ContadorIngresso'

// V11a: a página pública do evento. Preço e taxa continuam saindo de lib/taxa (taxa.test.ts); aqui se confere o que a
// página mostra: taxa ao lado do preço, esgotado só com lotação real, a barra de compra e o "N pessoas vão" opcional.
let evento: Record<string, unknown>
vi.mock('../hooks/useEvents', () => ({ usePublicEvent: () => ({ data: evento, isLoading: false, error: null }) }))
vi.mock('../components/CollectiveTableCard', () => ({ default: () => <div data-testid="mesa" /> }))

const ingresso = (o: Record<string, unknown>) => ({ id: 't1', name: 'Pista', price: 25, type: 'individual', sold: 0, perks: [], ...o })
const base = (o: Record<string, unknown> = {}) => ({
  id: 'e1', title: 'Noite de Forró', date: '2026-12-12', time: '22:00:00', venue_name: 'Espaço Torres', cover_image: null,
  accent_color: '#a55c65', ticket_types: [ingresso({})], ...o,
})

function montar() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/event/e1']}><ThemeProvider><EventPage /></ThemeProvider></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  evento = base()
})

describe('página do evento (V11a)', () => {
  it('nome uma vez em h1, preço com a taxa ao lado e sem lotação inventada', () => {
    evento = base({ ticket_types: [ingresso({ sold: 90, capacity: null, quantity_total: 0 })] })
    montar()
    expect(screen.getByRole('heading', { level: 1, name: 'Noite de Forró' })).toBeInTheDocument()
    expect(screen.getByText(/R\$\s25,00 \+ R\$\s3,00 de taxa/)).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s28,00/).length).toBeGreaterThanOrEqual(2) // na linha do ingresso e na barra de compra
    expect(screen.queryByText(/Quase esgotado|vendidos/)).toBeNull()
    // 90 vendidos e nenhuma lotação no banco: não se afirma esgotado (antes valia `capacity || 100`)
    expect(screen.queryByText(/Esgotado/)).toBeNull()
    expect(screen.getByRole('button', { name: /^Adicionar um / })).toBeEnabled()
  })

  it('esgotado só quando a lotação real foi atingida: o contador some', () => {
    evento = base({ ticket_types: [ingresso({ sold: 10, quantity_total: 10 })] })
    montar()
    expect(screen.getByText(/Esgotado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Adicionar um / })).toBeNull()
    expect(screen.getByRole('button', { name: 'Comprar' })).toBeDisabled()
  })

  it('barra de compra: "a partir de" com a taxa; ao escolher vira total e "Finalizar"', () => {
    montar()
    expect(screen.getByText(/A partir de/).textContent).toMatch(/R\$\s28,00/)
    fireEvent.click(screen.getByRole('button', { name: /^Adicionar um / }))
    fireEvent.click(screen.getByRole('button', { name: /^Adicionar um / }))
    expect(screen.getByText(/2 ingressos/).textContent).toMatch(/R\$\s56,00/)
    expect(screen.getByText(/R\$\s50,00 \+ taxa R\$\s6,00/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalizar' })).toBeInTheDocument()
  })

  it('evento já realizado: "Comprar" desligado com o motivo e sem contador', () => {
    evento = base({ date: '2020-01-01' })
    montar()
    expect(screen.getByRole('button', { name: 'Comprar' })).toBeDisabled()
    expect(screen.getAllByText('Evento encerrado').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('button', { name: /^Adicionar um / })).toBeNull()
  })

  it('janela de venda: vencida e futura desligam a compra com o motivo', () => {
    evento = base({ ticket_types: [ingresso({ sale_end: '2020-01-01T00:00:00Z' })] })
    const { unmount } = montar()
    expect(screen.getByRole('button', { name: 'Comprar' })).toBeDisabled()
    expect(screen.getAllByText('Vendas encerradas').length).toBeGreaterThanOrEqual(1)
    unmount()
    evento = base({ ticket_types: [ingresso({ sale_start: '2099-03-05T12:00:00Z' })] })
    montar()
    expect(screen.getByRole('button', { name: 'Comprar' })).toBeDisabled()
    expect(screen.getAllByText('Vendas começam em 05/03').length).toBeGreaterThanOrEqual(1)
  })

  it('classificação: mostra a do banco; vazia, diz que o produtor não informou', () => {
    evento = base({ classificacao: 'A16' })
    const { unmount } = montar()
    expect(screen.getByText('Classificação: 16 anos')).toBeInTheDocument()
    unmount()
    evento = base()
    montar()
    expect(screen.getByText('Classificação não informada pelo produtor')).toBeInTheDocument()
  })

  it('Salvar (VF) e Compartilhar existem na barra de topo', () => {
    montar()
    expect(screen.getByRole('button', { name: 'Salvar evento' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Compartilhar' })).toBeInTheDocument()
  })
})

// No limite o botão fica aria-disabled (não disabled): ignora o clique mas mantém o foco do teclado
describe('ContadorIngresso no limite', () => {
  it('"mais" desligado ignora o clique e não perde o foco', () => {
    const onMais = vi.fn()
    render(<ContadorIngresso nome="Pista" qtd={2} onMenos={() => {}} onMais={onMais} maisDesligado />)
    const mais = screen.getByRole('button', { name: 'Adicionar um Pista' })
    mais.focus()
    fireEvent.click(mais)
    expect(onMais).not.toHaveBeenCalled()
    expect(mais).toHaveAttribute('aria-disabled', 'true')
    expect(document.activeElement).toBe(mais)
  })

  it('"menos" em zero ignora o clique', () => {
    const onMenos = vi.fn()
    render(<ContadorIngresso nome="Pista" qtd={0} onMenos={onMenos} onMais={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tirar um Pista' }))
    expect(onMenos).not.toHaveBeenCalled()
  })
})
