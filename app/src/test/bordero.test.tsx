import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { resumoBordero } from '../lib/bordero'
import ProducerBordero from '../pages/producer/Bordero'

// E5: Borderô do evento. As contas (total, por dia em Brasília, por forma, contagem por tipo) e os estados da tela
const eventos = vi.hoisted(() => ({ lista: [{ id: 'e1', title: 'Festa Um' }, { id: 'e2', title: 'Festa Dois' }] as { id: string; title: string }[] }))
vi.mock('../hooks/useEvents', () => ({
  useProducerEvents: () => ({ data: eventos.lista, isPending: false, isError: false, isFetching: false, refetch: vi.fn() }),
}))
// o banco: cada .from(tabela) devolve as linhas da tabela; guarda o que foi pedido em select e eq
const banco = vi.hoisted(() => ({ linhas: {} as Record<string, unknown[]>, erro: null as unknown, selects: [] as string[], eqs: [] as [string, unknown][] }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => {
      const q: Record<string, unknown> = {}
      for (const m of ['order', 'in', 'range']) q[m] = () => q
      q.select = (c: string) => { banco.selects.push(`${tabela}:${c}`); return q }
      q.eq = (c: string, v: unknown) => { banco.eqs.push([c, v]); return q }
      q.then = (ok: (r: unknown) => unknown) => ok({ data: banco.erro ? null : banco.linhas[tabela] ?? [], error: banco.erro })
      return q
    },
  },
}))
const baixou = vi.hoisted(() => vi.fn())
vi.mock('../lib/exportCsv', async orig => ({ ...(await orig<typeof import('../lib/exportCsv')>()), downloadCsv: baixou }))

const pedido = (id: string, total: number, payment_method: string | null, created_at: string) => ({ id, total, payment_method, created_at })
const ingresso = (ticket_type_id: string, nome: string, status: string, checked_in_at: string | null = null) =>
  ({ ticket_type_id, status, checked_in_at, ticket_types: { name: nome } })

const montar = (url = '/producer/bordero?eventId=e1') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}><ProducerBordero /></MemoryRouter>
    </QueryClientProvider>,
  )

describe('resumoBordero', () => {
  const pedidos = [
    pedido('p1', 110, 'pix', '2026-10-05T01:30:00Z'), // 04/10 22:30 em Brasília
    pedido('p2', 55.5, 'pix', '2026-10-04T15:00:00Z'), // 04/10
    pedido('p3', 200, 'credit_card', '2026-10-06T12:00:00Z'),
    pedido('p4', 10, null, '2026-10-06T13:00:00Z'),
  ]
  const ingressos = [
    ingresso('t1', 'Pista', 'active'), ingresso('t1', 'Pista', 'used', '2026-10-07T00:00:00Z'), ingresso('t1', 'Pista', 'active', '2026-10-07T00:00:00Z'),
    ingresso('t2', 'VIP', 'active'), ingresso('t2', 'VIP', 'cancelled'), ingresso('t2', 'VIP', 'refunded', '2026-10-07T00:00:00Z'),
  ]
  const r = resumoBordero(pedidos, ingressos)

  it('total e nº de pedidos', () => {
    expect(r.total).toBeCloseTo(375.5)
    expect(r.nPedidos).toBe(4)
  })
  it('por dia na hora de Brasília: o pedido da 01h30 UTC cai no dia anterior', () => {
    expect(r.porDia.map(d => [d.dia, d.pedidos, d.total])).toEqual([['2026-10-04', 2, 165.5], ['2026-10-06', 2, 210]])
  })
  it('por forma, com "Não informada" para forma vazia', () => {
    expect(r.porForma.map(f => [f.forma, f.pedidos, f.total])).toEqual([['Cartão de crédito', 1, 200], ['Pix', 2, 165.5], ['Não informada', 1, 10]])
  })
  it('por tipo: só ativo e usado contam; check-in é usado ou checked_in_at', () => {
    expect(r.porTipo).toEqual([{ id: 't1', nome: 'Pista', validos: 3, checkins: 2 }, { id: 't2', nome: 'VIP', validos: 1, checkins: 0 }])
  })
  it('sem linhas, tudo zerado', () => {
    expect(resumoBordero([], [])).toEqual({ total: 0, nPedidos: 0, porForma: [], porDia: [], porTipo: [] })
  })
})

