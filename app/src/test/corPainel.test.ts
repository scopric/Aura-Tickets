import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Cor do painel do produtor (Decisão 217): violeta da logo. Lê os valores REAIS do index.css.
const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')
const bloco = (re: RegExp) => {
  const corpo = css.match(re)?.[1]
  if (!corpo) throw new Error(`bloco não encontrado: ${re}`)
  return Object.fromEntries([...corpo.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim().replace(/\s*\/\*.*$/, '')]))
}
const globalClaro = bloco(/\n {2}:root, \.light \{([\s\S]*?)\n {2}\}/)
const globalEscuro = { ...globalClaro, ...bloco(/\n {2}\.dark \{([\s\S]*?)\n {2}\}/) }
const claro = { ...globalClaro, ...bloco(/\n\.painel-produtor, body\.cor-produtor \{([\s\S]*?)\n\}/) }
const escuro = { ...globalEscuro, ...bloco(/\n\.dark \.painel-produtor, \.dark body\.cor-produtor \{([\s\S]*?)\n\}/) }

function rgb(v: string): number[] {
  const hex = v.match(/^#([0-9a-f]{6})$/i)
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16))
  const hsl = v.match(/^([\d.]+) ([\d.]+)% ([\d.]+)%$/)
  if (!hsl) throw new Error(`não é cor opaca: "${v}"`)
  const [h, s, l] = [+hsl[1], +hsl[2] / 100, +hsl[3] / 100]
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) }
  return [f(0), f(8), f(4)]
}
const luz = (c: number[]) => { const [r, g, b] = c.map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const razao = (a: string, b: string) => { const [l1, l2] = [luz(rgb(a)), luz(rgb(b))].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05) }

describe('cor do painel do produtor: violeta da logo', () => {
  for (const [tema, t] of [['claro', claro], ['escuro', escuro]] as const) {
    it(`${tema}: preenchimento violeta com branco por cima ≥ 4,5`, () => {
      expect(rgb(t.primary).map(Math.round)).toEqual([143, 51, 245]) // #8f33f5, a cor da logo
      expect(razao(t['primary-foreground'], t.primary)).toBeGreaterThanOrEqual(4.5)
    })
    it(`${tema}: texto de marca sobre fundo, superfície e fundo suave ≥ 4,5`, () => {
      for (const fundo of ['background', 'card']) expect(razao(t['primary-text'], t[fundo]), `texto sobre ${fundo}`).toBeGreaterThanOrEqual(4.5)
      expect(razao(t['primary-text'], t['ev-brand-soft'])).toBeGreaterThanOrEqual(4.5)
    })
    it(`${tema}: foco de campo ≥ 3 sobre o fundo (WCAG 1.4.11) e hover com branco ≥ 4,5`, () => {
      expect(razao(t['ev-focus-field'], t.background)).toBeGreaterThanOrEqual(3)
      expect(razao('#ffffff', t['ev-brand-hover'])).toBeGreaterThanOrEqual(4.5)
    })
  }
  it('pílula do menu do celular: violeta com contraste ≥ 4,5 sobre o fundo dela, nos dois temas', () => {
    const l = css.match(/\nbody\.cor-produtor \.vidro :is\([^)]*\) \{ color: (#[0-9a-f]{6}); \}/i)?.[1]
    const e = css.match(/\n\.dark body\.cor-produtor \.vidro :is\([^)]*\) \{ color: (#[0-9a-f]{6}); \}/i)?.[1]
    expect(l && e).toBeTruthy()
    expect(razao(l!, '#ffffff')).toBeGreaterThanOrEqual(4.5) // pílula clara: fundo #ffffff (index.css .vidro)
    expect(razao(e!, '#2a303b')).toBeGreaterThanOrEqual(4.5) // pílula escura: fundo #2a303b
  })

  it('a marca global (participante, admin) é o marinho da Decisão 226 e não vazou violeta', () => {
    expect(rgb(globalClaro.primary).map(Math.round)).toEqual([12, 35, 64]) // #0c2340
    expect(rgb(globalEscuro.primary).map(Math.round)).toEqual([47, 106, 168]) // #2f6aa8, marinho clareado para o fundo escuro
    expect(globalEscuro['primary-text']).toBe('213.5 62.2% 67.8%') // #7aa7e0
  })
  it('nenhum #1d68c4 fixo nas telas do produtor (só o ingresso, que é outro visual)', () => {
    const achados: string[] = []
    const varre = (dir: string) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) varre(p); else if (/\.tsx?$/.test(n) && /1d68c4/i.test(readFileSync(p, 'utf8'))) achados.push(p.replace(/.*src\//, '')) } }
    varre(resolve(__dirname, '../pages/producer')); varre(resolve(__dirname, '../components/producer'))
    expect(achados.filter(a => !a.endsWith('IngressoVisual.tsx'))).toEqual([])
  })
})
