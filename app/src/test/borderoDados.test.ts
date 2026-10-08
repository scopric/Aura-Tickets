import { describe, it, expect } from 'vitest'
import { dataSP, forma, porDia, porForma, porTipo, totais, unicos, type Pedido } from '../../../supabase/functions/_shared/borderoDados'

const ped = (o: Partial<Pedido>): Pedido => ({ id: 'a', status: 'paid', created_at: '2026-10-02T12:00:00Z', payment_method: 'pix', coupon_id: null, subtotal: 100, discount: 0, service_fee: 12, processing_fee: 3.5, total: 115.5, ...o })

describe('Borderô exportado: contas', () => {
  it('soma a cascata e arredonda em centavos', () => {
    const t = totais([ped({ id: '1' }), ped({ id: '2', discount: 10, total: 105.5 }), ped({ id: '3', service_fee: 0.1, processing_fee: 0.2, total: 0.3, subtotal: 0 })])
    expect(t).toMatchObject({ pedidos: 3, ingressos: 200, desconto: 10, taxaServico: 24.1, taxaPagamento: 7.2, total: 221.3, taxasGravadas: true })
  })
  it('avisa quando as taxas não foram gravadas, mas não quando não há venda', () => {
    expect(totais([ped({ service_fee: 0, processing_fee: 0 })]).taxasGravadas).toBe(false)
    expect(totais([]).taxasGravadas).toBe(true)
  })
  it('dia e hora são os de São Paulo, não os de UTC (23h20 em SP já é o dia seguinte em UTC)', () => {
    const d = dataSP('2026-10-03T02:20:00Z')
    expect(d.dia).toBe('2026-10-02')
    expect(d.serial.toISOString()).toBe('2026-10-02T23:20:00.000Z')
  })
  it('agrupa por forma e por dia; forma desconhecida vira "Não informada"', () => {
    const l = [ped({ id: '1' }), ped({ id: '2', payment_method: null }), ped({ id: '3', payment_method: 'credit_card', created_at: '2026-10-03T15:00:00Z' })]
    expect(porForma(l).map(f => [f.chave, f.pedidos])).toEqual([['Pix', 1], ['Não informada', 1], ['Cartão de crédito', 1]])
    expect(porDia(l).map(d => [d.chave, d.pedidos])).toEqual([['2026-10-02', 2], ['2026-10-03', 1]])
    expect(forma('xyz')).toBe('Não informada')
  })
  it('tipos: disponíveis nunca negativo, sem limite fica nulo, check-in só dos válidos', () => {
    const tipos = [{ id: 't1', name: 'Pista', price: 50, quantity_total: 2, is_active: true }, { id: 't2', name: 'Livre', price: 0, quantity_total: null, is_active: true }]
    const base = { order_id: 'o', created_at: '', checked_in_at: null }
    const ing = [
      { ...base, id: '1', ticket_type_id: 't1', status: 'active' }, { ...base, id: '2', ticket_type_id: 't1', status: 'used' }, { ...base, id: '3', ticket_type_id: 't1', status: 'active' },
      { ...base, id: '4', ticket_type_id: 't1', status: 'cancelled' }, { ...base, id: '5', ticket_type_id: 't2', status: 'active' },
    ]
    const [a, b] = porTipo(tipos, ing)
    expect(a).toMatchObject({ vendidos: 3, disponiveis: 0, checkins: 1 })
    expect(b).toMatchObject({ total: null, disponiveis: null, vendidos: 1 })
  })
  it('remove linha repetida pelo id', () => {
    expect(unicos([{ id: 'a' }, { id: 'b' }, { id: 'a' }])).toHaveLength(2)
  })
})
