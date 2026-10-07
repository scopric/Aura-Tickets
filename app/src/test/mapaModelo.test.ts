import { describe, it, expect } from 'vitest'
import { normalizarEnvs, instantaneo, type Environment } from '../pages/producer/mapa/modelo'

const atual: Environment[] = [{
  id: 'terreo', name: 'Térreo', pixelsPerMeter: 32, walls: [{ id: 'w', x1: 0, y1: 0, x2: 5, y2: 0, thickness: 0.2, color: '#000', locked: false }],
  sections: [{ id: 'vip', name: 'VIP', color: '#d97706', price: 250 }],
  seats: [{ id: 's1', x: 12, y: 13, label: 'A1', type: 'table', color: '#d97706', price: 250, rotation: 0, sold: 0, capacity: 4,
    sectionId: 'vip', status: 'free', locked: false, widthMeter: 2, heightMeter: 2, tableShape: 'rectangle', seatsCount: 4 }],
}]

describe('normalizarEnvs', () => {
  it('JSON atual passa idêntico (round-trip)', () => {
    const lido = normalizarEnvs(JSON.parse(JSON.stringify(atual)))
    expect(lido).toEqual(atual)
    expect(JSON.parse(instantaneo(lido, null)).envs).toEqual(atual)
  })
  it('JSON antigo sem walls/pixelsPerMeter/widthMeter é completado', () => {
    const antigo = [{ id: 't', name: 'T', sections: [], seats: [{ id: 's', x: 1, y: 1, label: '', type: 'table', color: '#000', price: 0, rotation: 0, sold: 0, capacity: 0, sectionId: 'x', status: 'free', locked: false }] }]
    const [e] = normalizarEnvs(JSON.parse(JSON.stringify(antigo)))
    expect(e.walls).toEqual([])
    expect(e.pixelsPerMeter).toBe(40)
    expect(e.seats[0].widthMeter).toBe(1.8)
    expect(e.seats[0].heightMeter).toBe(1.2)
    expect(e.seats[0].tableShape).toBe('circle')
    expect(e.seats[0].seatsCount).toBe(6)
  })
  it('tipo desconhecido não quebra', () => {
    const [e] = normalizarEnvs([{ id: 't', name: 'T', sections: [], seats: [{ ...atual[0].seats[0], type: 'xpto' as never, widthMeter: undefined, heightMeter: undefined }] }])
    expect(e.seats[0].widthMeter).toBe(0.5)
  })
})
