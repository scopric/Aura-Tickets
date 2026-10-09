import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../contexts/ThemeContext'
import BlocoOrganizador from '../components/BlocoOrganizador'
import EventoConteudo from '../components/EventoConteudo'
import { iconeDaRede } from '../components/iconesRedes'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) } }))

const REL = 'noopener noreferrer nofollow'
const UUID = 'ae8b2db2-27df-4187-974d-154244d0b5ea'
const base = {
  nome: 'Bora Dançar', razao_social: 'Bora LTDA', cnpj: '11222333000181', whatsapp: '5541999999999', instagram: 'bora.danca',
  site: 'https://www.bora.com.br', email: 'oi@bora.com.br',
  outras_redes: [{ rotulo: 'TikTok', url: 'https://www.tiktok.com/@bora' }, { rotulo: 'Blog', url: 'https://blog.exemplo.com.br' }],
}
const montar = (o: object, titulo = 'X') => render(<MemoryRouter><BlocoOrganizador fino titulo={titulo} organizador={o} /></MemoryRouter>)

describe('iconeDaRede: a rede sai do hostname exato', () => {
  it('hosts legítimos ganham o ícone da marca', () => {
    const casos: [string, string][] = [
      ['https://tiktok.com/@a', 'tiktok'], ['https://www.tiktok.com/@a', 'tiktok'], ['https://m.youtube.com/x', 'youtube'], ['https://youtu.be/x', 'youtube'],
      ['https://open.spotify.com/user/x', 'spotify'], ['https://www.facebook.com/x', 'facebook'], ['https://fb.com/x', 'facebook'],
      ['https://x.com/x', 'x'], ['https://twitter.com/x', 'x'], ['https://instagram.com/x', 'instagram'],
    ]
    for (const [url, rede] of casos) expect(iconeDaRede(url)?.rede, url).toBe(rede)
  })
  it('armadilhas não ganham: evil-tiktok.com, tiktok.com.evil.io, punycode, javascript:, texto solto', () => {
    for (const url of ['https://evil-tiktok.com/a', 'https://tiktok.com.evil.io/a', 'https://xn--tiktok-9ya.com/a', 'https://www.xn--yutube-2ya.com', 'javascript:alert(1)', 'tiktok.com', 'https://blog.exemplo.com.br', 'https://nottiktok.com'])
      expect(iconeDaRede(url), url).toBeNull()
  })
})

