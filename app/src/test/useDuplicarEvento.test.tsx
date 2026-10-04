import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ReactNode } from 'react'
import { useDuplicarEvento } from '../hooks/useDuplicarEvento'
import { duplicarEvento } from '../lib/eventoProdutor'
import type { DbEvent } from '../hooks/useEvents'

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({ useCreateEvent: () => ({ mutateAsync: vi.fn() }) }))
vi.mock('../lib/eventoProdutor', async orig => ({ ...(await orig<object>()), duplicarEvento: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))

const evento = { id: 'e1', title: 'Festa' } as DbEvent
let qc: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
)

beforeEach(() => { vi.clearAllMocks(); qc = new QueryClient() })

describe('useDuplicarEvento', () => {
  it('depois de duplicar, invalida a lista de eventos (a cópia aparece com os ingressos) e abre o painel do novo', async () => {
    const ordem: string[] = []
    vi.mocked(duplicarEvento).mockImplementation(async () => { ordem.push('duplicou'); return { id: 'novo', ingressos: 2, foto: true, avisos: [] } })
    const invalida = vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => { ordem.push('invalidou'); return Promise.resolve() })
    const { result } = renderHook(() => ({ h: useDuplicarEvento(), loc: useLocation() }), { wrapper })
    await act(async () => { await result.current.h.duplicar(evento) })
    expect(ordem).toEqual(['duplicou', 'invalidou'])
    expect(invalida).toHaveBeenCalledWith({ queryKey: ['producer-events'] })
    expect(result.current.loc.pathname).toBe('/producer/events/novo/edit')
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/2 tipos de ingresso/), expect.anything())
  })

  it('com aviso usa o toast de atenção; erro na criação mostra mensagem amigável e não navega', async () => {
    vi.mocked(duplicarEvento).mockResolvedValueOnce({ id: 'novo', ingressos: 0, foto: true, avisos: ['os ingressos não foram copiados'] })
    const { result } = renderHook(() => ({ h: useDuplicarEvento(), loc: useLocation() }), { wrapper })
    await act(async () => { await result.current.h.duplicar(evento) })
    expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/Atenção: os ingressos não foram copiados/), expect.anything())

    vi.mocked(duplicarEvento).mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'))
    await act(async () => { await result.current.h.duplicar(evento) })
    expect(toast.error).toHaveBeenCalledWith('Não foi possível duplicar o evento. Confira a internet e tente de novo.')
    expect(result.current.h.duplicando).toBe(false)
  })
})
