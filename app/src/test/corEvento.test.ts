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
      expect(contraste(d.tinta, d.cartaz)).toBeGreaterThanOrEqual(4.5)
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

// varsDoEvento antes da intensidade (gerado com o código do main, chave "cor|0" sem texto e "cor|1" com texto)
const ANTES: Record<string, Record<string, string>> = {"#a55c65|0":{"--evento":"#a55c65","--evento-fundo-c":"#f4e7e8","--evento-fundo-e":"#5a373d","--evento-texto-c":"#99565e","--evento-texto-e":"#cda4a9","--evento-grafico-c":"#a55c65","--evento-grafico-e":"#a55c65","--cz":"#a55c65","--cz-tinta":"#ffffff","--duo-sombra":"#2a1d23","--duo-luz":"#eaa2aa"},"#a55c65|1":{"--evento":"#a55c65","--evento-fundo-c":"#f4e7e8","--evento-fundo-e":"#5a373d","--evento-texto-c":"#99565e","--evento-texto-e":"#cda4a9","--evento-grafico-c":"#a55c65","--evento-grafico-e":"#a55c65","--cz":"#a55c65","--cz-tinta":"#ffffff","--duo-sombra":"#2a1d23","--duo-luz":"#a55c65"},"#1f7a74|0":{"--evento":"#1f7a74","--evento-fundo-c":"#e1ecea","--evento-fundo-e":"#1b4545","--evento-texto-c":"#1e736e","--evento-texto-e":"#82b5b1","--evento-grafico-c":"#1f7a74","--evento-grafico-e":"#1f7a74","--cz":"#1f7a74","--cz-tinta":"#ffffff","--duo-sombra":"#0f2326","--duo-luz":"#84b6b3"},"#1f7a74|1":{"--evento":"#1f7a74","--evento-fundo-c":"#e1ecea","--evento-fundo-e":"#1b4545","--evento-texto-c":"#1e736e","--evento-texto-e":"#82b5b1","--evento-grafico-c":"#1f7a74","--evento-grafico-e":"#1f7a74","--cz":"#1f7a74","--cz-tinta":"#ffffff","--duo-sombra":"#0f2326","--duo-luz":"#1f7a74"},"#d9a521|0":{"--evento":"#d9a521","--evento-fundo-c":"#faf3e4","--evento-fundo-e":"#735b28","--evento-texto-c":"#8b6b1b","--evento-texto-e":"#eed699","--evento-grafico-c":"#1d68c4","--evento-grafico-e":"#d9a521","--cz":"#d9a521","--cz-tinta":"#0b0d12","--duo-sombra":"#342b15","--duo-luz":"#eace85"},"#d9a521|1":{"--evento":"#d9a521","--evento-fundo-c":"#faf3e4","--evento-fundo-e":"#735b28","--evento-texto-c":"#8b6b1b","--evento-texto-e":"#eed699","--evento-grafico-c":"#1d68c4","--evento-grafico-e":"#d9a521","--cz":"#d9a521","--cz-tinta":"#0b0d12","--duo-sombra":"#342b15","--duo-luz":"#91701c"},"#1d68c4|0":{"--evento":"#1d68c4","--evento-fundo-c":"#e0eaf8","--evento-fundo-e":"#193d6d","--evento-texto-c":"#1d68c4","--evento-texto-e":"#80aade","--evento-grafico-c":"#1d68c4","--evento-grafico-e":"#1d68c4","--cz":"#1d68c4","--cz-tinta":"#ffffff","--duo-sombra":"#0f1f36","--duo-luz":"#83acdf"},"#1d68c4|1":{"--evento":"#1d68c4","--evento-fundo-c":"#e0eaf8","--evento-fundo-e":"#193d6d","--evento-texto-c":"#1d68c4","--evento-texto-e":"#80aade","--evento-grafico-c":"#1d68c4","--evento-grafico-e":"#1d68c4","--cz":"#1d68c4","--cz-tinta":"#ffffff","--duo-sombra":"#0f1f36","--duo-luz":"#1d68c4"},"#ffffff|0":{"--evento":"#ffffff","--evento-fundo-c":"#ffffff","--evento-fundo-e":"#6c6e72","--evento-texto-c":"#717376","--evento-texto-e":"#ffffff","--evento-grafico-c":"#1d68c4","--evento-grafico-e":"#ffffff","--cz":"#ffffff","--cz-tinta":"#0b0d12","--duo-sombra":"#3c3d41","--duo-luz":"#ffffff"},"#ffffff|1":{"--evento":"#ffffff","--evento-fundo-c":"#ffffff","--evento-fundo-e":"#6c6e72","--evento-texto-c":"#717376","--evento-texto-e":"#ffffff","--evento-grafico-c":"#1d68c4","--evento-grafico-e":"#ffffff","--cz":"#ffffff","--cz-tinta":"#0b0d12","--duo-sombra":"#3c3d41","--duo-luz":"#6d6e71"},"#000000|0":{"--evento":"#000000","--evento-fundo-c":"#d1d1d1","--evento-fundo-e":"#010102","--evento-texto-c":"#000000","--evento-texto-e":"#808080","--evento-grafico-c":"#000000","--evento-grafico-e":"#1d68c4","--cz":"#000000","--cz-tinta":"#ffffff","--duo-sombra":"#090a0e","--duo-luz":"#737373"},"#000000|1":{"--evento":"#000000","--evento-fundo-c":"#d1d1d1","--evento-fundo-e":"#010102","--evento-texto-c":"#000000","--evento-texto-e":"#808080","--evento-grafico-c":"#000000","--evento-grafico-e":"#1d68c4","--cz":"#000000","--cz-tinta":"#ffffff","--duo-sombra":"#090a0e","--duo-luz":"#000000"},"#ffff00|0":{"--evento":"#ffff00","--evento-fundo-c":"#feffe9","--evento-fundo-e":"#6c6f2c","--evento-texto-c":"#76770a","--evento-texto-e":"#ffff00","--evento-grafico-c":"#1d68c4","--evento-grafico-e":"#ffff00","--cz":"#ffff00","--cz-tinta":"#0b0d12","--duo-sombra":"#3c3d0e","--duo-luz":"#ffff73"},"#ffff00|1":{"--evento":"#ffff00","--evento-fundo-c":"#feffe9","--evento-fundo-e":"#6c6f2c","--evento-texto-c":"#76770a","--evento-texto-e":"#ffff00","--evento-grafico-c":"#1d68c4","--evento-grafico-e":"#ffff00","--cz":"#ffff00","--cz-tinta":"#0b0d12","--duo-sombra":"#3c3d0e","--duo-luz":"#6d6e0b"}}

