import { describe, it, expect, vi, beforeEach } from 'vitest'

const confetti = vi.hoisted(() => vi.fn())
const carregou = vi.hoisted(() => vi.fn())
// a fábrica só roda quando a biblioteca é de fato importada
vi.mock('canvas-confetti', () => { carregou(); return { default: confetti } })

import { soltarConfete } from '../lib/confete'

const reduzir = (v: boolean) => vi.stubGlobal('matchMedia', () => ({ matches: v }))

describe('soltarConfete', () => {
  beforeEach(() => { confetti.mockClear(); carregou.mockClear() })

  it('reduzir movimento: não solta e nem baixa a biblioteca', async () => {
    reduzir(true)
    soltarConfete(['#fff'])
    await new Promise(r => setTimeout(r, 50))
    expect(carregou).not.toHaveBeenCalled()
    expect(confetti).not.toHaveBeenCalled()
  })

  it('sem reduzir: solta com as cores pedidas', async () => {
    reduzir(false)
    soltarConfete(['#123456'])
    await vi.waitFor(() => expect(confetti).toHaveBeenCalledTimes(1))
    expect(confetti.mock.calls[0][0].colors).toEqual(['#123456'])
  })

  it('cancelado antes de a biblioteca chegar: não solta', async () => {
    reduzir(false)
    soltarConfete(['#fff'])()
    await new Promise(r => setTimeout(r, 50))
    expect(confetti).not.toHaveBeenCalled()
  })
})
