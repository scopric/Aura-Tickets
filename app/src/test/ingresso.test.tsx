import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import IngressosDoEvento from '../components/Ingresso'
import Tickets from '../pages/app/Tickets'
import { ThemeProvider } from '../contexts/ThemeContext'
import { agruparPorEvento, baixarIcs, diasAte, ehProximo, formatarFalta, gerarIcs, hojeISO, inicioDoEvento, leituraFalta, linkMapa, motivoEvento, motivoSemQr, salvarQrPng } from '../lib/ingresso'
import type { DbTicket } from '../hooks/useCheckout'

const evento = {
  id: 'e1', title: 'Noite de Forró', cover_image: null, date: '2026-12-12', time: '22:00:00',
  venue_name: 'Espaço Torres', venue_address: 'Rua das Flores, 100', venue_city: 'Curitiba', venue_state: 'PR', accent_color: '#a55c65',
}
const ticket = (n: number, extra: Partial<DbTicket> = {}): DbTicket => ({
  id: `t${n}`, event_id: 'e1', order_id: 'abcdef12-0000-0000-0000-000000000000', ticket_type_id: 'tt', user_id: 'u', code: `EVK-000${n}`, status: 'active',
  seat_info: null, buyer_name: 'Ricardo Scoparo', checked_in_at: null, created_at: '2026-10-01T12:00:00Z', updated_at: '',
  ticket_types: { name: 'Pista', price: 50, type: 'individual' }, events: evento, ...extra,
})
const tela = (n: number, extra: { abrirNoQr?: boolean; evento?: typeof evento } = {}) => (
  <MemoryRouter><ThemeProvider><IngressosDoEvento ingressos={Array.from({ length: n }, (_, i) => ticket(i + 1))} evento={extra.evento ?? evento} abrirNoQr={extra.abrirNoQr} /></ThemeProvider></MemoryRouter>
)

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete (navigator as { wakeLock?: unknown }).wakeLock })

