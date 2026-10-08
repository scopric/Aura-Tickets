import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Link, MemoryRouter } from 'react-router-dom'
import BarraCelular from '../components/producer/BarraCelular'
import { eventoEmAndamento } from '../hooks/useAoVivo'
import { instanteLocal } from '../lib/eventoProdutor'

// relógio fixo (só o Date): sexta 03/10/2026, 23:30 em Brasília
const AGORA = '2026-10-03T23:30:00-03:00'
const hoje = '2026-10-03'
const amanha = '2026-10-04'
const evento = (id: string, title: string, date: string, extra: object = {}) =>
  ({ id, title, date, time: '20:00', start_date: `${date}T20:00:00-03:00`, end_date: null, status: 'published', approval_status: 'approved', cover_image: null, ...extra })
let eventos: ReturnType<typeof evento>[] = []
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: eventos, isLoading: false }) }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Ricardo', email: 'r@x.com' }, logout: vi.fn() }) }))
vi.mock('../components/ThemeToggle', () => ({ default: () => <div role="radiogroup" aria-label="Tema" /> }))
const consulta = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: (...a: unknown[]) => ({ gte: (...b: unknown[]) => { consulta(a, b); return Promise.resolve({ count: 312, error: null }) } }) }) }) },
}))

afterEach(() => vi.useRealTimers())

const montar = (url = '/producer/dashboard') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Link to="/producer/cupons">sair da folha</Link>
        <Link to="/producer/dashboard">voltar</Link>
        <BarraCelular />
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(AGORA))
  eventos = []
  consulta.mockClear()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
})

