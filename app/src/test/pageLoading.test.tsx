import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PageLoading from '../components/PageLoading'

describe('PageLoading', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('é um status com "Carregando…" e o vídeo do Evo escondido do leitor de tela', () => {
    const { container } = render(<PageLoading />)
    expect(screen.getByRole('status').textContent).toContain('Carregando…')
    const video = container.querySelector('video') as HTMLVideoElement
    expect(video.getAttribute('aria-hidden')).toBe('true')
    expect(video.muted).toBe(true) // React não reflete muted como atributo
    expect(video.loop).toBe(true)
    expect(video.autoplay).toBe(true)
    expect(video.hasAttribute('playsinline')).toBe(true)
  })

  it('HEVC (Safari) primeiro, WebM (resto) depois', () => {
    const { container } = render(<PageLoading />)
    const [mov, webm] = Array.from(container.querySelectorAll('source'))
    expect(mov.getAttribute('src')).toBe('/evo/evo-giro-v1.mov')
    expect(mov.getAttribute('type')).toBe('video/quicktime; codecs="hvc1"')
    expect(webm.getAttribute('src')).toBe('/evo/evo-giro-v1.webm')
    expect(webm.getAttribute('type')).toBe('video/webm')
  })

  it('movimento reduzido toca a 0,5x; sem a preferência, na velocidade normal', () => {
    for (const reduce of [true, false]) {
      vi.stubGlobal('matchMedia', () => ({ matches: reduce }))
      const { container, unmount } = render(<PageLoading />)
      const video = container.querySelector('video') as HTMLVideoElement
      expect(video.playbackRate).toBe(reduce ? 0.5 : 1)
      unmount()
    }
  })
})
