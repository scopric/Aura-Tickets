import { describe, it, expect } from 'vitest'
import { janelaDoPeriodo } from '../lib/vendasPagas'

describe('janelaDoPeriodo', () => {
  const agora = new Date(2026, 9, 10, 15, 30).getTime() // 10/10/2026 15:30 local
  it('tudo: sem limite', () => expect(janelaDoPeriodo('tudo', agora)).toEqual({ de: null, ate: null }))
  it('hoje: da meia-noite de hoje', () => expect(janelaDoPeriodo('hoje', agora).de).toBe(new Date(2026, 9, 10).toISOString()))
  it('7 dias: hoje e os 6 anteriores', () => expect(janelaDoPeriodo('7d', agora).de).toBe(new Date(2026, 9, 4).toISOString()))
  it('30 dias: hoje e os 29 anteriores', () => expect(janelaDoPeriodo('30d', agora).de).toBe(new Date(2026, 8, 11).toISOString()))
})
