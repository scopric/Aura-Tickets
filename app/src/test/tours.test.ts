import { describe, it, expect } from 'vitest'
import { TOURS, tourDaRota } from '../lib/tours'

describe('catálogo de tours do produtor', () => {
  it('tem os cinco tours previstos', () => {
    expect(Object.keys(TOURS).sort()).toEqual(['checkin', 'configuracoes', 'criar-evento', 'eventos', 'inicio'])
  })

  for (const [id, t] of Object.entries(TOURS)) {
    it(`${id}: rota, 3 a 4 passos, alvos únicos e sem "em breve"`, () => {
      expect(t.rota.startsWith('/producer/')).toBe(true)
      expect(t.passos.length).toBeGreaterThanOrEqual(3)
      expect(t.passos.length).toBeLessThanOrEqual(4)
      const alvos = t.passos.map(p => p.alvo)
      expect(new Set(alvos).size).toBe(alvos.length)
      for (const p of t.passos) expect(`${p.titulo} ${p.texto}`).not.toMatch(/em breve/i)
    })
  }

  it('tourDaRota só devolve o tour na tela dele', () => {
    expect(tourDaRota('inicio', '/producer')).toBe(TOURS.inicio)
    expect(tourDaRota('inicio', '/producer/dashboard')).toBe(TOURS.inicio)
    expect(tourDaRota('inicio', '/producer/events')).toBeNull()
    expect(tourDaRota('nao-existe', '/producer/events')).toBeNull()
    expect(tourDaRota('toString', '/producer/events')).toBeNull()
    expect(tourDaRota(null, '/producer/events')).toBeNull()
  })
})
