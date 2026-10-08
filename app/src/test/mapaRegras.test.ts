import { describe, it, expect } from 'vitest'
import { TEMPLATES, aplicarTemplate } from '../pages/producer/mapa/templates'
import { novosPavimentos, type SeatNode } from '../pages/producer/mapa/modelo'
import { decidirApagar, decidirTemplate, proximoRotulo, rotuloDaCopia } from '../pages/producer/mapa/regras'

const no = (o: Partial<SeatNode>) => ({ label: 'X', sold: 0, status: 'free', capacity: 1, ...o }) as SeatNode

describe('templates: rótulos e ids', () => {
  for (const t of TEMPLATES) {
    it(`${t.nome}: rótulos únicos entre nós com capacity>0 e ids únicos`, () => {
      const env = aplicarTemplate(novosPavimentos()[0], t)
      const rot = env.seats.filter(n => n.capacity > 0).map(n => n.label)
      expect(rot.filter((r, i) => rot.indexOf(r) !== i)).toEqual([])
      expect(env.seats.every(n => n.id.startsWith(`${env.id}-`))).toBe(true)
    })
  }
  it('Feira: stands contam capacity 1', () => {
    const env = aplicarTemplate(novosPavimentos()[0], TEMPLATES.find(t => t.id === 'feira')!)
    const stands = env.seats.filter(n => n.type === 'stand')
    expect(stands.length).toBe(36)
    expect(stands.every(n => n.capacity === 1 && n.price > 0)).toBe(true)
  })
})

describe('proximoRotulo', () => {
  it('usa o maior número + 1, não a contagem', () => {
    expect(proximoRotulo([no({ label: 'Mesa 1' }), no({ label: 'Mesa 5' })], 'Mesa')).toBe('Mesa 6')
    expect(proximoRotulo([], 'PNE')).toBe('PNE 1')
    expect(proximoRotulo([no({ label: '3' }), no({ label: 'A1' })], '')).toBe('4')
  })
  it('cópia: Mesa 3 -> próximo livre; sem número só muda se vende lugar', () => {
    const nos = [no({ label: 'Mesa 3' }), no({ label: 'Mesa 4' })]
    expect(rotuloDaCopia(nos, nos[0])).toBe('Mesa 5')
    expect(rotuloDaCopia(nos, no({ label: 'Palco', capacity: 0 }))).toBe('Palco')
    expect(rotuloDaCopia(nos, no({ label: 'Camarote', capacity: 20 }))).toBe('Camarote 1')
  })
})

describe('apagar e aplicar template com venda', () => {
  it('apagar', () => {
    expect(decidirApagar(no({ sold: 2 })).acao).toBe('recusar')
    expect(decidirApagar(no({ status: 'sold' })).acao).toBe('recusar')
    expect(decidirApagar(no({ status: 'reserved' })).acao).toBe('recusar')
    expect(decidirApagar(no({ status: 'blocked' })).acao).toBe('confirmar')
    expect(decidirApagar(no({})).acao).toBe('ok')
  })
  it('template', () => {
    expect(decidirTemplate([no({}), no({ status: 'blocked' })])).toEqual({ permitido: true, vendidos: 0, bloqueados: 1 })
    expect(decidirTemplate([no({ sold: 1 })]).permitido).toBe(false)
    expect(decidirTemplate([no({ status: 'reserved' })]).permitido).toBe(false)
  })
})
