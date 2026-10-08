import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AppHub from '../pages/app/Hub'
import AppChat from '../pages/app/Chat'
import ParticipantSettings from '../pages/app/Settings'
import Register from '../pages/auth/Register'
import AppLayout from '../components/AppLayout'
import { erroDeLogin } from '../hooks/useAuth'

// P0c: o participante não vê promessa que o sistema não cumpre. Eventos, ingressos e auth simulados.
let eventos: Record<string, unknown>[] = []
let ingressos: Record<string, unknown>[] = []
let pedidos: Record<string, unknown>[] = []
vi.mock('../hooks/useEvents', () => ({ usePublicEvents: () => ({ data: eventos, isLoading: false, isError: false, refetch: vi.fn() }) }))
vi.mock('../hooks/useCheckout', () => ({ useUserTickets: () => ({ data: ingressos, isLoading: false }), useUserOrders: () => ({ data: pedidos, isLoading: false }) }))
vi.mock('../hooks/useMenuItems', () => ({ useEventMenuItems: () => ({ data: [], isLoading: false }) }))
vi.mock('../hooks/useAuth', async (original) => ({ ...(await original<typeof import('../hooks/useAuth')>()), useAuth: () => ({ user: { id: 'u1', role: 'user', name: 'Ana', email: 'a@x.com' }, logout: vi.fn() }) }))
vi.mock('../hooks/useNotifications', () => ({ useUserNotifications: () => ({ data: [], isLoading: false, isError: false }), useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }), useMarkNotificationRead: () => ({ mutate: vi.fn(), isPending: false }), urlDoAviso: () => null }))
vi.mock('../components/BotaoSalvar', () => ({ default: ({ eventId }: { eventId: string }) => <button type="button" aria-label="Salvar evento" data-evento={eventId} /> }))
vi.mock('../hooks/useTourLog', () => ({ useRegistrarTour: () => vi.fn() }))
vi.mock('../components/EvoHub', () => ({ default: () => null }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
vi.mock('../components/FeedbackTopButton', () => ({ default: () => null }))
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))
vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))

const evento = (id: string, category: string | null, extra: Record<string, unknown> = {}) =>
  ({ id, title: `Evento ${id}`, date: '2099-01-10', time: '20:00', category, venue_city: 'Curitiba', ticket_types: [], ...extra })

const Local = () => { const l = useLocation(); return <p data-testid="local">{l.pathname + l.search}</p> }
const montar = (ui: React.ReactElement, url = '/') => render(<MemoryRouter initialEntries={[url]}>{ui}<Local /></MemoryRouter>)

beforeEach(() => { cleanup(); eventos = []; ingressos = []; pedidos = [] })

