import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCreateOrder } from '../../hooks/useCheckout'
import { supabase } from '../../lib/supabase'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user_456', email: 'a@b.com', name: 'Ana' } }),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)

const EVENTO = { start_date: '2099-01-01T21:00:00Z', end_date: null, date: '2099-01-01', time: '18:00' }
const ITENS = [{ ticket_type_id: 'tt_1', quantity: 2 }]
const OK = { ok: true, order_id: 'order_new', subtotal: 100, desconto: 0, taxa: 10, total: 110, reservado_ate: '2026-10-30T12:10:00Z', agora: '2026-10-30T12:00:00Z' }

// rpc: evento_publico (checagens prévias) e reservar_ingressos (a única porta de compra)
function mockRpc(reserva: unknown = { data: OK, error: null }, ingressos: unknown[] = [{ id: 'tt_1', name: 'Pista', price: 50 }]) {
  vi.mocked(supabase.rpc).mockImplementation(((nome: string) =>
    Promise.resolve(nome === 'evento_publico' ? { data: { evento: EVENTO, ingressos }, error: null } : reserva)) as any)
}
const reservou = () => vi.mocked(supabase.rpc).mock.calls.find(c => c[0] === 'reservar_ingressos')

const criar = (extra: Record<string, unknown> = {}, items: any[] = ITENS) => {
  const { result } = renderHook(() => useCreateOrder(), { wrapper })
  return result.current.mutateAsync({ event_id: 'event_123', items, ...extra })
}

describe('useCheckout: criar pedido pela reservar_ingressos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('p_itens não leva null em lugar nenhum (o servidor recusa meia_tipo null com "Item inválido")', async () => {
    mockRpc()
    await criar({}, [{ ticket_type_id: 'tt_1', quantity: 1 }, { ticket_type_id: 'tt_1', quantity: 1, beneficio: 'meia', meia_tipo: 'pcd' }])
    const itens = (reservou()![1] as { p_itens: unknown[] }).p_itens
    expect(JSON.stringify(itens)).not.toContain('null')
    expect(itens[0]).not.toHaveProperty('meia_tipo')
    expect(itens[1]).toHaveProperty('meia_tipo', 'pcd')
  })

  it('chama a rpc com p_itens (quantidade, beneficio, meia_tipo) e devolve os valores do servidor e o prazo', async () => {
    mockRpc()
    const o = await criar()
    expect(reservou()![1]).toEqual({ p_event_id: 'event_123', p_itens: [{ ticket_type_id: 'tt_1', quantidade: 2, beneficio: 'inteira' }], p_cupom: null, p_cpf: null })
    expect(o).toMatchObject({ id: 'order_new', total: 110, subtotal: 100, desconto: 0, taxa: 10, customer_email: 'a@b.com' })
    expect(o.venceEm - Date.now()).toBeGreaterThan(599_000) // reservado_ate - agora = 10 min, no relógio daqui
    expect(o.venceEm - Date.now()).toBeLessThanOrEqual(600_000)
  })

  it('1 inteira + 2 meias monta p_itens certo e manda o cupom limpo', async () => {
    mockRpc()
    await criar({ cupom: ' VERAO ' }, [{ ticket_type_id: 'tt_1', quantity: 1 }, { ticket_type_id: 'tt_1', quantity: 2, beneficio: 'meia', meia_tipo: 'estudante' }])
    expect(reservou()![1]).toMatchObject({
      p_itens: [{ ticket_type_id: 'tt_1', quantidade: 1, beneficio: 'inteira' }, { ticket_type_id: 'tt_1', quantidade: 2, beneficio: 'meia', meia_tipo: 'estudante' }],
      p_cupom: 'VERAO',
    })
  })

  it('ok:false vira erro com a mensagem e o motivo do servidor', async () => {
    mockRpc({ data: { ok: false, motivo: 'cupom_invalido', mensagem: 'Cupom inválido' }, error: null })
    await expect(criar({ cupom: 'X' })).rejects.toMatchObject({ message: 'Cupom inválido', motivo: 'cupom_invalido' })
    mockRpc({ data: { ok: false, motivo: 'indisponivel', mensagem: 'Não foi possível reservar' }, error: null })
    await expect(criar()).rejects.toMatchObject({ message: 'Não foi possível reservar', motivo: 'indisponivel' })
  })

  it('erro do banco (ex.: 22023) propaga com o code', async () => {
    mockRpc({ data: null, error: { message: 'Muitas tentativas', code: '22023' } })
    await expect(criar()).rejects.toMatchObject({ message: 'Muitas tentativas', code: '22023' })
  })

  it('não grava nada direto em orders nem order_items', async () => {
    mockRpc()
    await criar()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('tipo com venda encerrada não chama a reservar_ingressos', async () => {
    mockRpc(undefined, [{ id: 'tt_1', name: 'Pista', price: 50, sale_end: '2020-01-01T00:00:00Z' }])
    await expect(criar()).rejects.toThrow('Pista: Vendas encerradas')
    expect(reservou()).toBeUndefined()
  })

  it('acima do máximo por pedido (inteira + meia somam) não reserva', async () => {
    mockRpc(undefined, [{ id: 'tt_1', name: 'Pista', price: 50, max_per_order: 2 }])
    await expect(criar({}, [{ ticket_type_id: 'tt_1', quantity: 1 }, { ticket_type_id: 'tt_1', quantity: 2, beneficio: 'meia', meia_tipo: 'pcd' }])).rejects.toThrow('Pista: máximo de 2 por pedido')
    expect(reservou()).toBeUndefined()
  })

  describe('limite por CPF', () => {
    const comLimite = [{ id: 'tt_1', name: 'Pista', price: 50, max_por_cpf: 2 }]

    it('sem limite no tipo, p_cpf vai null (mesmo se a tela mandar)', async () => {
      mockRpc()
      await criar({ customer_cpf: '529.982.247-25' })
      expect(reservou()![1]).toMatchObject({ p_cpf: null })
    })

    it('com limite, manda só os dígitos do CPF', async () => {
      mockRpc(undefined, comLimite)
      await criar({ customer_cpf: '529.982.247-25' })
      expect(reservou()![1]).toMatchObject({ p_cpf: '52998224725' })
    })

    it('com limite e sem CPF, manda null (o servidor recusa com a mensagem dele)', async () => {
      mockRpc(undefined, comLimite)
      await criar()
      expect(reservou()![1]).toMatchObject({ p_cpf: null })
    })
  })
})
