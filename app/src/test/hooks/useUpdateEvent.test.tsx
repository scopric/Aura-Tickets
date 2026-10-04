import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { gravarEvento, useCreateEvent, useUpdateEvent } from '../../hooks/useEvents'
import { supabase } from '../../lib/supabase'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

// Devolve o que foi passado ao update de events.
async function gravado(event: Record<string, unknown>) {
  const update = vi.fn(() => ({
    eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'e1' }, error: null }) }) }),
  }))
  vi.mocked(supabase.from).mockReturnValue({
    update,
    select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
  } as any)
  const { result } = renderHook(() => useUpdateEvent(), { wrapper })
  await result.current.mutateAsync({ eventId: 'e1', event: event as any, tickets: [] })
  return (update.mock.calls[0] as unknown[])[0]
}

describe('useUpdateEvent grava só o que a tela mandou', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Arquivar manda só o status', async () => {
    expect(await gravado({ status: 'ended' })).toEqual({ status: 'ended' })
  })

  it('EditEvent: approval_status e location não vão ao banco; venue_name vai', async () => {
    const payload = await gravado({
      title: 'Show', description: null, date: '2026-10-10', time: '20:00',
      location: 'Arena', venue_name: 'Arena', category: 'Música', status: 'published', approval_status: 'pending',
      cover_image: '/c.jpg', image_url: '/c.jpg', capacity: 100,
    })
    expect(payload).toEqual({
      title: 'Show', description: null, date: '2026-10-10', time: '20:00', start_date: '2026-10-10T20:00:00-03:00',
      venue_name: 'Arena', category: 'Música', status: 'published',
      cover_image: '/c.jpg', image_url: '/c.jpg', capacity: 100,
    })
  })

  it('lista branca da F1: temas, estilos, classificação, modo do local e endereço vão; ausentes não', async () => {
    expect(await gravado({
      category: 'show', temas: ['musica'], estilos: ['forro'], classificacao: 'A16', local_modo: 'hibrido',
      venue_city: 'Recife', venue_state: 'PE', venue_zip: '50000-000',
    })).toEqual({
      category: 'show', temas: ['musica'], estilos: ['forro'], classificacao: 'A16', local_modo: 'hibrido',
      venue_city: 'Recife', venue_state: 'PE', venue_zip: '50000-000',
    })
    expect(await gravado({ temas: [], classificacao: '', local_modo: '', venue_zip: '' }))
      .toEqual({ temas: [], classificacao: null, local_modo: 'presencial', venue_zip: null })
  })

  it('category vazia grava null (sem "Outros")', async () => {
    expect(await gravado({ category: '' })).toEqual({ category: null })
  })
})

describe('useUpdateEvent: date, time e start_date andam juntos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('start_date sai de date + time com -03:00', async () => {
    expect(await gravado({ date: '2026-12-31', time: '23:30' })).toEqual({ date: '2026-12-31', time: '23:30', start_date: '2026-12-31T23:30:00-03:00' })
  })
  it('hora do banco com segundos ("20:00:00") não quebra o start_date', async () => {
    expect(await gravado({ date: '2026-10-10', time: '20:00:00' })).toMatchObject({ start_date: '2026-10-10T20:00:00-03:00' })
  })
  it('data sem hora: time null e start_date à meia-noite de Brasília', async () => {
    expect(await gravado({ date: '2026-10-10' })).toEqual({ date: '2026-10-10', time: null, start_date: '2026-10-10T00:00:00-03:00' })
  })
  it('sem data: grava date e time vazios e NÃO envia start_date (não vira "agora")', async () => {
    const p = await gravado({ date: '', time: '20:00' })
    expect(p).toEqual({ date: null, time: null })
    expect(p).not.toHaveProperty('start_date')
  })
  it('evento sem a chave date (ex.: só título): nada de data é regravado, nem se vier start_date', async () => {
    expect(await gravado({ title: 'Novo nome', start_date: '2030-01-01T00:00:00Z' })).toEqual({ title: 'Novo nome' })
  })
})

// Ingressos: existente vai por update sem type/is_active; novo vai por insert.
async function salvaIngressos(tickets: Record<string, unknown>[], linhasDoUpdate = [{ id: 'a' }], erroLeitura: unknown = null) {
  const update = vi.fn((_: Record<string, unknown>) => ({ eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: linhasDoUpdate, error: null }) }) }) }))
  const insert = vi.fn((_: Record<string, unknown>[]) => Promise.resolve({ error: null }))
  vi.mocked(supabase.from).mockImplementation(((tabela: string) => tabela === 'events'
    ? { update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'e1' }, error: null }) }) }) }) }
    : { select: () => ({ eq: () => Promise.resolve({ data: erroLeitura ? null : [{ id: 'a' }], error: erroLeitura }) }), update, insert }) as any)
  const { result } = renderHook(() => useUpdateEvent(), { wrapper })
  await result.current.mutateAsync({ eventId: 'e1', event: {} as any, tickets: tickets as any })
  return { update, insert }
}

