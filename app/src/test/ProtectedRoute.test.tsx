import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Link } from 'react-router-dom'
import { fireEvent } from '@testing-library/react'
import { AuthRetryableFetchError } from '@supabase/supabase-js'

// Decisão 99: admin sem 2FA cadastrado vê a tela de cadastro, não o painel
const auth = vi.hoisted(() => ({ role: 'admin' as string }))
const mfa = vi.hoisted(() => ({ getAuthenticatorAssuranceLevel: vi.fn(), listFactors: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, role: auth.role, user: { id: 'u1', admin_permissions: ['super_admin'] }, logout: vi.fn() }),
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { mfa } } }))

import { ProtectedRoute } from '../App'

const nivel = (currentLevel: string, nextLevel: string) => ({ data: { currentLevel, nextLevel }, error: null })
const fatores = (n: number) => ({ data: { all: [], totp: Array.from({ length: n }, () => ({ status: 'verified' })) }, error: null })
const abrir = () => render(
  <MemoryRouter><ProtectedRoute allowedRoles={['admin', 'producer']}><p>painel</p></ProtectedRoute></MemoryRouter>)

describe('ProtectedRoute e o 2FA do admin', () => {
  beforeEach(() => { vi.clearAllMocks(); auth.role = 'admin' })

  it('admin sem fator → tela de cadastro do 2FA', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(nivel('aal1', 'aal1'))
    mfa.listFactors.mockResolvedValue(fatores(0))
    abrir()
    expect(await screen.findByText(/ative a verificação em duas etapas/)).toBeInTheDocument()
    expect(screen.getByText('Sair')).toBeInTheDocument()
    expect(screen.queryByText('painel')).not.toBeInTheDocument()
  })

  it('admin em aal2 → painel, sem listar fatores', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(nivel('aal2', 'aal2'))
    abrir()
    expect(await screen.findByText('painel')).toBeInTheDocument()
    expect(mfa.listFactors).not.toHaveBeenCalled()
  })

  it('erro ao listar fatores → fecha com "Tentar de novo"', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(nivel('aal1', 'aal1'))
    mfa.listFactors.mockResolvedValue({ data: null, error: new Error('rede') })
    abrir()
    expect(await screen.findByText('Tentar de novo')).toBeInTheDocument()
  })

  it('produtor sem fator → painel, sem listar fatores', async () => {
    auth.role = 'producer'
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(nivel('aal1', 'aal1'))
    abrir()
    expect(await screen.findByText('painel')).toBeInTheDocument()
    expect(mfa.listFactors).not.toHaveBeenCalled()
  })

  it('falha de rede no 2FA: libera /app/tickets com cópia guardada e bloqueia as outras rotas', async () => {
    auth.role = 'user'
    localStorage.setItem('evk.ingressos.u1', JSON.stringify({ em: new Date().toISOString(), ingressos: [] }))
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: new AuthRetryableFetchError('rede', 0) })
    render(
      <MemoryRouter initialEntries={['/app/tickets']}>
        <Link to="/app/outra">ir</Link>
        <ProtectedRoute allowedRoles={['user']}><p>painel</p></ProtectedRoute>
      </MemoryRouter>)
    expect(await screen.findByText('painel')).toBeInTheDocument()
    fireEvent.click(screen.getByText('ir'))
    expect(await screen.findByText('Tentar de novo')).toBeInTheDocument()
    expect(screen.queryByText('painel')).not.toBeInTheDocument()
    localStorage.clear()
  })
})