describe('Início do app (Hub)', () => {
  const ingresso = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
    id, status, code: `COD-${id}`, event_id: 'e1', seat_info: null,
    ticket_types: { name: 'Pista', price: 50 },
    events: { id: 'e1', title: 'Baile do Sol', date: '2099-01-10', time: '20:00', venue_name: 'Casa', status: 'published' }, ...extra,
  })

  it('sem selo "Online" nem "Livre" inventado; chat diz que não está disponível', () => {
    ingressos = [ingresso('t1', 'active')]
    montar(<AppHub />)
    expect(screen.queryByText('Online')).toBeNull()
    expect(screen.queryByText(/Livre/)).toBeNull()
    expect(screen.getAllByText(/chat com o produtor ainda não está disponível/i).length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Mensagem para o produtor')).toBeNull()
  })

  it('QR só em ingresso ativo; reembolsado diz "Reembolsado"; contador só conta ativos', () => {
    ingressos = [ingresso('t1', 'active'), ingresso('t2', 'refunded', { events: { id: 'e1', title: 'Outro Evento', date: '2099-01-10', status: 'published' } })]
    const { container } = montar(<AppHub />)
    expect(screen.getAllByRole('link', { name: 'Mostrar o QR de Baile do Sol' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Mostrar o QR de Outro Evento' })).toBeNull()
    expect(screen.getAllByText('Reembolsado').length).toBeGreaterThan(0)
    expect(screen.queryByText('Transferido')).toBeNull()
    const ativos = container.querySelector('dl dt')!
    expect(ativos).toHaveTextContent('Ingressos ativos')
    expect(ativos.parentElement!.querySelector('dd')).toHaveTextContent('1')
  })

  it('ingresso ativo de evento cancelado: selo mostra o motivo, sem QR, e não entra em "Ingressos ativos"', () => {
    ingressos = [ingresso('t1', 'active'), ingresso('t2', 'active', { events: { id: 'e2', title: 'Festa Cancelada', date: '2099-01-10', status: 'cancelled' } })]
    const { container } = montar(<AppHub />)
    expect(screen.getAllByText(/Evento cancelado/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Mostrar o QR de Festa Cancelada' })).toBeNull()
    expect(container.querySelector('dl dd')).toHaveTextContent('1')
  })

  it('o próximo evento é o passe: o botão do QR leva à tela do ingresso já virado; anteriores ficam numa lista própria', () => {
    ingressos = [ingresso('t1', 'active'), ingresso('t2', 'used', { events: { id: 'e9', title: 'Festa Velha', date: '2020-01-10', status: 'published' } })]
    montar(<AppHub />)
    expect(screen.getAllByRole('link', { name: 'Mostrar o QR de Baile do Sol' })[0]).toHaveAttribute('href', '/app/tickets?evento=e1&qr=1')
    expect(screen.getAllByText('Festa Velha').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Anteriores').length).toBeGreaterThan(0)
  })

  it('"Explorar eventos" é um link para /app/events', () => {
    montar(<AppHub />)
    expect(screen.getAllByRole('link', { name: 'Explorar eventos' })[0]).toHaveAttribute('href', '/app/events')
  })

  it('0 ingressos: a tela diz por quê (pedido pendente, pagamento confirmado sem ingresso, só anteriores) e tem "Não vejo meu ingresso"', () => {
    pedidos = [{ id: 'o1', status: 'pending' }, { id: 'o2', status: 'pending' }]
    montar(<AppHub />)
    expect(screen.getAllByText(/2 pedidos aguardando pagamento/).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Ver minhas compras' })[0]).toHaveAttribute('href', '/app/orders')
    cleanup()
    pedidos = [{ id: 'o1', status: 'paid' }]
    montar(<AppHub />)
    expect(screen.getAllByText(/ingresso ainda não chegou/).length).toBeGreaterThan(0)
    cleanup()
    pedidos = []
    ingressos = [ingresso('t1', 'used', { events: { id: 'e9', title: 'Festa Velha', date: '2020-01-10', status: 'published' } })]
    montar(<AppHub />)
    expect(screen.getAllByText(/ficam em Anteriores/).length).toBeGreaterThan(0)
  })

  it('"Não vejo meu ingresso" pede ao Evo o assunto do chat', () => {
    const ouvir = vi.fn()
    window.addEventListener('evo:suporte', ouvir)
    montar(<AppHub />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Não vejo meu ingresso' })[0])
    window.removeEventListener('evo:suporte', ouvir)
    expect((ouvir.mock.calls[0][0] as CustomEvent).detail).toEqual({ assunto: 'Não recebi ou não acho meu ingresso' })
  })

  it('o cardápio segue o evento que vem primeiro por data, não a compra mais recente', () => {
    ingressos = [
      ingresso('t1', 'active', { events: { id: 'tarde', title: 'Evento Tarde', date: '2099-06-10', status: 'published' } }),
      ingresso('t2', 'active', { events: { id: 'cedo', title: 'Evento Cedo', date: '2099-02-10', status: 'published' } }),
    ]
    montar(<AppHub />)
    expect(screen.getAllByRole('heading', { name: 'Evento Cedo', level: 3 }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'Evento Tarde', level: 3 })).toBeNull()
  })
})

describe('Chat do app', () => {
  it('vazio honesto: diz que não está disponível e aponta o Evo; sem campo de mensagem', () => {
    montar(<AppChat />)
    expect(screen.getByRole('status')).toHaveTextContent(/ainda não está disponível/)
    expect(screen.getByRole('status')).toHaveTextContent(/Evo/)
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})

describe('Configurações: exclusão de conta', () => {
  it('o texto diz o que a função faz (anonimiza; nome e CPF ficam em pedidos e ingressos), sem "permanentemente"', () => {
    montar(<ParticipantSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))
    const janela = screen.getByRole('dialog', { name: 'Excluir conta' })
    expect(janela).toHaveTextContent(/anonimizado/)
    expect(janela).toHaveTextContent(/nome e CPF/)
    expect(janela).toHaveTextContent(/ainda vão acontecer deixam de aparecer/)
    expect(document.body.textContent).not.toMatch(/permanente/i)
    fireEvent.keyDown(janela, { key: 'Escape' }) // Dialog do projeto: Esc fecha
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Cadastro: sem indicação nem recompensa', () => {
  it('"Como nos conheceu?" não pede e-mail de amigo nem promete recompensa; o olho da senha tem nome', () => {
    montar(<Register />, '/auth/register')
    fireEvent.change(screen.getByPlaceholderText('Crie uma senha'), { target: { value: 'x' } })
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/recompensa/i)
  })
})

describe('Menu do app (AppLayout)', () => {
  const layout = () => montar(
    <Routes><Route element={<AppLayout />}><Route path="/app/*" element={<h1>Página</h1>} /></Route></Routes>,
    '/app/hub',
  )

  it('todo botão só de ícone tem nome acessível', () => {
    layout()
    for (const nome of ['Abrir menu', 'Notificações', 'Recolher menu lateral', 'Alterar foto de perfil']) {
      expect(screen.getAllByRole('button', { name: nome }).length).toBeGreaterThan(0)
    }
    expect(screen.getByRole('button', { name: 'Recolher menu lateral' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Recolher menu lateral' }))
    expect(screen.getByRole('button', { name: 'Expandir menu lateral' })).toBeInTheDocument()
    // recolhida, a lateral só tem ícones: cada link e o Sair seguem com nome
    expect(screen.getByRole('link', { name: 'Compras' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    for (const b of screen.getAllByRole('button')) expect(b).toHaveAccessibleName()
  })

  it('a busca do topo está ligada: enviar leva ao Explorar com o termo', () => {
    layout()
    const campo = screen.getByRole('searchbox', { name: 'Buscar eventos' })
    expect(campo).toBeEnabled()
    fireEvent.change(campo, { target: { value: 'forró' } })
    fireEvent.submit(campo.closest('form')!)
    expect(screen.getByTestId('local')).toHaveTextContent('/app/events?q=forr%C3%B3')
  })
})

describe('Erros do login em português', () => {
  it('traduz os comuns do Supabase e deixa passar o resto', () => {
    expect(erroDeLogin('Invalid login credentials')).toBe('E-mail ou senha incorretos')
    expect(erroDeLogin('Email not confirmed')).toMatch(/Confirme seu e-mail/)
    expect(erroDeLogin('Email rate limit exceeded')).toMatch(/Muitas tentativas/)
    expect(erroDeLogin('Algo novo')).toBe('Algo novo')
    expect(erroDeLogin('')).toBe('Erro ao realizar login')
    expect(erroDeLogin('User is banned')).toMatch(/bloqueada/)
    expect(erroDeLogin('Signups not allowed for this instance')).toMatch(/desativados/)
    expect(erroDeLogin('Unsupported provider: provider is not enabled')).toMatch(/não está disponível/)
    // com texto padrão, o que não é reconhecido nunca sai em inglês
    expect(erroDeLogin('Database error saving new user', 'Tente de novo')).toBe('Tente de novo')
    expect(erroDeLogin('Invalid login credentials', 'Tente de novo')).toBe('E-mail ou senha incorretos')
  })
})
