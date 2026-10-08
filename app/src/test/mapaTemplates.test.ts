import { describe, it, expect } from 'vitest'
import { TEMPLATES, aplicarTemplate } from '../pages/producer/mapa/templates'
import { limites } from '../pages/producer/mapa/geometria'
import { normalizarEnvs, novosPavimentos } from '../pages/producer/mapa/modelo'
import { daSecao } from '../pages/producer/mapa/paleta'

describe('templates do mapa', () => {
  it('há pelo menos 12, com ids e nomes únicos', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(12)
    expect(new Set(TEMPLATES.map(t => t.id)).size).toBe(TEMPLATES.length)
    expect(new Set(TEMPLATES.map(t => t.nome)).size).toBe(TEMPLATES.length)
  })

  for (const t of TEMPLATES) {
    describe(t.nome, () => {
      const env = aplicarTemplate(novosPavimentos()[0], t)

      it('tudo dentro da sala', () => {
        const c = limites(env)
        expect(c.x).toBe(10); expect(c.y).toBe(10)
        expect(c.w).toBeCloseTo(env.roomWidth!, 6)
        expect(c.h).toBeCloseTo(env.roomHeight!, 6)
      })

      it('ids únicos, status free, tamanhos e seção válidos', () => {
        const ids = [...env.seats.map(s => s.id), ...(env.walls || []).map(w => w.id)]
        expect(new Set(ids).size).toBe(ids.length)
        const secoes = new Set(env.sections.map(s => s.id))
        for (const s of env.seats) {
          expect(s.status).toBe('free')
          expect(s.widthMeter).toBeGreaterThan(0)
          expect(s.heightMeter).toBeGreaterThan(0)
          expect(secoes.has(s.sectionId), `${s.label} -> ${s.sectionId}`).toBe(true)
        }
      })

      it('o que é da seção tem a cor da seção', () => {
        for (const s of env.seats.filter(n => daSecao(n.type))) {
          expect(s.color).toBe(env.sections.find(x => x.id === s.sectionId)!.color)
        }
      })

      it('serializa em JSON e passa por normalizarEnvs sem mudar', () => {
        const json = JSON.parse(JSON.stringify([env]))
        expect(json).toEqual([env])
        const [lido] = normalizarEnvs(json)
        expect(lido.seats).toHaveLength(env.seats.length)
        expect(lido.roomWidth).toBe(env.roomWidth)
      })
    })
  }

  it('só o Vazio não tem elementos', () => {
    for (const t of TEMPLATES) expect(t.gerar().seats.length === 0).toBe(t.id === 'vazio')
  })
})
