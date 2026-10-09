import { describe, it, expect } from 'vitest'
import { contraste } from '../lib/corEvento'

// O hero usa o fundo e as cores normais da página (sem lavagem): texto e texto secundário passam de 4,5:1 nos dois
// temas. Valores do index.css (foreground, muted-foreground, background).
describe('hero do evento: contraste do texto sobre o fundo da página', () => {
  it('tema claro', () => {
    expect(contraste('#0b0d12', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contraste('#5b6472', '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
  it('tema escuro', () => {
    expect(contraste('#e6e8ec', '#0b0d12')).toBeGreaterThanOrEqual(4.5)
    expect(contraste('#9aa1ad', '#0b0d12')).toBeGreaterThanOrEqual(4.5)
  })
})
