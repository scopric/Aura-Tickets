import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AdminSettingsPage from '../pages/admin/AdminSettings'

// Decisão 163 item 8: cada exportação de Configurações exige a permissão da área; o botão some para quem não tem
let permissoes: string[] = []
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', admin_permissions: permissoes } }) }))
vi.mock('../hooks/useTwoFactor', () => ({ useTwoFactor: () => ({ factors: [], loading: false, refresh: vi.fn() }) }))
vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(() => ({ select: vi.fn(() => ({ order: vi.fn(() => ({ order: vi.fn(() => ({ range: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) })), limit: vi.fn() })), auth: {} } }))
vi.mock('../lib/avatarUpload', () => ({ uploadAvatar: vi.fn() }))

const botoes = () => {
  render(<AdminSettingsPage />)
  fireEvent.click(screen.getByRole('button', { name: /Backup/ }))
  return ['Usuários', 'Eventos', 'Transações', 'Logs'].filter(n => screen.queryByRole('button', { name: new RegExp(`^${n}\\s*CSV`) }))
}

describe('Configurações: exportações por permissão', () => {
  afterEach(() => cleanup())
  it('manage_finance vê só Transações', () => { permissoes = ['manage_finance']; expect(botoes()).toEqual(['Transações']) })
  it('view_analytics vê só Logs', () => { permissoes = ['view_analytics']; expect(botoes()).toEqual(['Logs']) })
  it('super_admin vê todas', () => { permissoes = ['super_admin']; expect(botoes()).toEqual(['Usuários', 'Eventos', 'Transações', 'Logs']) })
  it('sem permissão de área: nenhuma e aviso', () => { permissoes = ['manage_settings']; expect(botoes()).toEqual([]); expect(screen.getByText(/não inclui nenhuma exportação/)).toBeInTheDocument() })
})
