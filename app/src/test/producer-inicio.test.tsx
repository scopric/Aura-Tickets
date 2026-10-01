import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerDashboard from '../pages/producer/Dashboard'

// Supabase falso: guarda a cadeia de chamadas (.select().eq().in()...) e responde por tabela
type Chamada = [string, unknown[]]
type Resposta = { data?: unknown; error: unknown; count?: number | null }
const tabelas: Record<string, (c: Chamada[]) => Resposta> = {}
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Ricardo Scoparo' } }) }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (t: string) => {
      const c: Chamada[] = []
      const r = () => Promise.resolve(tabelas[t](c))
      type Cb = (v: unknown) => unknown
      const b: object = new Proxy({}, {
        get: (_o, k) => k === 'then' ? (ok: Cb, no: Cb) => r().then(ok, no)
          : k === 'maybeSingle' ? r
          : (...a: unknown[]) => { c.push([String(k), a]); return b },
      })
      return b
    },
  },
}))
let reduzir = true // prefers-reduced-motion
vi.stubGlobal('matchMedia', () => ({ matches: reduzir }))

const ingressos = (total: number, porEvento: Record<string, number> = {}, checkin = false) => (c: Chamada[]): Resposta => {
  if (c.some(([n]) => n === 'not')) return { data: checkin ? [{ id: 't1' }] : [], error: null }
  const ev = c.find(([n, a]) => n === 'eq' && a[0] === 'event_id')
  return { data: null, error: null, count: ev ? porEvento[ev[1][1] as string] ?? 0 : total }
}
const valorDe = (rotulo: string) => screen.getByText(rotulo).nextElementSibling?.textContent
const montar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><MemoryRouter><ProducerDashboard /></MemoryRouter></QueryClientProvider>)
  return qc
}
const e1 = { id: 'e1', title: '[TESTE] Show', status: 'published', approval_status: 'pending', date: '2099-01-10', start_date: '2099-01-10T20:00:00Z', capacity: null, ticket_types: [{ quantity_total: 100, capacity: null }] }

describe('Início do produtor', () => {
  it('sem eventos: convite, aviso honesto e passos zerados', async () => {
    tabelas.events = () => ({ data: [], error: null })
    tabelas.producer_profiles = () => ({ data: null, error: { code: '42501' } })
    tabelas.orders = () => ({ data: [], error: null, count: 0 })
    tabelas.tickets = ingressos(0)
    montar()
    expect(await screen.findByText('Você ainda não tem eventos')).toBeTruthy()
    expect(screen.getByText('Nenhuma venda paga ainda.')).toBeTruthy()
    expect(screen.getByText('0 de 5')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Início' })).toBeTruthy()
    expect(screen.getByText(/, Ricardo$/)).toBeTruthy()
  })

  it('com eventos e vendas: publicado só se aprovado, só eventos futuros, vendidos por evento e ticket médio', async () => {
    tabelas.events = () => ({ data: [
      e1,
      { id: 'e2', title: 'Rascunho velho', status: 'draft', approval_status: 'pending', date: '2020-01-01', start_date: '2020-01-01T00:00:00Z', capacity: 50, ticket_types: [] },
    ], error: null })
    tabelas.producer_profiles = () => ({ data: { company_name: 'Seda' }, error: null })
    tabelas.orders = () => ({ data: [{ total: 55 }, { total: 110 }], error: null, count: 2 })
    tabelas.tickets = ingressos(3, { e1: 3 })
    montar()
    expect(await screen.findByText('[TESTE] Show')).toBeTruthy()
    expect(valorDe('Eventos publicados')).toBe('0') // e1 está publicado, mas em análise
    expect(valorDe('Ingressos vendidos')).toBe('3')
    expect(valorDe('Vendas (bruto)')).toMatch(/165,00$/)
    expect(valorDe('Ticket médio')).toMatch(/55,00$/)
    expect(screen.queryByText('Rascunho velho')).toBeNull()
    expect(screen.getByText('Em análise')).toBeTruthy()
    expect(screen.getByText('3 de 100 vendidos')).toBeTruthy()
    expect(screen.getByText('4 de 5')).toBeTruthy()
    expect(screen.queryByText('Nenhuma venda paga ainda.')).toBeNull()
    expect(screen.getByRole('link', { name: /\[TESTE\] Show/ }).getAttribute('href')).toBe('/producer/events/e1/edit')
  })

  it('mais pedidos que o limite de linhas: soma com "+" e sem ticket médio', async () => {
    tabelas.events = () => ({ data: [e1], error: null })
    tabelas.producer_profiles = () => ({ data: null, error: null })
    tabelas.orders = () => ({ data: [{ total: 10 }], error: null, count: 1500 })
    tabelas.tickets = ingressos(1500)
    montar()
    await screen.findByText('[TESTE] Show')
    expect(valorDe('Vendas (bruto)')).toMatch(/10,00\+$/)
    expect(valorDe('Ticket médio')).toBe('—')
    expect(screen.getByText('Soma parcial: mais de 1.000 pedidos pagos')).toBeTruthy()
  })

  it('contagem animada vai a 0 quando o valor novo é 0', async () => {
    reduzir = false
    tabelas.events = () => ({ data: [e1], error: null })
    tabelas.producer_profiles = () => ({ data: null, error: null })
    tabelas.orders = () => ({ data: [], error: null, count: 0 })
    tabelas.tickets = ingressos(7)
    const qc = montar()
    await waitFor(() => expect(valorDe('Ingressos vendidos')).toBe('7'), { timeout: 3000 })
    tabelas.tickets = ingressos(0)
    await qc.refetchQueries()
    await new Promise(r => setTimeout(r, 100)) // deixa o React e a limpeza do efeito terminarem
    expect(valorDe('Ingressos vendidos')).toBe('0')
    reduzir = true
  })

  it('erro de consulta (inclusive de rede no perfil) vira aviso com "Tentar de novo", não zeros', async () => {
    tabelas.events = () => ({ data: [], error: null })
    tabelas.producer_profiles = () => ({ data: null, error: { code: '', message: 'Failed to fetch' } })
    tabelas.orders = () => ({ data: [], error: null, count: 0 })
    tabelas.tickets = ingressos(0)
    montar()
    // a tela tenta 1 vez de novo (retry: 1) antes de mostrar o erro
    expect(await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByText('R$ 0,00')).toBeNull()
  })
})
