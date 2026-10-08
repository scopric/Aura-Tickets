import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { doEvento } from '../hooks/useEventoDaUrl'
import { slugArquivo } from '../lib/exportCsv'
import ProducerCoupons from '../pages/producer/Coupons'
import ProducerPiggyBank from '../pages/producer/PiggyBank'
import ProducerMenu from '../pages/producer/Menu'
import ProducerAffiliates from '../pages/producer/Affiliates'
import ProducerFinance from '../pages/producer/Finance'

// V4a2: Cupons, Orçamento, Cardápio, Afiliados e Resumo filtram por event_id quando a URL traz ?eventId=
const eventos = vi.hoisted(() => ({ carregando: false, erro: false }))
vi.mock('../hooks/useEvents', () => ({
  useProducerEvents: () => eventos.carregando
    ? { data: undefined, isPending: true, isError: false }
    : eventos.erro
      ? { data: undefined, isPending: false, isError: true }
      : { data: [{ id: 'e1', title: 'Festa Um' }, { id: 'e2', title: 'Festa Dois' }], isPending: false, isError: false },
}))
// o que vai para o banco: as mutações e a RPC de vincular afiliado
const banco = vi.hoisted(() => ({
  cupom: vi.fn(), caixa: vi.fn(), item: vi.fn(),
  rpc: vi.fn((nome: string) => Promise.resolve(nome === 'listar_afiliados' ? { data: [], error: null } : { data: 'ok', error: null })),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
const parado = { mutateAsync: vi.fn(), isPending: false }
vi.mock('../hooks/useProducerTools', () => ({
  useProducerCoupons: () => ({
    data: [
      { id: 'c1', code: 'CUPOM1', event_id: 'e1', discount_type: 'percent', discount_value: 10, uses: 2, max_uses: 5, is_active: true },
      { id: 'c2', code: 'CUPOM2', event_id: 'e2', discount_type: 'percent', discount_value: 10, uses: 0, max_uses: 5, is_active: true },
      { id: 'c3', code: 'CUPOMTODOS', event_id: null, discount_type: 'percent', discount_value: 10, uses: 7, max_uses: 5, is_active: true },
    ],
    isLoading: false, isError: false, refetch: vi.fn(), isFetching: false,
  }),
  useCreateCoupon: () => ({ mutateAsync: banco.cupom, isPending: false }), useUpdateCoupon: () => parado, useDeleteCoupon: () => parado,
  useBudgetBoxes: () => ({
    data: [
      { id: 'b1', name: 'Som do um', event_id: 'e1', target: 100, saved: 0, category: 'infra' },
      { id: 'b2', name: 'Som do dois', event_id: 'e2', target: 100, saved: 0, category: 'infra' },
      { id: 'b3', name: 'Item solto', event_id: null, target: 100, saved: 0, category: 'infra' },
    ],
    isPending: false, isError: false, refetch: vi.fn(), isFetching: false,
  }),
  useCreateBudgetBox: () => ({ mutateAsync: banco.caixa, isPending: false }), useDeleteBudgetBox: () => parado, useCreatePiggyTransaction: () => parado,
}))
vi.mock('../hooks/useMenuItems', () => ({
  useProducerMenuItems: () => ({
    data: [
      { id: 'm1', name: 'Gin do um', event_id: 'e1', category: 'bebida', price: 10, is_available: true },
      { id: 'm2', name: 'Gin do dois', event_id: 'e2', category: 'bebida', price: 10, is_available: true },
    ],
    isLoading: false,
  }),
  useCreateMenuItem: () => ({ mutateAsync: banco.item, isPending: false }), useUpdateMenuItem: () => parado, useDeleteMenuItem: () => parado,
}))
const afiliado = (id: string, event_id: string) => ({ id, email_mascarado: `${id}***@x.com`, commission_percent: 10, status: 'active', event_id, evento: 'Ev', sales: 0, total_earned: 0, created_at: '2026-01-01' })
// RPC de vendas pagas (L6): o filtro de evento chega como p_event_id; e2 tem 2 pedidos, e1 tem 1
const vendas = (id: string | null) => {
  const por = [{ event_id: 'e1', titulo: 'Festa Um', pedidos: 1, total: 10 }, { event_id: 'e2', titulo: 'Festa Dois', pedidos: 2, total: 20 }].filter(e => !id || e.event_id === id)
  const n = por.reduce((a, e) => a + e.pedidos, 0)
  return { total: n * 10, pedidos: n, reembolsados: { pedidos: 0, total: 0 }, por_evento: por, por_dia: [], por_forma: [] }
}
const lista = { then: (ok: (r: unknown) => unknown) => ok({ data: [], error: null }) } as Record<string, unknown>
for (const m of ['select', 'eq', 'gte', 'order', 'limit', 'range']) lista[m] = () => lista
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => lista,
    rpc: (nome: string, args?: { p_event_id?: string | null }) => nome === 'listar_afiliados'
      ? Promise.resolve({ data: [afiliado('af1', 'e1'), afiliado('af2', 'e2')], error: null })
      : nome === 'produtor_vendas_pagas' ? Promise.resolve({ data: vendas(args?.p_event_id ?? null), error: null })
      : banco.rpc(nome, args),
  },
}))
const pedido = (id: string, event_id: string) => ({ id, event_id, total: 10, payment_method: 'pix', created_at: '2026-01-01T00:00:00Z', events: { title: event_id === 'e1' ? 'Festa Um' : 'Festa Dois' } })
const baixou = vi.hoisted(() => vi.fn())
vi.mock('../lib/exportCsv', async orig => ({
  ...(await orig<typeof import('../lib/exportCsv')>()),
  downloadCsv: baixou,
  // o filtro de evento agora é do banco: a busca do CSV já volta só com o evento da URL (e2 nestes testes)
  fetchAllRows: () => Promise.resolve([pedido('p2', 'e2'), pedido('p3', 'e2')]),
}))