describe('Borderô (tela)', () => {
  beforeEach(() => { localStorage.clear(); banco.linhas = {}; banco.erro = null; banco.selects = []; banco.eqs = [] })
  afterEach(() => { vi.clearAllMocks(); cleanup() })

  it('sem evento escolhido pede para escolher e não vai ao banco', () => {
    montar('/producer/bordero')
    expect(screen.getByText('Escolha um evento', { selector: 'div' })).toBeInTheDocument()
    expect(screen.getByLabelText('Evento')).toHaveValue('')
    expect(screen.queryByRole('option', { name: /Todos/ })).toBeNull()
    expect(banco.selects).toHaveLength(0)
  })

  it('com vendas mostra total (com taxa), por forma, por dia e por tipo, sem valor por tipo', async () => {
    banco.linhas = {
      orders: [pedido('p1', 110, 'pix', '2026-10-05T01:30:00Z'), pedido('p2', 40, 'boleto', '2026-10-06T12:00:00Z')],
      tickets: [ingresso('t1', 'Pista', 'active'), ingresso('t1', 'Pista', 'used')],
    }
    montar()
    const total = (await screen.findByText('Total pago pelo comprador (com taxa)')).parentElement!
    expect(total).toHaveTextContent('150,00')
    expect(screen.getByText('Pedidos pagos').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Boleto')).toBeInTheDocument()
    expect(screen.getByText('04/10/2026')).toBeInTheDocument()
    const tipo = within(screen.getByRole('region', { name: 'Ingressos por tipo' }))
    expect(tipo.getByText('Pista')).toBeInTheDocument()
    expect(tipo.getByText('2 válidos')).toBeInTheDocument()
    expect(tipo.getByText('1 check-in')).toBeInTheDocument()
    expect(tipo.queryByText(/R\$/)).toBeNull()
    expect(screen.getByText(/taxas da Evokaa e de processamento, reembolsos, repasse, meia-entrada/)).toBeInTheDocument()
  })

  it('consulta só colunas escolhidas (sem *, CPF ou telefone) e só pedidos pagos do evento', async () => {
    montar()
    await screen.findByText('Sem vendas pagas ainda')
    expect(banco.selects.length).toBe(2)
    for (const s of banco.selects) expect(s).not.toMatch(/\*|cpf|phone|email|name(?!\))/i)
    expect(banco.eqs).toContainEqual(['status', 'paid'])
    expect(banco.eqs.filter(([c]) => c === 'event_id').every(([, v]) => v === 'e1')).toBe(true)
  })

  it('vazio: texto honesto e CSV desligado', async () => {
    montar()
    expect(await screen.findByText('Sem vendas pagas ainda')).toBeInTheDocument()
    expect(screen.getByText('O borderô se preenche quando a venda for ligada.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar CSV/ })).toBeDisabled()
  })

  it('erro de leitura é separado do vazio', async () => {
    banco.erro = { message: 'falhou' }
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as vendas deste evento.')
    expect(screen.queryByText('Sem vendas pagas ainda')).toBeNull()
  })

  it('CSV sem dado pessoal: pedido, data, forma e total; PDF chama a impressão', async () => {
    banco.linhas = { orders: [pedido('p1', 110.5, 'pix', '2026-10-05T01:30:00Z')] }
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {})
    montar()
    await screen.findByText('Total pago pelo comprador (com taxa)')
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    expect(baixou.mock.calls[0][0]).toMatch(/^evokaa-bordero-festa-um-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(baixou.mock.calls[0][1]).toBe('﻿pedido;data;forma;total\r\np1;04/10/2026;Pix;"110,50"')
    fireEvent.click(screen.getByRole('button', { name: /Salvar em PDF/ }))
    expect(imprimir).toHaveBeenCalledTimes(1)
  })
})
