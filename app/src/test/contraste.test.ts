import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Contraste WCAG 2.x dos pares texto/fundo do contrato v3.4 (§2.1 e §2.8.2), com os valores REAIS do index.css
const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8')

function bloco(re: RegExp) {
  const corpo = css.match(re)?.[1]
  if (!corpo) throw new Error(`bloco não encontrado: ${re}`)
  return Object.fromEntries([...corpo.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))
}
const claro = bloco(/\n {2}:root, \.light \{([\s\S]*?)\n {2}\}/)
// o .dark só redefine o que muda; o resto vem do :root
const escuro = { ...claro, ...bloco(/\n {2}\.dark \{([\s\S]*?)\n {2}\}/) }

function rgb(valor: string): number[] {
  const hex = valor.match(/^#([0-9a-f]{6})$/i)
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16))
  const hsl = valor.match(/^([\d.]+) ([\d.]+)% ([\d.]+)%$/)
  if (!hsl) throw new Error(`não é cor opaca: "${valor}"`)
  const [h, s, l] = [+hsl[1], +hsl[2] / 100, +hsl[3] / 100]
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) }
  return [f(0), f(8), f(4)]
}
const luz = (c: number[]) => {
  const [r, g, b] = c.map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const razao = (a: string, b: string) => {
  const [l1, l2] = [luz(rgb(a)), luz(rgb(b))].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// [texto, fundo, mínimo]: 4,5 para texto (WCAG 1.4.3); 3 para borda de campo e foco (WCAG 1.4.11)
const PARES: [string, string, number][] = [
  ['foreground', 'background', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'muted', 4.5],          // rótulo sobre superfície 2
  ['muted-foreground', 'card', 4.5],
  ['primary-foreground', 'primary', 4.5],      // branco no azul da marca
  ['card-foreground', 'card', 4.5],
  ['popover-foreground', 'popover', 4.5],
  ['secondary-foreground', 'secondary', 4.5],
  ['accent-foreground', 'accent', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  ['ev-warm-text', 'background', 4.5],
  ['primary-text', 'background', 4.5],          // classe text-primary
  ['primary-text', 'card', 4.5],
  ['primary-text', 'secondary', 4.5],
  ['destructive-text', 'background', 4.5],      // classe text-destructive
  ['destructive-text', 'card', 4.5],
  ['destructive-text', 'secondary', 4.5],
  ['ev-success', 'background', 4.5],
  ['ev-warning', 'background', 4.5],
  ['input', 'background', 3],                  // borda de campo
  ['input', 'secondary', 3],
  ['ring', 'background', 3],                   // anel de foco
]

describe.each([['claro', claro], ['escuro', escuro]] as const)('contraste no tema %s', (_, tokens) => {
  it.each(PARES)('%s sobre %s >= %s:1', (texto, fundo, minimo) => {
    expect(tokens[texto], `--${texto}`).toBeDefined()
    expect(tokens[fundo], `--${fundo}`).toBeDefined()
    expect(razao(tokens[texto], tokens[fundo])).toBeGreaterThanOrEqual(minimo)
  })

  it('tokens do shadcn são trio HSL opaco (sem alfa, sem hsl())', () => {
    const shadcn = ['background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary',
      'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent',
      'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring']
    for (const t of shadcn) expect(tokens[t], `--${t}`).toMatch(/^[\d.]+ [\d.]+% [\d.]+%$/)
  })
})

describe('valores do contrato §2.1', () => {
  // conferência da conversão hex -> HSL feita à mão no index.css
  it.each([
    [claro, 'background', '#ffffff'], [claro, 'foreground', '#0b0d12'], [claro, 'muted-foreground', '#5b6472'],
    [claro, 'secondary', '#f4f5f7'], [claro, 'border', '#e3e6ea'], [claro, 'input', '#838c9a'],
    [claro, 'primary', '#1d68c4'], [claro, 'destructive', '#c8322b'],
    [escuro, 'background', '#0b0d12'], [escuro, 'foreground', '#e6e8ec'], [escuro, 'card', '#14171d'],
    [escuro, 'secondary', '#1b1f27'], [escuro, 'muted-foreground', '#9aa1ad'], [escuro, 'input', '#646d7b'],
    [escuro, 'border', '#1f2025'], // branco 8% sobre #0b0d12
  ])('%#: --%s = %s', (tokens, nome, hex) => {
    const [r, g, b] = rgb(tokens[nome]).map(Math.round)
    expect('#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')).toBe(hex)
  })
})
