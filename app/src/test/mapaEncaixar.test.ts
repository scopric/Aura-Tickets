import { describe, it, expect } from 'vitest'
import { novosPavimentos, type Environment, type SeatNode } from '../pages/producer/mapa/modelo'
import { encaixarNaSala } from '../pages/producer/mapa/regras'
import { caixaDosElementos } from '../pages/producer/mapa/geometria'

const no = (o: Partial<SeatNode>) => ({ label: 'X', sold: 0, status: 'free', capacity: 1, price: 0, rotation: 0, locked: false, sectionId: 's', color: '#000', type: 'seat', widthMeter: 0.5, heightMeter: 0.5, ...o }) as SeatNode
const amb = (seats: SeatNode[], extra: Partial<Environment> = {}): Environment => ({ ...novosPavimentos()[0], roomWidth: 40, roomHeight: 40, seats, walls: [], ...extra })
const palco = no({ id: 'p', label: 'Palco Principal', type: 'stage', x: 19.4, y: 9, widthMeter: 8, heightMeter: 4, price: 0, capacity: 0 })
const cadeira = no({ id: 'c', label: 'A1', x: 30, y: 30, price: 50 })

describe('encaixarNaSala', () => {
  it('caso do print: palco 3 m acima da sala fica dentro e preserva posições relativas', () => {
    const e = amb([palco, cadeira])
    const r = encaixarNaSala(e)
    expect(r.motivo).toBeUndefined()
    const c = caixaDosElementos(r.env)!
    expect(c.y).toBeGreaterThanOrEqual(10.5 - 1e-9)
    expect(c.x).toBeGreaterThanOrEqual(10)
    expect(r.env.roomWidth).toBe(40)
    const [p, q] = r.env.seats
    expect(q.x - p.x).toBeCloseTo(cadeira.x - palco.x)
    expect(q.y - p.y).toBeCloseTo(cadeira.y - palco.y)
    expect(p.y - 2).toBeCloseTo(10.5) // menor deslocamento possível
  })
  it('já dentro: devolve o mesmo env', () => {
    const e = amb([cadeira])
    expect(encaixarNaSala(e).env).toBe(e)
  })
  it('conjunto maior que a sala amplia a sala', () => {
    const e = amb([no({ id: 'a', x: 5, y: 20, widthMeter: 30, heightMeter: 2 }), no({ id: 'b', x: 60, y: 20, widthMeter: 30, heightMeter: 2 })], { roomWidth: 40 })
    const r = encaixarNaSala(e)
    const c = caixaDosElementos(r.env)!
    expect(r.env.roomWidth).toBeGreaterThanOrEqual(c.w + 1)
    expect(Number.isInteger(r.env.roomWidth)).toBe(true)
    expect(c.x).toBeGreaterThanOrEqual(10.5 - 1e-9)
    expect(c.x + c.w).toBeLessThanOrEqual(10 + r.env.roomWidth! - 0.5 + 1e-9)
  })
  it('com lugar vendido não muda e dá razão', () => {
    const e = amb([palco, no({ id: 'v', x: 30, y: 30, sold: 1 })])
    const r = encaixarNaSala(e)
    expect(r.env).toBe(e)
    expect(r.motivo).toMatch(/vendidos/)
  })
  it('não altera ids, rótulos, preços nem status', () => {
    const e = amb([palco, cadeira])
    const r = encaixarNaSala(e)
    const f = (n: SeatNode) => [n.id, n.label, n.price, n.status, n.sold, n.sectionId]
    expect(r.env.seats.map(f)).toEqual(e.seats.map(f))
  })
})
