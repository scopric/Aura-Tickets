import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import Lateral from '../components/producer/Lateral'

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) // o Radix Tooltip usa
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

const montar = (url: string, rail = false, onBuscar = () => {}) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Lateral rail={rail} onNavega={() => {}} onRecolher={() => {}} onBuscar={onBuscar} />
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

  it('o botão "Buscar…" (Ctrl K no jsdom, que não é Mac) chama a busca e fica ao lado do "+" (V4c)', () => {
    const onBuscar = vi.fn()
    montar('/producer/dashboard', false, onBuscar)
    const buscar = screen.getByRole('button', { name: /^Buscar telas, eventos e ações/ })
    expect(buscar).toHaveTextContent('Ctrl K')
    fireEvent.click(buscar)
    expect(onBuscar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Criar evento' })).toHaveAttribute('href', '/producer/planner')
  })

  it('o "+" (só ícone) mostra a dica "Criar evento" também na lateral aberta', async () => {
    montar('/producer/dashboard')
    const user = userEvent.setup()
    await user.hover(screen.getByRole('link', { name: 'Criar evento' }))
    await waitFor(() => expect(screen.getAllByText('Criar evento').length).toBeGreaterThan(1)) // dica (role=tooltip + cópia acessível do Radix)
  })

  it('uma seção aberta por vez: abrir Vendas fecha Eventos; clicar de novo fecha', () => {
    montar('/producer/events')
    const nav = screen.getByRole('navigation', { name: 'Menu do produtor' })
    const botao = (nome: string) => within(nav).getByRole('button', { name: nome })
    expect(botao('Eventos')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(botao('Vendas'))
    expect(botao('Vendas')).toHaveAttribute('aria-expanded', 'true')
    expect(botao('Eventos')).toHaveAttribute('aria-expanded', 'false') // mesmo sendo a seção da tela atual
    fireEvent.click(botao('Público'))
    expect(botao('Público')).toHaveAttribute('aria-expanded', 'true')
    expect(botao('Vendas')).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(botao('Público'))
    expect(within(nav).queryAllByRole('button', { expanded: true })).toHaveLength(0)
  })

  it('a escolha à mão vale até trocar de tela: filtro na URL mantém; outra tela (ou voltar) volta à seção da tela', () => {
    const Ir = () => {
      const navega = useNavigate()
      return <>{['/producer/cupons?status=ativos', '/producer/team', '/producer/cupons'].map(u => <button key={u} onClick={() => navega(u)}>ir {u}</button>)}</>
    }
    render(
      <MemoryRouter initialEntries={['/producer/cupons']}>
        <Lateral rail={false} onNavega={() => {}} onRecolher={() => {}} onBuscar={() => {}} />
        <Ir />
      </MemoryRouter>,
    )
    const nav = screen.getByRole('navigation', { name: 'Menu do produtor' })
    const aberta = () => within(nav).getAllByRole('button', { expanded: true }).map(b => b.textContent)
    expect(aberta()).toEqual(['Vendas'])
    fireEvent.click(within(nav).getByRole('button', { name: 'Financeiro' }))
    expect(aberta()).toEqual(['Financeiro'])
    fireEvent.click(screen.getByRole('button', { name: 'ir /producer/cupons?status=ativos' }))
    expect(aberta()).toEqual(['Financeiro']) // só o filtro mudou
    fireEvent.click(screen.getByRole('button', { name: 'ir /producer/team' }))
    expect(aberta()).toEqual(['Operação'])
    fireEvent.click(screen.getByRole('button', { name: 'ir /producer/cupons' }))
    expect(aberta()).toEqual(['Vendas']) // a escolha antiga não volta
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
    expect(within(nav).getByRole('button', { name: 'Público' })).toHaveAttribute('aria-expanded', 'true') // só a da tela atual
    expect(within(nav).getByRole('button', { name: 'Vendas' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(nav).getByRole('button', { name: 'Financeiro' })).toHaveAttribute('aria-expanded', 'false')
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