describe('organizador: contato escondido até o clique', () => {
  it('antes do clique não há wa.me nem mailto no DOM; depois há, com rel certo e foco no primeiro item', () => {
    const { container } = montar(base)
    expect(container.innerHTML).not.toMatch(/wa\.me|mailto:/)
    const botao = screen.getByRole('button', { name: 'Mostrar contato' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(botao)
    expect(screen.queryByRole('button', { name: 'Mostrar contato' })).toBeNull()
    const wa = screen.getByRole('link', { name: 'Falar no WhatsApp (abre em nova aba)' })
    expect(wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5541999999999\?text=/)
    expect(wa).toHaveAttribute('rel', REL)
    expect(wa).toHaveFocus()
    expect(screen.getByRole('link', { name: 'oi@bora.com.br' })).toHaveAttribute('href', 'mailto:oi@bora.com.br')
  })
  it('só e-mail: o e-mail recebe o foco; sem WhatsApp nem e-mail não há botão', () => {
    const { unmount } = montar({ nome: 'Bora', email: 'oi@bora.com.br' })
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contato' }))
    expect(screen.getByRole('link', { name: 'oi@bora.com.br' })).toHaveFocus()
    unmount()
    for (const o of [{ nome: 'Bora' }, { nome: 'Bora', whatsapp: '41999', email: 'x@y.com?bcc=z' }]) {
      const r = montar(o)
      expect(screen.queryByRole('button', { name: 'Mostrar contato' })).toBeNull()
      r.unmount()
    }
  })
})

describe('organizador: canais e redes', () => {
  it('Instagram, Site e redes reconhecidas viram botões-ícone; rede desconhecida vira texto com rel certo', () => {
    montar(base)
    for (const n of ['Instagram (abre em nova aba)', 'Site (abre em nova aba)', 'TikTok (abre em nova aba)']) {
      const a = screen.getByRole('link', { name: n })
      expect(a).toHaveAttribute('rel', REL); expect(a).toHaveAttribute('target', '_blank')
      expect(a.querySelector('svg')).not.toBeNull()
    }
    const blog = screen.getByRole('link', { name: /Blog/ })
    expect(blog.querySelector('svg')).not.toBeNull() // só a setinha
    expect(blog).toHaveAttribute('title', 'blog.exemplo.com.br')
    expect(blog).toHaveAttribute('rel', REL)
  })
  it('javascript:, punycode, marca da plataforma e Instagram ruim continuam rejeitados', () => {
    montar({ nome: 'Bora', instagram: 'a b', site: 'javascript:alert(1)', outras_redes: [
      { rotulo: 'Ruim', url: 'javascript:alert(1)' }, { rotulo: 'Xn', url: 'https://xn--e1afmkfd.com' }, { rotulo: 'Marca', url: 'https://evokaa.com.br/x' }, { rotulo: 'Boa', url: 'https://www.tiktok.com/@b' }] })
    expect(screen.getAllByRole('link').map((l) => l.getAttribute('aria-label'))).toEqual(['TikTok (abre em nova aba)'])
  })
})

describe('organizador: números, bio e outros eventos', () => {
  it('números inválidos somem; válidos aparecem', () => {
    const { unmount } = montar({ ...base, eventos_realizados: 184, desde: 2023 })
    expect(screen.getByText('184')).toBeInTheDocument(); expect(screen.getByText('2023')).toBeInTheDocument()
    expect(screen.getByText('eventos realizados')).toBeInTheDocument(); expect(screen.getByText('no ar desde')).toBeInTheDocument()
    unmount()
    for (const [a, b] of [[-1, 1989], [NaN, 3000], [1e9, 2023.5], ['12', '2020'], [0, 0], [Infinity, null]]) {
      const r = montar({ ...base, eventos_realizados: a, desde: b })
      expect(screen.queryByText('eventos realizados'), String(a)).toBeNull()
      expect(screen.queryByText('no ar desde'), String(b)).toBeNull()
      r.unmount()
    }
  })
  it('bio longa é cortada em 280 caracteres e aparece como texto; Ler mais alterna aria-expanded', () => {
    montar({ ...base, bio: `<script>alert(1)</script> ${'a'.repeat(400)}` })
    const bio = document.getElementById('organizador-bio')!
    expect(Array.from(bio.textContent!).length).toBe(280)
    expect(bio.textContent).toContain('<script>')
    expect(bio.querySelector('script')).toBeNull()
    const lerMais = screen.getByRole('button', { name: 'Ler mais' })
    expect(lerMais).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(lerMais)
    expect(screen.getByRole('button', { name: 'Ler menos' })).toHaveAttribute('aria-expanded', 'true')
  })
  it('outros eventos: no máximo 3, id inválido descartado, link para /event/<id>, capa http: não vira imagem', () => {
    const ev = (id: string, extra = {}) => ({ id, title: `Evento ${id.slice(0, 2)}`, date: '2026-11-07', time: '21:00:00', ...extra })
    const { container } = montar({ ...base, outros_eventos: [
      ev('nao-e-uuid'), ev(UUID, { cover_image: 'http://x.com/a.jpg' }), ev('11111111-1111-1111-1111-111111111111'), ev('22222222-2222-2222-2222-222222222222'), ev('33333333-3333-3333-3333-333333333333'),
    ] })
    const links = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/event/'))
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAttribute('href', `/event/${UUID}`)
    expect(container.querySelector('img')).toBeNull()
    expect(links[0].textContent).toMatch(/sáb|sab/i)
  })
  it('sem os campos novos (produção hoje) não há faixa, bio nem lista', () => {
    const { container } = montar(base)
    expect(container.querySelector('dl')).toBeNull()
    expect(container.querySelector('#organizador-bio')).toBeNull()
    expect(screen.queryByText('Outros eventos')).toBeNull()
  })
})

describe('organizador na página', () => {
  const evento = () => ({ id: UUID, title: 'Noite', date: '2026-12-12', time: '22:00:00', venue_name: 'Clube', description: 'Texto sobre.', gallery: ['https://x.com/a.jpg'], cover_image: null, accent_color: '#a55c65', visibility: 'public', ticket_types: [] }) as never
  beforeEach(() => { window.scrollTo = vi.fn() as unknown as typeof window.scrollTo })
  it('fecha a coluna: depois de Sobre e Galeria e antes de Aparência; com previa nada novo', async () => {
    const fonte = readFileSync(resolve(__dirname, '../components/EventoConteudo.tsx'), 'utf8')
    const i = (t: string) => fonte.indexOf(t)
    expect(i('id="h-sobre"')).toBeLessThan(i('<Atracoes'))
    expect(i('<Atracoes')).toBeLessThan(i('id="h-galeria"'))
    expect(i('id="h-galeria"')).toBeLessThan(i('titulo={event.title} fino />'))
    expect(i('titulo={event.title} fino />')).toBeLessThan(i('id="h-aparencia"'))
    const q = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(<QueryClientProvider client={q}><MemoryRouter><ThemeProvider><EventoConteudo evento={evento()} previa="moldura" /></ThemeProvider></MemoryRouter></QueryClientProvider>)
    expect(container.querySelector('.evv-mono, dl')).toBeNull()
  })
})
