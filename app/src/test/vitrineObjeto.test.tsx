import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../contexts/ThemeContext'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import EventoConteudo from '../components/EventoConteudo'

// Vitrine chapada (estilo Sympla/DICE): sem foil, carimbo, pilha de papéis, picote ou inclinação; data só uma vez; compra num botão só
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

describe('vitrine chapada', () => {
  it('não há mais foil, carimbo, picote, canhoto, série nem rótulo mono no DOM', () => {
    const { container } = montar(evento())
    for (const c of ['.evv-carimbo', '.evv-foil', '.evv-luz', '.evv-picote', '.evv-canhoto', '.evv-capa-obj', '.evv-gr', '.evv-mono', '.evv-selo', '.evv-mapa']) expect(container.querySelector(c), c).toBeNull()
    expect(container.textContent).not.toMatch(/Nº AE8B2D/)
  })

  it('a data aparece uma vez só: no topo, junto da hora, e não há linha "Data" nas informações', () => {
    const { container } = montar(evento())
    expect(screen.getByText(/Sexta-feira, 16 de outubro · 22h/)).toBeInTheDocument()
    const rotulos = [...container.querySelectorAll('span.uppercase')].map((e) => e.textContent)
    expect(rotulos).toEqual(expect.arrayContaining(['Horário', 'Local', 'Faixa etária']))
    expect(rotulos).not.toContain('Data')
    expect(container.textContent!.match(/16 de outubro/g)).toHaveLength(1)
  })

  it('a linha de data do topo usa a cor do evento (--evento-texto, já com 4,5:1 nos dois temas)', () => {
    montar(evento())
    expect(screen.getByText(/16 de outubro/).className).toContain('text-[var(--evento-texto)]')
  })

  it('a faixa etária é só texto (sem selo) e o local tem a pílula "Abrir no mapa"', () => {
    const { container } = montar(evento({ classificacao: 'A18' }))
    expect(screen.getByText('Classificação: 18 anos')).toBeInTheDocument()
    expect(container.querySelector('svg.evv-selo')).toBeNull()
    expect(screen.getByRole('button', { name: /Escolher aplicativo de mapa para Clube Morgenau/ })).toHaveTextContent('Abrir no mapa')
  })

  it('modo previa não ganha o desenho novo (sem topo largo, sem pílula do mapa, sem rodapé do cartão)', () => {
    const { container } = montar(evento(), 'moldura')
    for (const c of ['.evv-compra', '.evv-bilhete-in', '.evv-lista']) expect(container.querySelector(c), c).toBeNull()
    expect(screen.queryByRole('button', { name: /aplicativo de mapa/ })).toBeNull()
  })

  it('um único botão de compra, dentro do cartão de ingressos, sem o texto "ingresso" duplicado em outro total', () => {
    const { container } = montar(evento())
    expect(screen.getAllByRole('button', { name: 'Comprar' })).toHaveLength(1)
    expect(container.querySelector('#ingressos .evv-compra')).not.toBeNull()
  })

  it('o recuo da lista de ingressos fica na área que rola (>= 8 px) e não há rolagem horizontal', () => {
    const css = readFileSync(resolve(__dirname, '../components/EventoVitrine.css'), 'utf8')
    const regra = css.match(/\.evv-lista \{([^}]*)\}/)![1]
    expect(+regra.match(/padding-inline:\s*(\d+)px/)![1]).toBeGreaterThanOrEqual(8)
    expect(regra).not.toMatch(/overflow-x:\s*auto/)
    expect(regra).toMatch(/overflow-x:\s*hidden/)
  })

  it('o CSS não guarda mais nenhum efeito (foil, carimbo, grão, picote, mask, drop-shadow)', () => {
    const css = readFileSync(resolve(__dirname, '../components/EventoVitrine.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toMatch(/foil|carimbo|picote|evv-gr|mask|drop-shadow|conic-gradient|mix-blend|rotate\(/)
  })
})
