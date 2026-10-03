import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import * as Familia from '../components/icones/evokaa16'
import type { IconeEvokaa } from '../components/icones/evokaa16'

const icones = Object.entries(Familia) as [string, IconeEvokaa][]

describe('Evokaa 16', () => {
  it('exporta os 192 ícones, com nomes únicos', () => {
    expect(icones).toHaveLength(192)
    expect(new Set(icones.map(([, I]) => I.displayName)).size).toBe(192)
  })

  it.each(icones)('%s renderiza um <svg> viewBox 16, 24 px, oculto por padrão', (_, Icone) => {
    const { container } = render(<Icone />)
    const svg = container.querySelector('svg')!
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('viewBox')).toBe('0 0 16 16')
    expect(svg.getAttribute('width')).toBe('24')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('role')).toBeNull()
    expect(svg.getAttribute('fill')).toBe('none')
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0)
  })

  it('aria-labelledby também dá nome ao ícone', () => {
    const svg = render(<Familia.Buscar aria-labelledby="x" />).container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-hidden')).toBeNull()
  })

  it('aria-label vira role="img" e tira o aria-hidden', () => {
    const { getByRole } = render(<Familia.Buscar aria-label="Buscar" />)
    const svg = getByRole('img', { name: 'Buscar' })
    expect(svg.getAttribute('aria-hidden')).toBeNull()
  })

  it('size, className e strokeWidth: size vale, className passa, traço é fixo', () => {
    const { container } = render(<Familia.Buscar size={16} className="size-4" strokeWidth={4} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('16')
    expect(svg.getAttribute('class')).toBe('size-4')
    expect(svg.getAttribute('stroke-width')).toBe('1.5')
  })

  it('ativo liga a camada tint (só nos ícones que a têm)', () => {
    const tint = (ativo: boolean) =>
      render(<Familia.Ajuda ativo={ativo} />).container.querySelector<SVGPathElement>('[data-camada="tint"]')
    // sem ativo, a camada fica apagada e o pai acende por --ek-tint
    expect(tint(false)?.style.fillOpacity).toBe('var(--ek-tint, 0)')
    expect(tint(true)?.style.fillOpacity).toBe('0.28')
    // seta-esquerda não tem tint
    expect(render(<Familia.SetaEsquerda ativo />).container.querySelector('[data-camada="tint"]')).toBeNull()
  })

  it('camada half sai a 45% de opacidade', () => {
    const { container } = render(<Familia.Qr />)
    expect(container.querySelector('path[opacity="0.45"]')).not.toBeNull()
  })
})