describe('useUpdateEvent preserva tipo e situação dos ingressos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('existente coletiva: update sem type', async () => {
    const { update, insert } = await salvaIngressos([{ id: 'a', name: 'Mesa', price: 100, capacity: 4, type: 'coletiva' }])
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0]).not.toHaveProperty('type')
    expect(insert).not.toHaveBeenCalled()
  })

  it('existente inativo: update sem is_active', async () => {
    const { update } = await salvaIngressos([{ id: 'a', name: 'X', price: 0, is_active: false }])
    expect(update.mock.calls[0][0]).not.toHaveProperty('is_active')
  })

  it('novo: insert com type individual e is_active true', async () => {
    const { update, insert } = await salvaIngressos([{ name: 'Novo', price: 10, capacity: 5 }])
    expect(update).not.toHaveBeenCalled()
    expect(insert.mock.calls[0][0]).toEqual([expect.objectContaining({ event_id: 'e1', type: 'individual', is_active: true })])
  })

  it('novo: o painel escolhe individual ou coletiva; qualquer outro tipo vira individual (vip e mesa não se criam por aqui)', async () => {
    const { insert } = await salvaIngressos([
      { name: 'A', price: 1, capacity: 1, type: 'coletiva' }, { name: 'B', price: 1, capacity: 1, type: 'individual' },
      { name: 'C', price: 1, capacity: 1, type: 'vip' }, { name: 'D', price: 1, capacity: 1, type: 'mesa' }, { name: 'E', price: 1, capacity: 1, type: 'qualquer' },
    ])
    expect((insert.mock.calls[0][0] as { type: string }[]).map(t => t.type)).toEqual(['coletiva', 'individual', 'individual', 'individual', 'individual'])
  })

  it('existente com tipo no payload: o tipo nunca vai no update (só no insert)', async () => {
    const { update } = await salvaIngressos([{ id: 'a', name: 'Mesa', price: 100, capacity: 4, type: 'individual' }])
    expect(update.mock.calls[0][0]).not.toHaveProperty('type')
  })

  it('update que volta 0 linha gera erro', async () => {
    await expect(salvaIngressos([{ id: 'a', name: 'X', price: 1 }], [])).rejects.toThrow('Não foi possível salvar um dos ingressos')
  })

  it('leitura dos ingressos com erro: rejeita e não insere', async () => {
    const insert = vi.fn()
    vi.mocked(supabase.from).mockImplementation(((tabela: string) => tabela === 'events'
      ? { update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'e1' }, error: null }) }) }) }) }
      : { select: () => ({ eq: () => Promise.resolve({ data: null, error: new Error('falhou') }) }), insert }) as any)
    const { result } = renderHook(() => useUpdateEvent(), { wrapper })
    await expect(result.current.mutateAsync({ eventId: 'e1', event: {} as any, tickets: [{ name: 'M', price: 1, type: 'coletiva' }] as any })).rejects.toThrow('falhou')
    expect(insert).not.toHaveBeenCalled()
  })

  it('existente sem description: update não manda description', async () => {
    const { update } = await salvaIngressos([{ id: 'a', name: 'X', price: 1 }])
    expect(update.mock.calls[0][0]).not.toHaveProperty('description')
  })

  it('inclui_bebida: existente e novo levam o campo; sem o campo, o update não o manda', async () => {
    const { update, insert } = await salvaIngressos([
      { id: 'a', name: 'Open bar', price: 100, inclui_bebida: true },
      { name: 'Novo', price: 10, capacity: 5, inclui_bebida: true },
    ])
    expect(update.mock.calls[0][0]).toMatchObject({ inclui_bebida: true })
    expect(insert.mock.calls[0][0]).toEqual([expect.objectContaining({ inclui_bebida: true })])
    const { update: u2 } = await salvaIngressos([{ id: 'a', name: 'X', price: 1 }])
    expect(u2.mock.calls[0][0]).not.toHaveProperty('inclui_bebida')
    const { update: u3 } = await salvaIngressos([{ id: 'a', name: 'X', price: 1, inclui_bebida: false }])
    expect(u3.mock.calls[0][0]).toMatchObject({ inclui_bebida: false }) // desmarcar a bebida precisa gravar false
  })

  it('preço 0 grava price 0', async () => {
    const { update } = await salvaIngressos([{ id: 'a', name: 'X', price: 0 }])
    expect(update.mock.calls[0][0]).toMatchObject({ price: 0 })
  })
})

