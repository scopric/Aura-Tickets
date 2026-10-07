import { describe, it, expect } from 'vitest'
import { limites, ajustarTela, zoomNoCursor, snap } from '../pages/producer/mapa/geometria'
import type { Environment, SeatNode } from '../pages/producer/mapa/modelo'

const env = (extra: Partial<Environment> = {}): Environment => ({ id: 'a', name: 'A', seats: [], sections: [], ...extra })
const cadeira = (x: number, y: number): SeatNode => ({
  id: 's', x, y, label: '', type: 'seat', color: '#000', price: 0, rotation: 0, sold: 0, capacity: 1,
  sectionId: 'x', status: 'free', locked: false, widthMeter: 0.5, heightMeter: 0.5,
})

describe('ajustarTela', () => {
  it('sala 40x40 em 800x600 fica centralizada', () => {
    const c = limites(env({ roomWidth: 40, roomHeight: 40 }))
    const v = ajustarTela(c, 800, 600, 40)
    const s = 40 * v.zoom
    // centro da sala na tela = centro da vista
    expect(c.x * s + v.pan.x + (c.w * s) / 2).toBeCloseTo(400)
    expect(c.y * s + v.pan.y + (c.h * s) / 2).toBeCloseTo(300)
    expect(c.w * s).toBeLessThanOrEqual(800)
    expect(c.h * s).toBeLessThanOrEqual(600)
  })
  it('conteúdo fora da sala entra no quadro', () => {
    const c = limites(env({ seats: [cadeira(100, 5)] }))
    expect(c.x + c.w).toBeGreaterThanOrEqual(100.25)
    expect(c.y).toBeLessThanOrEqual(4.75)
    const v = ajustarTela(c, 800, 600, 40)
    const s = 40 * v.zoom
    expect(100 * s + v.pan.x).toBeLessThanOrEqual(800)
    expect(5 * s + v.pan.y).toBeGreaterThanOrEqual(0)
  })
})

describe('zoomNoCursor', () => {
  it('o ponto sob o cursor não muda', () => {
    const v = { zoom: 1, pan: { x: 120, y: -40 } }
    const cur = { x: 300, y: 200 }
    const n = zoomNoCursor(v, cur, 2.5)
    expect((cur.x - n.pan.x) / n.zoom).toBeCloseTo((cur.x - v.pan.x) / v.zoom)
    expect((cur.y - n.pan.y) / n.zoom).toBeCloseTo((cur.y - v.pan.y) / v.zoom)
  })
  it('limita o zoom entre 0,1 e 8', () => {
    expect(zoomNoCursor({ zoom: 1, pan: { x: 0, y: 0 } }, { x: 0, y: 0 }, 99).zoom).toBe(8)
    expect(zoomNoCursor({ zoom: 1, pan: { x: 0, y: 0 } }, { x: 0, y: 0 }, 0).zoom).toBe(0.1)
  })
})

describe('snap', () => {
  it('passo de 0,25 m, inclusive negativo e zero', () => {
    expect(snap(0.37)).toBe(0.25)
    expect(snap(-0.37)).toBe(-0.25)
    expect(snap(-0.1)).toBe(0)
    expect(snap(0)).toBe(0)
    expect(snap(1.13, 0.5)).toBe(1)
  })
})
