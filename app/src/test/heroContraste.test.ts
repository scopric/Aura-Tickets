import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { contraste, derivarCor } from '../lib/corEvento'

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
