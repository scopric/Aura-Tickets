import { describe, it, expect } from 'vitest'
import type { Environment, SeatNode } from '../pages/producer/mapa/modelo'
import { apagarLote, definirPreco, ligarIngresso, lotesDe, metricas } from '../pages/producer/mapa/regras'

const no = (o: Partial<SeatNode>): SeatNode => ({
  id: 'n', x: 12, y: 12, label: 'X', type: 'seat', color: '#111111', price: 10, rotation: 0, sold: 0, capacity: 1,
  sectionId: 'a', status: 'free', locked: false, ...o,
})
const mapa = (seats: SeatNode[]): Environment => ({
  id: 'terreo', name: 'T', seats, walls: [],
  sections: [
    { id: 'a', name: 'A', color: '#aa0000', price: 10 },
    { id: 'b', name: 'B', color: '#00bb00', price: 50 },
    { id: 'estrutura', name: 'Estrutura', color: '#475569', price: 0 },
  ],
})

describe('lotes', () => {
  it('Estrutura não é lote', () => expect(lotesDe(mapa([])).map(s => s.id)).toEqual(['a', 'b']))
  it('preço inválido não passa; válido vai para a seção e os nós', () => {
    const e = mapa([no({ id: '1' }), no({ id: '2', sectionId: 'b' })])
    for (const p of [-1, NaN, Infinity]) expect(definirPreco(e, 'a', p)).toBe(e)
    const r = definirPreco(e, 'a', 0)
    expect(r.sections[0].price).toBe(0)
    expect(r.seats.map(n => n.price)).toEqual([0, 10])
    expect(definirPreco(e, 'estrutura', 5)).toBe(e)
  })
  it('ligar ingresso copia o preço dele; desligar mantém o preço', () => {
    const e = mapa([no({ id: '1' })])
    const l = ligarIngresso(e, 'a', { id: 't1', price: 99 })
    expect(l.sections[0]).toMatchObject({ ticketTypeId: 't1', price: 99 })
    expect(l.seats[0].price).toBe(99)
    const d = ligarIngresso(l, 'a')
    expect(d.sections[0].ticketTypeId).toBeUndefined()
    expect(d.sections[0].price).toBe(99)
    expect(ligarIngresso(e, 'estrutura', { id: 't1', price: 1 })).toBe(e)
  })
  it('apagar lote migra os elementos para outro lote (cor e preço dele)', () => {
    const e = mapa([no({ id: '1' }), no({ id: '2', sectionId: 'b' })])
    const r = apagarLote(e, 'a')
    expect(r.erro).toBeUndefined()
    expect(r.env.sections.map(s => s.id)).toEqual(['b', 'estrutura'])
    expect(r.env.seats[0]).toMatchObject({ sectionId: 'b', price: 50, color: '#00bb00' })
    expect(r.destino).toBe('B')
  })
  it('apagar lote é bloqueado com venda ou reserva, com um lote só e para Estrutura', () => {
    expect(apagarLote(mapa([no({ sold: 2 })]), 'a').erro).toMatch(/venda/)
    expect(apagarLote(mapa([no({ status: 'reserved' })]), 'a').erro).toMatch(/venda/)
    expect(apagarLote(mapa([no({ status: 'sold' })]), 'a').env.sections).toHaveLength(3)
    const um = mapa([]); um.sections = um.sections.filter(s => s.id !== 'b')
    expect(apagarLote(um, 'a').erro).toMatch(/pelo menos um/)
    expect(apagarLote(mapa([]), 'estrutura').erro).toBeTruthy()
  })
})

describe('metricas', () => {
  it('mesmas fórmulas do editor antigo', () => {
    const e = mapa([
      no({ id: '1', capacity: 1, price: 10, sold: 1 }),
      no({ id: '2', type: 'table', capacity: 6, price: 20, sold: 2, status: 'reserved' }),
      no({ id: '3', type: 'stage', capacity: 0, price: 0 }),
    ])
    e.walls = [{ id: 'w', x1: 0, y1: 0, x2: 1, y2: 1, thickness: 0.15, color: '#000', locked: false }]
    expect(metricas(e)).toEqual({ assentos: 7, mesas: 1, muros: 1, vendido: 3, reservados: 1, receita: 10 + 40, potencial: 10 + 120 })
  })
  it('mapa vazio', () => expect(metricas(mapa([]))).toEqual({ assentos: 0, mesas: 0, muros: 0, vendido: 0, reservados: 0, receita: 0, potencial: 0 }))
})