describe('.ics', () => {
  it('traz título, data, hora (em UTC, a partir do horário de Brasília) e local; linhas terminam em CRLF', () => {
    const ics = gerarIcs({ id: 'e1', titulo: 'Noite de Forró', data: '2026-12-12', hora: '22:00:00', local: 'Espaço Torres' }, new Date('2026-10-03T21:42:00Z'))!
    expect(ics.split('\r\n')).toEqual(expect.arrayContaining([
      'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:e1@evokaa', 'DTSTAMP:20261003T214200Z', 'DTSTART:20261213T010000Z',
      'SUMMARY:Noite de Forró', 'LOCATION:Espaço Torres', 'END:VEVENT', 'END:VCALENDAR',
    ]))
    expect(ics).not.toContain('DTEND')
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })
  it('usa o end_date do evento como DTEND quando vem depois do início', () => {
    const base = { id: 'x', titulo: 'Festival', data: '2026-12-12', hora: '22:00' }
    expect(gerarIcs({ ...base, fim: '2026-12-13T07:00:00Z' })).toContain('DTEND:20261213T070000Z')
    expect(gerarIcs({ ...base, fim: '2026-12-12T20:00:00Z' })).not.toContain('DTEND') // fim antes do início: ignora
  })
  it('escapa vírgula, ponto e vírgula, barra, quebra de linha e retorno de carro', () => {
    const ics = gerarIcs({ id: 'x', titulo: 'A, B; C \\ D\nE\r\nF\rG', data: '2026-12-12', hora: '09:30', local: 'Rua 1, 2' })!
    expect(ics).toContain(String.raw`SUMMARY:A\, B\; C \\ D\nE\nF\nG` + '\r\n')
    expect(ics).toContain(String.raw`LOCATION:Rua 1\, 2` + '\r\n')
  })
  it('sem hora vira dia inteiro, sem DTEND (vale um dia); sem data não gera', () => {
    const ics = gerarIcs({ id: 'x', titulo: 'Feira', data: '2026-12-31', fim: '2027-01-02T00:00:00Z' })!
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231')
    expect(ics).not.toContain('DTEND')
    expect(ics).not.toContain('LOCATION')
    expect(gerarIcs({ id: 'x', titulo: 'Feira', data: null })).toBeNull()
  })
  it('dobra linha longa em 75 bytes sem partir caractere acentuado', () => {
    const ics = gerarIcs({ id: 'x', titulo: 'Forró '.repeat(40), data: '2026-12-12', hora: '22:00' })!
    for (const l of ics.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(ics.replace(/\r\n /g, '')).toContain(`SUMMARY:${'Forró '.repeat(40)}`)
  })
  it('baixarIcs entrega um Blob text/calendar', () => {
    const criar = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    baixarIcs('BEGIN:VCALENDAR', 'Noite de Forró')
    const blob = (criar.mock.calls[0] as unknown[])[0] as Blob
    expect(blob.type).toBe('text/calendar;charset=utf-8')
  })
})

describe('alarme e QR como imagem', () => {
  it('.ics com hora traz o alarme 2 h antes; dia inteiro não', () => {
    const base = { id: 'e1', titulo: 'Noite de Forró', data: '2026-12-12' }
    const linhas = gerarIcs({ ...base, hora: '22:00' })!.split('\r\n')
    expect(linhas).toEqual(expect.arrayContaining(['BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT2H', 'DESCRIPTION:Noite de Forró começa em 2 horas', 'END:VALARM']))
    expect(linhas.indexOf('END:VALARM')).toBeLessThan(linhas.indexOf('END:VEVENT')) // o alarme fica dentro do VEVENT
    expect(gerarIcs(base)).not.toContain('VALARM')
  })
  it('evento cancelado ou fora do ar (rascunho) tira o QR e diz o motivo', () => {
    expect(motivoEvento({ status: 'cancelled' })).toBe('Evento cancelado')
    expect(motivoEvento({ status: 'draft' })).toBe('Evento fora do ar')
    expect(motivoEvento({ status: 'published' })).toBeNull()
    expect(motivoEvento(undefined)).toBeNull()
    expect(motivoSemQr(ticket(1, { events: { ...evento, status: 'draft' } }))).toBe('Evento fora do ar')
  })
  it('salvarQrPng: abre a folha de compartilhar com o PNG; cancelar não é erro; sem compartilhar, baixa o arquivo', async () => {
    vi.stubGlobal('Image', class { src = ''; decode() { return Promise.resolve() } })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, drawImage() {}, fillStyle: '' } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(cb => cb(new Blob(['x'], { type: 'image/png' })))
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const share = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { canShare: () => true, share })
    await salvarQrPng(svg, 'EVK-0001')
    const arquivo = share.mock.calls[0][0].files[0] as File
    expect([arquivo.name, arquivo.type]).toEqual(['EVK-0001.png', 'image/png'])
    share.mockRejectedValueOnce(Object.assign(new Error('cancelou'), { name: 'AbortError' }))
    await expect(salvarQrPng(svg, 'EVK-0001')).resolves.toBeUndefined()
    const baixar = vi.fn()
    URL.createObjectURL = () => 'blob:x'
    URL.revokeObjectURL = () => {}
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(baixar)
    Object.assign(navigator, { canShare: undefined })
    await salvarQrPng(svg, 'EVK-0001')
    expect(baixar).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
    delete (navigator as { share?: unknown }).share
    delete (navigator as { canShare?: unknown }).canShare
  })
  it('o QR ampliado tem "Salvar QR como imagem"', () => {
    render(tela(1, { abrirNoQr: true }))
    fireEvent.click(screen.getByRole('button', { name: /Ampliar o QR/ }))
    expect(screen.getByRole('button', { name: /Salvar QR como imagem/ })).toBeTruthy()
  })
})