describe('intensidade da cor', () => {
  it('100 (e sem argumento) é idêntico ao de antes', () => {
    for (const [k, v] of Object.entries(ANTES)) {
      const [cor, t] = k.split('|')
      expect(varsDoEvento(cor, t === '1')).toEqual(v)
      expect(varsDoEvento(cor, t === '1', 100)).toEqual(v)
    }
  })
  for (const cor of CORES) {
    it(`contrastes mínimos em 10, 40 e 70%: ${cor}`, () => {
      for (const n of [10, 40, 70]) {
        const d = derivarCor(cor, n)
        expect(contraste('#0b0d12', d.claro.fundo)).toBeGreaterThanOrEqual(4.5)
        expect(contraste('#ffffff', d.escuro.fundo)).toBeGreaterThanOrEqual(4.5)
        for (const f of ['#ffffff', d.claro.fundo]) expect(contraste(d.claro.texto, f)).toBeGreaterThanOrEqual(4.5)
        for (const f of ['#0b0d12', '#14171d', d.escuro.fundo]) expect(contraste(d.escuro.texto, f)).toBeGreaterThanOrEqual(4.5)
        expect(contraste(d.claro.grafico, '#ffffff')).toBeGreaterThanOrEqual(3)
        expect(contraste(d.escuro.grafico, '#14171d')).toBeGreaterThanOrEqual(3)
        expect(contraste(d.tinta, d.cartaz)).toBeGreaterThanOrEqual(4.5)
        expect(contraste('#ffffff', d.duoLuzTexto)).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
  it('menos intensidade deixa o fundo mais perto do fundo do tema', () => {
    const [a, b] = [derivarCor('#1d68c4', 100), derivarCor('#1d68c4', 30)]
    expect(contraste(b.claro.fundo, '#ffffff')).toBeLessThan(contraste(a.claro.fundo, '#ffffff'))
    expect(contraste(b.escuro.fundo, '#0b0d12')).toBeLessThan(contraste(a.escuro.fundo, '#0b0d12'))
    expect(b.cartaz).not.toBe(a.cartaz)
  })
  it('valor inválido ou fora da faixa não quebra', () => {
    expect(varsDoEvento('#1d68c4', false, NaN)).toEqual(varsDoEvento('#1d68c4'))
    expect(varsDoEvento('#1d68c4', false, 500)).toEqual(varsDoEvento('#1d68c4'))
    expect(varsDoEvento('#1d68c4', false, 0)).toEqual(varsDoEvento('#1d68c4', false, 10))
  })
})

describe('corVivaDePixels: sem tons quase brancos ou pretos', () => {
  const px = (...c: number[][]) => c.flatMap(([r, g, b]) => [r, g, b, 255])
  it('ignora o quase branco e usa o próximo candidato', () => {
    expect(corVivaDePixels(px([255, 250, 200], [165, 92, 101]))).toBe('#a55c65')
  })
  it('ignora o quase preto', () => {
    expect(corVivaDePixels(px([40, 0, 0], [31, 122, 116]))).toBe('#1f7a74')
  })
  it('só extremos: null (cai no sorteio)', () => {
    expect(corVivaDePixels(px([255, 250, 200], [40, 0, 0]))).toBeNull()
  })
})