describe('barra inferior do celular (V4b)', () => {
  it('4 abas com rótulo de uma palavra e a atual marcada; busca separada', () => {
    montar('/producer/events')
    const nav = screen.getByRole('navigation', { name: 'Navegação do celular' })
    expect(within(nav).getAllByRole('link').map(l => l.textContent)).toEqual(['Início', 'Eventos', 'Check-in'])
    expect(within(nav).getByRole('button', { name: 'Menu' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Eventos' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: 'Buscar tela' })).toBeInTheDocument()
    expect(nav).toHaveClass('vidro')
  })

  it('tela de outra área marca a aba Menu; o Check-in dentro de evento leva o eventId', () => {
    montar('/producer/cupons')
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Check-in' })).toHaveAttribute('href', '/producer/checkin')
  })

  it('sem o evento na URL o Check-in não leva eventId; com ?eventId= leva', () => {
    montar('/producer/cupons?eventId=e1')
    expect(screen.getByRole('link', { name: 'Check-in' })).toHaveAttribute('href', '/producer/checkin?eventId=e1')
  })

  it('Menu abre a folha com a lista por área, tema e Sair; Esc fecha', async () => {
    montar('/producer/cupons')
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const folha = await screen.findByRole('dialog', { name: 'Menu' })
    for (const area of ['Eventos', 'Vendas', 'Público', 'Operação', 'Financeiro', 'Conta']) {
      expect(within(folha).getByRole('heading', { name: area })).toBeInTheDocument()
    }
    expect(within(folha).getByRole('link', { name: 'Cupons' })).toHaveAttribute('aria-current', 'page') // Vendas fechada na lateral aparece aberta aqui
    expect(within(folha).getByRole('link', { name: 'Calculadora de mesas' })).toBeInTheDocument()
    expect(within(folha).getByRole('link', { name: 'Dashboards' })).toHaveAttribute('href', '/producer/central') // item solto, fora das áreas
    expect(within(folha).queryByText(/ferrament/i)).toBeNull()
    expect(within(folha).getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument()
    expect(within(folha).getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menu', hidden: true })).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}') // só teclado: os eventos de ponteiro do vaul não existem no jsdom
    // fechada; o vaul só tira a folha do DOM no fim da transição (que o jsdom não roda)
    await waitFor(() => expect(folha).toHaveAttribute('data-state', 'closed'))
    expect(screen.getByRole('button', { name: 'Menu', hidden: true })).toHaveAttribute('aria-expanded', 'false')
  })

  it('a busca abre a folha com o foco no filtro, e o filtro reduz a lista', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar tela' }))
    const folha = await screen.findByRole('dialog', { name: 'Menu' })
    const filtro = within(folha).getByRole('searchbox', { name: 'Buscar tela' })
    await waitFor(() => expect(filtro).toHaveFocus())
    fireEvent.change(filtro, { target: { value: 'orcamento' } })
    expect(within(folha).getByRole('link', { name: 'Orçamento' })).toBeInTheDocument()
    expect(within(folha).queryByRole('link', { name: 'Cupons' })).toBeNull()
    fireEvent.change(filtro, { target: { value: 'zzz' } })
    expect(within(folha).getByText('Nenhuma tela com esse nome.')).toBeInTheDocument()
    // Criar evento, Tema e Sair são fixos: o filtro é só de telas
    expect(within(folha).getByRole('link', { name: 'Criar evento' })).toBeInTheDocument()
    expect(within(folha).getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument()
    expect(within(folha).getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar tela', hidden: true })).toHaveAttribute('aria-expanded', 'true')
  })

  it('a folha não reabre sozinha ao voltar à rota; já baixada, abre no mesmo clique (dentro do gesto)', async () => {
    montar('/producer/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const folha = await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(screen.getByText('sair da folha', { selector: 'a' }))
    await waitFor(() => expect(folha).toHaveAttribute('data-state', 'closed'))
    fireEvent.click(screen.getByText('voltar', { selector: 'a' }))
    expect(document.querySelectorAll('[role=dialog][data-state=open]')).toHaveLength(0)
    // a folha antiga ainda sai (sem transição no jsdom) e deixa o resto aria-hidden: por isso hidden: true
    fireEvent.click(screen.getByRole('button', { name: 'Menu', hidden: true }))
    expect(document.querySelectorAll('[role=dialog][data-state=open]')).toHaveLength(1) // sem await: abriu dentro do clique
  })

  it('trocar de rota por fora da folha fecha a folha', async () => {
    montar('/producer/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const folha = await screen.findByRole('dialog', { name: 'Menu' })
    expect(folha).toHaveAttribute('data-state', 'open')
    fireEvent.click(screen.getByText('sair da folha', { selector: 'a' }), { bubbles: true })
    await waitFor(() => expect(folha).toHaveAttribute('data-state', 'closed'))
  })

  it('dentro de um evento a folha mostra "← Eventos", o nome e só as telas do evento (Conta continua)', async () => {
    eventos = [evento('e1', 'Noite de Forró', amanha)]
    montar('/producer/cupons?eventId=e1')
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const folha = await screen.findByRole('dialog', { name: 'Menu' })
    expect(within(folha).getByRole('link', { name: 'Eventos' })).toHaveAttribute('href', '/producer/events')
    expect(within(folha).getByText('Noite de Forró')).toBeInTheDocument()
    expect(within(folha).getByRole('link', { name: 'Cupons' })).toHaveAttribute('href', '/producer/cupons?eventId=e1')
    expect(within(folha).queryByRole('link', { name: 'Banners' })).toBeNull() // só na produtora
    expect(within(folha).getByRole('link', { name: 'Configurações' })).toHaveAttribute('href', '/producer/settings')
  })

  it('na Visão geral do evento e na edição, a aba Eventos fica marcada e a folha marca "Visão geral"', async () => {
    eventos = [evento('e1', 'Noite de Forró', amanha)]
    montar('/producer/events/e1/edit')
    expect(screen.getByRole('link', { name: 'Eventos' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const folha = await screen.findByRole('dialog', { name: 'Menu' })
    const visao = within(folha).getByRole('link', { name: 'Visão geral' })
    expect(visao).toHaveAttribute('href', '/producer/event/e1')
    expect(visao).toHaveAttribute('aria-current', 'page') // rotasDaTela: a edição fica sob a Visão geral
  })

  it('a folha lista os eventos fixados pela mesma lista da lateral (useFixados)', async () => {
    eventos = [evento('e1', 'Noite de Forró', amanha), evento('e2', 'Baile Fixado', '2026-12-30', { status: 'draft' })]
    localStorage.setItem('evk.nav.fixados', JSON.stringify(['e2']))
    montar('/producer/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const folha = await screen.findByRole('dialog', { name: 'Menu' })
    const links = within(folha).getAllByRole('link').map(l => l.getAttribute('aria-label') ?? l.textContent)
    expect(links.findIndex(t => /Baile Fixado/.test(t ?? ''))).toBeLessThan(links.findIndex(t => /Noite de Forró/.test(t ?? '')))
    localStorage.clear()
  })

  it('foco entra na folha (Fechar) e volta ao botão Menu ao fechar pelo X', async () => {
    montar('/producer/dashboard')
    const menu = screen.getByRole('button', { name: 'Menu' })
    menu.focus()
    fireEvent.click(menu)
    const folha = await screen.findByRole('dialog', { name: 'Menu' })
    const fechar = within(folha).getByRole('button', { name: 'Fechar' })
    await waitFor(() => expect(fechar).toHaveFocus())
    fireEvent.click(fechar)
    await waitFor(() => expect(menu).toHaveFocus())
  })

  it('--barra-cel no body enquanto a barra existe (Evo e cookies sobem acima dela)', () => {
    const { unmount } = montar()
    expect(document.body.style.getPropertyValue('--barra-cel')).toContain('68px')
    unmount()
    expect(document.body.style.getPropertyValue('--barra-cel')).toBe('')
  })
})

describe('faixa "ao vivo" (V4b)', () => {
  it('com evento publicado em andamento, mostra a contagem de check-ins desde 3 h antes do início', async () => {
    eventos = [evento('e1', 'Noite de Forró', hoje, { time: '22:00' })]
    montar()
    const faixa = await screen.findByRole('region', { name: 'Evento em andamento' })
    expect(faixa).toHaveTextContent('312 entraram · Noite de Forró')
    expect(within(faixa).getByRole('link', { name: 'Abrir check-in' })).toHaveAttribute('href', '/producer/checkin?eventId=e1')
    // início 22:00 em Brasília = 01:00 UTC; a contagem começa às 19:00 de lá = 22:00 UTC
    expect(consulta).toHaveBeenCalledWith(['event_id', 'e1'], ['checked_in_at', '2026-10-03T22:00:00.000Z'])
    await waitFor(() => expect(document.body.style.getPropertyValue('--barra-cel')).toContain('124px'))
  })

  it('não some à meia-noite: 01:00 do dia seguinte, evento das 22:00, a faixa continua', async () => {
    vi.setSystemTime(new Date('2026-10-04T01:00:00-03:00'))
    eventos = [evento('e1', 'Noite de Forró', hoje, { time: '22:00' })]
    montar()
    expect(await screen.findByRole('region', { name: 'Evento em andamento' })).toHaveTextContent('312 entraram')
  })

  it('festival de vários dias: vale até o end_date, depois some', async () => {
    eventos = [evento('f1', 'Festival', '2026-10-02', { time: '18:00', end_date: '2026-10-05T03:00:00-03:00' })]
    vi.setSystemTime(new Date('2026-10-04T15:00:00-03:00'))
    const { unmount } = montar()
    expect(await screen.findByRole('region', { name: 'Evento em andamento' })).toHaveTextContent('Festival')
    unmount()
    vi.setSystemTime(new Date('2026-10-05T04:00:00-03:00'))
    montar()
    expect(screen.queryByRole('region', { name: 'Evento em andamento' })).toBeNull()
  })

  it('some fora da janela (mais de 3 h antes, depois do fim) e com rascunho, em análise ou cancelado', () => {
    eventos = [
      evento('a', 'Amanhã', amanha),
      evento('e', 'Já acabou', hoje, { time: '08:00' }), // sem end_date: acaba 12 h depois, às 20:00
      evento('b', 'Rascunho', hoje, { status: 'draft' }),
      evento('c', 'Em análise', hoje, { approval_status: 'pending' }),
      evento('d', 'Cancelado', hoje, { status: 'cancelled' }),
    ]
    montar()
    expect(screen.queryByRole('region', { name: 'Evento em andamento' })).toBeNull()
    expect(consulta).not.toHaveBeenCalled()
  })

  it('evento sem hora vale o dia inteiro (00:00 a +24 h), sem a margem de 3 h', () => {
    const semHora = evento('d', 'Dia todo', hoje, { time: null })
    expect(eventoEmAndamento([semHora] as never, new Date('2026-10-03T00:00:00-03:00'))?.id).toBe('d')
    expect(eventoEmAndamento([semHora] as never, new Date('2026-10-03T23:59:00-03:00'))?.id).toBe('d')
    expect(eventoEmAndamento([semHora] as never, new Date('2026-10-02T22:00:00-03:00'))).toBeUndefined()
    expect(eventoEmAndamento([semHora] as never, new Date('2026-10-04T00:01:00-03:00'))).toBeUndefined()
  })

  it('eventoEmAndamento escolhe o de início mais perto de agora; instanteLocal usa o fuso de Brasília', () => {
    const cedo = evento('x', 'Cedo', hoje, { time: '19:00' })
    const tarde = evento('y', 'Tarde', hoje, { time: '23:00' })
    expect(eventoEmAndamento([cedo, tarde] as never, new Date(AGORA))?.id).toBe('y')
    expect(instanteLocal('2026-10-03', '22:00')).toBe(Date.parse('2026-10-03T22:00:00-03:00'))
    expect(instanteLocal('2026-10-03')).toBe(Date.parse('2026-10-03T00:00:00-03:00'))
  })
})
