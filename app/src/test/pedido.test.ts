import { describe, expect, it } from 'vitest'
import { chaveItem, lerChave, totaisItens, vendaBloqueada } from '../lib/pedido'

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

describe('carrinho com meia-entrada', () => {
  it('chave nova e chave antiga (só o id = inteira)', () => {
    expect(chaveItem('a')).toBe('a|inteira|')
    expect(chaveItem('a', 'meia', 'pcd')).toBe('a|meia|pcd')
    expect(lerChave('a')).toEqual({ ticket_type_id: 'a', beneficio: 'inteira', meia_tipo: null })
    expect(lerChave('a|meia|estudante')).toEqual({ ticket_type_id: 'a', beneficio: 'meia', meia_tipo: 'estudante' })
    expect(lerChave('a|meia|')).toMatchObject({ beneficio: 'inteira' }) // meia sem benefício não existe
  })
  it('totaisItens usa a taxa do servidor na meia e a de taxa.ts na inteira', () => {
    // 1 inteira de R$ 50 (taxa 5) + 2 meias de R$ 25 com taxa do servidor R$ 3
    expect(totaisItens([{ price: 50, quantity: 1 }, { price: 25, quantity: 2, taxa_unit: 3 }])).toEqual({ subtotal: 100, taxa: 11, total: 111 })
    expect(totaisItens([{ price: 0, quantity: 2 }])).toEqual({ subtotal: 0, taxa: 0, total: 0 })
  })
})
