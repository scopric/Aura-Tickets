import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const from = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { from } }))
const usuario = { id: 'a1', admin_permissions: ['manage_events'] }
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: usuario }) }))

import AdminDashboard from '../pages/admin/Dashboard'

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
