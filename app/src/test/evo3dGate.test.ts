import { describe, it, expect } from 'vitest'
import { motivoDoPoster } from '../components/evo3d/gate'

const mm = (reduce: boolean) => (q: string) => ({ matches: reduce && q.includes('reduced-motion') })
const janelaComWebgl2 = { WebGL2RenderingContext: class {} }

describe('evo3d/gate', () => {
  it('libera a cena no ambiente comum', () => {
    expect(motivoDoPoster({ matchMedia: mm(false), navigator: {}, window: janelaComWebgl2 })).toBeNull()
  })

  it('fica no poster com movimento reduzido', () => {
    expect(motivoDoPoster({ matchMedia: mm(true), navigator: {}, window: janelaComWebgl2 })).toBe('movimento-reduzido')
  })

  it('fica no poster com economia de dados', () => {
    expect(motivoDoPoster({ matchMedia: mm(false), navigator: { connection: { saveData: true } }, window: janelaComWebgl2 })).toBe('economia-de-dados')
  })

  it('fica no poster com menos de 4 GB; 4 GB ou mais libera', () => {
    expect(motivoDoPoster({ matchMedia: mm(false), navigator: { deviceMemory: 2 }, window: janelaComWebgl2 })).toBe('pouca-memoria')
    expect(motivoDoPoster({ matchMedia: mm(false), navigator: { deviceMemory: 4 }, window: janelaComWebgl2 })).toBeNull()
  })

  it('fica no poster sem WebGL2 e sem janela', () => {
    expect(motivoDoPoster({ matchMedia: mm(false), navigator: {}, window: {} })).toBe('sem-webgl2')
    expect(motivoDoPoster({})).toBe('sem-webgl2')
  })

  it('a ordem dos motivos é movimento, dados, memória, WebGL2', () => {
    expect(motivoDoPoster({ matchMedia: mm(true), navigator: { connection: { saveData: true }, deviceMemory: 1 }, window: {} })).toBe('movimento-reduzido')
  })
})
