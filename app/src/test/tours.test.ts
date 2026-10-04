import { describe, it, expect } from 'vitest'
import { TOURS, tourDaRota, tourDoCaminho } from '../lib/tours'

describe('catálogo de tours', () => {
  it('tem os seis tours previstos (cinco do produtor e um do participante)', () => {
    expect(Object.keys(TOURS).sort()).toEqual(['app-inicio', 'checkin', 'configuracoes', 'criar-evento', 'eventos', 'inicio'])
  })

  for (const [id, t] of Object.entries(TOURS)) {
    it(`${id}: rota, 3 a 4 passos, alvos únicos e sem "em breve"`, () => {
      expect(/^\/(producer|app)\//.test(t.rota)).toBe(true)
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

  it('tourDoCaminho acha o tour pela rota da tela e devolve nome e número de passos', () => {
    expect(tourDoCaminho('/producer/events')).toEqual({ id: 'eventos', nome: 'Eventos', passos: TOURS.eventos.passos.length })
    expect(tourDoCaminho('/producer/events/')).toMatchObject({ id: 'eventos' })
    expect(tourDoCaminho('/producer/events/new')).toMatchObject({ id: 'criar-evento', passos: 3 })
    expect(tourDoCaminho('/producer')).toMatchObject({ id: 'inicio', passos: 4 })
    expect(tourDoCaminho('/producer/dashboard')).toMatchObject({ id: 'inicio' })
    expect(tourDoCaminho('/app/hub')).toEqual({ id: 'app-inicio', nome: 'Início', passos: 3 })
    expect(tourDoCaminho('/app/hub/')).toMatchObject({ id: 'app-inicio' })
    for (const t of Object.values(TOURS)) expect(tourDoCaminho(t.rota)?.nome).toBe(t.nome)
  })

  it('tourDoCaminho é null em tela sem tour', () => {
    expect(tourDoCaminho('/producer/finance')).toBeNull()
    expect(tourDoCaminho('/producer/planner')).toBeNull()
    expect(tourDoCaminho('/producer/events/abc/edit')).toBeNull()
    expect(tourDoCaminho('/app/tickets')).toBeNull()
    expect(tourDoCaminho('/')).toBeNull()
  })
})
