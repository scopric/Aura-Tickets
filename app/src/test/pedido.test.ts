import { describe, expect, it } from 'vitest'
import { itensDoPedido, pedidoReaproveitavel } from '../lib/pedido'

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
})

describe('pedidoReaproveitavel', () => {
  const p = [{ id: 'o1', payment_method: 'pix', order_items: [{ ticket_type_id: 'a', quantity: 2 }, { ticket_type_id: 'b', quantity: 1 }] }]
  it('reaproveita com os mesmos itens, em qualquer ordem', () => {
    expect(pedidoReaproveitavel(p, [{ ticket_type_id: 'b', quantity: 1 }, { ticket_type_id: 'a', quantity: 2 }], 'pix')?.id).toBe('o1')
  })
  it('não reaproveita se muda quantidade ou forma de pagamento', () => {
    expect(pedidoReaproveitavel(p, [{ ticket_type_id: 'a', quantity: 3 }, { ticket_type_id: 'b', quantity: 1 }], 'pix')).toBeUndefined()
    expect(pedidoReaproveitavel(p, [{ ticket_type_id: 'a', quantity: 2 }, { ticket_type_id: 'b', quantity: 1 }], 'credit_card')).toBeUndefined()
  })
})