describe('mapa e carteira', () => {
  it('link do mapa codifica o endereço', () => {
    expect(linkMapa('Espaço Torres, Rua A & B')).toBe('https://www.google.com/maps/search/?api=1&query=Espa%C3%A7o%20Torres%2C%20Rua%20A%20%26%20B')
  })
  it('evento noturno continua próximo depois da meia-noite, até as 12h do dia seguinte (Brasília)', () => {
    const t = ticket(1) // 12/12, 22h, sem end_date
    expect(ehProximo(t, Date.parse('2026-12-12T22:30:00-03:00'))).toBe(true)
    expect(ehProximo(t, Date.parse('2026-12-13T00:30:00-03:00'))).toBe(true) // virou a meia-noite
    expect(ehProximo(t, Date.parse('2026-12-13T11:59:00-03:00'))).toBe(true)
    expect(ehProximo(t, Date.parse('2026-12-13T12:00:00-03:00'))).toBe(false)
  })
  it('com end_date vale o instante real, em qualquer fuso', () => {
    const t = ticket(1, { events: { ...evento, end_date: '2026-12-13T05:00:00Z' } }) // 02h de Brasília
    expect(ehProximo(t, Date.parse('2026-12-13T01:59:00-03:00'))).toBe(true)
    expect(ehProximo(t, Date.parse('2026-12-13T02:01:00-03:00'))).toBe(false)
  })
  it('usado, cancelado e transferido nunca são próximos; sem data o ingresso ativo é próximo', () => {
    const agora = Date.parse('2026-12-12T20:00:00-03:00')
    for (const status of ['used', 'cancelled', 'transferred'] as const) expect(ehProximo(ticket(1, { status }), agora)).toBe(false)
    expect(ehProximo(ticket(1, { events: { ...evento, date: null } }), agora)).toBe(true)
  })
  it('QR só vale para ingresso ativo de evento em pé: diz o motivo nos demais', () => {
    const agora = Date.parse('2026-12-12T20:00:00-03:00')
    expect(motivoSemQr(ticket(1), agora)).toBeNull()
    expect(motivoSemQr(ticket(1, { status: 'used' }), agora)).toBe('Ingresso já usado')
    expect(motivoSemQr(ticket(1, { status: 'cancelled' }), agora)).toBe('Ingresso cancelado')
    expect(motivoSemQr(ticket(1, { events: { ...evento, status: 'cancelled' } }), agora)).toBe('Evento cancelado')
    const comFim = ticket(1, { events: { ...evento, end_date: '2026-12-13T05:00:00Z' } })
    expect(motivoSemQr(comFim, Date.parse('2026-12-13T01:00:00-03:00'))).toBeNull() // end_date ainda não passou
    expect(motivoSemQr(comFim, Date.parse('2026-12-13T03:00:00-03:00'))).toBe('Evento encerrado')
    expect(motivoSemQr(ticket(1), Date.parse('2026-12-20T12:00:00-03:00'))).toBeNull() // sem end_date: o QR fica (evento de vários dias)
  })
  it('agrupa por evento em ordem cronológica (ou do mais recente ao mais antigo)', () => {
    const e2 = { ...evento, id: 'e2', date: '2026-11-01' }
    const lista = [ticket(1), ticket(2), ticket(3, { events: e2, event_id: 'e2' })]
    expect(agruparPorEvento(lista).map(g => [g.id, g.ingressos.length])).toEqual([['e2', 1], ['e1', 2]])
    expect(agruparPorEvento(lista, true).map(g => g.id)).toEqual(['e1', 'e2'])
    expect(diasAte('2026-12-12', '2026-12-11')).toBe(1)
    expect(hojeISO(new Date('2026-12-13T02:00:00Z'))).toBe('2026-12-12') // 23h em Brasília ainda é dia 12
  })
})

const carteira = (tickets: DbTicket[], entrada = '/app/tickets') => {
  const qc = new QueryClient()
  qc.setQueryData(['user-tickets', undefined], tickets)
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[entrada]}><ThemeProvider><Tickets /></ThemeProvider></MemoryRouter></QueryClientProvider>)
}

describe('Carteira', () => {
  const passado = { ...evento, date: '2026-01-10', time: '20:00:00' }
  it('o link direto ?evento= abre o ingresso ativo de evento anterior sem end_date, com QR', () => {
    carteira([ticket(1, { events: passado })], '/app/tickets?evento=e1')
    expect(screen.getByRole('button', { name: /Mostrar QR/ })).toBeTruthy()
  })
  it('o link direto de evento com end_date vencida abre sem QR: diz que o evento acabou', () => {
    carteira([ticket(1, { events: { ...passado, end_date: '2026-01-11T02:00:00Z' } })], '/app/tickets?evento=e1')
    expect(screen.getByRole('status').textContent).toContain('Evento encerrado')
    expect(screen.queryByRole('button', { name: /Mostrar QR/ })).toBeNull()
  })
  it('evento anterior com ingressos de situações diferentes mostra a contagem por situação', () => {
    carteira([ticket(1, { status: 'used', events: passado }), ticket(2, { status: 'cancelled', events: passado }), ticket(3, { status: 'cancelled', events: passado })])
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Anteriores/ }), { button: 0 })
    fireEvent.click(screen.getByRole('tab', { name: /Anteriores/ }))
    expect(screen.getByText('1 usado · 2 cancelados')).toBeTruthy()
  })
  it('evento próximo com tipos diferentes mostra só a quantidade, sem o tipo do primeiro ingresso', () => {
    const futuro = { ...evento, date: '2099-01-01' }
    const vip = { name: 'VIP', price: 90, type: 'individual' }
    carteira([ticket(1, { events: futuro }), ticket(2, { events: futuro, ticket_types: vip })])
    expect(screen.getByText('2 ingressos')).toBeTruthy()
    expect(screen.queryByText(/Pista · 2/)).toBeNull()
  })
})

