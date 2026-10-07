import { describe, expect, it } from 'vitest'
import { itensDoPedido, pedidoReaproveitavel, vendaBloqueada } from '../lib/pedido'

describe('itensDoPedido', () => {
  it('grava preço por item, subtotal e taxa (10%, mínimo R$ 3)', () => {
    const r = itensDoPedido([{ ticket_type_id: 'a', quantity: 2 }, { ticket_type_id: 'b', quantity: 1 }], { a: 50, b: 10 })
    expect(r.linhas).toEqual([
      { ticket_type_id: 'a', quantity: 2, unit_price: 50, subtotal: 100 },
      { ticket_type_id: 'b', quantity: 1, unit_price: 10, subtotal: 10 },
    ])
    expect(r.subtotal).toBe(110)
    expect(r.service_fee).toBe(13) // 2 x 5 + 1 x 3
    expect(r.total).toBe(123)
  })
  it('falha se algum tipo não tem preço no banco', () => {
    expect(() => itensDoPedido([{ ticket_type_id: 'x', quantity: 1 }], {})).toThrow('sem preço')
  })
  it('falha com preço nulo ou inválido (não vira 0)', () => {
    expect(() => itensDoPedido([{ ticket_type_id: 'x', quantity: 1 }], { x: null })).toThrow('Ingresso sem preço no banco')
    expect(() => itensDoPedido([{ ticket_type_id: 'x', quantity: 1 }], { x: NaN })).toThrow('Ingresso sem preço no banco')
  })
})

describe('pedidoReaproveitavel', () => {
  const p = [{ id: 'o1', created_at: new Date().toISOString(), payment_method: 'pix', order_items: [{ ticket_type_id: 'a', quantity: 2 }, { ticket_type_id: 'b', quantity: 1 }] }]
  it('reaproveita com os mesmos itens, em qualquer ordem', () => {
    expect(pedidoReaproveitavel(p, [{ ticket_type_id: 'b', quantity: 1 }, { ticket_type_id: 'a', quantity: 2 }], 'pix')?.id).toBe('o1')
  })
  it('não reaproveita se muda quantidade ou forma de pagamento', () => {
    expect(pedidoReaproveitavel(p, [{ ticket_type_id: 'a', quantity: 3 }, { ticket_type_id: 'b', quantity: 1 }], 'pix')).toBeUndefined()
    expect(pedidoReaproveitavel(p, [{ ticket_type_id: 'a', quantity: 2 }, { ticket_type_id: 'b', quantity: 1 }], 'credit_card')).toBeUndefined()
  })
  it('não reaproveita pedido com 20 min ou mais', () => {
    const velho = [{ ...p[0], created_at: new Date(Date.now() - 21 * 60_000).toISOString() }]
    expect(pedidoReaproveitavel(velho, [{ ticket_type_id: 'a', quantity: 2 }, { ticket_type_id: 'b', quantity: 1 }], 'pix')).toBeUndefined()
  })
})

describe('vendaBloqueada', () => {
  const ev = { start_date: '2026-12-15T21:00:00Z', end_date: null, date: '2026-12-15', time: '18:00' }
  const agora = new Date('2026-12-01T12:00:00Z').getTime()
  it('libera dentro da janela e sem janela', () => {
    expect(vendaBloqueada(ev, {}, agora)).toBeNull()
    expect(vendaBloqueada(ev, { sale_start: '2026-11-01T00:00:00Z', sale_end: '2026-12-10T00:00:00Z' }, agora)).toBeNull()
  })
  it('antes de sale_start: vendas abrem em', () => {
    expect(vendaBloqueada(ev, { sale_start: '2026-12-05T15:00:00Z' }, agora)).toBe('Vendas abrem em 05/12 às 12:00')
  })
  it('depois de sale_end: encerradas', () => {
    expect(vendaBloqueada(ev, { sale_end: '2026-11-30T00:00:00Z' }, agora)).toBe('Vendas encerradas')
  })
  it('evento que já terminou bloqueia (fim = início + 12 h)', () => {
    expect(vendaBloqueada(ev, {}, new Date('2026-12-16T10:00:00Z').getTime())).toBe('Este evento já terminou')
  })
})

describe('pedido gratuito', () => {
  it('total 0 e reaproveita pendente sem forma de pagamento', () => {
    const r = itensDoPedido([{ ticket_type_id: 'a', quantity: 2 }], { a: 0 })
    expect(r.total).toBe(0)
    expect(r.service_fee).toBe(0)
    const agora = Date.now()
    const p = { id: 'p', payment_method: null, order_items: [{ ticket_type_id: 'a', quantity: 2 }], created_at: new Date(agora).toISOString() }
    expect(pedidoReaproveitavel([p], [{ ticket_type_id: 'a', quantity: 2 }], null, agora)).toBe(p)
  })
})
