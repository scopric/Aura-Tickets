import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SeatingMap from '../pages/producer/SeatingMap'
import { reduzirPlanta } from '../lib/plantaFundo'

const h = vi.hoisted(() => ({
  upsert: vi.fn(),
  eq: vi.fn(),
  mapa: null as unknown,
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../hooks/useEvents', () => ({
  useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festa 1' }, { id: 'e2', title: 'Festa 2' }], isLoading: false }),
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: (c: string, v: string) => { h.eq(c, v); return { maybeSingle: async () => ({ data: h.mapa, error: null }) } } }),
      upsert: h.upsert,
    }),
  },
}))

const fundo = { image: 'data:image/webp;base64,AAAA', scale: 1.4, offset: { x: 10, y: 20 }, opacity: 0.6 }
const montar = (url: string) => render(<MemoryRouter initialEntries={[url]}><SeatingMap /></MemoryRouter>)

describe('Lugar marcado: salvar', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    h.upsert.mockResolvedValue({ error: null })
    h.mapa = {
      environments: [{ id: 'terreo', name: 'Térreo', seats: [], sections: [{ id: 'vip', name: 'VIP', color: '#000', price: 10 }] }],
      config: { zoom: 1, pan: { x: 0, y: 0 }, background: fundo },
    }
  })

  it('sem evento escolhido a tela pede para escolher e não edita', () => {
    montar('/producer/seating')
    expect(screen.getByText(/Escolha o evento/)).toBeTruthy()
    expect(screen.queryByText('Salvar')).toBeNull()
  })

  it('salva no evento escolhido, leva a planta de fundo e não grava no localStorage', async () => {
    montar('/producer/seating?eventId=e2')
    const salvar = await screen.findByRole('button', { name: /Salvar/ })
    await waitFor(() => expect((salvar as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(salvar)
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(1))
    const [payload, opcoes] = h.upsert.mock.calls[0]
    expect(payload.event_id).toBe('e2')
    expect(payload.config.background).toEqual(fundo)
    expect(opcoes).toEqual({ onConflict: 'event_id' })
    expect(localStorage.getItem('seating_map_e2')).toBeNull()
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Mapa de assentos salvo!'))
  })

  it('erro do banco aparece como erro, não como "salvo localmente"', async () => {
    h.upsert.mockResolvedValue({ error: { message: 'permission denied' } })
    montar('/producer/seating?eventId=e1')
    const salvar = await screen.findByRole('button', { name: /Salvar/ })
    await waitFor(() => expect((salvar as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(salvar)
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(expect.stringContaining('permission denied'), expect.anything()))
    expect(h.toast.warning).not.toHaveBeenCalled()
    expect(h.toast.success).not.toHaveBeenCalledWith('Mapa de assentos salvo!')
  })
})

describe('Lugar marcado: alterações não salvas', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    h.upsert.mockResolvedValue({ error: null })
    h.mapa = { environments: [{ id: 'terreo', name: 'Térreo', seats: [], sections: [{ id: 'vip', name: 'VIP', color: '#000', price: 10 }] }], config: { zoom: 1, pan: { x: 0, y: 0 } } }
  })
  afterEach(() => vi.restoreAllMocks())

  it('confirma antes de trocar de evento e de voltar, avisa ao fechar a aba, e salvar zera o aviso', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false)
    montar('/producer/seating?eventId=e1')
    const salvar = await screen.findByRole('button', { name: /Salvar/ })
    await waitFor(() => expect((salvar as HTMLButtonElement).disabled).toBe(false))
    const seletor = screen.getByLabelText('Evento do mapa') as HTMLSelectElement

    // sem alterações: troca sem perguntar e recarrega o mapa do outro evento
    fireEvent.change(seletor, { target: { value: 'e2' } })
    expect(confirmar).not.toHaveBeenCalled()
    await waitFor(() => expect(h.eq).toHaveBeenLastCalledWith('event_id', 'e2'))
    await waitFor(() => expect((screen.getByRole('button', { name: /Salvar/ }) as HTMLButtonElement).disabled).toBe(false))

    // com alteração: pergunta; recusando, o evento não muda
    fireEvent.click(screen.getByText('Novo pavimento'))
    const evento = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(evento)
    expect(evento.defaultPrevented).toBe(true)
    fireEvent.change(screen.getByLabelText('Evento do mapa'), { target: { value: 'e1' } })
    expect(confirmar).toHaveBeenCalledTimes(1)
    expect((screen.getByLabelText('Evento do mapa') as HTMLSelectElement).value).toBe('e2')
    const voltar = screen.getByLabelText('Voltar ao painel')
    expect(voltar.getAttribute('href')).toBe('/producer/dashboard?eventId=e2')
    fireEvent.click(voltar)
    expect(confirmar).toHaveBeenCalledTimes(2)

    // salvar zera o aviso
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Mapa de assentos salvo!'))
    const depois = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(depois)
    expect(depois.defaultPrevented).toBe(false)
  })
})

describe('reduzirPlanta', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('encaixa a imagem inteira em 1600 px, sem cortar, e baixa a qualidade até caber', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 4000, height: 2000, close: () => {} }))
    const desenho = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: desenho } as never)
    const grande = 'data:image/webp;base64,' + 'A'.repeat(600_000)
    const pequeno = 'data:image/webp;base64,' + 'A'.repeat(1000)
    const exporta = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValueOnce(grande).mockReturnValue(pequeno)
    let canvas!: HTMLCanvasElement
    const criar = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((t: string) => { const el = criar(t); if (t === 'canvas') canvas = el as HTMLCanvasElement; return el })

    const url = await reduzirPlanta(new Blob(['x']))

    expect([canvas.width, canvas.height]).toEqual([1600, 800])
    expect(desenho).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800)
    expect(exporta).toHaveBeenCalledTimes(2)
    expect(exporta.mock.calls[1][1]).toBeLessThan(exporta.mock.calls[0][1] as number)
    expect(url).toBe(pequeno)
  })
})
