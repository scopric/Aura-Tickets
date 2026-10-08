import { describe, it, expect } from 'vitest'
import { janelaDoPeriodo } from '../lib/vendasPagas'

describe('janelaDoPeriodo', () => {
  const agora = Date.parse('2026-10-10T15:30:00-03:00')
  it('tudo: sem limite', () => expect(janelaDoPeriodo('tudo', agora)).toEqual({ de: null, ate: null }))
  it('hoje: da meia-noite de hoje', () => expect(janelaDoPeriodo('hoje', agora).de).toBe(new Date('2026-10-10T00:00:00-03:00').toISOString()))
  it('7 dias: hoje e os 6 anteriores', () => expect(janelaDoPeriodo('7d', agora).de).toBe(new Date('2026-10-04T00:00:00-03:00').toISOString()))
  it('30 dias: hoje e os 29 anteriores', () => expect(janelaDoPeriodo('30d', agora).de).toBe(new Date('2026-09-11T00:00:00-03:00').toISOString()))
})
