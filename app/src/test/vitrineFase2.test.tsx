import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { ThemeProvider } from '../contexts/ThemeContext'
import EventoConteudo from '../components/EventoConteudo'
import MapaEvento from '../components/MapaEvento'
import Atracoes from '../components/Atracoes'
import SeloClassificacao from '../components/SeloClassificacao'
import BlocoOrganizador from '../components/BlocoOrganizador'
import { coordenadasValidas, ehApple, linksDeMapa, pecasDoMapa } from '../lib/mapaEvento'

vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) } }))

const CWB = { lat: -25.4310044, lng: -49.2484121 }

describe('mapa: contas e links', () => {
  it('pecasDoMapa: valores conhecidos', () => {
    const o = pecasDoMapa(0, 0, 1)
    expect([o.x0, o.y0, o.fx, o.fy]).toEqual([1, 1, 0, 0])
    const c = pecasDoMapa(CWB.lat, CWB.lng, 15) // conta feita à parte: xt 11901,3001 e yt 18778,7632
    expect([c.x0, c.y0]).toEqual([11901, 18778])
    expect(c.fx).toBeCloseTo(0.3001, 3)
    expect(c.fy).toBeCloseTo(0.7632, 3)
    expect(c.pecas).toHaveLength(6)
    expect(c.pecas[0].url).toBe('https://tile.openstreetmap.org/15/11900/18778.png')
    expect(c.pinoX).toBeCloseTo(332.9, 0)
    expect(c.pinoY).toBeCloseTo(195.4, 0)
  })

  it('coordenadasValidas: texto numérico passa; vazio, null, NaN e fora da faixa não', () => {
    expect(coordenadasValidas('-25.43', '-49.24')).toEqual({ lat: -25.43, lng: -49.24 })
    for (const [a, b] of [['', ''], [null, null], [NaN, 1], ['x', '1'], [91, 0], [0, 181], [undefined, 3]]) expect(coordenadasValidas(a, b)).toBeNull()
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
  const props = { nome: 'Clube Morgenau', endereco: 'Av. Senador Souza Naves 945 · Curitiba', consulta: 'Clube Morgenau, Curitiba', mapaUrl: 'https://g/x' }
  afterEach(() => vi.restoreAllMocks())

  it('coordenadas válidas (mesmo como texto): 6 peças e a atribuição OSM com link seguro', () => {
    const { container } = render(<MapaEvento {...props} lat="-25.4310044" lng="-49.2484121" />)
    expect(container.querySelectorAll('img')).toHaveLength(6)
    const osm = screen.getByRole('link', { name: /OpenStreetMap/ })
    expect(osm).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
    expect(osm).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('coordenada inválida ou ausente: cartão estilizado, sem peças e sem atribuição; sem endereço: nada', () => {
    for (const [lat, lng] of [[null, null], ['', ''], [NaN, 5], [95, 5]]) {
      const { container, unmount } = render(<MapaEvento {...props} lat={lat} lng={lng} />)
      expect(container.querySelectorAll('img')).toHaveLength(0)
      expect(container.querySelector('.evv-mapa-grade')).not.toBeNull()
      expect(screen.queryByRole('link', { name: /OpenStreetMap/ })).toBeNull()
      unmount()
    }
    const { container } = render(<MapaEvento {...props} endereco="" />)
    expect(container.firstChild).toBeNull()
  })

  it('folha: abre, mostra os 3 apps (Apple primeiro no iPhone), Esc fecha e o foco volta ao cartão', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    render(<MapaEvento {...props} lat={CWB.lat} lng={CWB.lng} />)
    const cartao = screen.getByRole('button', { name: /Escolher aplicativo de mapa/ })
    fireEvent.click(cartao)
    const links = await screen.findAllByRole('link', { name: /Google Maps|Waze|Apple Mapas/ })
    expect(links.map((l) => l.textContent?.replace(' (abre em nova aba)', ''))).toEqual(['Apple Mapas', 'Google Maps', 'Waze'])
    for (const l of links) { expect(l).toHaveAttribute('target', '_blank'); expect(l).toHaveAttribute('rel', 'noopener noreferrer') }
    const dialogo = screen.getByRole('dialog')
    expect(dialogo).toHaveAttribute('data-state', 'open')
    fireEvent.keyDown(dialogo, { key: 'Escape', code: 'Escape' })
    // o Vaul espera a animação de saída para desmontar (o jsdom não a dispara): vale o estado "closed"
    await waitFor(() => expect(dialogo).toHaveAttribute('data-state', 'closed'))
    await waitFor(() => expect(cartao).toHaveFocus())
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

describe('SeloClassificacao e página', () => {
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

  it('selo é aria-hidden e o texto da classificação segue inteiro num elemento', () => {
    const { container } = montar(evento({ classificacao: 'A18' }))
    expect(screen.getByText('Classificação: 18 anos')).toBeInTheDocument()
    const selo = container.querySelector('.evv-selo')!
    expect(selo.getAttribute('aria-hidden')).toBe('true')
    expect(selo.textContent).toBe('18')
  })

  it('sem classificação não há selo; faixa livre mostra L', () => {
    expect(render(<SeloClassificacao valor={null} />).container.firstChild).toBeNull()
    expect(render(<SeloClassificacao valor="AL" />).container.querySelector('.evv-selo')?.textContent).toBe('L')
    const { container } = montar(evento())
    expect(container.querySelector('.evv-selo')).toBeNull()
  })

  it('com previa nada novo aparece (mapa, selo, atrações)', () => {
    const { container } = montar(evento({ classificacao: 'A18' }), 'moldura')
    expect(container.querySelector('.evv-selo, .evv-mapa, #h-atracoes')).toBeNull()
  })

  it('na página, com endereço, o cartão do mapa aparece e o link "Como chegar" da linha Local continua', () => {
    montar(evento())
    expect(screen.getByRole('button', { name: /Escolher aplicativo de mapa/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Como chegar: Clube/ })).toBeInTheDocument()
  })
})

describe('organizador completo', () => {
  it('todos os links presentes com rel certo', () => {
    render(<BlocoOrganizador fino titulo="X" organizador={{
      nome: 'Bora Dançar', razao_social: 'Bora LTDA', cnpj: '11222333000181', whatsapp: '5541999999999', instagram: 'bora.danca',
      site: 'https://www.bora.com.br', email: 'oi@bora.com.br', outras_redes: [{ rotulo: 'TikTok', url: 'https://www.tiktok.com/@bora' }],
    }} />)
    for (const n of [/WhatsApp/, /Instagram/, /Site/, /TikTok/]) expect(screen.getByRole('link', { name: n })).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    expect(screen.getByRole('link', { name: /E-mail/ })).toHaveAttribute('href', 'mailto:oi@bora.com.br')
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
