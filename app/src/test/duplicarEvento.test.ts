import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import { duplicarEvento, resumoDuplicacao } from '../lib/eventoProdutor'
import { prepararCapa, enviarEGravarCapa } from '../lib/capaEvento'
import type { DbEvent, DbTicketType } from '../hooks/useEvents'

vi.mock('../lib/capaEvento', () => ({ prepararCapa: vi.fn(), enviarEGravarCapa: vi.fn() }))

const FOTO = 'https://x.supabase.co/storage/v1/object/public/capas-eventos/p1/e1/aaaaaaaa.webp'
const tipo = (o: Partial<DbTicketType> = {}) => ({ id: 't', event_id: 'e1', name: 'Pista', description: null, price: 50, capacity: 10, quantity_total: 100, sold: 7, type: 'individual', perks: [], is_active: true, ...o }) as DbTicketType
const original = (o: Partial<DbEvent> = {}) => ({
  id: 'e1', producer_id: 'p1', title: 'Festa', status: 'published', approval_status: 'approved', date: '2026-11-30', time: '20:00:00',
  start_date: '2026-11-30T23:00:00Z', end_date: null, category: 'show', cover_image: FOTO, image_url: FOTO,
  ticket_types: [tipo(), tipo({ id: 't2', name: 'Camarote', price: 200 })], ...o,
}) as unknown as DbEvent

let inserido: unknown[]
function ingressos(erro: unknown = null) {
  inserido = []
  vi.mocked(supabase.from).mockImplementation(((tabela: string) => ({
    insert: (linhas: unknown[]) => { inserido.push([tabela, linhas]); return Promise.resolve({ error: erro }) },
  })) as never)
}
const criar = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  criar.mockResolvedValue({ id: 'novo' })
  ingressos()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'], { type: 'image/webp' })) })))
  vi.mocked(prepararCapa).mockResolvedValue({ blob: new Blob(['x']), previewUrl: 'blob:x', cor: '#fff' })
  vi.mocked(enviarEGravarCapa).mockResolvedValue(true)
  URL.revokeObjectURL = vi.fn()
})

describe('duplicarEvento', () => {
  it('sucesso: cria o evento (rascunho, sem datas e sem ingressos no hook), os ingressos e a foto na pasta do evento novo', async () => {
    const r = await duplicarEvento(original(), criar, 'p1')
    expect(r).toEqual({ id: 'novo', ingressos: 2, foto: true, avisos: [] })
    expect(criar).toHaveBeenCalledTimes(1)
    const { event, tickets } = criar.mock.calls[0][0]
    expect(tickets).toEqual([])
    expect(event.status).toBe('draft')
    for (const k of ['date', 'time', 'start_date', 'end_date', 'approval_status', 'id']) expect(event).not.toHaveProperty(k)
    const [tabela, linhas] = inserido[0] as [string, { event_id: string; name: string; sold: number; quantity_total: number }[]]
    expect(tabela).toBe('ticket_types')
    expect(linhas.map(l => [l.event_id, l.name, l.sold, l.quantity_total])).toEqual([['novo', 'Pista', 0, 100], ['novo', 'Camarote', 0, 100]])
    expect(fetch).toHaveBeenCalledWith(FOTO)
    expect(enviarEGravarCapa).toHaveBeenCalledWith(expect.anything(), 'p1', 'novo')
  })

  it('ingressos falham: 1 evento só, aviso, e a foto ainda é copiada', async () => {
    ingressos({ message: 'boom' })
    const r = await duplicarEvento(original(), criar, 'p1')
    expect(criar).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ id: 'novo', ingressos: 0, foto: true, avisos: ['os ingressos não foram copiados'] })
  })

  it('foto falha (download recusado ou envio): aviso "foto não copiada" e o evento fica', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))) // CORS
    expect(await duplicarEvento(original(), criar, 'p1')).toMatchObject({ id: 'novo', ingressos: 2, foto: false, avisos: ['foto não copiada'] })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['x'], { type: 'image/webp' })) })))
    vi.mocked(enviarEGravarCapa).mockResolvedValue(false)
    expect(await duplicarEvento(original(), criar, 'p1')).toMatchObject({ foto: false, avisos: ['foto não copiada'] })
    expect(criar).toHaveBeenCalledTimes(2) // um evento por chamada, nunca um segundo
  })

  it('evento sem foto e sem ingressos: nada a avisar', async () => {
    const r = await duplicarEvento(original({ cover_image: '/images/hero-bg.jpg', image_url: '/images/hero-bg.jpg', ticket_types: [] }), criar, 'p1')
    expect(r).toEqual({ id: 'novo', ingressos: 0, foto: false, avisos: [] })
    expect(fetch).not.toHaveBeenCalled()
    expect(inserido).toEqual([])
  })

  it('falha ao criar o evento lança e não mexe em ingressos nem foto', async () => {
    criar.mockRejectedValue(new Error('duplicate key'))
    await expect(duplicarEvento(original(), criar, 'p1')).rejects.toThrow()
    expect(inserido).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('resumoDuplicacao', () => {
  it('diz o que foi copiado e o que nunca vai', () => {
    const t = resumoDuplicacao({ id: 'n', ingressos: 2, foto: true, avisos: [] })
    expect(t).toMatch(/Copiado: os dados do evento, 2 ingressos, a foto\./)
    expect(t).toMatch(/Não vão: datas, vendas, aprovação e destaque\./)
    expect(t).not.toMatch(/Atenção/)
  })
  it('lista o que falhou', () => {
    expect(resumoDuplicacao({ id: 'n', ingressos: 0, foto: false, avisos: ['os ingressos não foram copiados', 'foto não copiada'] }))
      .toMatch(/Copiado: os dados do evento\..*Atenção: os ingressos não foram copiados; foto não copiada\./)
  })
})
