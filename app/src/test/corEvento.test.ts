import { describe, it, expect } from 'vitest'
import { contraste, corSorteada, corVivaDePixels, derivarCor, diaMesDoCartaz, ehHex, linhasDoCartaz, misturaOklab, temFoto, varsDoEvento } from '../lib/corEvento'

// cores das pranchas + extremos (branco, preto, cinza, neon) e uma grade de matizes
const matizes = Array.from({ length: 24 }, (_, i) => {
  const h = i * 15, f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))) }
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('')
})
const CORES = ['#a55c65', '#1f7a74', '#d9a521', '#1d68c4', '#b5482e', '#ffffff', '#000000', '#808080', '#ffff00', '#00ffff', '#fefefe', '#010101', ...matizes]

describe('derivarCor: contraste AA nos dois temas', () => {
  for (const cor of CORES) {
    it(`cor ${cor}`, () => {
      const d = derivarCor(cor)
      // claro: tinta escura sobre o fundo do evento; texto da cor no fundo da página, no fundo do evento
      expect(contraste('#0b0d12', d.claro.fundo)).toBeGreaterThanOrEqual(4.5)
      expect(contraste(d.claro.texto, '#ffffff')).toBeGreaterThanOrEqual(4.5)
      expect(contraste(d.claro.texto, d.claro.fundo)).toBeGreaterThanOrEqual(4.5)
      // escuro: branco sobre o fundo do evento; texto da cor no fundo, na superfície e no fundo do evento
      expect(contraste('#ffffff', d.escuro.fundo)).toBeGreaterThanOrEqual(4.5)
      for (const f of ['#0b0d12', '#14171d', d.escuro.fundo]) expect(contraste(d.escuro.texto, f)).toBeGreaterThanOrEqual(4.5)
      // gráfico: 3:1 contra a superfície, ou cai para a cor da marca
      expect(contraste(d.claro.grafico, '#ffffff')).toBeGreaterThanOrEqual(3)
      expect(contraste(d.escuro.grafico, '#14171d')).toBeGreaterThanOrEqual(3)
      // cartaz: a tinta lê sobre o campo; foto com texto: branco sobre o teto do duotone
      expect(contraste(d.tinta, d.cor)).toBeGreaterThanOrEqual(4.5)
      expect(contraste('#ffffff', d.duoLuzTexto)).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('a cor crua do vinho reprova como texto (2.2) e o derivado passa; os fundos batem com as pranchas', () => {
    expect(contraste('#a55c65', '#0b0d12')).toBeLessThan(4.5)
    const d = derivarCor('#a55c65')
    expect(d.escuro.fundo).toBe('#5a373d')
    expect(d.claro.fundo).toBe('#f4e7e8')
    expect(misturaOklab('#a55c65', '#0b0d12', 0.55)).toBe('#5a373d')
    expect(d.duoLuz).toBe('#eaa2aa')
    expect(d.claro.grafico).toBe('#a55c65')
    expect(d.escuro.grafico).toBe('#a55c65')
  })
  it('mostarda no claro não dá 3:1 de gráfico e cai para a cor da marca', () => {
    expect(derivarCor('#d9a521').claro.grafico).toBe('#1d68c4')
  })
  it('cor inválida vira o azul da marca', () => {
    expect(derivarCor('vermelho').cor).toBe('#1d68c4')
    expect(derivarCor('#A55C65').cor).toBe('#a55c65')
  })
  it('varsDoEvento entrega os pares claro/escuro e a luz de texto na faixa', () => {
    const v = varsDoEvento('#a55c65'), t = varsDoEvento('#a55c65', true)
    expect(v['--evento-fundo-e']).toBe('#5a373d')
    expect(v['--duo-luz']).toBe('#eaa2aa')
    expect(t['--duo-luz']).not.toBe(v['--duo-luz'])
  })
})

describe('corVivaDePixels e sorteio', () => {
  const px = (...c: number[][]) => new Uint8ClampedArray(c.flatMap(([r, g, b]) => [r, g, b, 255]))
  it('escolhe o pixel mais saturado de luminosidade média, não o mais claro nem o escuro', () => {
    expect(corVivaDePixels(px([250, 250, 250], [5, 5, 5], [165, 92, 101], [120, 120, 120]))).toBe('#a55c65')
  })
  it('foto cinza não tem cor: null (o chamador sorteia)', () => {
    expect(corVivaDePixels(px([10, 10, 10], [200, 200, 200], [128, 128, 128]))).toBeNull()
  })
  it('o sorteio é estável e devolve hex', () => {
    const a = corSorteada('3f2c5d52-1111-4222-8333-444455556666')
    expect(corSorteada('3f2c5d52-1111-4222-8333-444455556666')).toBe(a)
    expect(ehHex(a)).toBe(true)
    expect(new Set(Array.from({ length: 60 }, (_, i) => corSorteada(`evento-${i}`))).size).toBeGreaterThan(2)
  })
})

describe('capa', () => {
  it('só conta como foto a URL real: vazio, nulo e a foto padrão são cartaz', () => {
    expect(temFoto(null)).toBe(false)
    expect(temFoto('')).toBe(false)
    expect(temFoto('/images/hero-bg.jpg')).toBe(false)
    expect(temFoto('https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/capas-eventos/a/b/c.webp')).toBe(true)
    expect(temFoto('blob:https://evokaa.com.br/1234')).toBe(true)
    expect(temFoto('data:image/png;base64,AAAA')).toBe(false)
    expect(temFoto('javascript:alert(1)')).toBe(false)
    expect(temFoto('//evil.com/a.jpg')).toBe(false)
  })
  it('linhas do cartaz: palavra curta gruda na seguinte e o tamanho cabe', () => {
    expect(linhasDoCartaz('Noite de Forró')).toEqual({ linhas: ['NOITE', 'DE FORRÓ'], k: 112 / 8 })
    expect(linhasDoCartaz('   ').linhas).toEqual(['EVENTO'])
    expect(linhasDoCartaz('A').k).toBe(24)
  })
  it('dia e mês do cartaz vêm da data sem mexer em fuso', () => {
    expect(diaMesDoCartaz('2026-12-05')).toEqual({ dia: '5', mes: 'DEZ' })
    expect(diaMesDoCartaz('2026-13-05')).toBeNull()
    expect(diaMesDoCartaz(null)).toBeNull()
  })
})
