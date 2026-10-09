import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PainelEventos from '../components/PainelEventos'

// A consulta termina como a gente mandar: pendente para sempre, erro ou lista vazia
let resposta: () => Promise<{ data: unknown; error: unknown }>
vi.mock('../lib/supabase', () => {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte']) q[m] = () => q
  q.order = () => resposta()
  return { supabase: { from: () => q } }
})

const montar = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><PainelEventos aoNavegar={() => {}} /></MemoryRouter>
  </QueryClientProvider>,
)
const VAZIO = /Nenhum evento publicado/

describe('PainelEventos: não afirma "sem eventos" sem saber', () => {
  beforeEach(() => { resposta = () => new Promise(() => {}) })

  it('carregando: sem a mensagem de vazio', () => {
    montar()
    expect(screen.queryByText(VAZIO)).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver todos os eventos' })).toBeInTheDocument()
  })

  it('erro na consulta: sem a mensagem de vazio', async () => {
    resposta = () => Promise.resolve({ data: null, error: new Error('falhou') })
    montar()
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByText(VAZIO)).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver todos os eventos' })).toBeInTheDocument()
  })

  it('sucesso e vazio: mostra a mensagem', async () => {
    resposta = () => Promise.resolve({ data: [], error: null })
    montar()
    await waitFor(() => expect(screen.getByText(VAZIO)).toBeInTheDocument())
  })
})
