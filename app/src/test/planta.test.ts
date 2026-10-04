import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TIPOS, MAX_PECAS, MAX_CORPO_BYTES, conferirArquivo, corpoGemini, interpretar } from '../../../supabase/functions/_shared/planta'
import { alternarTipo, contarPorTipo, emMetros, nosDaProposta, pecasValidas, type PecaProposta, type Quadro } from '../lib/plantaIA'

const resposta = (obj: unknown, finishReason = 'STOP') => ({
  candidates: [{ content: { parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] }, finishReason }],
})
const peca = (o: object = {}) => ({ tipo: 'table', x: 0.5, y: 0.5, w: 0.1, h: 0.1, ...o })

describe('interpretar', () => {
  it('aceita peças válidas e rótulo curto', () => {
    const r = interpretar(resposta({ pecas: [peca({ rotulo: 'Mesa 12' }), peca({ tipo: 'stage', x: 0, y: 1 })] }))
    expect(r).toMatchObject({ ok: true, descartadas: 0 })
    expect(r.ok && r.pecas).toHaveLength(2)
    expect(r.ok && r.pecas[0].rotulo).toBe('Mesa 12')
  })

  it('descarta tipo fora da lista e coordenada fora de 0..1 ou tamanho zero', () => {
    const r = interpretar(resposta({ pecas: [peca({ tipo: 'wall' }), peca({ tipo: 'select' }), peca({ x: 1.2 }), peca({ y: -0.1 }), peca({ w: 0 }), peca({ h: 'a' }), peca()] }))
    expect(r.ok && r.pecas).toHaveLength(1)
    expect(r.ok && r.descartadas).toBe(6)
  })

  it('rótulo fora do padrão sai, mas a peça fica', () => {
    const r = interpretar(resposta({ pecas: [peca({ rotulo: '<script>alert(1)</script>' }), peca({ rotulo: 'a'.repeat(30) })] }))
    expect(r.ok && r.pecas.every(p => p.rotulo === undefined)).toBe(true)
    expect(r.ok && r.pecas).toHaveLength(2)
  })

  it('corta em 200 peças', () => {
    const r = interpretar(resposta({ pecas: Array.from({ length: 250 }, () => peca()) }))
    expect(r.ok && r.pecas).toHaveLength(MAX_PECAS)
    expect(r.ok && r.descartadas).toBe(50)
  })

  it('JSON quebrado, sem pecas, truncado (MAX_TOKENS) ou bloqueado vira erro', () => {
    expect(interpretar(resposta('{"pecas": [{"tipo"'))).toEqual({ ok: false })
    expect(interpretar(resposta({ outra: 1 }))).toEqual({ ok: false })
    expect(interpretar(resposta({ pecas: [] }, 'MAX_TOKENS'))).toEqual({ ok: false })
    expect(interpretar({ promptFeedback: { blockReason: 'SAFETY' } })).toEqual({ ok: false })
    expect(interpretar(null)).toEqual({ ok: false })
  })

  it('o corpo do Gemini fecha o formato: JSON, schema com enum dos tipos, sem tools', () => {
    const c: any = corpoGemini({ mime: 'image/png', b64: 'AAAA' })
    expect(c.generationConfig.responseMimeType).toBe('application/json')
    expect(c.generationConfig.responseSchema.properties.pecas.items.properties.tipo.enum).toEqual([...TIPOS])
    expect(c.tools).toBeUndefined()
  })
})

describe('conferirArquivo', () => {
  const b64 = (bytes: number[], total = 24) => btoa(String.fromCharCode(...bytes, ...new Array(total - bytes.length).fill(0)))
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const jpg = [0xff, 0xd8, 0xff, 0xe0]
  const webp = [...'RIFF'].map(c => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map(c => c.charCodeAt(0)))

  it('aceita png, jpeg e webp pelos bytes iniciais', () => {
    expect(conferirArquivo(`data:image/png;base64,${b64(png)}`)?.mime).toBe('image/png')
    expect(conferirArquivo(`data:image/jpeg;base64,${b64(jpg)}`)?.mime).toBe('image/jpeg')
    expect(conferirArquivo(`data:image/webp;base64,${b64(webp)}`)?.mime).toBe('image/webp')
  })

  it('o cabeçalho mente: vale o que o arquivo é', () => {
    expect(conferirArquivo(`data:image/png;base64,${b64(jpg)}`)?.mime).toBe('image/jpeg')
    expect(conferirArquivo(`data:image/png;base64,${b64([0x25, 0x50, 0x44, 0x46])}`)).toBeNull() // PDF disfarçado
  })

  it('recusa PDF, gif, base64 inválido, não-string e vazio', () => {
    expect(conferirArquivo(`data:application/pdf;base64,${b64(png)}`)).toBeNull()
    expect(conferirArquivo(`data:image/gif;base64,${b64(png)}`)).toBeNull()
    expect(conferirArquivo('data:image/png;base64,@@@@@@@@@@@@@@@@@@@@')).toBeNull()
    expect(conferirArquivo(123)).toBeNull()
    expect(conferirArquivo('data:image/png;base64,')).toBeNull()
    expect(conferirArquivo(`data:image/png;base64,${'A'.repeat(MAX_CORPO_BYTES + 4)}`)).toBeNull() // grande demais: recusa antes da regex
  })

  it('recusa acima de 1,5 MB depois de decodificar', () => {
    const com = (n: number) => btoa(String.fromCharCode(...png) + 'A'.repeat(n))
    expect(conferirArquivo(`data:image/png;base64,${com(1_600_000)}`)).toBeNull()
    expect(conferirArquivo(`data:image/png;base64,${com(1_000_000)}`)).not.toBeNull()
  })
})

