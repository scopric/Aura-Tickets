import { describe, it, expect } from 'vitest'
import { janelaDoPeriodo, intervaloLivre } from '../lib/vendasPagas'

describe('janelaDoPeriodo', () => {
  const agora = Date.parse('2026-10-10T15:30:00-03:00')
  it('tudo: sem limite', () => expect(janelaDoPeriodo('tudo', agora)).toEqual({ de: null, ate: null }))
  it('hoje: da meia-noite de hoje', () => expect(janelaDoPeriodo('hoje', agora).de).toBe(new Date('2026-10-10T00:00:00-03:00').toISOString()))
  it('7 dias: hoje e os 6 anteriores', () => expect(janelaDoPeriodo('7d', agora).de).toBe(new Date('2026-10-04T00:00:00-03:00').toISOString()))
  it('30 dias: hoje e os 29 anteriores', () => expect(janelaDoPeriodo('30d', agora).de).toBe(new Date('2026-09-11T00:00:00-03:00').toISOString()))
})

describe('intervaloLivre', () => {
  it('"até" é inclusivo: vira a meia-noite seguinte de Brasília', () =>
    expect(intervaloLivre('2026-10-01', '2026-10-03')).toEqual({ de: '2026-10-01T03:00:00.000Z', ate: '2026-10-04T03:00:00.000Z' }))
  it('campo vazio = sem limite', () => expect(intervaloLivre('', '')).toEqual({ de: null, ate: null }))
  it('data inválida', () => expect(intervaloLivre('2026-13-45', '')).toHaveProperty('erro'))
  it('dia que não existe (30 de fevereiro)', () => expect(intervaloLivre('2026-02-30', '')).toHaveProperty('erro'))
  it('de depois de até', () => expect(intervaloLivre('2026-10-05', '2026-10-01')).toHaveProperty('erro'))
})
