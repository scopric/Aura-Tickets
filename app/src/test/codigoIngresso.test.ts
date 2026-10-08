import { describe, it, expect, afterEach, vi } from 'vitest'
import { apagarLista, apagarListas, codigoAgora, guardarLista, horasRestantes, lerLista, listaDaResposta, PASSO_MS } from '../lib/codigoIngresso'

const PREFIXO = `E1.${'a'.repeat(32)}.`
const T0 = Date.UTC(2026, 9, 8, 21, 0, 0)
const cods = (n: number) => Array.from({ length: n }, (_, i) => `AAAAAA${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26) % 26)}`)
const resposta = (o: Record<string, unknown> = {}) => ({ servidorAgora: T0, passo: 30, primeiraJanela: Math.floor(T0 / PASSO_MS), prefixo: PREFIXO, codigos: cods(1440), ...o })

afterEach(() => apagarListas())

describe('lista de códigos do QR dinâmico', () => {
  it('aceita a resposta da função e calcula o desvio do relógio do aparelho', () => {
    const l = listaDaResposta(resposta(), T0 - 5 * 60_000)! // aparelho 5 min atrasado
    expect(l.offset).toBe(5 * 60_000)
    // com o relógio errado, o código da vez é o do servidor
    expect(codigoAgora(l, T0 - 5 * 60_000)?.qr).toBe(PREFIXO + l.codigos[0])
  })

  it('troca de código a cada 30 s e diz quanto falta', () => {
    const l = listaDaResposta(resposta(), T0)!
    const a = codigoAgora(l, T0 + 1_000)!
    expect(a.qr).toBe(PREFIXO + l.codigos[0])
    expect(a.restanteMs).toBe(29_000)
    expect(codigoAgora(l, T0 + 29_999)!.qr).toBe(PREFIXO + l.codigos[0])
    expect(codigoAgora(l, T0 + 30_000)!.qr).toBe(PREFIXO + l.codigos[1])
    expect(codigoAgora(l, T0 + 30_000)!.restanteMs).toBe(30_000)
  })

  it('lista vencida (passou das 12 h) ou que ainda não começou: sem código', () => {
    const l = listaDaResposta(resposta(), T0)!
    expect(codigoAgora(l, T0 + 1440 * PASSO_MS - 1)).not.toBeNull()
    expect(codigoAgora(l, T0 + 1440 * PASSO_MS)).toBeNull()
    expect(codigoAgora(l, T0 - 2 * PASSO_MS)).toBeNull()
  })

  it('horas que a lista ainda cobre', () => {
    const l = listaDaResposta(resposta(), T0)!
    expect(horasRestantes(l, T0)).toBeCloseTo(12, 1)
    expect(horasRestantes(l, T0 + 6 * 3_600_000)).toBeCloseTo(6, 1)
    expect(horasRestantes(l, T0 + 13 * 3_600_000)).toBe(0)
  })

  it('recusa resposta fora do formato (nada de confiar no servidor às cegas)', () => {
    for (const ruim of [null, undefined, 'x', {}, resposta({ passo: 60 }), resposta({ servidorAgora: 'agora' }), resposta({ primeiraJanela: 1.5 }),
      resposta({ prefixo: 'E1.curto.' }), resposta({ prefixo: `E2.${'a'.repeat(32)}.` }), resposta({ codigos: [] }), resposta({ codigos: ['abcdefgh'] }),
      resposta({ codigos: ['ABCDEF18'] }), resposta({ codigos: cods(2001) }), resposta({ codigos: [5] })]) {
      expect(listaDaResposta(ruim, T0)).toBeNull()
    }
  })

  it('guarda e lê por conta e ingresso; apagar e logout limpam', () => {
    const l = listaDaResposta(resposta(), T0)!
    guardarLista('u1', 'i1', l)
    expect(lerLista('u1', 'i1')).toEqual(l)
    expect(lerLista('u2', 'i1')).toBeNull() // outra conta nunca lê
    expect(lerLista('u1', 'i2')).toBeNull()
    apagarLista('u1', 'i1')
    expect(lerLista('u1', 'i1')).toBeNull()
    guardarLista('u1', 'i1', l); guardarLista('u2', 'i9', l)
    apagarListas()
    expect(lerLista('u1', 'i1')).toBeNull()
    expect(lerLista('u2', 'i9')).toBeNull()
  })

  it('cópia adulterada no armazenamento não passa pelo crivo', () => {
    const guardado = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => void guardado.set(k, v), removeItem: (k: string) => void guardado.delete(k), key: () => null, get length() { return guardado.size } })
    Object.defineProperty(localStorage, 'length', { get: () => guardado.size })
    const l = listaDaResposta(resposta(), T0)!
    guardarLista('u1', 'i1', l)
    const [k] = [...guardado.keys()]
    expect(k).toBe('evk.qr.u1.i1')
    apagarListas()
    guardado.set(k, JSON.stringify({ ...l, codigos: ['<script>'] }))
    expect(lerLista('u1', 'i1')).toBeNull()
    guardado.set(k, JSON.stringify({ ...l, prefixo: 'E1.x.' }))
    expect(lerLista('u1', 'i1')).toBeNull()
    guardado.set(k, '{lixo')
    expect(lerLista('u1', 'i1')).toBeNull()
    guardado.set(k, JSON.stringify(l))
    expect(lerLista('u1', 'i1')).toEqual(l)
    vi.unstubAllGlobals()
  })
})