// Criar: o que vai ao insert de events e ao de ticket_types.
async function criado(event: Record<string, unknown>, tickets: Record<string, unknown>[] = []) {
  const insertEvento = vi.fn((...args: unknown[]) => (args, { select: () => ({ single: () => Promise.resolve({ data: { id: 'e1' }, error: null }) }) }))
  const insertIngressos = vi.fn((...args: unknown[]) => (args, Promise.resolve({ error: null })))
  vi.mocked(supabase.from).mockImplementation(((tabela: string) => ({ insert: tabela === 'events' ? insertEvento : insertIngressos })) as never)
  const { result } = renderHook(() => useCreateEvent(), { wrapper })
  await result.current.mutateAsync({ event: event as never, tickets: tickets as never })
  return { evento: insertEvento.mock.calls[0][0] as Record<string, unknown>, ingressos: insertIngressos.mock.calls[0]?.[0] as Record<string, unknown>[] }
}

describe('useCreateEvent: formato, datas e colunas da F1', () => {
  beforeEach(() => vi.clearAllMocks())

  it('com data: start_date = date + time com -03:00; formato vira category', async () => {
    const { evento } = await criado({ title: 'Show', category: 'show', date: '2099-11-20', time: '22:00', temas: ['musica'], estilos: ['forro'], classificacao: 'A16', local_modo: 'presencial', venue_zip: '50000-000' })
    expect(evento).toMatchObject({ category: 'show', date: '2099-11-20', time: '22:00', start_date: '2099-11-20T22:00:00-03:00', temas: ['musica'], estilos: ['forro'], classificacao: 'A16', local_modo: 'presencial', venue_zip: '50000-000' })
  })
  it('sem data: não envia start_date (o banco usa o padrão) e sem formato grava category null', async () => {
    const { evento } = await criado({ title: 'Rascunho', time: '22:00' })
    expect(evento).toMatchObject({ category: null, date: null, time: null })
    expect(evento.start_date).toBeUndefined()
  })
  it('colunas da F1 vazias não vão no insert (criar não depende do SQL da F1)', async () => {
    const { evento } = await criado({ title: 'X', temas: [], estilos: [] })
    for (const k of ['temas', 'estilos', 'classificacao', 'local_modo', 'venue_zip']) expect(evento[k]).toBeUndefined()
  })
  it('ingresso leva inclui_bebida só quando marcado', async () => {
    const { ingressos } = await criado({ title: 'X' }, [{ name: 'Open bar', price: 100, capacity: 10, inclui_bebida: true }, { name: 'Pista', price: 50, capacity: 10 }])
    expect(ingressos.map(t => t.inclui_bebida)).toEqual([true, undefined])
  })
})

describe('gravação sem ingressos (painel do evento)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('useUpdateEvent com event {} não chama update em events (corpo vazio) e só mexe nos ingressos', async () => {
    const updateEvento = vi.fn()
    const insert = vi.fn(() => Promise.resolve({ error: null }))
    vi.mocked(supabase.from).mockImplementation(((tabela: string) => tabela === 'events'
      ? { update: updateEvento }
      : { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }), insert }) as never)
    const { result } = renderHook(() => useUpdateEvent(), { wrapper })
    await result.current.mutateAsync({ eventId: 'e1', event: {}, tickets: [{ name: 'Novo', price: 10, capacity: 5 }] as never })
    expect(updateEvento).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('gravarEvento: mesma lista branca, um update só, sem ler ingressos; select só de id e updated_at', async () => {
    const select = vi.fn(() => ({ single: () => Promise.resolve({ data: { id: 'e1' }, error: null }) }))
    const update = vi.fn(() => ({ eq: () => ({ select }) }))
    const from = vi.mocked(supabase.from).mockReturnValue({ update } as never)
    await gravarEvento('e1', { title: 'Novo', date: '2026-12-12', time: '22:00', approval_status: 'approved', location: 'x' } as never)
    expect(update).toHaveBeenCalledWith({ title: 'Novo', date: '2026-12-12', time: '22:00', start_date: '2026-12-12T22:00:00-03:00' })
    expect(select).toHaveBeenCalledWith('id, updated_at')
    expect(from).toHaveBeenCalledTimes(1) // events; nada de ticket_types
  })

  it('gravarEvento sem coluna nenhuma não chama o banco', async () => {
    const from = vi.mocked(supabase.from)
    await gravarEvento('e1', {})
    await gravarEvento('e1', { approval_status: 'approved' } as never) // fora da lista branca
    expect(from).not.toHaveBeenCalled()
  })

  it('gravarEvento propaga o erro (o painel mostra "Não salvou")', async () => {
    vi.mocked(supabase.from).mockReturnValue({ update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error('RLS') }) }) }) }) } as never)
    await expect(gravarEvento('e1', { title: 'x' })).rejects.toThrow('RLS')
  })
})
