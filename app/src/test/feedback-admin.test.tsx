import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../lib/supabase', () => {
  const tabela = (t: string) => {
    const r = t === 'feedback'
      ? { data: null, error: { message: 'column feedback.email does not exist' } }
      : { data: [{ id: 'c1', name: 'Carla', email: 'carla@x.com', phone: null, subject: null, message: 'Oi', page: null, created_at: '2026-01-01T10:00:00Z' }], error: null }
    const q: any = { select: () => q, order: () => q, limit: () => Promise.resolve(r) }
    return q
  }
  return { supabase: { from: tabela } }
})

import AdminFeedback from '../pages/admin/Feedback'

describe('Admin: feedback', () => {
  it('erro em feedback mostra alerta e contatos continuam na tela', async () => {
    render(<QueryClientProvider client={new QueryClient()}><AdminFeedback /></QueryClientProvider>)
    expect(await screen.findByText(/column feedback\.email does not exist/)).toBeInTheDocument()
    expect(screen.getByText('Carla')).toBeInTheDocument()
  })
})
