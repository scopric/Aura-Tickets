import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { contraste, derivarCor, misturaOklab } from '../lib/corEvento'

// Contraste do texto do hero do evento (>= 4,5:1) no PIOR caso das camadas de EventoVitrine.css, nos dois temas.
// Os números (texto, lavagem, capa desfocada, escurecimento) saem do próprio CSS, para o teste acompanhar o design.
const css = readFileSync(resolve(__dirname, '../components/EventoVitrine.css'), 'utf8')
const hero = css.match(/\.evv-hero \{([\s\S]*?)\n\}/)![1]
const dark = css.match(/\.dark \.evv-hero \{([^}]*)\}/)![1]
// a última definição vale (no escuro, a do bloco .dark vem depois)
const v = (corpo: string, nome: string) => [...corpo.matchAll(new RegExp(`--${nome}:\\s*([^;]+);`, 'g'))].at(-1)![1].trim()

const ler = (corpo: string) => ({
  fg: v(corpo, 'h-fg'), fg2: v(corpo, 'h-fg2'), esc: +v(corpo, 'h-esc'),
  lavA: +v(corpo, 'h-lav-a'), lavB: +v(corpo, 'h-lav-b'), img: +v(corpo, 'h-img'),
})
// o tema escuro redefine só o que muda; o resto vem do bloco base
const tema = { claro: ler(hero), escuro: ler(hero + dark) }

const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const hex = (c: number[]) => '#' + c.map(x => Math.round(x).toString(16).padStart(2, '0')).join('')
// composição alfa em sRGB, igual à do navegador: topo sobre base com opacidade a
const sobre = (base: string, topo: string, a: number) => hex(rgb(base).map((b, i) => b * (1 - a) + rgb(topo)[i] * a))

const CORES = ['#f2a61d', '#ffd400', '#fdfdf5', '#f5f5f5', '#0a0a0a', '#111111', '#1d4ed8', '#2563eb', '#dc2626', '#a55c65', '#00ff88', '#ff00cc']

// Fora da conta: a granulação (.evv-gr, opacidade 0,04 em overlay), de impacto desprezível.
// Cartão "Próximo evento" do painel: texto branco sobre foto branca (pior caso) com o degradê de PainelEventos
describe('painel de eventos: texto branco sobre capa branca', () => {
  it('a faixa do texto (parte de baixo do degradê) passa de 4,5:1', () => {
    const fonte = readFileSync(resolve(__dirname, '../components/PainelEventos.tsx'), 'utf8')
    const via = +fonte.match(/via-black\/(\d+)/)![1] / 100 // o texto fica entre o meio e a base do degradê
    expect(contraste('#ffffff', sobre('#ffffff', '#000000', via))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('bilhete e carimbo', () => {
  it('rótulos mono (muted-foreground) sobre o cartão, nos dois temas (valores do index.css)', () => {
    expect(contraste('#5b6472', '#ffffff')).toBeGreaterThanOrEqual(4.5) // claro: muted sobre card
    expect(contraste('#9aa1ad', '#14171d')).toBeGreaterThanOrEqual(4.5) // escuro
  })
  it('carimbo: halo escuro em três camadas, o mais justo com opacidade >= 0,85', () => {
    // O halo escurece o fundo junto às letras, mas NÃO é prova de leitura sobre foto branca (nas bordas das letras
    // a sombra é suave). O carimbo é decorativo e aria-hidden: nenhuma informação depende dele.
    const sombras = [...css.match(/\.evv-carimbo \{[\s\S]*?\}/)![0].matchAll(/drop-shadow\([^)]*rgb\(0 0 0 \/ ([\d.]+)\)\)/g)].map(m => +m[1])
    expect(sombras).toHaveLength(3)
    expect(Math.max(...sombras)).toBeGreaterThanOrEqual(0.85)
    expect(contraste('#ffffff', '#202020')).toBeGreaterThanOrEqual(4.5) // sobre foto escura
  })
})

describe('hero do evento: contraste do texto', () => {
  for (const cor of CORES) for (const intensidade of [100, 40]) for (const t of ['claro', 'escuro'] as const) {
    it(`${cor} a ${intensidade}% no tema ${t}`, () => {
      const fundo = derivarCor(cor, intensidade)[t].fundo
      const lavagem = sobre(fundo, derivarCor(cor, intensidade).cor, 1 - (1 - tema[t].lavA) * (1 - tema[t].lavB)) // as duas lavagens juntas
      for (const pixel of ['#000000', '#ffffff']) { // capa desfocada: o pior pixel possível
        const comCapa = sobre(lavagem, pixel, tema[t].img)
        const final = sobre(comCapa, '#0b0d12', tema[t].esc)
        expect(contraste(tema[t].fg, final), `título ${cor} ${t} capa ${pixel}`).toBeGreaterThanOrEqual(4.5)
        expect(contraste(tema[t].fg2, final), `meta ${cor} ${t} capa ${pixel}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

// Cartão de fechamento do organizador: fundo = card misturado com a cor do evento (a % sai do próprio componente).
// Valores dos tokens do index.css: card, foreground e muted-foreground (o anel dos ícones usa muted-foreground; com --input
// o caso #0a0a0a no tema claro dava 2,93:1, por isso o anel foi trocado).
describe('cartão do organizador: contraste sobre o fundo misturado', () => {
  const fonte = readFileSync(resolve(__dirname, '../components/BlocoOrganizador.tsx'), 'utf8')
  const pct = +fonte.match(/color-mix\(in oklab, var\(--evento\) (\d+)%, hsl\(var\(--card\)\)\)/)![1] / 100
  const tokens = {
    claro: { card: '#ffffff', fg: '#0b0d12', muted: '#5b6472', input: '#5b6472' },
    escuro: { card: '#14171d', fg: '#e6e8ec', muted: '#9aa1ad', input: '#9aa1ad' },
  }
  for (const cor of ['#f2a61d', '#ffd400', '#0a0a0a', '#fdfdf5', '#1d68c4', '#ff2d55']) for (const intensidade of [100, 40]) for (const t of ['claro', 'escuro'] as const) {
    it(`${cor} a ${intensidade}% no tema ${t}`, () => {
      const k = tokens[t]
      const fundo = misturaOklab(derivarCor(cor, intensidade).cor, k.card, pct) // --evento é sempre a cor cheia
      expect(contraste(k.muted, fundo), 'muted').toBeGreaterThanOrEqual(4.5)
      expect(contraste(k.fg, fundo), 'foreground').toBeGreaterThanOrEqual(4.5)
      expect(contraste(k.fg, fundo), 'borda do botão Mostrar contato (border-foreground)').toBeGreaterThanOrEqual(3)
      expect(contraste(k.input, fundo), 'anel dos ícones redondos (muted-foreground)').toBeGreaterThanOrEqual(3)
    })
  }
})