describe('IngressosDoEvento', () => {
  it('evento cancelado: avisa o motivo e não oferece o QR', () => {
    render(<MemoryRouter><ThemeProvider><IngressosDoEvento ingressos={[ticket(1, { events: { ...evento, status: 'cancelled' } })]} evento={{ ...evento, status: 'cancelled' }} abrirNoQr /></ThemeProvider></MemoryRouter>)
    expect(screen.getByRole('status').textContent).toContain('Evento cancelado')
    expect(screen.queryByRole('button', { name: /Mostrar QR/ })).toBeNull()
    expect(screen.queryByText('EVK-0001', { selector: 'span' })).toBeNull()
  })
  it('"1 de N" quando há vários ingressos; navega e respeita os limites; um só não mostra o contador', () => {
    const { unmount } = render(tela(3))
    expect(screen.getByText('1 de 3')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Ingresso anterior' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Próximo ingresso' }))
    expect(screen.getByText('2 de 3')).toBeTruthy()
    expect(document.body.textContent).toContain('EVK-0002')
    fireEvent.click(screen.getByRole('button', { name: 'Próximo ingresso' }))
    expect((screen.getByRole('button', { name: 'Próximo ingresso' }) as HTMLButtonElement).disabled).toBe(true)
    unmount()
    render(tela(1))
    expect(screen.queryByText(/ de 1/)).toBeNull()
  })

  it('"Mostrar QR" vira o ingresso (frente com a arte, verso com o QR) e volta; trocar de ingresso volta à frente', () => {
    const { container } = render(tela(2))
    const face = () => container.querySelector('.ingresso-virador')!.getAttribute('data-face')
    expect(face()).toBe('frente')
    expect(screen.queryByRole('button', { name: /Ampliar o QR/ })).toBeNull() // o QR fica no verso
    expect(container.querySelector('.evcapa')).not.toBeNull() // a frente é a arte do evento
    fireEvent.click(screen.getByRole('button', { name: /Mostrar QR/ }))
    expect(face()).toBe('verso')
    expect(screen.getByRole('button', { name: /Ampliar o QR/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Mostrar QR/ })).toBeNull() // frente escondida
    fireEvent.click(screen.getByRole('button', { name: /Voltar para a arte/ }))
    expect(face()).toBe('frente')
    fireEvent.click(screen.getByRole('button', { name: /Mostrar QR/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Próximo ingresso' }))
    expect(face()).toBe('frente')
  })

  it('ao virar, o foco vai para o botão da face visível e a escondida fica inert', async () => {
    const { container } = render(tela(1))
    const face = (c: string) => container.querySelector(c) as HTMLElement
    fireEvent.click(screen.getByRole('button', { name: /Mostrar QR/ }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /Voltar para a arte/ })))
    expect(face('.ingresso-frente').hasAttribute('inert')).toBe(true)
    expect(face('.ingresso-verso').hasAttribute('inert')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Voltar para a arte/ }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /Mostrar QR/ })))
    expect(face('.ingresso-verso').hasAttribute('inert')).toBe(true)
  })

  it('vindo do botão do QR da carteira, o ingresso já abre virado', () => {
    const { container } = render(tela(1, { abrirNoQr: true }))
    expect(container.querySelector('.ingresso-virador')!.getAttribute('data-face')).toBe('verso')
  })

  it('Detalhes abre o titular, o pedido e as regras', () => {
    render(tela(1))
    fireEvent.click(screen.getByRole('button', { name: /Detalhes/ }))
    const d = screen.getByRole('dialog')
    expect(d.textContent).toContain('Ricardo Scoparo')
    expect(d.textContent).toContain('#ABCDEF12')
    expect(d.textContent).toContain('Regras')
  })

  it('o QR é o código do ingresso, como sempre', () => {
    const { container } = render(tela(1, { abrirNoQr: true }))
    expect(container.querySelector('svg title')?.textContent).toBe('QR Code do ingresso EVK-0001')
  })

  it('Agenda gera o .ics do evento', async () => {
    const criar = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(tela(1))
    fireEvent.click(screen.getByRole('button', { name: /Agenda/ }))
    const blob = (criar.mock.calls[0] as unknown[])[0] as Blob
    const texto = await new Promise<string>(r => { const f = new FileReader(); f.onload = () => r(String(f.result)); f.readAsText(blob) })
    expect(texto).toContain('SUMMARY:Noite de Forró')
    expect(texto).toContain('DTSTART:20261213T010000Z')
    expect(texto).toContain('LOCATION:Espaço Torres\\, Rua das Flores\\, 100\\, Curitiba\\, PR')
  })

  it('Como chegar abre o mapa com o endereço', () => {
    render(tela(1))
    const a = screen.getByRole('link', { name: /Como chegar/ }) as HTMLAnchorElement
    expect(a.href).toContain('google.com/maps/search/?api=1&query=' + encodeURIComponent('Espaço Torres, Rua das Flores, 100, Curitiba, PR'))
    expect(a.rel).toContain('noopener')
  })

  it('não oferece Transferir (só depois do M5)', () => {
    render(tela(1))
    expect(screen.queryByText(/Transferir/)).toBeNull()
  })

  it('QR ampliado sem Wake Lock no aparelho abre normalmente, sem erro e sem prometer tela acesa', () => {
    render(tela(1, { abrirNoQr: true }))
    expect('wakeLock' in navigator).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Ampliar o QR/ }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Mostre na entrada')).toBeTruthy()
    expect(screen.queryByText(/tela fica acesa/)).toBeNull()
  })

  it('QR ampliado com Wake Lock pede a tela acesa e solta ao fechar', async () => {
    const release = vi.fn(() => Promise.resolve())
    const request = vi.fn(() => Promise.resolve({ release, addEventListener: vi.fn() }))
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
    render(tela(1, { abrirNoQr: true }))
    fireEvent.click(screen.getByRole('button', { name: /Ampliar o QR/ }))
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'))
    expect(await screen.findByText(/tela fica acesa/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Fechar/ }))
    await waitFor(() => expect(release).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('fechar o QR ampliado devolve o foco ao botão que o abriu', async () => {
    render(tela(1, { abrirNoQr: true }))
    const ampliar = screen.getByRole('button', { name: /Ampliar o QR/ })
    ampliar.focus()
    fireEvent.click(ampliar)
    fireEvent.click(await screen.findByRole('button', { name: /Fechar/ }))
    await waitFor(() => expect(ampliar).toHaveFocus())
  })

  it('Wake Lock recusado pelo aparelho não quebra', async () => {
    const request = vi.fn(() => Promise.reject(new Error('NotAllowedError')))
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
    render(tela(1, { abrirNoQr: true }))
    fireEvent.click(screen.getByRole('button', { name: /Ampliar o QR/ }))
    await waitFor(() => expect(request).toHaveBeenCalled())
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('contagem regressiva só no dia, até o início, a partir de data + hora reais', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(new Date('2026-12-12T21:42:00-03:00'))
    render(tela(1))
    expect(screen.getAllByText('00:18:00').length).toBeGreaterThan(0)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getAllByText('00:17:59').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Começa em 17 minutos').length).toBeGreaterThan(0) // leitura para leitor de tela
    act(() => { vi.advanceTimersByTime(18 * 60 * 1000) })
    expect(screen.queryByText(/^\d\d:\d\d:\d\d$/)).toBeNull() // já começou: sem contagem
  })

  it('fora do dia do evento não há contagem, só "Em N dias"', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(new Date('2026-12-01T10:00:00-03:00'))
    render(tela(1))
    expect(screen.queryByText(/^\d\d:\d\d/)).toBeNull()
    expect(screen.getAllByText('Em 11 dias').length).toBeGreaterThan(0)
  })

  it('com reduzir movimento a contagem atualiza só a cada minuto e sem segundos', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(new Date('2026-12-12T21:42:00-03:00'))
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }))
    render(tela(1))
    expect(screen.getAllByText('00:18').length).toBeGreaterThan(0)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getAllByText('00:18').length).toBeGreaterThan(0) // nada mudou em 5 s
    act(() => { vi.advanceTimersByTime(55_000) })
    expect(screen.getAllByText('00:17').length).toBeGreaterThan(0)
    vi.unstubAllGlobals()
  })
})

describe('contas da contagem', () => {
  it('formata, lê e calcula o início', () => {
    expect(formatarFalta(17 * 60_000 + 57_000)).toBe('00:17:57')
    expect(formatarFalta(17 * 60_000 + 57_000, true)).toBe('00:17')
    expect(leituraFalta(125 * 60_000)).toBe('Começa em 2 horas e 5 minutos')
    expect(leituraFalta(30_000)).toBe('Começa em menos de um minuto')
    expect(inicioDoEvento('2026-12-12', '22:00:00')!.toISOString()).toBe('2026-12-13T01:00:00.000Z')
    expect(inicioDoEvento('2026-12-12', null)).toBeNull()
  })
})