describe('tipos x editor', () => {
  it('cada tipo da lista existe no toolDefaults e em typeLabels do SeatingMap', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/producer/SeatingMap.tsx'), 'utf8')
    const defaults = src.slice(src.indexOf('const toolDefaults'), src.indexOf('const TOOL_CATEGORIES'))
    const rotulos = src.slice(src.indexOf('const typeLabels'), src.indexOf('let _nextId'))
    for (const t of TIPOS) {
      expect(defaults, t).toMatch(new RegExp(`\\b${t}: \\{ wMeter: [1-9\\d.]+`))
      expect(rotulos, t).toMatch(new RegExp(`\\b${t}:`))
    }
    expect(TIPOS).toHaveLength(18)
  })
})

describe('conversão para metros', () => {
  const q: Quadro = { offset: { x: 100, y: 80 }, scale: 1, naturalWidth: 1600, naturalHeight: 800, pixelsPerMeter: 40 }

  it('com proporção 2:1 a altura usa a proporção da imagem, não a largura', () => {
    // planta: 1000 x 500 px; peça no centro com 10% x 20%
    expect(emMetros({ tipo: 'table', x: 0.5, y: 0.5, w: 0.1, h: 0.2 }, q)).toEqual({ x: 15, y: 8.25, widthMeter: 2.5, heightMeter: 2.5 })
  })

  it('proporção 1:1 e escala 2 mudam o resultado como esperado', () => {
    const quadrada: Quadro = { ...q, naturalWidth: 800, naturalHeight: 800, scale: 2 }
    expect(emMetros({ tipo: 'stage', x: 0, y: 0, w: 0.5, h: 0.5 }, quadrada)).toEqual({ x: 2.5, y: 2, widthMeter: 25, heightMeter: 25 })
  })

  it('pixelsPerMeter calibrado muda os metros', () => {
    const m = emMetros({ tipo: 'table', x: 0, y: 0, w: 0.1, h: 0.1 }, { ...q, pixelsPerMeter: 20 })
    expect(m.widthMeter).toBe(5)
  })
})

describe('aplicar só os marcados', () => {
  const q: Quadro = { offset: { x: 0, y: 0 }, scale: 1, naturalWidth: 1000, naturalHeight: 1000, pixelsPerMeter: 40 }
  const base: PecaProposta[] = [
    { id: 'a', tipo: 'table', x: 0.1, y: 0.1, w: 0.05, h: 0.05, marcada: true },
    { id: 'b', tipo: 'table', x: 0.2, y: 0.2, w: 0.05, h: 0.05, marcada: false },
    { id: 'c', tipo: 'bar', x: 0.3, y: 0.3, w: 0.05, h: 0.05, marcada: true },
  ]

  it('só as marcadas viram nós', () => {
    expect(nosDaProposta(base, q).map(n => n.tipo)).toEqual(['table', 'bar'])
    expect(nosDaProposta(base.map(p => ({ ...p, marcada: false })), q)).toEqual([])
  })

  it('contagem por tipo e alternar tipo (desmarca todas; com alguma desmarcada, marca todas)', () => {
    expect(contarPorTipo(base)).toEqual({ table: { total: 2, marcadas: 1 }, bar: { total: 1, marcadas: 1 } })
    const marcou = alternarTipo(base, 'table')
    expect(marcou.filter(p => p.tipo === 'table').every(p => p.marcada)).toBe(true)
    const desmarcou = alternarTipo(marcou, 'table')
    expect(desmarcou.filter(p => p.tipo === 'table').every(p => !p.marcada)).toBe(true)
    expect(desmarcou.find(p => p.id === 'c')?.marcada).toBe(true)
  })

  it('pecasValidas no front descarta tipo que o editor não tem e número fora da faixa', () => {
    const existe = (t: string) => t === 'table'
    expect(pecasValidas([peca(), peca({ tipo: 'foo' }), peca({ x: 2 }), null, 'x'], existe)).toHaveLength(1)
    expect(pecasValidas('nada', existe)).toEqual([])
  })
})
