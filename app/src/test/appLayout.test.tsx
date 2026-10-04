import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { avisarCamada, CHAVE_AVISO_POLITICA, fecharPolitica } from '../lib/camadas'
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_VERSION } from '../lib/tracking'

const registrar = vi.fn()
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'user', name: 'Ana', email: 'a@x.com' }, logout: vi.fn() }) }))
vi.mock('../hooks/useNotifications', () => ({ useUserNotifications: () => ({ data: [], isLoading: false, isError: false }), useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }), useMarkNotificationRead: () => ({ mutate: vi.fn(), isPending: false }), urlDoAviso: () => null }))
vi.mock('../hooks/useTourLog', () => ({ useRegistrarTour: () => registrar }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
vi.mock('../components/EvoHub', () => ({ default: () => <div data-tour="evo" /> }))
vi.mock('../components/FeedbackTopButton', () => ({ default: () => null }))
// computador (>= 1024 px) por padrão: max-width: 1023px não casa
const mediaQuery = (celular: boolean) => (q: string) => ({ matches: q.includes('max-width') ? celular : !celular, addEventListener: () => {}, removeEventListener: () => {} })
vi.stubGlobal('matchMedia', mediaQuery(false))
Element.prototype.scrollIntoView = vi.fn()
// jsdom mede tudo com 0: o Tour só conta alvos com tamanho
Element.prototype.getBoundingClientRect = () => DOMRect.fromRect({ x: 10, y: 300, width: 40, height: 40 })
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

const Local = () => { const l = useLocation(); return <p data-testid="local">{l.pathname + l.search}</p> }
const montar = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route element={<><AppLayout /><Local /></>}>
          <Route path="/app/hub" element={<h1>Início</h1>} />
          <Route path="/app/tickets" element={<h1>Ingressos</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

describe('AppLayout: tour do participante (V9c)', () => {
  // cookies decididos e Política fechada (o tour só abre com as camadas da V9a resolvidas)
  const decidirCookies = () => localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ version: COOKIE_CONSENT_VERSION, consent: { necessary: true, analytics: false } }))
  beforeEach(() => {
    cleanup(); registrar.mockClear(); vi.stubGlobal('matchMedia', mediaQuery(false))
    localStorage.clear(); decidirCookies(); localStorage.setItem(CHAVE_AVISO_POLITICA, '1')
  })

  it('sem ?tour= nada abre sozinho', () => {
    montar('/app/hub')
    expect(screen.queryByText(/1 de 3/)).toBeNull()
  })

  it('?tour=app-inicio abre no passo 1 de 3 e concluir grava tour:app-inicio e tira só o tour da URL', async () => {
    montar('/app/hub?tour=app-inicio&x=1')
    expect(await screen.findByText('1 de 3')).toBeInTheDocument() // os alvos são medidos depois da 1ª pintura
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByText('2 de 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(registrar).toHaveBeenCalledWith('tour:app-inicio', { skipped: false })
    expect(screen.getByRole('heading', { name: 'Início' })).toHaveFocus() // o foco volta ao título da página, não ao body
    expect(screen.getByTestId('local')).toHaveTextContent('/app/hub?x=1')
  })

  it('pular grava skipped e devolve o foco ao título', () => {
    montar('/app/hub?tour=app-inicio')
    fireEvent.click(screen.getByRole('button', { name: 'Pular' }))
    expect(registrar).toHaveBeenCalledWith('tour:app-inicio', { skipped: true })
    expect(screen.getByRole('heading', { name: 'Início' })).toHaveFocus()
  })

  it('?tour= de outra tela ou inexistente: não abre e sai da URL', () => {
    montar('/app/tickets?tour=app-inicio')
    expect(screen.queryByText(/1 de 3/)).toBeNull()
    expect(screen.getByTestId('local')).toHaveTextContent(/^\/app\/tickets$/)
  })

  it('computador: os alvos ficam na lateral (e a barra do celular os repete, escondida)', () => {
    const { container } = montar('/app/hub')
    expect(container.querySelector('aside [data-tour="app-ingressos"]')).not.toBeNull()
    expect(container.querySelector('aside [data-tour="app-explorar"]')).not.toBeNull()
  })

  it('celular: a lateral não expõe alvos (está fora da tela); a barra inferior sim', () => {
    vi.stubGlobal('matchMedia', mediaQuery(true))
    const { container } = montar('/app/hub')
    expect(container.querySelector('aside [data-tour]')).toBeNull()
    expect(container.querySelector('nav[aria-label="Navegação principal"] [data-tour="app-ingressos"]')).not.toBeNull()
    expect(container.querySelector('nav[aria-label="Navegação principal"] [data-tour="app-explorar"]')).not.toBeNull()
  })

  it('cookies sem decisão: o tour espera e o ?tour= fica; decididos os cookies e fechada a Política, abre', () => {
    localStorage.clear()
    montar('/app/hub?tour=app-inicio&x=1')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('local')).toHaveTextContent('/app/hub?tour=app-inicio&x=1')
    act(() => { decidirCookies(); avisarCamada() }) // cookies decididos: a Política passa a vez
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('local')).toHaveTextContent('?tour=app-inicio')
    act(() => fecharPolitica())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
