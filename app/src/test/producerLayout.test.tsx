import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ProducerLayout from '../components/ProducerLayout'

vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [], isLoading: false }) }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Ricardo', email: 'r@x.com' }, logout: vi.fn() }) }))
const { registrar } = vi.hoisted(() => ({ registrar: vi.fn() }))
vi.mock('../hooks/useTourLog', () => ({ useRegistrarTour: () => registrar }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
vi.mock('../components/EvoHub', () => ({ default: () => null }))
vi.mock('../components/FeedbackTopButton', () => ({ default: () => null }))
vi.mock('../components/NotificationsTopButton', () => ({ default: () => null }))
vi.mock('../components/producer/BarraCelular', () => ({ default: () => <nav aria-label="Navegação do celular" /> }))
// computador (>= 1024 px) por padrão; `celular` liga só a consulta (max-width: 767px)
const mediaQuery = (celular: boolean) => (q: string) => ({ matches: q.includes('max-width') ? celular : true, addEventListener: () => {}, removeEventListener: () => {} })
vi.stubGlobal('matchMedia', mediaQuery(false))

const Local = () => { const l = useLocation(); return <p data-testid="local">{l.pathname + l.search}</p> }
const montar = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route element={<ProducerLayout />}>
          <Route path="/producer/dashboard" element={<><h1>Início <input aria-label="campo" /></h1><Link to="/producer/events">ir</Link></>} />
          <Route path="/producer/events" element={<><h1 data-tour="eventos-criar">Eventos</h1><Local /><Link to="/producer/dashboard">voltar</Link></>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

describe('ProducerLayout com a lateral nova', () => {
  beforeEach(() => { localStorage.clear(); registrar.mockClear() })

  it('mantém a raiz .painel-produtor e o menu com nome', () => {
    const { container } = montar('/producer/dashboard')
    expect(container.querySelector('.painel-produtor')).not.toBeNull()
    expect(screen.getByRole('navigation', { name: 'Menu do produtor' })).toBeInTheDocument()
  })

  it('⌘B recolhe para o trilho e lembra; de novo expande; em campo de texto é ignorado', () => {
    montar('/producer/dashboard')
    const aside = document.getElementById('produtor-menu')!
    expect(aside.className).not.toContain('lg:w-14')
    fireEvent.keyDown(window, { key: 'b', metaKey: true })
    expect(aside.className).toContain('lg:w-14')
    expect(localStorage.getItem('evk.nav.recolhida')).toBe('1')
    fireEvent.keyDown(screen.getByLabelText('campo'), { key: 'b', ctrlKey: true })
    expect(aside.className).toContain('lg:w-14')
    fireEvent.keyDown(window, { key: 'B', ctrlKey: true })
    expect(aside.className).not.toContain('lg:w-14')
    expect(localStorage.getItem('evk.nav.recolhida')).toBe('0')
  })

  it('⌘B é ignorado com Shift', () => {
    montar('/producer/dashboard')
    const aside = document.getElementById('produtor-menu')!
    fireEvent.keyDown(window, { key: 'b', metaKey: true, shiftKey: true })
    expect(aside.className).not.toContain('lg:w-14')
  })

  it('⌘B não faz nada abaixo de 1024 px', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    montar('/producer/dashboard')
    fireEvent.keyDown(window, { key: 'b', metaKey: true })
    expect(localStorage.getItem('evk.nav.recolhida')).toBeNull()
    vi.stubGlobal('matchMedia', mediaQuery(false))
  })

  it('começa no trilho quando a pessoa tinha recolhido', () => {
    localStorage.setItem('evk.nav.recolhida', '1')
    montar('/producer/dashboard')
    expect(document.getElementById('produtor-menu')!.className).toContain('lg:w-14')
  })

  it('o conteúdo da página (com os data-tour) continua no Outlet', () => {
    const { container } = montar('/producer/events')
    expect(container.querySelector('[data-tour="eventos-criar"]')).not.toBeNull()
  })

  it('a barra inferior só existe abaixo de 768 px; entre 768 e 1023 px fica a gaveta', () => {
    montar('/producer/dashboard')
    expect(screen.queryByRole('navigation', { name: 'Navegação do celular' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument()
    cleanup()
    vi.stubGlobal('matchMedia', mediaQuery(true))
    montar('/producer/dashboard')
    expect(screen.getByRole('navigation', { name: 'Navegação do celular' })).toBeInTheDocument()
    vi.stubGlobal('matchMedia', mediaQuery(false))
  })

  it('virar celular (redimensionar) fecha a gaveta do tablet; ela não reabre ao voltar', () => {
    // tablet: nem computador nem celular; os ouvintes ficam guardados para disparar a mudança
    const estado = { celular: false }
    const ouvintes: Array<() => void> = []
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() { return q.includes('max-width') ? estado.celular : false },
      addEventListener: (_: string, f: () => void) => ouvintes.push(f),
      removeEventListener: () => {},
    }))
    montar('/producer/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toBeInTheDocument()
    estado.celular = true
    act(() => ouvintes.forEach(f => f()))
    expect(screen.queryByRole('button', { name: 'Fechar menu', hidden: true })).toBeNull()
    estado.celular = false
    act(() => ouvintes.forEach(f => f()))
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument()
    vi.stubGlobal('matchMedia', mediaQuery(false))
  })

  it('a gaveta do tablet não reabre ao voltar à rota em que foi aberta', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    montar('/producer/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    fireEvent.click(screen.getByText('ir', { selector: 'a' }))
    fireEvent.click(screen.getByText('voltar', { selector: 'a' }))
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument()
    vi.stubGlobal('matchMedia', mediaQuery(false))
  })

  it('no celular a lateral some por classe (max-md) e o conteúdo ganha folga para a barra', () => {
    const { container } = montar('/producer/dashboard')
    expect(document.getElementById('produtor-menu')!.className).toContain('max-md:hidden')
    expect(container.innerHTML).toContain('max-md:pb-[calc(var(--barra-cel,0px)+6rem)]')
  })

  it('?tour=eventos + Esc: grava tour:eventos como pulado, foco no h1 e só o tour sai da URL', () => {
    montar('/producer/events?tour=eventos&x=1')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(registrar).toHaveBeenCalledWith('tour:eventos', { skipped: true })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Eventos' })).toHaveFocus()
    expect(screen.getByTestId('local')).toHaveTextContent('/producer/events?x=1')
  })

  it('?tour= de outra tela: não abre, não grava e só o tour sai da URL', () => {
    montar('/producer/events?tour=inicio&y=2')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(registrar).not.toHaveBeenCalled()
    expect(screen.getByTestId('local')).toHaveTextContent('/producer/events?y=2')
  })
})
