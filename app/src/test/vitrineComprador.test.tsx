import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ThemeProvider } from '../contexts/ThemeContext'
import EventoConteudo from '../components/EventoConteudo'

// Blocos de comprador da vitrine: Vendas até, Entenda a taxa e Política do evento
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) } }))

const evento = (o: Record<string, unknown> = {}) => ({
  id: 'ae8b2db2-27df-4187-974d-154244d0b5ea', title: 'Noite', date: '2026-12-12', time: '22:00:00', venue_name: 'Clube', venue_city: 'Curitiba',
  cover_image: null, accent_color: '#a55c65', visibility: 'public', ticket_types: [], ...o,
}) as never
const ing = (id: string, o: object = {}) => ({ id, name: `Lote ${id}`, price: 25, type: 'individual', sold: 0, perks: [], ...o })
const montar = (e: never, previa?: 'moldura') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><ThemeProvider><EventoConteudo evento={e} previa={previa} /></ThemeProvider></MemoryRouter>
  </QueryClientProvider>,
)
beforeEach(() => { window.scrollTo = vi.fn() as unknown as typeof window.scrollTo })

describe('vitrine: blocos de comprador', () => {
  it('"Vendas até" só com sale_end válido e futuro; "Entenda a taxa" abre a Drawer da taxa', () => {
    const futuro = new Date(Date.now() + 10 * 86_400_000).toISOString()
    montar(evento({ ticket_types: [ing('a', { sale_end: futuro }), ing('b'), ing('c', { sale_end: 'lixo' }), ing('d', { sale_end: '2020-01-01T00:00:00Z' })] }))
    expect(screen.getAllByText(/^Vendas até /).map((e) => e.textContent)).toEqual([`Vendas até ${new Date(futuro).toLocaleDateString('pt-BR')}`])
    fireEvent.click(screen.getByRole('button', { name: 'Entenda a taxa' }))
    expect(screen.getByText('Taxa de serviço')).toBeInTheDocument()
  })

  it('"Entenda a taxa" não aparece quando só há lote gratuito', () => {
    montar(evento({ ticket_types: [ing('g', { price: 0 })] }))
    expect(screen.queryByRole('button', { name: 'Entenda a taxa' })).toBeNull()
  })

  it('política: só frases dos Termos e o link para /termos', () => {
    const { container } = montar(evento())
    const termos = readFileSync(resolve(__dirname, '../pages/Terms.tsx'), 'utf8')
    const sec = container.querySelector('#h-politica')!.parentElement!
    for (const p of sec.querySelectorAll('p')) expect(termos, p.textContent!).toContain(p.textContent!)
    expect(screen.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos')
  })

  it('modo previa não ganha os blocos', () => {
    const { container } = montar(evento({ ticket_types: [ing('a', { sale_end: new Date(Date.now() + 864e5).toISOString() })] }), 'moldura')
    expect(container.querySelector('#h-politica')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Entenda a taxa' })).toBeNull()
    expect(screen.queryByText(/^Vendas até /)).toBeNull()
  })
})
