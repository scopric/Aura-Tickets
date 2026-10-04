import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SeatingMap from '../pages/producer/SeatingMap'
import { reduzirPlanta } from '../lib/plantaFundo'

const h = vi.hoisted(() => ({
  upsert: vi.fn(),
  eq: vi.fn(),
  mapa: null as unknown,
  erroLeitura: false,
  eventos: { data: undefined as unknown, isLoading: false, isError: false, refetch: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../hooks/useEvents', () => ({
  useProducerEvents: () => h.eventos,
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: (c: string, v: string) => { h.eq(c, v); return { maybeSingle: async () => (h.erroLeitura ? { data: null, error: { message: 'falhou' } } : { data: h.mapa, error: null }) } } }),
      upsert: h.upsert,
    }),
  },
}))

const dois = { data: [{ id: 'e1', title: 'Festa 1' }, { id: 'e2', title: 'Festa 2' }], isLoading: false, isError: false, refetch: vi.fn() }
const fundo = { image: 'data:image/webp;base64,AAAA', scale: 1.4, offset: { x: 10, y: 20 }, opacity: 0.6 }
const montar = (url: string) => render(<MemoryRouter initialEntries={[url]}><SeatingMap /></MemoryRouter>)

describe('Lugar marcado: salvar', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    h.eventos = dois
    h.erroLeitura = false
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
    h.eventos = dois
    h.erroLeitura = false
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

describe('Lugar marcado: carga e erros', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    h.erroLeitura = false
    h.upsert.mockResolvedValue({ error: null })
    h.mapa = { environments: [{ id: 'terreo', name: 'Térreo', seats: [], sections: [{ id: 'vip', name: 'VIP', color: '#000', price: 10 }] }], config: { zoom: 1, pan: { x: 0, y: 0 } } }
  })

  it('a rodinha funciona depois de carga fria (lista de eventos ainda carregando)', async () => {
    h.eventos = { ...dois, data: undefined, isLoading: true }
    const url = '/producer/seating?eventId=e1'
    const r = render(<MemoryRouter initialEntries={[url]}><SeatingMap /></MemoryRouter>)
    expect(screen.getByText(/Carregando seus eventos/)).toBeTruthy()
    h.eventos = dois
    r.rerender(<MemoryRouter initialEntries={[url]}><SeatingMap /></MemoryRouter>)
    await screen.findByRole('button', { name: /Salvar/ })
    const canvas = document.querySelector('main') as HTMLElement
    const roda = new WheelEvent('wheel', { deltaY: 100, cancelable: true, bubbles: true })
    await act(async () => { canvas.dispatchEvent(roda) })
    expect(roda.defaultPrevented).toBe(true)
  })

  it('erro ao carregar os eventos não diz "crie um evento" e oferece tentar de novo', () => {
    h.eventos = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() }
    montar('/producer/seating')
    expect(screen.getByText(/Não consegui carregar seus eventos/)).toBeTruthy()
    expect(screen.queryByText(/Crie um evento/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(h.eventos.refetch).toHaveBeenCalled()
  })

  it('erro ao ler o mapa mostra faixa fixa e trava o Salvar', async () => {
    h.eventos = dois
    h.erroLeitura = true
    montar('/producer/seating?eventId=e1')
    expect((await screen.findByRole('alert')).textContent).toMatch(/O mapa não carregou/)
    expect((screen.getByRole('button', { name: /Salvar/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('só planta em data:image/ vai para o banco e volta ao carregar', async () => {
    h.eventos = dois
    h.mapa = { ...(h.mapa as object), config: { zoom: 1, pan: { x: 0, y: 0 }, background: { ...fundo, image: 'https://images.unsplash.com/x.jpg' } } }
    montar('/producer/seating?eventId=e1')
    const salvar = await screen.findByRole('button', { name: /Salvar/ })
    await waitFor(() => expect((salvar as HTMLButtonElement).disabled).toBe(false))
    expect(document.querySelector('img[alt="Planta Baixa"]')).toBeNull() // não restaurou a URL externa
    fireEvent.click(salvar)
    await waitFor(() => expect(h.upsert).toHaveBeenCalled())
    expect(h.upsert.mock.calls[0][0].config.background).toBeNull()
  })

  it('salvar demorado + troca de evento: o fim do salvamento não marca o mapa novo como alterado', async () => {
    h.eventos = dois
    let termina!: (v: unknown) => void
    h.upsert.mockReturnValue(new Promise(r => { termina = r }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    montar('/producer/seating?eventId=e1')
    const salvar = await screen.findByRole('button', { name: /Salvar/ })
    await waitFor(() => expect((salvar as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByText('Novo pavimento')) // e1 alterado e salvo (ainda pendente)
    fireEvent.click(salvar)
    fireEvent.change(screen.getByLabelText('Evento do mapa'), { target: { value: 'e2' } })
    await waitFor(() => expect(h.eq).toHaveBeenLastCalledWith('event_id', 'e2'))
    await waitFor(() => expect((screen.getByRole('button', { name: /Salvar/ }) as HTMLButtonElement).disabled).toBe(false))
    await act(async () => { termina({ error: null }) })
    const ev = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false) // e2 está como foi carregado
  })
})

describe('reduzirPlanta', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('encaixa a imagem inteira em 1600 px, sem cortar, e baixa a qualidade até caber', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 4000, height: 2000, close: () => {} }))
    const desenho = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: desenho, fillRect: vi.fn(), set fillStyle(_: string) {} } as never)
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
