import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SeatingMap from '../pages/producer/SeatingMap'
import { reduzirPlanta } from '../lib/plantaFundo'

const h = vi.hoisted(() => ({
  upsert: vi.fn(),
  eq: vi.fn(),
  mapa: null as unknown,
  tipos: [] as unknown[],
  colunasTipos: '',
  eqTipos: vi.fn(),
  tiposAtraso: null as Promise<unknown> | null,
  erroLeitura: false,
  eventos: { data: undefined as unknown, isLoading: false, isError: false, refetch: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  invoke: vi.fn(),
  pdf: vi.fn(),
  reduzir: null as null | ((b: Blob) => Promise<string>),
}))

vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('../hooks/useEvents', () => ({
  useProducerEvents: () => h.eventos,
}))
vi.mock('../lib/plantaFundo', async () => {
  const real = await vi.importActual<typeof import('../lib/plantaFundo')>('../lib/plantaFundo')
  return { ...real, pdfParaImagem: h.pdf, reduzirPlanta: (b: Blob) => (h.reduzir ? h.reduzir(b) : real.reduzirPlanta(b)) }
})
vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke: h.invoke },
    from: (tabela: string) => ({
      select: (colunas: string) => ({
        eq: (c: string, v: string) => {
          if (tabela === 'ticket_types') { h.colunasTipos = colunas; h.eqTipos(v); return h.tiposAtraso ?? Promise.resolve({ data: h.tipos, error: null }) }
          h.eq(c, v)
          return { maybeSingle: async () => (h.erroLeitura ? { data: null, error: { message: 'falhou' } } : { data: h.mapa, error: null }) }
        },
      }),
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

  it('o mapa só aparece ao comprador se o produtor ligar: Salvar grava is_active (desligado por padrão) e o botão avisa', async () => {
    montar('/producer/seating?eventId=e2')
    const salvar = await screen.findByRole('button', { name: /Salvar/ })
    await waitFor(() => expect((salvar as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(salvar)
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(1))
    expect(h.upsert.mock.calls[0][0].is_active).toBe(false)
    const ligar = screen.getByRole('button', { name: /Mostrar mapa para o comprador/ })
    expect(ligar.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(ligar)
    expect(h.toast.warning).toHaveBeenCalledWith(expect.stringMatching(/reservado por 10 minutos.*já vendido/), expect.anything())
    expect(screen.getByRole('button', { name: /Mapa visível para o comprador/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(salvar)
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(2))
    expect(h.upsert.mock.calls[1][0].is_active).toBe(true)
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

describe('Lugar marcado: setor ligado ao ingresso (E7a)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    h.eventos = dois
    h.erroLeitura = false
    h.upsert.mockResolvedValue({ error: null })
    h.tiposAtraso = null
    h.tipos = [
      { id: 'tt1', name: 'Pista', price: 80, type: 'individual', is_active: true },
      { id: 'tt2', name: 'Mesa Coletiva', price: 300, type: 'coletiva', is_active: true },
      { id: 'tt3', name: 'Camarote', price: 500, type: 'vip', is_active: false },
    ]
    h.mapa = { environments: [{ id: 'terreo', name: 'Térreo', seats: [], sections: [{ id: 'vip', name: 'VIP', color: '#000', price: 10 }] }], config: { zoom: 1, pan: { x: 0, y: 0 } } }
  })

  it('o select só lista ingresso ativo e não coletivo, grava ticketTypeId no setor e o aviso de não salvo pega', async () => {
    montar('/producer/seating?eventId=e1')
    const salvar = await screen.findByRole('button', { name: /Salvar/ })
    await waitFor(() => expect((salvar as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByText('Lotes & Preços'))
    expect(screen.getByText('Não vende (sem ingresso ligado)', { selector: 'div' })).toBeTruthy()
    const select = (await screen.findByLabelText('Ingresso deste setor')) as HTMLSelectElement
    await waitFor(() => expect(select.querySelector('option[value="tt1"]')).toBeTruthy())
    expect(select.querySelector('option[value="tt2"]')).toBeNull() // coletiva
    expect(select.querySelector('option[value="tt3"]')).toBeNull() // inativo
    expect(h.colunasTipos).toBe('id, name, price, type, is_active, max_per_order')

    const ev = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false) // ainda como carregado
    fireEvent.change(select, { target: { value: 'tt1' } })
    const ev2 = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(ev2)
    expect(ev2.defaultPrevented).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    await waitFor(() => expect(h.upsert).toHaveBeenCalledTimes(1))
    const setor = h.upsert.mock.calls[0][0].environments[0].sections[0]
    expect(setor.ticketTypeId).toBe('tt1')
    expect(setor.price).toBe(80) // preço do ingresso, só para exibição
  })

  it('trocar de evento recarrega os ingressos; "Ingresso indisponível" só aparece com a lista carregada', async () => {
    h.mapa = { environments: [{ id: 'terreo', name: 'Térreo', seats: [], sections: [{ id: 'vip', name: 'VIP', color: '#000', price: 10, ticketTypeId: 'tt-removido' }] }], config: { zoom: 1, pan: { x: 0, y: 0 } } }
    let entrega!: (v: unknown) => void
    h.tiposAtraso = new Promise(r => { entrega = r })
    montar('/producer/seating?eventId=e1')
    const salvar = await screen.findByRole('button', { name: /Salvar/ })
    await waitFor(() => expect((salvar as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByText('Lotes & Preços'))
    expect(h.eqTipos).toHaveBeenLastCalledWith('e1')
    // lista ainda carregando: texto neutro, sem acusar indisponível
    await screen.findByLabelText('Ingresso deste setor')
    expect(screen.queryByText(/Ingresso indisponível/)).toBeNull()
    expect(screen.getByText(/lista ainda não carregada/)).toBeTruthy()
    await act(async () => { entrega({ data: h.tipos, error: null }) })
    expect(await screen.findByText(/Ingresso indisponível/)).toBeTruthy() // lista carregada e tt-removido não está nela

    // troca de evento: nova leitura e, enquanto ela não volta, volta ao texto neutro
    h.tiposAtraso = new Promise(() => {})
    fireEvent.change(screen.getByLabelText('Evento do mapa'), { target: { value: 'e2' } })
    await waitFor(() => expect(h.eqTipos).toHaveBeenLastCalledWith('e2'))
    await waitFor(() => expect((screen.getByRole('button', { name: /Salvar/ }) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByText(/Ingresso indisponível/)).toBeNull()
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

  const entradaDaPlanta = () => document.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement
  // jsdom não decodifica imagem: informa o tamanho natural (proporção 2:1) e dispara o onLoad da planta
  const carregarPlanta = async () => {
    const img = await waitFor(() => {
      const el = document.querySelector('img[alt="Planta Baixa"]') as HTMLImageElement
      expect(el).toBeTruthy()
      return el
    })
    Object.defineProperty(img, 'naturalWidth', { value: 2000, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 1000, configurable: true })
    fireEvent.load(img)
  }
  const comPlanta = () => { h.mapa = { ...(h.mapa as object), config: { zoom: 1, pan: { x: 0, y: 0 }, background: { ...fundo, offset: { x: 150, y: 100 }, scale: 1 } } } }
  const pecas = [
    { tipo: 'table', x: 0.25, y: 0.5, w: 0.05, h: 0.1 },
    { tipo: 'table', x: 0.5, y: 0.5, w: 0.05, h: 0.1 },
    { tipo: 'stage', x: 0.5, y: 0.1, w: 0.3, h: 0.1 },
  ]

  it('PDF vira imagem no navegador, segue o caminho da imagem e é salvo como planta de fundo', async () => {
    h.eventos = dois
    h.mapa = { ...(h.mapa as object), config: { zoom: 1, pan: { x: 0, y: 0 }, background: null } }
    h.pdf.mockResolvedValue(new Blob(['png']))
    h.reduzir = async () => 'data:image/webp;base64,PDFPAGINA1'
    montar('/producer/seating?eventId=e1')
    const salvar = await screen.findByRole('button', { name: /Salvar/ })
    await waitFor(() => expect((salvar as HTMLButtonElement).disabled).toBe(false))
    await act(async () => { fireEvent.change(entradaDaPlanta(), { target: { files: [new File(['%PDF'], 'planta.pdf', { type: 'application/pdf' })] } }) })
    expect(h.pdf).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.querySelector('img[alt="Planta Baixa"]')).toBeTruthy())
    fireEvent.click(salvar)
    await waitFor(() => expect(h.upsert).toHaveBeenCalled())
    expect(h.upsert.mock.calls[0][0].config.background.image).toBe('data:image/webp;base64,PDFPAGINA1')
    h.reduzir = null
  })

  it('PDF que não abre mostra o motivo e não deixa planta', async () => {
    h.eventos = dois
    h.mapa = { ...(h.mapa as object), config: { zoom: 1, pan: { x: 0, y: 0 }, background: null } }
    h.pdf.mockRejectedValue(new Error('senha'))
    montar('/producer/seating?eventId=e1')
    await waitFor(() => expect((screen.getByRole('button', { name: /Salvar/ }) as HTMLButtonElement).disabled).toBe(false))
    await act(async () => { fireEvent.change(entradaDaPlanta(), { target: { files: [new File(['%PDF'], 'x.pdf', { type: 'application/pdf' })] } }) })
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(expect.stringMatching(/Não consegui abrir esse PDF/)))
    expect(document.querySelector('img[alt="Planta Baixa"]')).toBeNull()
  })

  it('lê com a IA, mostra a proposta sem tocar no mapa, desmarca uma peça e aplica só as marcadas, com a proporção da imagem', async () => {
    h.eventos = dois
    comPlanta()
    h.invoke.mockResolvedValue({ data: { ok: true, pecas, descartadas: 0, usage_id: 'u1', restante: 0, custo: 5 }, error: null })
    montar('/producer/seating?eventId=e1')
    const salvar = await screen.findByRole('button', { name: /Salvar/ })
    await waitFor(() => expect((salvar as HTMLButtonElement).disabled).toBe(false))
    await carregarPlanta()

    fireEvent.click(screen.getByLabelText('Leitor de mapa com IA'))
    expect(screen.getByText(/usa 5 créditos do Evo/)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ler com IA/ })) })
    expect(h.invoke).toHaveBeenCalledWith('agent', { body: { mode: 'planta', event_id: 'e1', imagem: fundo.image } })

    expect(await screen.findByRole('dialog', { name: 'Revisar a proposta da IA' })).toBeTruthy()
    expect(screen.getByText(/3 de 3 peças marcadas/)).toBeTruthy()
    expect(h.upsert).not.toHaveBeenCalled() // nada foi ao mapa
    const desmarcarMesa = screen.getAllByRole('button', { name: /Mesa Inteligente.*clique para desmarcar/ })
    fireEvent.click(desmarcarMesa[0])
    expect(screen.getByText(/2 de 3 peças marcadas/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Aplicar ao mapa \(2\)/ }))
    expect(screen.queryByRole('dialog', { name: 'Revisar a proposta da IA' })).toBeNull()
    expect(entradaDaPlanta()).toBeTruthy() // peças recém-aplicadas ficam selecionadas e o campo de arquivo continua montado
    fireEvent.click(salvar)
    await waitFor(() => expect(h.upsert).toHaveBeenCalled())
    const seats = h.upsert.mock.calls[0][0].environments[0].seats
    expect(seats.map((x: { type: string }) => x.type).sort()).toEqual(['stage', 'table'])
    // planta 1000 x 500 px (proporção 2:1), planta com escala 1, 40 px/m: palco em x=0.5, y=0.1
    const palco = seats.find((x: { type: string }) => x.type === 'stage')
    expect(palco.widthMeter).toBe(7.5)
    expect(palco.heightMeter).toBe(1.25)
  })

  it('fechar o modal durante a leitura: a proposta não fica órfã sobre a planta, e a leitura (já cobrada) reabre no painel de revisão', async () => {
    h.eventos = dois
    comPlanta()
    let responde!: (v: unknown) => void
    h.invoke.mockReturnValue(new Promise(r => { responde = r }))
    montar('/producer/seating?eventId=e1')
    await waitFor(() => expect((screen.getByRole('button', { name: /Salvar/ }) as HTMLButtonElement).disabled).toBe(false))
    await carregarPlanta()
    fireEvent.click(screen.getByLabelText('Leitor de mapa com IA'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ler com IA/ })) })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Leitor de planta com IA' })).getByRole('button', { name: 'Fechar' })) // fecha o modal com a leitura em andamento
    expect(screen.queryByRole('dialog', { name: 'Leitor de planta com IA' })).toBeNull()
    await act(async () => { responde({ data: { ok: true, pecas, descartadas: 0, usage_id: 'u1', restante: 0, custo: 5 }, error: null }) })
    expect(await screen.findByRole('dialog', { name: 'Revisar a proposta da IA' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.queryByRole('button', { name: /clique para desmarcar/ })).toBeNull() // sem painel, sem camada
  })

  it('trocar a planta durante a leitura descarta a proposta e não reabre o modal', async () => {
    h.eventos = dois
    comPlanta()
    let responde!: (v: unknown) => void
    h.invoke.mockReturnValue(new Promise(r => { responde = r }))
    h.reduzir = async () => 'data:image/webp;base64,OUTRA'
    montar('/producer/seating?eventId=e1')
    await waitFor(() => expect((screen.getByRole('button', { name: /Salvar/ }) as HTMLButtonElement).disabled).toBe(false))
    await carregarPlanta()
    fireEvent.click(screen.getByLabelText('Leitor de mapa com IA'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ler com IA/ })) })
    await act(async () => { fireEvent.change(entradaDaPlanta(), { target: { files: [new File(['x'], 'outra.png', { type: 'image/png' })] } }) })
    await act(async () => { responde({ data: { ok: true, pecas, descartadas: 0, usage_id: 'u1', restante: 0, custo: 5 }, error: null }) })
    expect(h.toast.info).toHaveBeenCalledWith(expect.stringMatching(/proposta foi descartada/))
    expect(screen.queryByRole('dialog', { name: 'Revisar a proposta da IA' })).toBeNull()
    h.reduzir = null
  })

  it('sem crédito: mostra quanto custa e quanto sobra, e não abre proposta', async () => {
    h.eventos = dois
    comPlanta()
    h.invoke.mockResolvedValue({ data: { ok: false, motivo: 'sem_credito', custo: 5, restante: 2 }, error: null })
    montar('/producer/seating?eventId=e1')
    await waitFor(() => expect((screen.getByRole('button', { name: /Salvar/ }) as HTMLButtonElement).disabled).toBe(false))
    await carregarPlanta()
    fireEvent.click(screen.getByLabelText('Leitor de mapa com IA'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ler com IA/ })) })
    expect(h.toast.error).toHaveBeenCalledWith('Esta leitura custa 5 créditos e você tem 2.')
    expect(screen.queryByRole('dialog', { name: 'Revisar a proposta da IA' })).toBeNull()
  })

  it('recusa do servidor usa a mensagem do Evo (arquivo inválido cai no texto do servidor)', async () => {
    h.eventos = dois
    comPlanta()
    h.invoke.mockResolvedValue({ data: { ok: false, motivo: 'teto_diario' }, error: null })
    montar('/producer/seating?eventId=e1')
    await waitFor(() => expect((screen.getByRole('button', { name: /Salvar/ }) as HTMLButtonElement).disabled).toBe(false))
    await carregarPlanta()
    fireEvent.click(screen.getByLabelText('Leitor de mapa com IA'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ler com IA/ })) })
    expect(h.toast.error).toHaveBeenCalledWith('O Evo atingiu o limite de uso de hoje. Tente de novo amanhã.')
  })

  it.each([
    ['limite_planta', 'Você fez muitas leituras de planta na última hora. Tente de novo mais tarde.'],
    ['planta_instavel', 'O leitor de planta está instável no momento. Tente de novo mais tarde. Esta tentativa não usou seus créditos.'],
  ])('recusa %s mostra a mensagem do leitor de planta e não abre proposta', async (motivo, texto) => {
    h.eventos = dois
    comPlanta()
    h.invoke.mockResolvedValue({ data: { ok: false, motivo }, error: null })
    montar('/producer/seating?eventId=e1')
    await waitFor(() => expect((screen.getByRole('button', { name: /Salvar/ }) as HTMLButtonElement).disabled).toBe(false))
    await carregarPlanta()
    fireEvent.click(screen.getByLabelText('Leitor de mapa com IA'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Ler com IA/ })) })
    expect(h.toast.error).toHaveBeenCalledWith(texto)
    expect(screen.queryByRole('dialog', { name: 'Revisar a proposta da IA' })).toBeNull()
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
