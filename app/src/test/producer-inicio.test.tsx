import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerDashboard from '../pages/producer/Dashboard'

// Respostas por tabela; o supabase falso aceita qualquer encadeamento (.select().eq().in()...)
const tabelas: Record<string, { data: unknown; error: unknown }> = {}
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Ricardo Scoparo' } }) }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (t: string) => {
      const r = () => tabelas[t]
      type Cb = (v: unknown) => unknown
      const b: object = new Proxy({}, { get: (_o, k) => k === 'then' ? (ok: Cb, no: Cb) => Promise.resolve(r()).then(ok, no) : k === 'maybeSingle' ? () => Promise.resolve(r()) : () => b })
      return b
    },
  },
}))
vi.stubGlobal('matchMedia', () => ({ matches: true })) // prefers-reduced-motion: números sem contagem
const montar = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><ProducerDashboard /></MemoryRouter></QueryClientProvider>)

describe('Início do produtor', () => {
  it('sem eventos: convite, aviso honesto e passos zerados', async () => {
    tabelas.events = { data: [], error: null }
    tabelas.producer_profiles = { data: null, error: { code: '42501' } }
    montar()
    expect(await screen.findByText('Você ainda não tem eventos')).toBeTruthy()
    expect(screen.getByText(/As vendas aparecem aqui/)).toBeTruthy()
    expect(screen.getByText('0 de 5')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeTruthy()
    expect(screen.getByText(/, Ricardo$/)).toBeTruthy()
  })

  it('com eventos e vendas: só eventos futuros, vendidos/capacidade e ticket médio', async () => {
    tabelas.events = { data: [
      { id: 'e1', title: '[TESTE] Show', status: 'published', approval_status: 'pending', date: '2099-01-10', start_date: '2099-01-10T20:00:00Z', capacity: null, ticket_types: [{ quantity_total: 100, capacity: null }] },
      { id: 'e2', title: 'Rascunho velho', status: 'draft', approval_status: 'pending', date: '2020-01-01', start_date: '2020-01-01T00:00:00Z', capacity: 50, ticket_types: [] },
    ], error: null }
    tabelas.producer_profiles = { data: { company_name: 'Seda' }, error: null }
    tabelas.orders = { data: [{ total: 55 }, { total: 110 }], error: null }
    tabelas.tickets = { data: [1, 2, 3].map(() => ({ event_id: 'e1', checked_in_at: null })), error: null }
    montar()
    expect(await screen.findByText('[TESTE] Show')).toBeTruthy()
    expect(screen.queryByText('Rascunho velho')).toBeNull()
    expect(screen.getByText('Em análise')).toBeTruthy()
    expect(screen.getByText('3 de 100 vendidos')).toBeTruthy()
    expect(screen.getByText('4 de 5')).toBeTruthy()
    expect(screen.queryByText(/As vendas aparecem aqui/)).toBeNull()
    expect(screen.getByText(/165,00/)).toBeTruthy()
    expect(screen.getByText(/55,00/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /\[TESTE\] Show/ }).getAttribute('href')).toBe('/producer/events/e1/edit')
  })

  it('erro de consulta vira aviso com "Tentar de novo", não zeros', async () => {
    tabelas.events = { data: null, error: new Error('falhou') }
    montar()
    // a tela tenta 1 vez de novo (retry: 1) antes de mostrar o erro
    expect(await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByText('R$ 0,00')).toBeNull()
  })
})
