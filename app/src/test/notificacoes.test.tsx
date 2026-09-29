import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NotificationsTopButton, { tempoRelativo } from '../components/NotificationsTopButton'

const marcarTodas = vi.fn()
const marcarUma = vi.fn()
let lista: { id: string; title: string; message: string | null; is_read: boolean; created_at: string }[] = []
vi.mock('../hooks/useNotifications', () => ({
  useUserNotifications: () => ({ data: lista, isLoading: false, isError: false }),
  useMarkAllNotificationsRead: () => ({ mutate: marcarTodas, isPending: false }),
  useMarkNotificationRead: () => ({ mutate: marcarUma, isPending: false }),
}))
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

describe('NotificationsTopButton (sino do produtor)', () => {
  it('vazio: estado honesto e "marcar todas" desligado', async () => {
    lista = []
    render(<NotificationsTopButton className="" />)
    fireEvent.click(screen.getByRole('button', { name: 'Notificações (0 não lidas)' }))
    expect(await screen.findByText('Nenhuma notificação por enquanto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marcar todas como lidas' })).toBeDisabled()
  })

  it('lista com 2 itens, marca uma e marca todas', async () => {
    const agora = Date.now()
    lista = [
      { id: 'n1', title: 'Evento aprovado', message: 'Seu evento foi aprovado.', is_read: false, created_at: new Date(agora - 5 * 60000).toISOString() },
      { id: 'n2', title: 'Bem-vindo', message: null, is_read: true, created_at: new Date(agora - 2 * 86400000).toISOString() },
    ]
    render(<NotificationsTopButton className="" />)
    fireEvent.click(screen.getByRole('button', { name: 'Notificações (1 não lidas)' }))
    expect(await screen.findByText('Evento aprovado')).toBeInTheDocument()
    expect(screen.getByText('Bem-vindo')).toBeInTheDocument()
    expect(screen.getByText('há 5 minutos')).toBeInTheDocument()
    expect(screen.getByText('anteontem')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Bem-vindo')) // já lida: não marca de novo
    fireEvent.click(screen.getByText('Evento aprovado'))
    expect(marcarUma).toHaveBeenCalledTimes(1)
    expect(marcarUma).toHaveBeenCalledWith('n1')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }))
    expect(marcarTodas).toHaveBeenCalledTimes(1)
  })

  it('tempoRelativo em pt-BR', () => {
    const agora = Date.parse('2026-09-29T12:00:00Z')
    expect(tempoRelativo('2026-09-29T11:59:40Z', agora)).toBe('agora')
    expect(tempoRelativo('2026-09-29T09:00:00Z', agora)).toBe('há 3 horas')
  })
})
