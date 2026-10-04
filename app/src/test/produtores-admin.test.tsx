import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const linhas = [
  { id: 'a', email: 'a@x.com', full_name: 'Ana', avatar_url: null, created_at: '2026-01-01', producer_profiles: null, events: [{ count: 0 }] },
  { id: 'b', email: 'b@x.com', full_name: 'Bia', avatar_url: null, created_at: '2026-01-02', producer_profiles: { company_name: 'Bia Eventos', cnpj: null, is_verified: false, commission_rate: null }, events: [{ count: 1 }] },
]
vi.mock('../lib/supabase', () => {
  const q: any = { select: () => q, eq: () => q, order: () => Promise.resolve({ data: linhas, error: null }) }
  return { supabase: { from: () => q } }
})

import AdminProducers from '../pages/admin/Producers'

describe('Admin: produtores', () => {
  it('CNPJ nulo não quebra e não há botão "Completar cadastro"', async () => {
    render(<AdminProducers />)
    expect(await screen.findByText('Bia Eventos')).toBeInTheDocument()
    expect(screen.getByText('CNPJ a preencher')).toBeInTheDocument()
    expect(screen.getByText('aguardando o produtor completar o cadastro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Completar cadastro' })).toBeNull()
  })
})
