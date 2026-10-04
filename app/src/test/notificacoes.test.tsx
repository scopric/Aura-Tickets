import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import NotificationsTopButton, { tempoRelativo } from '../components/NotificationsTopButton'
import ParticipantNotifications from '../pages/app/Notifications'
import { urlDoAviso } from '../hooks/useNotifications'

type Aviso = { id: string; title: string; body: string | null; is_read: boolean; created_at: string; type?: string; metadata?: { url?: string } | null }
const marcarTodas = vi.fn()
const marcarUma = vi.fn()
const marcarUmaAsync = vi.fn()
const marcarTodasAsync = vi.fn()
const apagarAsync = vi.fn()
let lista: Aviso[] = []
let estado = { isLoading: false, isError: false }
const refetch = vi.fn()
vi.mock('../hooks/useNotifications', async (original) => ({
  ...(await original<typeof import('../hooks/useNotifications')>()),
  useUserNotifications: () => ({ data: lista, ...estado, refetch }),
  useMarkAllNotificationsRead: () => ({ mutate: marcarTodas, mutateAsync: marcarTodasAsync, isPending: false }),
  useMarkNotificationRead: vi.fn(() => ({ mutate: marcarUma, mutateAsync: marcarUmaAsync, isPending: false })),
  useDeleteNotification: vi.fn(() => ({ mutateAsync: apagarAsync, isPending: false })),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
const toastErro = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastErro(...a), success: vi.fn() } }))
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

const agora = Date.now()
const dois = (): Aviso[] => [
  { id: 'n1', title: 'Seu evento foi aprovado', body: '"Festa" já está no ar.', is_read: false, type: 'info', metadata: { url: '/producer/events/e1/edit' }, created_at: new Date(agora - 5 * 60000).toISOString() },
  { id: 'n2', title: 'Bem-vindo', body: null, is_read: true, type: 'info', metadata: null, created_at: new Date(agora - 2 * 86400000).toISOString() },
]
const Local = () => <p data-testid="local">{useLocation().pathname}</p>
const montarSino = (props: { verTodas?: { to: string; texto: string } } = {}) =>
  render(<MemoryRouter><NotificationsTopButton className="" {...props} /><Local /></MemoryRouter>)

beforeEach(() => { vi.clearAllMocks(); estado = { isLoading: false, isError: false }; lista = [] })

describe('NotificationsTopButton (sino)', () => {
  it('vazio: estado honesto, "marcar todas" desligado e link de rodapé', async () => {
    montarSino({ verTodas: { to: '/producer/settings?secao=notificacoes', texto: 'Preferências de notificação' } })
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }))
    expect(await screen.findByText('Nenhuma notificação por enquanto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marcar todas como lidas' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Preferências de notificação' })).toHaveAttribute('href', '/producer/settings?secao=notificacoes')
  })

  it('erro de leitura: avisa em vez de mostrar "vazio"', async () => {
    estado = { isLoading: false, isError: true }
    montarSino()
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as notificações')
    expect(screen.queryByText('Nenhuma notificação por enquanto')).toBeNull()
  })

  it('lista (lê body), conta não lidas, marca uma ao abrir, vai ao link e marca todas', async () => {
    lista = dois()
    montarSino()
    fireEvent.click(screen.getByRole('button', { name: 'Notificações, 1 não lida' }))
    expect(await screen.findByText('Seu evento foi aprovado')).toBeInTheDocument()
    expect(screen.getByText('"Festa" já está no ar.')).toBeInTheDocument() // body, não message
    expect(screen.getByText('há 5 minutos')).toBeInTheDocument()
    expect(screen.getByText('anteontem')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Bem-vindo')) // já lida e sem link: não marca nem navega
    expect(marcarUma).not.toHaveBeenCalled()
    expect(screen.getByTestId('local')).toHaveTextContent('/')
    fireEvent.click(screen.getByText('Seu evento foi aprovado'))
    expect(marcarUma).toHaveBeenCalledTimes(1)
    expect(marcarUma.mock.calls[0][0]).toBe('n1')
    expect(screen.getByTestId('local')).toHaveTextContent('/producer/events/e1/edit')
  })

  it('marcar todas chama a ação', async () => {
    lista = dois()
    montarSino()
    fireEvent.click(screen.getByRole('button', { name: 'Notificações, 1 não lida' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar todas como lidas' }))
    expect(marcarTodas).toHaveBeenCalledTimes(1)
  })

  it('tempoRelativo em pt-BR', () => {
    const t = Date.parse('2026-09-29T12:00:00Z')
    expect(tempoRelativo('2026-09-29T11:59:40Z', t)).toBe('agora')
    expect(tempoRelativo('2026-09-29T09:00:00Z', t)).toBe('há 3 horas')
  })
})

describe('urlDoAviso', () => {
  it('só aceita caminho interno', () => {
    expect(urlDoAviso({ metadata: { url: '/event/abc' } })).toBe('/event/abc')
    expect(urlDoAviso({ metadata: { url: 'https://mal.example' } })).toBeNull()
    expect(urlDoAviso({ metadata: { url: '//mal.example' } })).toBeNull()
    expect(urlDoAviso({ metadata: null })).toBeNull()
  })
})

describe('Tela de notificações do participante', () => {
  const montarPagina = () => render(<MemoryRouter initialEntries={['/app/notifications']}><Routes><Route path="/app/notifications" element={<ParticipantNotifications />} /></Routes></MemoryRouter>)

  it('vazio honesto', () => {
    montarPagina()
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma notificação ainda.')
  })

  it('erro de leitura com "Tentar de novo"', () => {
    estado = { isLoading: false, isError: true }
    montarPagina()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as notificações')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('lista com body, abre o link, marca uma e marca todas; falha ao marcar mostra erro', async () => {
    lista = dois()
    marcarUmaAsync.mockResolvedValue(true)
    marcarTodasAsync.mockResolvedValue(true)
    montarPagina()
    expect(screen.getByText('1 não lida')).toBeInTheDocument()
    expect(screen.getByText('"Festa" já está no ar.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/producer/events/e1/edit')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como lida' }))
    await waitFor(() => expect(marcarUmaAsync).toHaveBeenCalledWith('n1'))
    fireEvent.click(screen.getByRole('button', { name: /Marcar todas/ }))
    await waitFor(() => expect(marcarTodasAsync).toHaveBeenCalledTimes(1))
    marcarUmaAsync.mockRejectedValueOnce(new Error('x'))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como lida' }))
    await waitFor(() => expect(toastErro).toHaveBeenCalledWith('Erro ao marcar como lida'))
  })

  it('filtro "Não lidas" esconde as lidas', () => {
    lista = dois()
    montarPagina()
    fireEvent.click(screen.getByRole('button', { name: 'Não lidas' }))
    expect(screen.queryByText('Bem-vindo')).toBeNull()
    expect(screen.getByText('Seu evento foi aprovado')).toBeInTheDocument()
  })
})
