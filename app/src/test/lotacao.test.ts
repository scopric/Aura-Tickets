import { describe, expect, it } from 'vitest'
import { noLimite, tetoPorPedido } from '../lib/lotacao'
import type { DbTicketType } from '../hooks/useEvents'

const t = (o: Partial<DbTicketType>) => ({ price: 50, quantity_total: 100, sold: 0, ...o }) as DbTicketType

describe('teto por pedido', () => {
  it('sem máximo = 10, grátis ou pago; max_per_order manda nos dois', () => {
    expect(tetoPorPedido({})).toBe(10)
    expect(tetoPorPedido({ max_per_order: 4 })).toBe(4)
    expect(tetoPorPedido({ max_per_order: null })).toBe(10)
  })
  it('noLimite desliga o + no teto, mesmo com lotação sobrando', () => {
    expect(noLimite(t({ price: 0 }), 9)).toBe(false)
    expect(noLimite(t({ price: 0 }), 10)).toBe(true)
    expect(noLimite(t({}), 9)).toBe(false)
    expect(noLimite(t({}), 10)).toBe(true) // pago sem máximo também para em 10
    expect(noLimite(t({ max_per_order: 4 }), 4)).toBe(true)
  })
})
