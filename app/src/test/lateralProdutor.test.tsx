import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Lateral from '../components/producer/Lateral'

const amanha = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10)
const evento = (id: string, title: string, dias: number, extra: object = {}) =>
  ({ id, title, date: amanha(dias), time: '20:00', start_date: amanha(dias), end_date: null, status: 'published', approval_status: 'approved', cover_image: null, ...extra })
const eventos = [
  evento('e1', 'Noite de Forró', 10),
  evento('e2', 'Validação', 20, { status: 'draft' }),
  evento('e3', 'Baile da Virada', 30, { approval_status: 'pending' }), // em análise
  evento('e4', 'Quarto evento', 40),
  evento('e5', 'Cancelado', 5, { status: 'cancelled' }),
]
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: eventos, isLoading: false }) }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Ricardo Scoparo', email: 'r@x.com', producer_profile: { company_name: 'Scoparo Produções' } }, logout: vi.fn() }) }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))

const montar = (url: string, rail = false) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Lateral rail={rail} onNavega={() => {}} onRecolher={() => {}} />
    </MemoryRouter>,
  )

beforeEach(() => localStorage.clear())

describe('lateral do produtor (V4a)', () => {
  it('escopo da produtora: Eventos aberto com 3 eventos, "Todos os eventos" ativo, aviso em análise, sem Ferramentas', () => {
    montar('/producer/events')
    const nav = screen.getByRole('navigation', { name: 'Menu do produtor' })
    expect(within(nav).getByRole('link', { name: 'Todos os eventos' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: /Noite de Forró/ })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /^Baile da Virada, \d+ [a-z]{3}, em análise$/ })).toBeInTheDocument()
    expect(within(nav).queryByText('Quarto evento')).toBeNull() // só 3 visíveis
    expect(within(nav).queryByText('Cancelado')).toBeNull()
    expect(within(nav).getByRole('link', { name: 'Relatórios' })).toHaveAttribute('href', '/producer/pos-evento')
    expect(within(nav).getByRole('button', { name: 'Vendas' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/ferrament/i)).toBeNull()
  })

  it('a busca ⌘K não está na lateral até a V4c', () => {
    montar('/producer/dashboard')
    expect(screen.queryByRole('button', { name: /Buscar/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Criar evento' })).toHaveAttribute('href', '/producer/planner')
  })

  it('lembra seção aberta à mão em evk.nav.secoes', () => {
    montar('/producer/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'Vendas' }))
    expect(screen.getByRole('button', { name: 'Vendas' })).toHaveAttribute('aria-expanded', 'true')
    expect(JSON.parse(localStorage.getItem('evk.nav.secoes')!)).toEqual({ 'produtora:Vendas': true })
  })

  it('abre sozinha a seção da tela atual', () => {
    montar('/producer/cupons')
    const nav = screen.getByRole('navigation', { name: 'Menu do produtor' })
    expect(within(nav).getByRole('button', { name: 'Vendas' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(nav).getByRole('link', { name: 'Cupons' })).toHaveAttribute('aria-current', 'page')
  })

  it('fixado sobe para o topo da lista', () => {
    localStorage.setItem('evk.nav.fixados', JSON.stringify(['e4']))
    montar('/producer/dashboard')
    const nav = screen.getByRole('navigation', { name: 'Menu do produtor' })
    const links = within(nav).getAllByRole('link').map(a => a.getAttribute('aria-label') ?? a.textContent)
    expect(links.findIndex(l => l?.startsWith('Quarto evento'))).toBeLessThan(links.findIndex(l => l?.startsWith('Noite de Forró')))
  })

  it('escopo do evento (?eventId=): volta, bloco do evento, só as telas do evento com o id no link', () => {
    montar('/producer/checkin?eventId=e1')
    const nav = screen.getByRole('navigation', { name: 'Menu do produtor' })
    expect(screen.getByRole('link', { name: 'Todos os eventos' })).toHaveAttribute('href', '/producer/events')
    expect(screen.getByRole('button', { name: /Evento Noite de Forró: trocar de evento/ })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Check-in' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Check-in' })).toHaveAttribute('href', '/producer/checkin?eventId=e1')
    expect(within(nav).getByRole('button', { name: 'Evento' })).toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: 'Conta' })).toBeNull()
    expect(within(nav).getByRole('button', { name: 'Vendas' })).toHaveAttribute('aria-expanded', 'true') // evento: tudo aberto
    expect(within(nav).getByRole('button', { name: 'Financeiro' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(nav).queryByText('Banners')).toBeNull() // Decisão 143
    expect(within(nav).queryByText('CRM')).toBeNull()
  })

  it('edição do evento (/producer/events/:id/edit) também é escopo do evento', () => {
    montar('/producer/events/e2/edit')
    expect(screen.getByRole('button', { name: /Evento Validação: trocar de evento/ })).toBeInTheDocument()
    const visao = within(screen.getByRole('navigation')).getByRole('link', { name: 'Visão geral' })
    expect(visao).toHaveAttribute('href', '/producer/event/e2')
    expect(visao).toHaveAttribute('aria-current', 'page') // a edição fica sob a Visão geral
  })

  it('V7: a Visão geral (/producer/event/:id) é a tela ativa do evento e a linha do evento da produtora abre ela', () => {
    montar('/producer/event/e1')
    expect(within(screen.getByRole('navigation')).getByRole('link', { name: 'Visão geral' })).toHaveAttribute('aria-current', 'page')
    cleanup()
    montar('/producer/dashboard')
    expect(within(screen.getByRole('navigation')).getAllByRole('link').find(a => a.getAttribute('aria-label')?.startsWith('Noite de Forró'))).toHaveAttribute('href', '/producer/event/e1')
  })

  it('estrela fixa o evento e lembra em evk.nav.fixados', () => {
    montar('/producer/checkin?eventId=e1')
    fireEvent.click(screen.getByRole('button', { name: 'Fixar Noite de Forró na lista' }))
    expect(JSON.parse(localStorage.getItem('evk.nav.fixados')!)).toEqual(['e1'])
    expect(screen.getByRole('button', { name: 'Desafixar Noite de Forró da lista' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('evento aberto vira o último evento usado', () => {
    montar('/producer/checkin?eventId=e3')
    expect(localStorage.getItem('evk.nav.ultimoEvento')).toBe('e3')
  })

  it('trilho: só ícones, todos com nome acessível', () => {
    montar('/producer/dashboard', true)
    const nav = screen.getByRole('navigation', { name: 'Menu do produtor' })
    for (const b of [...within(nav).queryAllByRole('button'), ...within(nav).queryAllByRole('link')]) {
      expect(b.getAttribute('aria-label') || b.textContent, b.outerHTML).toBeTruthy()
    }
    expect(within(nav).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument()
  })
})
