import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AbasDeArea, BarraFiltros, CabecalhoEvento, EmBreve, KpiCard } from '../components/producer/ui-evento'

// o Tooltip (Radix) mede o conteúdo ao abrir; o jsdom não tem ResizeObserver
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

const periodos = [{ value: 'hoje', label: 'Hoje' }, { value: 'tudo', label: 'Tudo' }]

describe('CabecalhoEvento', () => {
  const base = { titulo: 'Festa', situacao: 'Publicado' as const, editarHref: '/producer/events/1/edit' }
  it('mostra título, situação por texto e Editar como link; sem ação não há Duplicar nem Despublicar', () => {
    render(<MemoryRouter><CabecalhoEvento {...base} linkPublico="https://evokaa.com.br/event/x" /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Festa' })).toBeInTheDocument()
    expect(screen.getByText('Publicado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Editar/ })).toHaveAttribute('href', '/producer/events/1/edit')
    expect(screen.getByRole('link', { name: /evokaa.com.br\/event\/x/ })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Despublicar' })).toBeNull()
  })
  it('com a ação, os botões aparecem e disparam', async () => {
    const dup = vi.fn()
    render(<MemoryRouter><CabecalhoEvento {...base} onDuplicar={dup} onDespublicar={() => {}} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'Duplicar' }))
    expect(dup).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Despublicar' })).toBeInTheDocument()
  })
})

describe('BarraFiltros', () => {
  it('período é grupo nomeado, troca ao clicar; Exportar só com a ação', async () => {
    const muda = vi.fn(), exporta = vi.fn()
    const { rerender } = render(<BarraFiltros periodo="tudo" onPeriodo={muda} periodos={periodos} />)
    expect(screen.queryByRole('button', { name: /Exportar/ })).toBeNull()
    rerender(<BarraFiltros periodo="tudo" onPeriodo={muda} periodos={periodos} onExportar={exporta} atualizadoEm={new Date(2026, 9, 8, 14, 5)} />)
    expect(screen.getByRole('radiogroup', { name: 'Período' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Hoje' }))
    expect(muda).toHaveBeenCalledWith('hoje')
    await userEvent.click(screen.getByRole('button', { name: /Exportar/ }))
    expect(exporta).toHaveBeenCalledOnce()
    expect(screen.getByText(/Atualizado às 14:05/)).toBeInTheDocument()
  })
})

describe('KpiCard', () => {
  it('mostra valor e comparação; o "?" só existe com ajuda e é botão com nome e foco', async () => {
    const { rerender } = render(<KpiCard rotulo="Vendas" valor="R$ 10" comparacao="+5%" />)
    expect(screen.getByText('R$ 10')).toBeInTheDocument()
    expect(screen.getByText('+5%')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<KpiCard rotulo="Vendas" valor="R$ 10" ajuda="Bruto" />)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Ajuda: Vendas' })).toHaveFocus()
  })
})

describe('AbasDeArea', () => {
  const abas = [{ to: '/a', label: 'Visão geral' }, { to: '/a/cupons', label: 'Cupons' }]
  const Rota = () => <span data-testid="rota">{useLocation().pathname}</span>
  it('marca a aba da rota atual e navega ao escolher outra', async () => {
    render(<MemoryRouter initialEntries={['/a/cupons']}><AbasDeArea abas={abas} /><Rota /></MemoryRouter>)
    expect(screen.getByRole('tablist', { name: 'Abas da área' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Cupons' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Visão geral' }))
    expect(screen.getByTestId('rota')).toHaveTextContent('/a')
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('EmBreve', () => {
  it('tem o selo, a descrição e o botão desativado', () => {
    render(<EmBreve titulo="Participantes" descricao="Lista de quem comprou." acao="Abrir" />)
    expect(screen.getByText('Em breve')).toBeInTheDocument()
    expect(screen.getByText('Lista de quem comprou.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeDisabled()
  })
})
