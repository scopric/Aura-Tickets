import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LogoProdutor from '../components/producer/LogoProdutor'

// Logo do produtor: lê e grava producer_profiles.logo_url; o arquivo sobe em <produtor>/<uuid>.<ext> no bucket logos-produtor
const UID = '11111111-2222-3333-4444-555555555555'
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: UID } }) }))
const db = vi.hoisted(() => ({
  logo: null as string | null, erroLeitura: null as unknown, erroGravar: null as unknown, linhasGravadas: 1,
  gravou: [] as unknown[], subiu: [] as { caminho: string; tipo: string }[], erroUpload: null as unknown,
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = () => q
      q.update = (v: unknown) => { db.gravou.push(v); q.gravando = true; return q }
      q.maybeSingle = () => Promise.resolve({ data: db.erroLeitura ? null : { logo_url: db.logo }, error: db.erroLeitura })
      q.then = (ok: (r: unknown) => unknown) => ok({ data: db.erroGravar ? null : Array.from({ length: db.linhasGravadas }, () => ({ id: UID })), error: db.erroGravar })
      return q
    },
    storage: { from: () => ({
      upload: (caminho: string, blob: Blob) => { db.subiu.push({ caminho, tipo: blob.type }); return Promise.resolve({ error: db.erroUpload }) },
      getPublicUrl: (c: string) => ({ data: { publicUrl: `https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/${c}` } }),
    }) },
  },
}))
const prep = vi.hoisted(() => ({ pronta: { blob: new Blob(['x'], { type: 'image/png' }), ext: 'png' as const, previewUrl: 'blob:p' }, erro: null as Error | null }))
vi.mock('../lib/logoProdutor', async orig => ({ ...(await orig<typeof import('../lib/logoProdutor')>()), prepararLogo: async () => { if (prep.erro) throw prep.erro; return prep.pronta } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { toast } from 'sonner'

const montar = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LogoProdutor /></QueryClientProvider>)
const escolher = (tipo = 'image/png') => fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'l.png', { type: tipo })] } })

describe('Logo do produtor', () => {
  beforeEach(() => { Object.assign(db, { logo: null, erroLeitura: null, erroGravar: null, linhasGravadas: 1, gravou: [], subiu: [], erroUpload: null }); prep.erro = null; URL.revokeObjectURL = vi.fn() })
  afterEach(() => { vi.clearAllMocks(); cleanup() })

  it('sem logo mostra "Sem logo" e o botão de escolher', async () => {
    montar()
    expect(await screen.findByText('Sem logo')).toBeInTheDocument()
    expect(screen.getByText('Escolher a logo')).toBeInTheDocument()
    expect(screen.queryByText('Remover a logo')).toBeNull()
  })

  it('com logo mostra a imagem e permite trocar e remover', async () => {
    db.logo = 'https://x.supabase.co/storage/v1/object/public/logos-produtor/a/b.png'
    montar()
    expect(await screen.findByAltText('Logo atual do organizador')).toHaveAttribute('src', db.logo)
    expect(screen.getByText('Trocar a logo')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Remover a logo'))
    await waitFor(() => expect(db.gravou).toEqual([{ logo_url: null }]))
  })

  it('escolher envia para <produtor>/<uuid>.png e grava a URL pública', async () => {
    montar()
    await screen.findByText('Sem logo')
    escolher()
    await waitFor(() => expect(db.gravou).toHaveLength(1))
    expect(db.subiu[0].caminho).toMatch(new RegExp(`^${UID}/[0-9a-f-]{36}\\.png$`))
    expect(db.subiu[0].tipo).toBe('image/png')
    const url = (db.gravou[0] as { logo_url: string }).logo_url
    expect(url).toBe(`https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/${db.subiu[0].caminho}`)
    // a mesma regra do CHECK do banco (docs/sql/20261031_produtor_logo.sql)
    expect(url).toMatch(new RegExp(`^https://rwaezeqyuhxrssntcxdv\\.supabase\\.co/storage/v1/object/public/logos-produtor/${UID}/[A-Za-z0-9_-]{8,80}\\.(png|webp|jpe?g)$`))
    expect(toast.success).toHaveBeenCalledWith('Logo salva!')
  })

  it('imagem recusada no preparo não envia nem grava, e o produtor lê o motivo', async () => {
    prep.erro = new Error('A imagem deve ter no máximo 5 MB.')
    montar()
    await screen.findByText('Sem logo')
    escolher()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('A imagem deve ter no máximo 5 MB.'))
    expect(db.subiu).toHaveLength(0)
    expect(db.gravou).toHaveLength(0)
  })

  it('envio recusado pelo Storage não grava a URL', async () => {
    db.erroUpload = { message: 'new row violates row-level security policy', statusCode: '403' }
    montar()
    await screen.findByText('Sem logo')
    escolher()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('recusado')))
    expect(db.gravou).toHaveLength(0)
  })

  it('URL recusada pelo CHECK do banco (23514) mostra texto em português, não o do Postgres', async () => {
    db.erroGravar = { code: '23514', message: 'new row for relation "producer_profiles" violates check constraint' }
    montar()
    await screen.findByText('Sem logo')
    escolher()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Endereço da logo não aceito. Tente enviar de novo.'))
  })

  it('RLS que não atualiza nenhuma linha não vira "salvo"', async () => {
    db.linhasGravadas = 0
    montar()
    await screen.findByText('Sem logo')
    escolher()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('erro de leitura (coluna ausente, sem 2FA) mostra aviso e nenhum botão', async () => {
    db.erroLeitura = { code: '42703', message: 'column does not exist' }
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('ainda não está disponível')
    expect(screen.queryByText('Escolher a logo')).toBeNull()
  })
})
