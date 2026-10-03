import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProducerLayout from '../components/ProducerLayout'

vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [], isLoading: false }) }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Ricardo', email: 'r@x.com' }, logout: vi.fn() }) }))
vi.mock('../hooks/useTourLog', () => ({ useRegistrarTour: () => vi.fn() }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
vi.mock('../components/EvoHub', () => ({ default: () => null }))
vi.mock('../components/FeedbackTopButton', () => ({ default: () => null }))
vi.mock('../components/NotificationsTopButton', () => ({ default: () => null }))
vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))

const montar = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route element={<ProducerLayout />}>
          <Route path="/producer/dashboard" element={<h1>Início <input aria-label="campo" /></h1>} />
          <Route path="/producer/events" element={<h1 data-tour="eventos-criar">Eventos</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

describe('ProducerLayout com a lateral nova', () => {
  beforeEach(() => localStorage.clear())

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
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
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
})
