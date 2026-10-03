import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import BarraCelular from '../components/producer/BarraCelular'
import { eventoDeHoje } from '../hooks/useAoVivo'

const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const amanha = new Date(Date.now() + 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
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

const montar = (url = '/producer/dashboard') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <BarraCelular />
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
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

  it('--barra-cel no body enquanto a barra existe (Evo e cookies sobem acima dela)', () => {
    const { unmount } = montar()
    expect(document.body.style.getPropertyValue('--barra-cel')).toContain('68px')
    unmount()
    expect(document.body.style.getPropertyValue('--barra-cel')).toBe('')
  })
})

describe('faixa "ao vivo" (V4b)', () => {
  it('só no dia de um evento publicado, com a contagem de check-ins de hoje', async () => {
    eventos = [evento('e1', 'Noite de Forró', hoje)]
    montar()
    const faixa = await screen.findByRole('region', { name: 'Evento de hoje' })
    expect(faixa).toHaveTextContent('312 entraram · Noite de Forró')
    expect(within(faixa).getByRole('link', { name: 'Abrir check-in' })).toHaveAttribute('href', '/producer/checkin?eventId=e1')
    expect(consulta).toHaveBeenCalledWith([ 'event_id', 'e1' ], [ 'checked_in_at', `${hoje}T00:00:00-03:00` ])
    await waitFor(() => expect(document.body.style.getPropertyValue('--barra-cel')).toContain('124px'))
  })

  it('some sem evento hoje (evento de amanhã, rascunho, em análise ou cancelado não contam)', () => {
    eventos = [
      evento('a', 'Amanhã', amanha),
      evento('b', 'Rascunho', hoje, { status: 'draft' }),
      evento('c', 'Em análise', hoje, { approval_status: 'pending' }),
      evento('d', 'Cancelado', hoje, { status: 'cancelled' }),
    ]
    montar()
    expect(screen.queryByRole('region', { name: 'Evento de hoje' })).toBeNull()
    expect(consulta).not.toHaveBeenCalled()
  })

  it('eventoDeHoje escolhe o mais cedo do dia e usa a data de Brasília', () => {
    const cedo = evento('x', 'Cedo', hoje, { time: '10:00' })
    const tarde = evento('y', 'Tarde', hoje, { time: '22:00' })
    expect(eventoDeHoje([tarde, cedo] as never)?.id).toBe('x')
    // 01:00 UTC do dia seguinte ainda é a noite de hoje em Brasília
    const agora = new Date(`${amanha}T01:00:00Z`)
    expect(eventoDeHoje([cedo] as never, agora)?.id).toBe('x')
  })
})

