import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { contraste, derivarCor } from '../lib/corEvento'

const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const hex = (c: number[]) => '#' + c.map(x => Math.round(x).toString(16).padStart(2, '0')).join('')
// composição alfa em sRGB, igual à do navegador: topo sobre base com opacidade a
const sobre = (base: string, topo: string, a: number) => hex(rgb(base).map((b, i) => b * (1 - a) + rgb(topo)[i] * a))

const CORES = ['#f2a61d', '#ffd400', '#fdfdf5', '#f5f5f5', '#0a0a0a', '#111111', '#1d4ed8', '#2563eb', '#dc2626', '#a55c65', '#00ff88', '#ff00cc']

// Cartão "Próximo evento" do painel: texto branco sobre foto branca (pior caso) com o degradê de PainelEventos
describe('painel de eventos: texto branco sobre capa branca', () => {
  it('a faixa do texto (parte de baixo do degradê) passa de 4,5:1', () => {
    const fonte = readFileSync(resolve(__dirname, '../components/PainelEventos.tsx'), 'utf8')
    const via = +fonte.match(/via-black\/(\d+)/)![1] / 100 // o texto fica entre o meio e a base do degradê
    expect(contraste('#ffffff', sobre('#ffffff', '#000000', via))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('rótulos pequenos', () => {
  it('muted-foreground sobre o cartão, nos dois temas (valores do index.css)', () => {
    expect(contraste('#5b6472', '#ffffff')).toBeGreaterThanOrEqual(4.5) // claro: muted sobre card
    expect(contraste('#9aa1ad', '#14171d')).toBeGreaterThanOrEqual(4.5) // escuro
  })
})

// Topo da vitrine chapada: a linha de data e hora é a única com a cor do evento (var(--evento-texto)), direto sobre a página
// (--background) e sobre o cartão de ingressos (--card), nos dois temas. Valores dos tokens do index.css.
describe('topo do evento: a linha de data na cor do evento', () => {
  const fundos = { claro: ['#ffffff', '#ffffff'], escuro: ['#0b0d12', '#14171d'] }
  for (const cor of CORES) for (const intensidade of [100, 40]) for (const t of ['claro', 'escuro'] as const) {
    it(`${cor} a ${intensidade}% no tema ${t}`, () => {
      const texto = derivarCor(cor, intensidade)[t].texto
      for (const f of fundos[t]) expect(contraste(texto, f), `${texto} sobre ${f}`).toBeGreaterThanOrEqual(4.5)
    })
  }
  it('a linha de data usa --evento-texto e o CSS não guarda mais as camadas do hero antigo', () => {
    const css = readFileSync(resolve(__dirname, '../components/EventoVitrine.css'), 'utf8')
    expect(css).not.toMatch(/\.evv-hero|\.evv-lav|\.evv-gr\b/)
    const fonte = readFileSync(resolve(__dirname, '../components/EventoConteudo.tsx'), 'utf8')
    expect(fonte).toMatch(/text-\[var\(--evento-texto\)\]/)
  })
})

// Bloco do organizador: sem fundo misturado com a cor do evento, o texto fica direto sobre a página (nada a medir além dos tokens).
describe('bloco do organizador: texto sobre a página', () => {
  it('foreground e muted-foreground sobre --background, nos dois temas (valores do index.css)', () => {
    expect(contraste('#0b0d12', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contraste('#5b6472', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contraste('#e6e8ec', '#0b0d12')).toBeGreaterThanOrEqual(4.5)
    expect(contraste('#9aa1ad', '#0b0d12')).toBeGreaterThanOrEqual(4.5)
  })
  it('o componente não mistura mais a cor do evento no fundo', () => {
    const fonte = readFileSync(resolve(__dirname, '../components/BlocoOrganizador.tsx'), 'utf8')
    expect(fonte).not.toMatch(/color-mix\(in oklab, var\(--evento\)/)
  })
})
