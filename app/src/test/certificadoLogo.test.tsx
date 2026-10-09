import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CertificateBuilder from '../pages/producer/CertificateBuilder'

// Certificado: sem logo própria, usa a logo salva do organizador (Configurações); ao salvar o modelo, grava essa URL nele
const SALVA = 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/u1/abcdefgh.png'
const db = vi.hoisted(() => ({ template: {} as Record<string, unknown>, upserts: [] as unknown[], logo: null as string | null, carregandoLogo: false }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festa' }], isLoading: false, isError: false, refetch: vi.fn(), isFetching: false }) }))
vi.mock('../hooks/useLogoProdutor', () => ({ useLogoProdutor: () => ({ logo: { data: db.logo, isLoading: db.carregandoLogo } }) }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = () => q
      q.maybeSingle = () => Promise.resolve({ data: { template: db.template }, error: null })
      q.upsert = (v: unknown) => { db.upserts.push(v); return q }
      q.then = (ok: (r: unknown) => unknown) => ok({ data: [{ id: 'c1' }], error: null })
      return q
    },
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const montar = () => render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><CertificateBuilder /></QueryClientProvider></MemoryRouter>)
const botaoSalvar = () => screen.getByRole('button', { name: /Salvar/ })

describe('logo no certificado', () => {
  beforeEach(() => { vi.stubEnv('VITE_SUPABASE_URL', 'https://rwaezeqyuhxrssntcxdv.supabase.co'); db.template = {}; db.upserts = []; db.logo = null; db.carregandoLogo = false })
  afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllEnvs() })

  it('sem logo própria e com logo do organizador, usa a do organizador e diz de onde vem', async () => {
    db.logo = SALVA
    montar()
    await waitFor(() => expect(screen.getAllByAltText('Logo do evento no certificado')[0]).toHaveAttribute('src', SALVA))
    expect(screen.getByAltText('Logo do evento')).toHaveAttribute('src', SALVA)
    expect(screen.getByText(/Usando a logo salva em/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Configurações > Organizador/ })).toHaveAttribute('href', '/producer/settings')
    expect(screen.queryByText('Usar a logo do organizador')).toBeNull()
  })

  it('sem nenhuma logo, mostra o espaço LOGO e a dica para salvar em Configurações', async () => {
    montar()
    expect(await screen.findByText(/Salve a logo em/)).toBeInTheDocument()
    expect(screen.getByText('LOGO')).toBeInTheDocument()
  })

  it('modelo com logo própria mantém a dele e oferece voltar à do organizador', async () => {
    db.logo = SALVA
    db.template = { logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' }
    montar()
    await waitFor(() => expect(screen.getByAltText('Logo do evento')).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='))
    expect(screen.getByText('Logo enviada só para este modelo.')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Usar a logo do organizador'))
    await waitFor(() => expect(screen.getByAltText('Logo do evento')).toHaveAttribute('src', SALVA))
  })

  it('modelo salvo antes com a URL do organizador não conta como logo própria', async () => {
    db.logo = SALVA
    db.template = { logoUrl: SALVA }
    montar()
    expect(await screen.findByText(/Usando a logo salva em/)).toBeInTheDocument()
    expect(screen.queryByText('Usar a logo do organizador')).toBeNull()
  })

  it('ao salvar, grava a logo efetiva no modelo (o certificado emitido não muda se a logo for trocada depois)', async () => {
    db.logo = SALVA
    montar()
    await screen.findByText(/Usando a logo salva em/)
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(db.upserts).toHaveLength(1))
    expect((db.upserts[0] as { template: { logoUrl: string } }).template.logoUrl).toBe(SALVA)
  })

  const OUTRA = 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/u1/zzzzzzzz.png'

  it('o organizador trocou a logo depois de o modelo ser salvo: o texto não diz que foi enviada aqui', async () => {
    db.logo = OUTRA
    db.template = { logoUrl: SALVA }
    montar()
    expect(await screen.findByText(/Logo do organizador guardada neste modelo/)).toBeInTheDocument()
    expect(screen.queryByText('Logo enviada só para este modelo.')).toBeNull()
    expect(screen.getByAltText('Logo do evento')).toHaveAttribute('src', SALVA) // o modelo mantém a da época
    fireEvent.click(screen.getByText('Usar a logo atual do organizador'))
    await waitFor(() => expect(screen.getByAltText('Logo do evento')).toHaveAttribute('src', OUTRA))
  })

  it('não salva enquanto a logo do organizador carrega (senão gravaria o modelo sem logo)', async () => {
    db.carregandoLogo = true
    montar()
    await screen.findByText(/Salve a logo em/)
    expect(botaoSalvar()).toBeDisabled()
  })

  it('logo própria é mantida ao salvar; voltar à do organizador grava a do organizador', async () => {
    db.logo = SALVA
    db.template = { logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' }
    montar()
    await waitFor(() => expect(screen.getByAltText('Logo do evento')).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='))
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(db.upserts).toHaveLength(1))
    expect((db.upserts[0] as { template: { logoUrl: string } }).template.logoUrl).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
    fireEvent.click(screen.getByText('Usar a logo do organizador'))
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(db.upserts).toHaveLength(2))
    expect((db.upserts[1] as { template: { logoUrl: string } }).template.logoUrl).toBe(SALVA)
  })

  it('sem campo Logo no modelo, a logo do organizador não é gravada', async () => {
    db.logo = SALVA
    db.template = { fields: [{ id: 'title', type: 'text', label: 'Título', x: 50, y: 22, fontSize: 28, color: '#000000', value: 'Certificado', width: 80, height: 40 }] }
    montar()
    await screen.findByText(/Usando a logo salva em/)
    fireEvent.click(botaoSalvar())
    await waitFor(() => expect(db.upserts).toHaveLength(1))
    expect((db.upserts[0] as { template: { logoUrl: string | null } }).template.logoUrl).toBeNull()
  })
})
