import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminEvents from '../pages/admin/Events'
import { dominioDaTransmissao, hashConfere, seloIngressosAlterados } from '../lib/moderacaoEvento'

// S8: detalhe do evento na moderação. Banco simulado por tabela; a lista vem de um useAdminEvents simulado.
const TEXTO = 'Aceito os termos do evento X'
const tabelas = vi.hoisted(() => ({ privado: null as unknown, aceite: null as unknown }))
vi.mock('../lib/supabase', () => {
  const linha = (t: string) => (t === 'evento_privado' ? tabelas.privado : tabelas.aceite)
  const q = (t: string): unknown => new Proxy(() => {}, { get: (_, k) => (k === 'then' ? undefined : k === 'maybeSingle' ? () => Promise.resolve({ data: linha(t), error: null }) : () => q(t)) })
  return { supabase: { from: (t: string) => q(t), rpc: vi.fn() } }
})
const evento = {
  id: 'e1', producer_id: 'p1', title: 'Festa X', subtitle: null, slug: 'festa-x', description: 'd', status: 'published', approval_status: 'approved',
  featured_carousel: false, category: 'festa', classificacao: 'A16', temas: ['musica'], estilos: ['funk', 'rock'], local_modo: 'hibrido',
  gallery: ['https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/capas-eventos/a.webp', '/images/b.jpg', 'https://rastreio.exemplo/pixel.gif', '//rastreio.exemplo/p.gif', '/\\rastreio.exemplo/p.gif', 'https://rwaezeqyuhxrssntcxdv.supabase.co.rastreio.exemplo/storage/v1/object/public/x.jpg'], ticket_types: [], profiles: { full_name: 'Paula', email: 'p@x.local' },
  updated_at: '2026-10-05T10:00:00.123456+00:00', created_at: '2026-10-01T10:00:00+00:00', date: null, time: null, start_date: '2026-11-01T20:00:00+00:00', end_date: null,
  venue_name: 'Casa', venue_address: null, venue_city: 'SP', venue_state: 'SP', cover_image: null, ingressos_alterados_em: '2026-10-05T17:30:00+00:00',
}
vi.mock('../hooks/useEvents', async (orig) => ({
  ...(await orig<typeof import('../hooks/useEvents')>()),
  useAdminEvents: () => ({ data: [evento], isLoading: false, isError: false, error: null }),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'a1', role: 'admin', admin_permissions: ['manage_events'] } }) }))

const sha = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))), (b) => b.toString(16).padStart(2, '0')).join('')
const abrir = async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AdminEvents /></MemoryRouter></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes do evento' }))
  return screen.findByRole('dialog')
}

describe('lib/moderacaoEvento', () => {
  it('dominioDaTransmissao devolve só o host e "link inválido" quando não é URL', () => {
    expect(dominioDaTransmissao('https://live.exemplo.com.br/sala?token=segredo#x')).toBe('live.exemplo.com.br')
    expect(dominioDaTransmissao('não é um link')).toBe('link inválido')
    expect(dominioDaTransmissao('')).toBe('link inválido')
    expect(dominioDaTransmissao('mailto:a@b.c')).toBe('link inválido')
  })
  it('hashConfere: sha256 do texto contra o hash gravado', async () => {
    expect(await hashConfere(TEXTO, await sha(TEXTO))).toBe(true)
    expect(await hashConfere(TEXTO + '.', await sha(TEXTO))).toBe(false)
  })
  it('seloIngressosAlterados: só evento aprovado com marca', () => {
    expect(seloIngressosAlterados({ approval_status: 'approved', ingressos_alterados_em: '2026-10-05T17:30:00+00:00' })).toMatch(/^Ingressos alterados em 05\/10 \d{2}:\d{2} \(depois da aprovação\)$/)
    expect(seloIngressosAlterados({ approval_status: 'pending', ingressos_alterados_em: '2026-10-05T17:30:00+00:00' })).toBeNull()
    expect(seloIngressosAlterados({ approval_status: 'approved', ingressos_alterados_em: null })).toBeNull()
  })
})

describe('detalhe do evento na moderação (S8)', () => {
  beforeEach(() => { cleanup(); tabelas.privado = { online_url: 'https://live.exemplo.com.br/sala?token=segredo' } })

  it('lista e detalhe mostram o selo "Ingressos alterados em … (depois da aprovação)"', async () => {
    tabelas.aceite = null
    const painel = await abrir()
    expect(screen.getAllByText(/Ingressos alterados em 05\/10 \d{2}:\d{2} \(depois da aprovação\)/)).toHaveLength(2) // fila + detalhe
    expect(within(painel).getByText(/depois da aprovação/)).toBeInTheDocument()
  })

  it('mostra classificação, temas, estilos, modo do local e galeria', async () => {
    tabelas.aceite = null
    const painel = await abrir()
    for (const t of ['16 anos', 'Música', 'Funk, Rock', 'Híbrido']) expect(within(painel).getByText(t)).toBeInTheDocument()
    // só Storage do projeto e caminho do site; domínio de fora (inclusive disfarçado) não é carregado
    const imgs = [...painel.querySelectorAll('img')].map(i => i.getAttribute('src'))
    expect(imgs).toEqual(['https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/capas-eventos/a.webp', '/images/b.jpg'])
    expect(painel.querySelector('img[referrerpolicy="no-referrer"]')).not.toBeNull()
    expect(painel.innerHTML).not.toContain('rastreio.exemplo')
  })

  it('transmissão: só o domínio, em texto, sem link e sem caminho nem token', async () => {
    tabelas.aceite = null
    const painel = await abrir()
    expect(await within(painel).findByText('live.exemplo.com.br')).toBeInTheDocument()
    expect(painel.textContent).not.toContain('segredo')
    expect(painel.textContent).not.toContain('/sala')
    expect(painel.querySelector('a[href*="exemplo.com.br"]')).toBeNull()
  })

  it('transmissão inválida mostra "link inválido"', async () => {
    tabelas.privado = { online_url: 'isso não é url' }
    tabelas.aceite = null
    const painel = await abrir()
    expect(await within(painel).findByText('link inválido')).toBeInTheDocument()
  })

  it('último aceite: versão, data e "hash confere"', async () => {
    tabelas.aceite = { versao: '2026-10-04', aceito_em: '2026-10-05T12:00:00+00:00', texto: TEXTO, texto_hash: await sha(TEXTO) }
    const painel = await abrir()
    expect(await within(painel).findByText(/versão 2026-10-04, em 05\/10.* — hash confere/)).toBeInTheDocument()
  })

  it('último aceite com texto alterado: "hash não confere"', async () => {
    tabelas.aceite = { versao: '2026-10-04', aceito_em: '2026-10-05T12:00:00+00:00', texto: TEXTO + ' (editado)', texto_hash: await sha(TEXTO) }
    const painel = await abrir()
    expect(await within(painel).findByText(/hash não confere/)).toBeInTheDocument()
  })
})
