import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  FONTES, MODELOS, aplicarModelo, camposPadrao, csvEmitidos, dataLonga, desfazer, erroDaImagem, histVazio, imagemSegura,
  medidasDaImagem, modeloPorId, mover, partesDoLote, refazer, registrar, resolverTexto, sanearTemplate, type DadosCertificado,
} from '../lib/certificados'

afterEach(() => vi.unstubAllEnvs())
const dados: DadosCertificado = { nome: 'Ana Silva', evento: 'Festa Um', data: '15 de junho de 2026', horas: '8', emissao: '16/06/2026', codigo: 'abc-123' }

describe('modelos', () => {
  it('tem os 6 de antes (mesmos ids) e pelo menos 6 novos, com id único e cores em hexadecimal', () => {
    expect(MODELOS.slice(0, 6).map(m => m.id)).toEqual(['classic', 'modern', 'corporate', 'creative', 'academic', 'sport'])
    expect(MODELOS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(MODELOS.map(m => m.id)).size).toBe(MODELOS.length)
    for (const m of MODELOS) for (const c of [m.bg, m.accent, m.tinta, m.suave]) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('os novos têm paleta distinta e só usam fontes permitidas', () => {
    const novos = MODELOS.slice(6)
    expect(new Set(novos.map(m => m.bg + m.accent)).size).toBe(novos.length)
    for (const m of MODELOS) expect(FONTES.map(f => f.id)).toContain(m.fonte)
    expect(new Set(MODELOS.map(m => m.fonte)).size).toBeGreaterThanOrEqual(3)
  })
  it('modelo desconhecido cai no clássico', () => { expect(modeloPorId('xyz').id).toBe('classic') })
  it('só carrega fontes que o site já tem (nenhuma fonte externa nova)', () => {
    for (const f of FONTES) expect(f.css).toMatch(/Plus Jakarta Sans|Outfit|Archivo|Georgia/)
  })
})

describe('aplicarModelo', () => {
  it('mantém texto e posição e troca cor e fonte pelo padrão do novo modelo', () => {
    const campos = camposPadrao().map(c => c.id === 'title' ? { ...c, value: 'Meu texto', x: 33, color: '#ff0000', fontFamily: 'outfit' as const } : c)
    const novo = MODELOS.find(m => m.id === 'noturno')!
    const r = aplicarModelo(campos, novo)
    const t = r.find(c => c.id === 'title')!
    expect(t.value).toBe('Meu texto')
    expect(t.x).toBe(33)
    expect(t.color).toBe(novo.tinta)
    expect(t.fontFamily).toBeUndefined()
    expect(r).toHaveLength(campos.length)
  })
})

describe('resolverTexto', () => {
  it('troca todas as variáveis, inclusive repetidas, e deixa o resto', () => {
    expect(resolverTexto('{{NOME}} em {{EVENTO}} ({{NOME}}) {{HORAS}}h {{CODIGO}} {{OUTRA}}', dados)).toBe('Ana Silva em Festa Um (Ana Silva) 8h abc-123 {{OUTRA}}')
  })
  it('não interpreta HTML: o que vier fica como texto', () => {
    expect(resolverTexto('{{NOME}}', { ...dados, nome: '<img src=x onerror=alert(1)>' })).toBe('<img src=x onerror=alert(1)>')
  })
  it('nome com $& não vira padrão de substituição', () => {
    expect(resolverTexto('{{NOME}}', { ...dados, nome: "$& $1 $'" })).toBe("$& $1 $'")
  })
})

describe('sanearTemplate (JSON do banco é dado não confiável)', () => {
  it('lixo vira o padrão', () => {
    for (const lixo of [null, undefined, 42, 'x', [], { fields: 'x' }, { fields: [] }]) {
      const t = sanearTemplate(lixo)
      expect(t.selectedTemplate).toBe('classic')
      expect(t.fields.length).toBe(camposPadrao().length)
      expect(t.logoUrl).toBeNull()
    }
  })
  it('cor fora do hexadecimal, fonte fora da lista, tipo desconhecido e coordenadas absurdas são corrigidos', () => {
    const t = sanearTemplate({
      selectedTemplate: 'inexistente', accentColor: 'red; background:url(x)',
      fields: [
        { id: 'a', type: 'text', label: 'A', x: 9999, y: -5, fontSize: 5000, color: 'url(javascript:1)', value: 'oi', width: 0, fontFamily: 'Comic Sans', align: 'justify', bold: 'sim' },
        { id: 'b', type: 'script', x: 1, y: 1 },
        'texto', null,
      ],
    })
    expect(t.selectedTemplate).toBe('classic')
    expect(t.accentColor).toBeNull()
    expect(t.fields).toHaveLength(1)
    const a = t.fields[0]
    expect([a.x, a.y, a.fontSize, a.width]).toEqual([100, 0, 96, 10])
    expect(a.color).toBe('#1a0e14')
    expect(a.fontFamily).toBeUndefined()
    expect(a.align).toBeUndefined()
    expect(a.bold).toBeUndefined()
  })
  it('limita quantidade de campos e tamanho de texto, e deixa ids únicos', () => {
    const muitos = Array.from({ length: 80 }, () => ({ id: 'igual', type: 'text', value: 'x'.repeat(5000), x: 1, y: 1 }))
    const t = sanearTemplate({ fields: muitos })
    expect(t.fields).toHaveLength(30)
    expect(t.fields[0].value).toHaveLength(300)
    expect(new Set(t.fields.map(f => f.id)).size).toBe(30)
  })
  it('QR e logo antigos, largos demais (50 a 100%), voltam ao tamanho certo (QR cortado)', () => {
    const t = sanearTemplate({ fields: [{ id: 'q', type: 'qrcode', x: 15, y: 78, width: 50 }, { id: 's', type: 'signature', x: 70, y: 80, width: 100 }, { id: 'l', type: 'logo', x: 50, y: 8, width: 80 }] })
    expect(t.fields.map(f => f.width)).toEqual([12, 20, 18])
  })
  it('imagens: só png/jpeg/webp em base64 ou https; SVG, javascript: e tamanho absurdo caem', () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    expect(imagemSegura(png)).toBe(png)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
    const doBucket = 'https://abc.supabase.co/storage/v1/object/public/logos-produtor/u1/a.png'
    expect(imagemSegura(doBucket)).toBe(doBucket)
    for (const ruim of ['https://outro.com/logo.png', 'https://abc.supabase.co/storage/v1/object/public/outro-bucket/a.png', 'https://abc.supabase.co.evil.com/storage/v1/object/public/logos-produtor/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/svg+xml,<svg onload=alert(1)>', 'javascript:alert(1)', 'http://x.com/a.png', 'https://x.com/a b.png', 'data:text/html;base64,AAAA', 'data:image/png;base64,' + 'A'.repeat(2_000_000), 7, null])
      expect(imagemSegura(ruim)).toBeNull()
    const t = sanearTemplate({ logoUrl: 'data:image/gif;base64,R0lGOD', sigUrl: png })
    expect(t.sigUrl).toBe(png)
    expect(t.logoUrl).toBeNull()
    expect(t.logoDescartada).toBe('data:image/gif;base64,R0lGOD') // avisa quem carrega; não some em silêncio
    expect(t.sigDescartada).toBeUndefined()
    vi.stubEnv('VITE_SUPABASE_URL', '')
    expect(imagemSegura(doBucket)).toBeNull() // sem a URL do projeto, nenhum https vale
  })
  it('carga horária só com número', () => {
    expect(sanearTemplate({ horas: '8' }).horas).toBe('8')
    expect(sanearTemplate({ horas: '<b>8' }).horas).toBe('')
  })
})

describe('erroDaImagem', () => {
  it('aceita png/jpeg/webp até 1 MB; recusa SVG e arquivo grande', () => {
    expect(erroDaImagem({ type: 'image/png', size: 1024 * 1024 })).toBeNull()
    expect(erroDaImagem({ type: 'image/webp', size: 10 })).toBeNull()
    expect(erroDaImagem({ type: 'image/svg+xml', size: 10 })).toMatch(/PNG, JPG ou WebP/)
    expect(erroDaImagem({ type: 'image/png', size: 1024 * 1024 + 1 })).toMatch(/1 MB/)
  })
})

describe('mover', () => {
  it('anda no passo e não sai da folha', () => {
    const c = camposPadrao()[1]
    expect(mover(c, 1, 0).x).toBe(c.x + 1)
    expect(mover({ ...c, x: 99.5 }, 5, 0).x).toBe(100)
    expect(mover({ ...c, y: 2 }, 0, -5).y).toBe(0)
  })
})

describe('desfazer e refazer', () => {
  it('volta e avança; edição nova apaga o futuro; edições seguidas com a mesma chave são um passo', () => {
    let h = histVazio<number>()
    let atual = 0
    h = registrar(h, atual, 'k'); atual = 1
    h = registrar(h, atual, 'k'); atual = 2
    expect(h.passado).toEqual([0])
    const d = desfazer(h, atual)!
    expect(d.estado).toBe(0)
    const r = refazer(d.hist, d.estado)!
    expect(r.estado).toBe(2)
    const d2 = desfazer(r.hist, r.estado)!
    const h3 = registrar(d2.hist, d2.estado); // edição nova
    expect(h3.futuro).toEqual([])
    expect(desfazer(histVazio<number>(), 1)).toBeNull()
    expect(refazer(histVazio<number>(), 1)).toBeNull()
  })
  it('a pilha é pequena (50)', () => {
    let h = histVazio<number>()
    for (let i = 0; i < 80; i++) h = registrar(h, i)
    expect(h.passado).toHaveLength(50)
  })
})

describe('lote', () => {
  it('divide em partes de até 50', () => {
    const lista = Array.from({ length: 120 }, (_, i) => i)
    const p = partesDoLote(lista)
    expect(p.map(x => x.length)).toEqual([50, 50, 20])
    expect(partesDoLote([])).toEqual([])
    expect(partesDoLote(lista.slice(0, 50))).toHaveLength(1)
  })
})

describe('csvEmitidos', () => {
  it('só nome, código e data; fórmula de planilha é neutralizada', () => {
    const csv = csvEmitidos([{ nome: '=HYPERLINK("x")', codigo: 'c-1', emitidoEm: '16/06/2026' }, { nome: 'Ana', codigo: 'c-2', emitidoEm: '17/06/2026' }])
    const linhas = csv.replace('﻿', '').split('\r\n')
    expect(linhas[0]).toBe('Nome;Código;Emitido em')
    expect(linhas[1].startsWith("\"'=HYPERLINK")).toBe(true)
    expect(linhas[2]).toBe('Ana;c-2;17/06/2026')
    expect(linhas).toHaveLength(3)
  })
})

describe('dataLonga', () => {
  it('formata e tolera vazio', () => {
    expect(dataLonga('2026-06-15')).toBe('15 de junho de 2026')
    expect(dataLonga(null)).toBe('')
    expect(dataLonga('lixo')).toBe('')
  })
})

describe('imagem embutida: medidas e bomba de pixels', () => {
  const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes))
  const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
  const png = (w: number, h: number) => `data:image/png;base64,${b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...u32(w), ...u32(h), 8, 6, 0, 0, 0])}`
  const webpX = (w: number, h: number) => { const a = w - 1, c = h - 1; return `data:image/webp;base64,${b64([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0, a & 255, (a >> 8) & 255, (a >> 16) & 255, c & 255, (c >> 8) & 255, (c >> 16) & 255])}` }
  const jpeg = (w: number, h: number) => `data:image/jpeg;base64,${b64([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1])}`

  it('lê as medidas de png, webp (VP8X) e jpeg sem decodificar', () => {
    expect(medidasDaImagem(png(300, 80))).toEqual({ w: 300, h: 80 })
    expect(medidasDaImagem(webpX(640, 480))).toEqual({ w: 640, h: 480 })
    expect(medidasDaImagem(jpeg(1200, 900))).toEqual({ w: 1200, h: 900 })
    expect(medidasDaImagem('data:image/png;base64,@@@')).toBeNull()
    expect(medidasDaImagem('sem virgula')).toBeNull()
  })
  it('aceita logo normal e foto de 24 MP; recusa PNG, WebP e JPEG que declaram pixels demais', () => {
    expect(imagemSegura(png(512, 200))).not.toBeNull()
    expect(imagemSegura(jpeg(6000, 4000))).not.toBeNull() // 24 MP
    for (const bomba of [png(30000, 30000), png(8000, 8000), webpX(16000, 16000), jpeg(20000, 20000)]) expect(imagemSegura(bomba)).toBeNull()
  })
  it('recusa imagem sem medidas legíveis (cabeçalho ausente) e dimensão zero', () => {
    expect(imagemSegura('data:image/png;base64,iVBORw0KGgo=')).toBeNull()
    expect(imagemSegura(png(0, 100))).toBeNull()
  })
})
