import { describe, it, expect } from 'vitest'
import { CATEGORIAS, ITENS } from '../pages/producer/mapa/paleta'
import { NOVOS } from '../pages/producer/mapa/catalogo'
import { toolDefaults, typeLabels } from '../pages/producer/mapa/modelo'

describe('catálogo do mapa', () => {
  it('todo tipo tem rótulo e medidas (os de navegação e a parede são os únicos com tamanho 0)', () => {
    for (const t of Object.keys(toolDefaults) as (keyof typeof toolDefaults)[]) {
      expect(typeLabels[t], t).toBeTruthy()
      if (!['select', 'pan', 'wall'].includes(t)) {
        expect(toolDefaults[t].wMeter, t).toBeGreaterThan(0)
        expect(toolDefaults[t].hMeter, t).toBeGreaterThan(0)
      }
    }
    expect(Object.keys(typeLabels).sort()).toEqual(Object.keys(toolDefaults).sort())
  })

  it('tipos novos não repetem nome nem colidem com os antigos', () => {
    const tipos = NOVOS.map(n => n[1])
    expect(new Set(tipos).size).toBe(tipos.length)
    expect(new Set(Object.values(typeLabels)).size).toBe(Object.values(typeLabels).length)
  })

  it('6 categorias, sem item repetido, todos com tamanho real (menos navegação)', () => {
    expect(CATEGORIAS.map(c => c.id)).toEqual(['navigation', 'seating', 'structures', 'technical', 'food', 'facilities'])
    const ids = CATEGORIAS.flatMap(c => c.itens.map(i => i.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(Object.keys(ITENS)).toHaveLength(ids.length)
    for (const c of CATEGORIAS) for (const i of c.itens) {
      if (c.id !== 'navigation' || i.id === 'text') { expect(i.w, i.id).toBeGreaterThan(0); expect(i.h, i.id).toBeGreaterThan(0) }
    }
  })

  it('cada tipo novo aparece na paleta', () => {
    for (const n of NOVOS) expect(ITENS[n[1]], n[1]).toBeDefined()
    expect(NOVOS.length).toBeGreaterThanOrEqual(35)
  })
})
