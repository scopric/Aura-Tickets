import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
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
  it('contenção: o CSS não tem foil, brilho, carimbo, picote da capa, papéis, mapa desenhado nem rótulo mono', () => {
    const css = readFileSync(resolve(__dirname, '../components/EventoVitrine.css'), 'utf8')
    for (const palavra of ['foil', 'evv-luz', 'carimbo', 'picote', 'evv-mapa', 'evv-pino', 'evv-mono', 'evv-lav', 'evv-gr ', 'color-dodge']) expect(css, palavra).not.toContain(palavra)
    expect(css).not.toMatch(/\.evv-capa-obj::(before|after)/)
  })

  it('títulos de seção e rótulos de linha sem caixa-alta; "Ingressos" é o título normal, sem número de série', () => {
    const { container } = montar(evento({ description: 'Texto', gallery: ['https://x.com/a.jpg'] }))
    for (const id of ['h-ingressos', 'h-sobre', 'h-galeria', 'h-politica']) {
      const h = container.querySelector(`#${id}`)!
      expect(h, id).not.toBeNull()
      expect(h.className, id).not.toMatch(/uppercase|tracking|mono/)
    }
    expect(screen.getByRole('heading', { level: 2, name: 'Ingressos' })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Nº AE8B2D/i)
    expect(container.querySelector('.uppercase')).toBeNull()
  })

  it('"Vendas até" só com sale_end válido e futuro; "Entenda a taxa" abre a Drawer da taxa', () => {
    const futuro = new Date(Date.now() + 10 * 86_400_000).toISOString()
    const ing = (id: string, o: object) => ({ id, name: `Lote ${id}`, price: 25, type: 'individual', sold: 0, perks: [], ...o })
    montar(evento({ ticket_types: [ing('a', { sale_end: futuro }), ing('b', {}), ing('c', { sale_end: 'lixo' }), ing('d', { sale_end: '2020-01-01T00:00:00Z' })] }))
    const textos = screen.getAllByText(/^Vendas até /).map((e) => e.textContent)
    expect(textos).toEqual([`Vendas até ${new Date(futuro).toLocaleDateString('pt-BR')}`])
    fireEvent.click(screen.getByRole('button', { name: 'Entenda a taxa' }))
    expect(screen.getByText('Taxa de serviço')).toBeInTheDocument()
  })

  it('política: só frases dos Termos (seções 4 e 5) e o link para /termos', () => {
    const { container } = montar(evento())
    const termos = readFileSync(resolve(__dirname, '../pages/Terms.tsx'), 'utf8')
    const sec = container.querySelector('#h-politica')!.parentElement!
    for (const p of sec.querySelectorAll('p')) expect(termos, p.textContent!).toContain(p.textContent!)
    expect(screen.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos')
  })

  it('modo previa não ganha nada novo (canhoto, política, atrações, selo, mapa, Entenda a taxa)', () => {
    const { container } = montar(evento(), 'moldura')
    for (const c of ['.evv-canhoto', '.evv-bilhete-in', '#h-politica', '#h-atracoes', '.evv-selo']) expect(container.querySelector(c), c).toBeNull()
    expect(screen.queryByRole('button', { name: 'Abrir no mapa' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Entenda a taxa' })).toBeNull()
  })

  it('canhoto mostra o total do carrinho sem a palavra ingresso nem um segundo botão de compra', () => {
    const { container } = montar(evento())
    const canhoto = container.querySelector('.evv-canhoto')!
    expect(canhoto.textContent).not.toMatch(/ingresso|A partir de/i)
    expect(canhoto.querySelector('button')).toBeNull()
  })

  it('a inclinação só age com mouse e sem reduzir movimento', () => {
    const mover = () => {
      const { container, unmount } = render(<CapaInclinada><i /></CapaInclinada>)
      const fora = container.firstElementChild as HTMLElement
      vi.spyOn(fora, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect)
      act(() => { fora.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 50, clientY: 50 })) })
      const obj = fora.firstElementChild as HTMLElement
      const r = [obj.hasAttribute('data-inclina'), obj.style.getPropertyValue('--ry')]
      unmount()
      return r
    }
    const media = (reduzir: boolean, mouse: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') ? reduzir : q.includes('hover') ? mouse : false }))
    media(false, true); expect(mover()).toEqual([true, '0deg'])
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
