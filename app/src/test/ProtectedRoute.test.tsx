import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Decisão 99: admin sem 2FA cadastrado vê a tela de cadastro, não o painel
const auth = vi.hoisted(() => ({ role: 'admin' as string }))
const mfa = vi.hoisted(() => ({ getAuthenticatorAssuranceLevel: vi.fn(), listFactors: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, role: auth.role, user: { admin_permissions: ['super_admin'] } }),
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
    expect(screen.queryByText('painel')).not.toBeInTheDocument()
  })

  it('admin com fator e aal2 → painel', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(nivel('aal2', 'aal2'))
    mfa.listFactors.mockResolvedValue(fatores(1))
    abrir()
    expect(await screen.findByText('painel')).toBeInTheDocument()
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
})
