import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerCRM, { numeroWhatsApp } from '../pages/producer/CRM'

const m = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../lib/supabase', () => {
  const etapas = [{ id: 'e1', name: 'Novo', position: 0 }]
  const leads = [{ id: 'l1', full_name: 'Lead Teste', email: 'lead@exemplo.com', phone: '11987654321', source: 'Instagram', potential_value: 100, event_interest: null, notes: 'nota antiga', stage_id: 'e1', created_at: '2026-10-01T10:00:00Z', crm_interactions: [] }]
  const tabela = (nome: string) => {
    const b: object = new Proxy({}, {
      get: (_o, k) => {
        if (k === 'then') return (ok: (v: unknown) => unknown) => ok({ data: nome === 'crm_leads' ? leads : etapas, error: null })
        if (k === 'update') return (v: unknown) => { m.update(v); return b }
        if (k === 'eq') return (c: string, v: string) => { m.eq(c, v); return b }
        return () => b
      },
    })
    return b
  }
  return { supabase: { from: tabela } }
})

describe('CRM: editar lead', () => {
  it('abre o modal preenchido e salva com update no lead do dono', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><MemoryRouter><ProducerCRM /></MemoryRouter></QueryClientProvider>)
    fireEvent.click(await screen.findByText('Lead Teste'))
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const nome = await screen.findByLabelText('Nome completo')
    expect(nome).toHaveValue('Lead Teste')
    fireEvent.change(nome, { target: { value: 'Lead Editado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ full_name: 'Lead Editado', notes: 'nota antiga' })))
    expect(m.eq).toHaveBeenCalledWith('id', 'l1')
    expect(m.eq).toHaveBeenCalledWith('producer_id', 'u1')
  })
})

describe('numeroWhatsApp', () => {
  it('acrescenta 55 em número brasileiro sem DDI', () => {
    expect(numeroWhatsApp('11987654321')).toBe('5511987654321')
    expect(numeroWhatsApp('(11) 3456-7890')).toBe('551134567890')
  })
  it('não mexe em número já completo', () => {
    expect(numeroWhatsApp('5511987654321')).toBe('5511987654321')
    expect(numeroWhatsApp('+55 11 98765-4321')).toBe('5511987654321')
  })
})
