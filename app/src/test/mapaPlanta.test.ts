import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createHash } from 'node:crypto'

const bd = vi.hoisted(() => ({ lido: { data: null as any, error: null }, gravado: null as any }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => bd.lido }) }),
      upsert: async (linha: unknown) => { bd.gravado = linha; return { error: null } },
    }),
  },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { useMapa } from '../pages/producer/mapa/usarMapa'
import { calibrar, aplicarPpm } from '../pages/producer/mapa/geometria'
import { lerFundo } from '../pages/producer/mapa/modelo'
import { validarArquivoPlanta, MAX_ARQUIVO_BYTES } from '../lib/plantaFundo'

const md5 = (v: unknown) => createHash('md5').update(JSON.stringify(v)).digest('hex')
const BG = { image: 'data:image/png;base64,iVBORw0KGgo=', scale: 1.3, offset: { x: 120, y: 95 }, opacity: 0.55 }
const ENV = { id: 'terreo', name: 'T', seats: [{ id: 'a', type: 'seat', x: 12, y: 14, sold: 1, status: 'sold', label: 'A1', sectionId: 's', capacity: 1 }], sections: [], walls: [], pixelsPerMeter: 40 }

describe('calibrar', () => {
  const p1 = { x: 0, y: 0 }
  it('mesma regra do antigo: ppm = distância em px / metros, arredondado', () => {
    // 10 m no mapa a 40 px/m = 400 px; a medida real é 8 m: 50 px/m
    expect(calibrar(p1, { x: 6, y: 8 }, 8, 40)).toEqual({ ppm: 50 })
    expect(calibrar(p1, { x: 5, y: 0 }, 3, 40)).toEqual({ ppm: 67 })
  })
  it('recusa distância zero, metros inválidos e ppm fora de 5-400', () => {
    expect(calibrar(p1, p1, 5, 40)).toHaveProperty('erro')
    for (const m of [0, -1, NaN, Infinity, 1001]) expect(calibrar(p1, { x: 1, y: 0 }, m, 40)).toHaveProperty('erro')
    expect(calibrar(p1, { x: 1, y: 0 }, 1000, 40)).toHaveProperty('erro') // 0,04 px/m
    expect(calibrar(p1, { x: 100, y: 0 }, 1, 40)).toHaveProperty('erro') // 4000 px/m
    expect(calibrar(p1, { x: 1, y: 0 }, 8, 40)).toEqual({ ppm: 5 })
    expect(calibrar(p1, { x: 10, y: 0 }, 1, 40)).toEqual({ ppm: 400 })
  })
  it('só devolve o ppm: posições em metros (inclusive de lugar vendido) não são tocadas', () => {
    const r = calibrar(p1, { x: 6, y: 8 }, 8, 40) as { ppm: number }
    const depois = aplicarPpm(ENV as any, r.ppm) // a mesma função que o editor usa
    expect(depois.pixelsPerMeter).toBe(50)
    expect(depois).toEqual({ ...ENV, pixelsPerMeter: 50 })
    expect(depois.seats[0]).toMatchObject({ x: 12, y: 14, sold: 1, status: 'sold' })
  })
})

describe('validarArquivoPlanta', () => {
  it('aceita imagem e PDF, recusa grande e outro tipo', () => {
    expect(validarArquivoPlanta({ size: 1000, type: 'image/png', name: 'a.png' })).toEqual({ pdf: false })
    expect(validarArquivoPlanta({ size: 1000, type: '', name: 'Planta.PDF' })).toEqual({ pdf: true })
    expect(validarArquivoPlanta({ size: MAX_ARQUIVO_BYTES + 1, type: 'image/png', name: 'a.png' }).erro).toMatch(/15 MB/)
    expect(validarArquivoPlanta({ size: MAX_ARQUIVO_BYTES, type: 'image/png', name: 'a.png' }).erro).toBeUndefined()
    expect(validarArquivoPlanta({ size: 10, type: 'text/plain', name: 'a.txt' }).erro).toMatch(/imagem/)
  })
})