const Busca = () => <output data-testid="busca">{useLocation().search}</output>
const montar = (pagina: React.ReactNode, url: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>{pagina}<Busca /></MemoryRouter>
    </QueryClientProvider>,
  )

describe('doEvento', () => {
  const l = [{ event_id: 'e1' }, { event_id: 'e2' }, { event_id: null }]
  it('sem evento devolve tudo; com evento só o dele', () => {
    expect(doEvento(l, null)).toHaveLength(3)
    expect(doEvento(l, 'e1')).toEqual([{ event_id: 'e1' }])
  })
})

describe('Filtro por ?eventId=', () => {
  afterEach(() => { eventos.carregando = false; eventos.erro = false; vi.clearAllMocks(); cleanup() })

  it('Cupons: só os do evento e os de todos os eventos; "Todos os eventos" tira o filtro', () => {
    montar(<ProducerCoupons />, '/producer/cupons?eventId=e1')
    expect(screen.getByText('CUPOM1')).toBeInTheDocument()
    expect(screen.getByText('CUPOMTODOS')).toBeInTheDocument()
    expect(screen.queryByText('CUPOM2')).toBeNull()
    // usos: só os do cupom do evento (2); os 7 do cupom de todos os eventos não entram
    expect(screen.getByText('Utilizações').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByLabelText('Evento')).toHaveValue('e1')
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: '' } })
    expect(screen.getByText('CUPOM2')).toBeInTheDocument()
    expect(screen.getByTestId('busca').textContent).toBe('')
  })

  it('Cupons: sem ?eventId= mostra todos', () => {
    montar(<ProducerCoupons />, '/producer/cupons')
    expect(screen.getAllByText(/^CUPOM/)).toHaveLength(3)
  })

  it('Cupons: sem filtro, os usos somam todos os cupons', () => {
    montar(<ProducerCoupons />, '/producer/cupons')
    expect(screen.getByText('Utilizações').nextElementSibling).toHaveTextContent('9')
  })

  it('Orçamento: sem ?eventId= mostra todos os itens', () => {
    montar(<ProducerPiggyBank />, '/producer/caixinha')
    expect(screen.getAllByText(/^Som do|^Item solto/)).toHaveLength(3)
  })

  it('Orçamento: só os itens do evento', () => {
    montar(<ProducerPiggyBank />, '/producer/caixinha?eventId=e2')
    expect(screen.getByText('Som do dois')).toBeInTheDocument()
    expect(screen.queryByText('Som do um')).toBeNull()
    expect(screen.queryByText('Item solto')).toBeNull()
  })

  it('Cardápio: só os itens do evento', () => {
    montar(<ProducerMenu />, '/producer/menu?eventId=e1')
    expect(screen.getByText('Gin do um')).toBeInTheDocument()
    expect(screen.queryByText('Gin do dois')).toBeNull()
  })

  it('Afiliados: só os do evento', async () => {
    montar(<ProducerAffiliates />, '/producer/afiliados?eventId=e2')
    expect(await screen.findByText('af2***@x.com')).toBeInTheDocument()
    expect(screen.queryByText('af1***@x.com')).toBeNull()
  })

  it('Resumo: pedidos e total só do evento', async () => {
    montar(<ProducerFinance />, '/producer/finance?eventId=e2')
    const pedidos = (await screen.findByText('Pedidos pagos')).parentElement!
    expect(within(pedidos).getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('1 pedido')).toBeNull()
  })

  it('Novo cupom pré-preenche o evento da URL quando é do produtor', () => {
    montar(<ProducerCoupons />, '/producer/cupons?eventId=e2')
    fireEvent.click(screen.getByRole('button', { name: /Novo cupom/ }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Evento')).toHaveValue('e2')
  })

  it('Cupons: com id que não é do produtor a lista fica vazia, sem o cupom de todos os eventos', () => {
    montar(<ProducerCoupons />, '/producer/cupons?eventId=evt-999')
    expect(screen.queryByText('CUPOMTODOS')).toBeNull()
    expect(screen.queryByText('CUPOM1')).toBeNull()
    expect(screen.getByText('Nenhum cupom neste evento')).toBeInTheDocument()
  })

  // o que vai para o banco, não o valor exibido: id de outro produtor não pode virar event_id
  it('Novo cupom grava event_id null quando o id da URL não é do produtor', async () => {
    montar(<ProducerCoupons />, '/producer/cupons?eventId=de-outro')
    fireEvent.click(screen.getAllByRole('button', { name: /Novo cupom/ })[0])
    const d = within(screen.getByRole('dialog'))
    fireEvent.change(d.getByLabelText('Código'), { target: { value: 'NOVO10' } })
    fireEvent.change(d.getByLabelText('Desconto (%)'), { target: { value: '10' } })
    fireEvent.submit(document.getElementById('form-cupom')!)
    await waitFor(() => expect(banco.cupom).toHaveBeenCalledTimes(1))
    expect(banco.cupom.mock.calls[0][0].event_id).toBeNull()
  })

  it('Novo item do orçamento grava event_id null quando o id da URL não é do produtor', async () => {
    montar(<ProducerPiggyBank />, '/producer/caixinha?eventId=de-outro')
    fireEvent.click(screen.getAllByRole('button', { name: /Novo item/ })[0])
    const d = within(screen.getByRole('dialog'))
    fireEvent.change(d.getByLabelText('Nome'), { target: { value: 'Som' } })
    fireEvent.change(d.getByLabelText('Previsto (R$)'), { target: { value: '50' } })
    fireEvent.submit(document.getElementById('form-orcamento')!)
    await waitFor(() => expect(banco.caixa).toHaveBeenCalledTimes(1))
    expect(banco.caixa.mock.calls[0][0].event_id).toBeNull()
  })

  it('Novo item do cardápio grava sem evento quando o id da URL não é do produtor', async () => {
    montar(<ProducerMenu />, '/producer/menu?eventId=de-outro')
    fireEvent.click(screen.getByRole('button', { name: /Novo item/i }))
    fireEvent.change(screen.getByPlaceholderText('Ex: Gin Tônica'), { target: { value: 'Gin' } })
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar item/ }))
    await waitFor(() => expect(banco.item).toHaveBeenCalledTimes(1))
    // useCreateMenuItem grava `event_id || null`: vazio vira null
    expect(banco.item.mock.calls[0][0].event_id || null).toBeNull()
  })

  it('Vincular afiliado não manda ao banco um evento que não é do produtor', async () => {
    montar(<ProducerAffiliates />, '/producer/afiliados?eventId=de-outro')
    fireEvent.click(screen.getAllByRole('button', { name: /Vincular afiliado/ })[0])
    const d = within(screen.getByRole('dialog'))
    fireEvent.change(d.getByLabelText('E-mail da conta Evokaa'), { target: { value: 'a@x.com' } })
    fireEvent.change(d.getByLabelText('Comissão (%)'), { target: { value: '10' } })
    fireEvent.submit(document.getElementById('form-afiliado')!)
    await Promise.resolve()
    expect(banco.rpc).not.toHaveBeenCalled()
  })

  it('Cardápio: "Novo item" fica desabilitado enquanto os eventos carregam com ?eventId=', () => {
    eventos.carregando = true
    montar(<ProducerMenu />, '/producer/menu?eventId=e1')
    expect(screen.getByRole('button', { name: /Novo item/i })).toBeDisabled()
  })

  it('Resumo: o CSV do evento leva o nome dele no arquivo', async () => {
    montar(<ProducerFinance />, '/producer/finance?eventId=e2')
    await screen.findByText('Pedidos pagos')
    fireEvent.click(screen.getByRole('button', { name: /Exportar|CSV/i }))
    await waitFor(() => expect(baixou).toHaveBeenCalled())
    expect(baixou.mock.calls[0][0]).toMatch(/^evokaa-pedidos-pagos-festa-dois-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('slugArquivo: sem acento, hífen, só a-z0-9, até 40; sem título cai no id curto', () => {
    expect(slugArquivo('Réveillon  da Praia! 2027', 'abc')).toBe('reveillon-da-praia-2027')
    expect(slugArquivo('x'.repeat(60), 'abc')).toHaveLength(40)
    expect(slugArquivo(undefined, '1234567890-abc')).toBe('12345678')
    expect(slugArquivo('!!!', 'evt-999')).toBe('evt-999')
  })

  it('enquanto os eventos carregam o seletor mostra "Carregando…", não "Todos os eventos"', () => {
    eventos.carregando = true
    montar(<ProducerCoupons />, '/producer/cupons?eventId=e1')
    expect(screen.getByLabelText('Evento')).toHaveValue('e1')
    expect(screen.getByRole('option', { name: 'Carregando…' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Evento não encontrado' })).toBeNull()
  })

  it('com erro na busca dos eventos o seletor mostra "Evento não encontrado", não "Carregando…"', () => {
    eventos.erro = true
    montar(<ProducerCoupons />, '/producer/cupons?eventId=e1')
    expect(screen.getByRole('option', { name: 'Evento não encontrado' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Carregando…' })).toBeNull()
  })

  it('Cardápio: vazio no evento explica onde ficam os itens sem evento', () => {
    montar(<ProducerMenu />, '/producer/menu?eventId=e9')
    expect(screen.getByText('Itens sem evento aparecem em Todos os eventos.')).toBeInTheDocument()
  })

  it('id que não é de evento nenhum mostra o aviso no seletor e nenhuma linha', () => {
    montar(<ProducerCoupons />, '/producer/cupons?eventId=apagado')
    expect(screen.getByRole('option', { name: 'Evento não encontrado' })).toBeInTheDocument()
    expect(screen.queryByText('CUPOM1')).toBeNull()
  })
})
