import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { ThemeProvider } from '../contexts/ThemeContext'
import EventoConteudo from '../components/EventoConteudo'
import MapaEvento from '../components/MapaEvento'
import Atracoes from '../components/Atracoes'
import { coordenadasValidas, ehApple, linksDeMapa } from '../lib/mapaEvento'

vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) } }))

const CWB = { lat: -25.4310044, lng: -49.2484121 }

describe('mapa: contas e links', () => {
  it('coordenadasValidas: texto numérico passa; o resto (vazio, 0x10, 1e999, vírgula, polos, ilha nula) não', () => {
    expect(coordenadasValidas('-25.43', '-49.24')).toEqual({ lat: -25.43, lng: -49.24 })
    expect(coordenadasValidas(' 12 ', ' -3.5 ')).toEqual({ lat: 12, lng: -3.5 })
    expect(coordenadasValidas(85.05, 180)).not.toBeNull()
    for (const [a, b] of [['', ''], [null, null], [NaN, 1], ['x', '1'], [91, 0], [0, 181], [undefined, 3], [85.06, 0], [-85.06, 0], [90, 0], [-90, 0], [0, 0], ['0', '0'], ['0x10', '5'], ['1e999', '5'], ['-25,43', '-49'], [Infinity, 0]]) expect(coordenadasValidas(a, b), `${a} ${b}`).toBeNull()
  })

  it('links dos três apps, com e sem coordenadas, tudo codificado', () => {
    const consulta = 'Café & Bar #1, Rua São João 5, Curitiba'
    const com = linksDeMapa({ coords: CWB, consulta, nome: 'Café & Bar', googleSemCoord: 'https://g/x' }, false)
    expect(com.map((l) => l.id)).toEqual(['google', 'waze', 'apple'])
    expect(com[0].href).toBe('https://www.google.com/maps/search/?api=1&query=-25.431004%2C-49.248412')
    expect(com[1].href).toBe('https://waze.com/ul?ll=-25.431004%2C-49.248412&navigate=yes&zoom=17')
    expect(com[2].href).toBe('https://maps.apple.com/?ll=-25.431004%2C-49.248412&q=Caf%C3%A9%20%26%20Bar')
    const sem = linksDeMapa({ coords: null, consulta, nome: 'Café & Bar', googleSemCoord: 'https://g/x' }, true)
    expect(sem.map((l) => l.id)).toEqual(['apple', 'google', 'waze'])
    expect(sem[0].href).toBe(`https://maps.apple.com/?q=${encodeURIComponent(consulta)}`)
    expect(sem[2].href).toBe(`https://waze.com/ul?q=${encodeURIComponent(consulta)}&navigate=yes`)
    expect(sem[2].href).not.toMatch(/&Bar|#1/) // & e # do endereço não escapam
    expect(sem[1].href).toBe('https://g/x')
  })

  it('plataforma: iPhone, iPad e Mac são Apple; Android, Windows e sem navigator não', () => {
    expect(ehApple('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true)
    expect(ehApple('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(true)
    expect(ehApple('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(false)
    expect(ehApple('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false)
    expect(ehApple('')).toBe(false)
  })
})

describe('MapaEvento', () => {
  const props = { nome: 'Clube Morgenau', consulta: 'Clube Morgenau, Curitiba', mapaUrl: 'https://g/x' }
  afterEach(() => vi.restoreAllMocks())

  it('é só a pílula "Abrir no mapa": sem peças do OpenStreetMap, sem imagem e sem atribuição', () => {
    const { container } = render(<MapaEvento {...props} lat={CWB.lat} lng={CWB.lng} />)
    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(screen.queryByRole('link', { name: /OpenStreetMap/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Escolher aplicativo de mapa para Clube Morgenau/ })).toHaveTextContent('Abrir no mapa')
  })

  it('folha: abre, mostra os 3 apps (Apple primeiro no iPhone), Esc fecha e o foco volta à pílula', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    render(<MapaEvento {...props} lat={CWB.lat} lng={CWB.lng} />)
    const pilula = screen.getByRole('button', { name: /Escolher aplicativo de mapa/ })
    fireEvent.click(pilula)
    const links = await screen.findAllByRole('link', { name: /Google Maps|Waze|Apple Mapas/ })
    expect(links.map((l) => l.textContent?.replace(' (abre em nova aba)', ''))).toEqual(['Apple Mapas', 'Google Maps', 'Waze'])
    for (const l of links) { expect(l).toHaveAttribute('target', '_blank'); expect(l).toHaveAttribute('rel', 'noopener noreferrer') }
    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveAttribute('data-state', 'open')
    fireEvent.keyDown(dialogo, { key: 'Escape', code: 'Escape' })
    // o Vaul espera a animação de saída para desmontar (o jsdom não a dispara): vale o estado "closed"
    await waitFor(() => expect(dialogo).toHaveAttribute('data-state', 'closed'))
    await waitFor(() => expect(pilula).toHaveFocus())
  })

  it('no Android o Google vem primeiro', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14; Pixel 8)')
    render(<MapaEvento {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Escolher aplicativo de mapa/ }))
    const links = await screen.findAllByRole('link', { name: /Google Maps|Waze|Apple Mapas/ })
    expect(links[0].textContent).toMatch(/Google Maps/)
  })
})

describe('Atracoes', () => {
  it('escondida quando vazia; no máximo 12', () => {
    const { container, unmount } = render(<Atracoes atracoes={[]} />)
    expect(container.firstChild).toBeNull()
    unmount()
    const muitas = Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, nome: `Atração ${i}` }))
    render(<Atracoes atracoes={muitas} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(12)
  })

  it('lista simples: foto redonda de 40 px ou monograma, nome e Instagram, sem carrossel', () => {
    const { container } = render(<Atracoes atracoes={[{ id: '1', nome: 'Maria Sanfoneira' }, { id: '2', nome: 'Trio', foto: 'https://x.com/c.jpg' }]} />)
    expect(screen.getByRole('list', { name: 'Lista de atrações' }).tagName).toBe('UL')
    expect(container.querySelector('.evv-monograma')?.textContent).toBe('MS')
    expect(container.querySelector('img')?.className).toMatch(/size-10.*rounded-full/)
    expect(container.querySelector('.snap-x, [tabindex]')).toBeNull()
  })

  it('Instagram inválido não vira link; válido vira, com rel certo', () => {
    const ruins = ['com espaço', 'a/b', '<x>', 'a'.repeat(31), '']
    render(<Atracoes atracoes={[...ruins.map((instagram, i) => ({ id: `r${i}`, nome: `Ruim ${i}`, instagram })), { id: 'ok', nome: 'Boa', instagram: 'trio.forro' }]} />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://instagram.com/trio.forro')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer nofollow')
  })

  it('nome com HTML aparece como texto; foto http: ou javascript: é rejeitada; https: aceita', () => {
    const { container } = render(<Atracoes atracoes={[
      { id: '1', nome: '<script>alert(1)</script>', foto: 'http://x.com/a.jpg' },
      { id: '2', nome: 'B', foto: 'javascript:alert(1)' },
      { id: '3', nome: 'C', foto: 'https://x.com/c.jpg' },
    ]} />)
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    const imgs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'))
    expect(imgs).toEqual(['https://x.com/c.jpg'])
  })
})

describe('página', () => {
  const evento = (o: Record<string, unknown> = {}) => ({
    id: 'ae8b2db2-27df-4187-974d-154244d0b5ea', title: 'Noite', date: '2026-12-12', time: '22:00:00', venue_name: 'Clube', venue_address: 'Rua A 1', venue_city: 'Curitiba',
    cover_image: null, accent_color: '#a55c65', visibility: 'public', ticket_types: [], ...o,
  }) as never
  const montar = (e: never, previa?: 'moldura') => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><ThemeProvider><EventoConteudo evento={e} previa={previa} /></ThemeProvider></MemoryRouter>
    </QueryClientProvider>,
  )
  beforeEach(() => { window.scrollTo = vi.fn() as unknown as typeof window.scrollTo })

  it('faixa etária é só o texto, inteiro num elemento', () => {
    montar(evento({ classificacao: 'A18' }))
    expect(screen.getByText('Classificação: 18 anos')).toBeInTheDocument()
  })

  it('a área de compra nunca é escondida pela entrada ao rolar', () => {
    const { container } = montar(evento())
    expect(container.querySelector('#ingressos')?.hasAttribute('data-entra')).toBe(false)
    expect(container.querySelector('[data-entra] #ingressos, [data-entra] .evv-compra')).toBeNull()
  })

  it('com previa nada novo aparece (pílula do mapa, atrações)', () => {
    const { container } = montar(evento({ classificacao: 'A18' }), 'moldura')
    expect(container.querySelector('#h-atracoes')).toBeNull()
    expect(screen.queryByRole('button', { name: /aplicativo de mapa/ })).toBeNull()
  })

  it('na página, a linha Local tem a pílula "Abrir no mapa"', () => {
    montar(evento())
    expect(screen.getByRole('button', { name: /Escolher aplicativo de mapa para Clube/ })).toBeInTheDocument()
  })
})

describe('modo demonstração', () => {
  it('só entra por import dinâmico dentro de import.meta.env.DEV e nenhum outro arquivo o importa', () => {
    const raiz = resolve(__dirname, '..')
    const fonte = readFileSync(resolve(raiz, 'components/EventoConteudo.tsx'), 'utf8')
    expect(fonte).toMatch(/if \(import\.meta\.env\.DEV[^\n]*\) \{\s*import\('\.\.\/lib\/demoVitrine'\)/)
    const acha: string[] = []
    const varre = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) varre(p); else if (/\.(tsx?|jsx?)$/.test(f) && /from ['"].*demoVitrine['"]|import\(['"].*demoVitrine['"]\)/.test(readFileSync(p, 'utf8'))) acha.push(p) } }
    varre(raiz)
    expect(acha.filter((p) => !p.endsWith('vitrineFase2.test.tsx')).map((p) => p.replace(raiz, ''))).toEqual(['/components/EventoConteudo.tsx'])
  })
})
