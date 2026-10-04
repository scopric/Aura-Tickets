import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PageLoading from '../components/PageLoading'

describe('PageLoading', () => {
  it('é um status com "Carregando…" e o Evo como imagem decorativa', () => {
    const { container } = render(<PageLoading />)
    expect(screen.getByRole('status').textContent).toContain('Carregando…')
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/evo/evo-giro-v2.webp')
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('width')).toBe('96')
    expect(img.getAttribute('height')).toBe('96')
  })

  it('movimento reduzido troca para a versão lenta (4 s por volta)', () => {
    const { container } = render(<PageLoading />)
    const source = container.querySelector('picture > source') as HTMLSourceElement
    expect(source.getAttribute('media')).toBe('(prefers-reduced-motion: reduce)')
    expect(source.getAttribute('srcset')).toBe('/evo/evo-giro-v2-lento.webp')
  })
})
