import { describe, expect, it } from 'vitest'
import { noLimite, tetoPorPedido } from '../lib/lotacao'
import type { DbTicketType } from '../hooks/useEvents'

const t = (o: Partial<DbTicketType>) => ({ price: 50, quantity_total: 100, sold: 0, ...o }) as DbTicketType

describe('teto por pedido', () => {
  it('grátis sem máximo = 10; pago sem máximo = sem teto; max_per_order manda nos dois', () => {
    expect(tetoPorPedido({ price: 0 })).toBe(10)
    expect(tetoPorPedido({ price: 50 })).toBeNull()
    expect(tetoPorPedido({ price: 50, max_per_order: 4 })).toBe(4)
    expect(tetoPorPedido({ price: 0, max_per_order: 3 })).toBe(3)
  })
  it('noLimite desliga o + no teto, mesmo com lotação sobrando', () => {
    expect(noLimite(t({ price: 0 }), 9)).toBe(false)
    expect(noLimite(t({ price: 0 }), 10)).toBe(true)
    expect(noLimite(t({}), 50)).toBe(false)
    expect(noLimite(t({ max_per_order: 4 }), 4)).toBe(true)
  })
})
