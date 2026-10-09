import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../contexts/ThemeContext'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import EventoConteudo from '../components/EventoConteudo'
import { CapaInclinada } from '../components/EventoVitrine'

// Ingresso como objeto: carimbo com dados reais, número de série, foil e inclinação só com mouse e movimento permitido
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) } }))

const evento = (o: Record<string, unknown> = {}) => ({
  id: 'ae8b2db2-27df-4187-974d-154244d0b5ea', title: 'Noite de Forró', date: '2026-10-16', time: '22:00:00', venue_name: 'Clube Morgenau',
  venue_city: 'Curitiba', cover_image: null, accent_color: '#f2a61d', visibility: 'public',
  ticket_types: [{ id: 't1', name: 'Pista', price: 25, type: 'individual', sold: 0, perks: [] }], ...o,
}) as never

const montar = (e: never, previa?: 'moldura' | 'folha') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><ThemeProvider><EventoConteudo evento={e} previa={previa} /></ThemeProvider></MemoryRouter>
  </QueryClientProvider>,
)

beforeEach(() => { window.scrollTo = vi.fn() as unknown as typeof window.scrollTo })
afterEach(() => vi.unstubAllGlobals())

describe('vitrine: ingresso como objeto', () => {
  it('carimbo usa o local, a cidade e o dia do evento, sem texto fixo de lote ou vendas', () => {
    const { container } = montar(evento())
    const carimbo = container.querySelector('.evv-carimbo')!
    expect(carimbo.getAttribute('aria-hidden')).toBe('true')
    const t = carimbo.textContent ?? ''
    expect(t).toContain('CLUBE MORGENAU')
    expect(t).toContain('CURITIBA')
    expect(t).toContain('16')
    expect(t).toContain('OUT')
    expect(t).not.toMatch(/lote|vendas|aberta/i)
  })

  it('sem data não há carimbo', () => {
    const { container } = montar(evento({ date: null }))
    expect(container.querySelector('.evv-carimbo')).toBeNull()
  })

  it('número de série: os 6 primeiros caracteres do id, em maiúsculas, só no cabeçalho do bilhete (decorativo)', () => {
    const { container } = montar(evento())
    const serie = [...container.querySelectorAll('.evv-mono')].find(e => /AE8B2D/.test(e.textContent ?? ''))!
    expect(serie.textContent).toBe('Nº AE8B2D')
    expect(serie.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.evv-capa-in')?.textContent ?? '').not.toMatch(/AE8B2D/) // nada de série sobre a capa
    expect(screen.getByRole('heading', { level: 2, name: 'Ingressos' })).toBeInTheDocument()
  })

  it('modo previa não tem carimbo, foil, picote, canhoto nem série', () => {
    const { container } = montar(evento(), 'moldura')
    for (const c of ['.evv-carimbo', '.evv-foil', '.evv-picote', '.evv-canhoto', '.evv-bilhete-in', '.evv-mono']) expect(container.querySelector(c), c).toBeNull()
  })

  it('canhoto mostra o total do carrinho sem a palavra ingresso nem um segundo botão de compra', () => {
    const { container } = montar(evento())
    const canhoto = container.querySelector('.evv-canhoto')!
    expect(canhoto.textContent).not.toMatch(/ingresso|A partir de/i)
    expect(canhoto.querySelector('button')).toBeNull()
  })

  it('foil e inclinação só agem com mouse e sem reduzir movimento (o foil lê as variáveis do ponteiro)', () => {
    const mover = () => {
      const { container, unmount } = render(<CapaInclinada><i /></CapaInclinada>)
      const fora = container.firstElementChild as HTMLElement
      vi.spyOn(fora, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect)
      act(() => { fora.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 50, clientY: 50 })) })
      const obj = fora.firstElementChild as HTMLElement
      const r = [obj.hasAttribute('data-inclina'), obj.style.getPropertyValue('--fx')]
      unmount()
      return r
    }
    const media = (reduzir: boolean, mouse: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') ? reduzir : q.includes('hover') ? mouse : false }))
    media(false, true); expect(mover()).toEqual([true, '50'])
    media(false, false); expect(mover()).toEqual([false, ''])
    media(true, true); expect(mover()).toEqual([false, ''])
  })

  it('o recuo da lista de ingressos fica na área que rola (>= 8 px) e não há rolagem horizontal', () => {
    const css = readFileSync(resolve(__dirname, '../components/EventoVitrine.css'), 'utf8')
    const regra = css.match(/\.evv-lista \{([^}]*)\}/)![1]
    expect(+regra.match(/padding-inline:\s*(\d+)px/)![1]).toBeGreaterThanOrEqual(8)
    expect(regra).not.toMatch(/overflow-x:\s*auto/)
    expect(regra).toMatch(/overflow-x:\s*hidden/)
  })

  it('o canhoto é aria-hidden (o total já é lido na barra de compra)', () => {
    const { container } = montar(evento())
    expect(container.querySelector('.evv-canhoto')?.getAttribute('aria-hidden')).toBe('true')
  })
})