describe('lerFundo', () => {
  it('só aceita data:image/ e completa o que falta com o padrão', () => {
    expect(lerFundo(BG)).toEqual(BG)
    expect(lerFundo({ image: 'https://x/y.png' })).toBeNull()
    expect(lerFundo(null)).toBeNull()
    expect(lerFundo({ image: BG.image })).toEqual({ image: BG.image, scale: 1, offset: { x: 150, y: 100 }, opacity: 0.4 })
    expect(lerFundo({ ...BG, scale: 'x', opacity: NaN }).scale).toBe(1)
  })
})

describe('useMapa e a planta de fundo', () => {
  const abrir = async (config: unknown) => {
    bd.gravado = null
    bd.lido = { data: { environments: [ENV], config }, error: null }
    const h = renderHook(() => useMapa('ev1'))
    await waitFor(() => expect(h.result.current.pronto).toBe(true))
    return h
  }
  it('abre e salva sem mexer: background com o mesmo md5, zoom e pan preservados, sem "alterado"', async () => {
    const h = await abrir({ zoom: 1.5, pan: { x: 3, y: 4 }, background: BG })
    expect(h.result.current.fundo).toEqual(BG)
    expect(h.result.current.sujo).toBe(false)
    await act(() => h.result.current.salvar(0))
    expect(md5(bd.gravado.config.background)).toBe(md5(BG))
    expect(bd.gravado.config).toMatchObject({ zoom: 1.5, pan: { x: 3, y: 4 } })
  })
  it('mover/opacidade marcam alterado e são gravados; remover grava background nulo', async () => {
    const h = await abrir({ zoom: 1, pan: { x: 0, y: 0 }, background: BG })
    act(() => h.result.current.setFundo({ ...BG, offset: { x: 1, y: 2 }, opacity: 0.9 }))
    expect(h.result.current.sujo).toBe(true)
    await act(() => h.result.current.salvar(0))
    expect(bd.gravado.config.background).toEqual({ ...BG, offset: { x: 1, y: 2 }, opacity: 0.9 })
    expect(h.result.current.sujo).toBe(false)
    act(() => h.result.current.setFundo(null))
    expect(h.result.current.sujo).toBe(true)
    await act(() => h.result.current.salvar(0))
    expect(bd.gravado.config.background).toBeNull()
  })
  it('background inválido do banco não é exibido mas é preservado até o produtor trocar ou remover', async () => {
    const h = await abrir({ background: { image: 'lixo' } })
    expect(h.result.current.fundo).toBeNull()
    await act(() => h.result.current.salvar(0))
    expect(bd.gravado.config.background).toEqual({ image: 'lixo' })
  })
  it('mapa sem planta grava background nulo', async () => {
    const h = await abrir({ zoom: 1 })
    await act(() => h.result.current.salvar(0))
    expect(bd.gravado.config.background).toBeNull()
  })
})

describe('envio da planta durante troca de evento', () => {
  it('upload que termina depois da troca de evento não entrega a planta de A ao B', async () => {
    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react')
    const { createElement } = await import('react')
    const lib = await import('../lib/plantaFundo')
    let soltar!: (v: string) => void
    vi.spyOn(lib, 'reduzirPlanta').mockImplementation(() => new Promise<string>(r => { soltar = r }))
    const PlantaFundo = (await import('../pages/producer/mapa/PlantaFundo')).default
    const onFundo = vi.fn()
    const props = { envsCount: 1, fundo: null, onFundo, modo: '' as const, onModo: vi.fn(), erroImagem: false }
    const { rerender } = render(createElement(PlantaFundo, { key: 'A', eventId: 'A', ...props }))
    fireEvent.change(screen.getByLabelText('Arquivo da planta'), { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } })
    await waitFor(() => expect(soltar).toBeTypeOf('function'))
    rerender(createElement(PlantaFundo, { key: 'B', eventId: 'B', ...props })) // trocou de evento: remonta
    soltar('data:image/webp;base64,AAAA')
    await new Promise(r => setTimeout(r, 50))
    expect(onFundo).not.toHaveBeenCalled()
  })
})
