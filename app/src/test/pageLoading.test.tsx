import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PageLoading from '../components/PageLoading'

describe('PageLoading', () => {
  it('mostra a cabeça do Evo girando e anuncia o carregando', () => {
    const { container } = render(<PageLoading />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('/evo/evo-cabeca.webp')
    expect(img?.className).toContain('evo-girando')
  })
})
