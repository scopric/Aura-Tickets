import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ProducerParticipantes from '../pages/producer/Participantes'
import { agrupar, type Pedido, type Ingresso } from '../lib/participantes'

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
const banco = vi.hoisted(() => ({ dados: { current: {} as Record<string, unknown> }, fator: vi.fn(), invoke: vi.fn(), baixar: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festa Um', status: 'draft', ticket_types: [] }], isPending: false, isError: false, isFetching: false, refetch: vi.fn() }) }))
vi.mock('../hooks/useParticipantes', async orig => ({ ...(await orig<typeof import('../hooks/useParticipantes')>()), useParticipantes: () => banco.dados.current }))
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: banco.invoke } } }))
vi.mock('../lib/vendasPagas', () => ({ faltaSegundoFator: banco.fator }))
vi.mock('../lib/exportCsv', async orig => ({ ...(await orig<typeof import('../lib/exportCsv')>()), downloadCsv: banco.baixar }))

const ped = (id: string, status: string, nome: string): Pedido => ({ id, status, customer_name: nome, customer_email: `${nome.toLowerCase()}@x.com`, total: 100, payment_method: 'pix', created_at: '2026-10-01T12:00:00Z', event_id: 'e1' })
const ing = (id: string, order_id: string): Ingresso => ({ id, order_id, ticket_type_id: 't1', status: 'active', buyer_name: 'Titular', buyer_email: null, price_paid: 50, checked_in_at: null, created_at: '2026-10-01T12:00:00Z', ticket_types: { name: 'Pista' } })
const ok = (pedidos: Pedido[], ingressos: Ingresso[]) => ({ isPending: false, isError: false, isFetching: false, refetch: vi.fn(), data: agrupar(pedidos, ingressos) })

const ing3 = [ing('a', 'p1'), { ...ing('b', 'p1'), checked_in_at: '2026-10-10T20:30:00Z' }, ing('c', 'p1')]
const montar = (url = '/producer/participantes') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[url]}><ProducerParticipantes /></MemoryRouter>
  </QueryClientProvider>,
)

describe('tela Participantes', () => {
  beforeEach(() => { banco.fator.mockReset().mockResolvedValue(false); banco.invoke.mockReset().mockResolvedValue({ error: null }); banco.baixar.mockReset() })
  const comDados = () => { banco.dados.current = ok([ped('p1', 'paid', 'Ana'), ped('p2', 'pending', 'Bruno'), ped('p3', 'cancelled', 'Carla')], [ing('i1', 'p1')]) }

  it('abas trocam a lista (estado na URL), busca filtra e Convidados é Em breve', async () => {
    comDados(); montar('/producer/participantes?aba=pendentes')
    expect(screen.getByText('Bruno')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: /Confirmados/ }))
    expect(screen.getByText('Ana')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Buscar por nome ou e-mail'), 'zzz')
    expect(screen.getByText(/Ninguém em confirmados/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Convidados' }))
    expect(screen.getByText('Convidados e cortesias')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar convidado' })).toBeDisabled()
  })

  it('2FA pendente não vira "0 participantes"', async () => {
    banco.dados.current = ok([], []); banco.fator.mockResolvedValue(true); montar()
    expect(await screen.findByText(/Confirme o 2FA/)).toBeInTheDocument()
    expect(screen.queryByText(/Nenhum pedido/)).toBeNull()
  })

  it('vazio de verdade explica o próximo passo', async () => {
    banco.dados.current = ok([], []); montar()
    expect(await screen.findByText('Nenhum pedido ainda')).toBeInTheDocument()
  })

  it('erro tem "Tentar de novo"', async () => {
    const refetch = vi.fn(); banco.dados.current = { isPending: false, isError: true, isFetching: false, refetch }
    montar(); await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('exporta o filtro atual com aviso de dado pessoal', async () => {
    comDados(); montar(); await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    const csv = banco.baixar.mock.calls[0][1] as string
    expect(csv).toContain('dados pessoais'); expect(csv).toContain('ana@x.com'); expect(csv).not.toContain('bruno@x.com')
  })

  it('painel lateral: linha do tempo e reenvio chama a send-email só depois de confirmar', async () => {
    comDados(); montar(); await userEvent.click(screen.getByRole('button', { name: /Abrir detalhes de Ana/ }))
    const painel = await screen.findByRole('dialog')
    expect(within(painel).getByText('Linha do tempo')).toBeInTheDocument()
    expect(within(painel).getByText('Pedido criado')).toBeInTheDocument()
    expect(within(painel).getByRole('button', { name: 'Transferir' })).toBeDisabled()
    await userEvent.click(within(painel).getByRole('button', { name: /Reenviar ingresso por e-mail/ }))
    expect(banco.invoke).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'Reenviar' }))
    await waitFor(() => expect(banco.invoke).toHaveBeenCalledWith('send-email', { body: { orderId: 'p1', emailType: 'ticket_delivery' } }))
  })

  it('entrada parcial mostra Entrou 1/3 e some no filtro Sem entrada', async () => {
    banco.dados.current = ok([ped('p1', 'paid', 'Ana')], ing3); montar()
    expect(screen.getByText('Entrou (1/3)')).toBeInTheDocument()
    expect(screen.getByText('1 de 3')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Check-in'), 'nao')
    expect(screen.queryByText('Entrou (1/3)')).toBeNull()
  })

  it('erro na checagem de 2FA mostra erro, nunca "Nenhum pedido ainda"', async () => {
    banco.dados.current = ok([], []); banco.fator.mockRejectedValue(new Error('x')); montar()
    expect(await screen.findByText(/Não consegui confirmar o seu acesso/)).toBeInTheDocument()
    expect(screen.queryByText('Nenhum pedido ainda')).toBeNull()
  })

  it('?eventId= que não é do produtor: "Evento não encontrado" com botão que limpa o filtro', async () => {
    comDados(); montar('/producer/participantes?eventId=alheio')
    expect(screen.getByText('Evento não encontrado entre os seus')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver todos os eventos' }))
    expect(screen.queryByText('Evento não encontrado entre os seus')).toBeNull()
  })
})
