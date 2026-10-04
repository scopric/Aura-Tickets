import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const from = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { from, auth: { mfa: { listFactors: () => Promise.resolve({ data: { totp: [] } }) } } } }))
const usuario = { id: 'a1', admin_permissions: ['manage_events'] }
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: usuario }) }))

vi.mock('../hooks/useAdminFinance', () => ({ useAdminFinance: () => ({ data: undefined, isLoading: false, isError: true, error: new Error('rls negou') }) }))

import AdminDashboard from '../pages/admin/Dashboard'
import AdminCoupons from '../pages/admin/Coupons'
import AdminFinance from '../pages/admin/Finance'
import AdminSettings from '../pages/admin/AdminSettings'

describe('Admin: Painel com permissão', () => {
  it('sem manage_newsletter mostra "—", não consulta a tabela e sem manage_finance não há link do financeiro', async () => {
    from.mockImplementation(() => {
      const r = Promise.resolve({ data: [], error: null, count: 0 })
      const q: any = { select: () => q, order: () => q, limit: () => r, or: () => q, eq: () => q, is: () => r, then: r.then.bind(r) }
      return q
    })
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/Atualizado em/)).toBeInTheDocument())
    expect(from).not.toHaveBeenCalledWith('newsletter_subscribers')
    expect(from).not.toHaveBeenCalledWith('profiles')
    expect(from).toHaveBeenCalledWith('events')
    expect(screen.getAllByText('Sem acesso a esta área').length).toBeGreaterThan(0)
    expect(screen.getByText('Inscritos na newsletter').parentElement?.textContent).toContain('—')
    expect(screen.queryByText(/Abrir financeiro/)).toBeNull()
  })
})

describe('Admin: Cupons', () => {
  it('falha ao ler os pedidos mostra alerta, não "Nenhum pedido", e o contador vira —', async () => {
    from.mockImplementation((t: string) => {
      const r = Promise.resolve(t === 'affiliate_coupon_requests'
        ? { data: null, error: { message: 'permission denied' } }
        : { data: [], error: null })
      const q: any = { select: () => q, order: () => q, limit: () => r, eq: () => q, then: r.then.bind(r) }
      return q
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AdminCoupons /></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', { name: /Pedidos dos afiliados/ }))
    expect(await screen.findByText(/Não foi possível carregar os pedidos: permission denied/)).toBeInTheDocument()
    expect(screen.queryByText('Nenhum pedido de cupom dos afiliados.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Pedidos dos afiliados (—)' })).toBeInTheDocument()
  })
})

describe('Admin: Configurações', () => {
  it('falha ao ler platform_settings avisa e trava o Salvar (não grava os padrões por cima)', async () => {
    from.mockImplementation((t: string) => {
      const r = Promise.resolve(t === 'platform_settings' ? { data: null, error: { message: 'timeout' } } : { data: [], error: null })
      const q: any = { select: () => q, order: () => q, limit: () => r, eq: () => q, then: r.then.bind(r) }
      return q
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<MemoryRouter><AdminSettings /></MemoryRouter>)
    expect(await screen.findByText(/Não foi possível ler as configurações/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salvar/ })).toBeDisabled()
  })
})

describe('Admin: Financeiro', () => {
  it('com erro não mostra KPIs zerados nem o banner de números reais', () => {
    render(<MemoryRouter><AdminFinance /></MemoryRouter>)
    expect(screen.getByText(/Não foi possível carregar os dados financeiros: rls negou/)).toBeInTheDocument()
    expect(screen.queryByText('Volume Geral de Vendas (GMV)')).toBeNull()
    expect(screen.queryByText(/Estes números são/)).toBeNull()
  })
})
