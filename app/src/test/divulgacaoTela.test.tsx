import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerDivulgacao from '../pages/producer/Divulgacao'

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
const banco = vi.hoisted(() => ({ eventos: { current: {} as Record<string, unknown> }, copiar: vi.fn(), fator: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => banco.eventos.current }))
vi.mock('../lib/vendasPagas', () => ({ faltaSegundoFator: banco.fator }))
vi.mock('sonner', () => ({ toast: banco.toast }))

const noAr = { id: 'e1', title: 'Festa Um', slug: 'festa-um', visibility: 'public', status: 'published', approval_status: 'approved', ticket_types: [] }
const rascunho = { id: 'e2', title: 'Festa Rascunho', slug: 'rascunho', visibility: 'public', status: 'draft', ticket_types: [] }
const eventos = (data: unknown[]) => ({ data, isPending: false, isError: false, isFetching: false, refetch: vi.fn() })

const Local = () => <span data-testid="url">{useLocation().pathname + useLocation().search}</span>
const montar = (url = '/producer/divulgacao') => render(
  <QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}><ProducerDivulgacao /><Local /></MemoryRouter></QueryClientProvider>,
)

beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); banco.fator.mockResolvedValue(false)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) // jsdom não desenha canvas
  banco.eventos.current = eventos([noAr, rascunho])
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: banco.copiar.mockResolvedValue(undefined) } })
})

describe('Divulgação: Links e QR', () => {
  it('monta o link com UTM do canal e da campanha, e copia', async () => {
    montar('/producer/divulgacao?eventId=e1')
    await userEvent.click(screen.getByRole('button', { name: 'WhatsApp' }))
    await userEvent.type(screen.getByLabelText(/Campanha/), 'Lançamento Lote 1')
    const link = (screen.getByLabelText('Link com UTM') as HTMLInputElement).value
    const u = new URL(link)
    expect(u.pathname).toBe('/event/festa-um')
    expect([u.searchParams.get('utm_source'), u.searchParams.get('utm_medium'), u.searchParams.get('utm_campaign')]).toEqual(['whatsapp', 'mensagem', 'lancamento-lote-1'])
    await userEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
    expect(banco.copiar).toHaveBeenCalledWith(link)
    expect(banco.toast.success).toHaveBeenCalledWith('Link copiado.')
  })

  it('sem a API de clipboard cai no plano B; se nada funciona, avisa', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('negado')) } })
    document.execCommand = vi.fn().mockReturnValue(false)
    montar('/producer/divulgacao?eventId=e1')
    await userEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(banco.toast.error).toHaveBeenCalled()
  })

  it('baixa o QR em PNG e em SVG', async () => {
    const png = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA')
    const cliques: { download: string; href: string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { cliques.push({ download: this.download, href: this.href }) })
    const criar = vi.fn().mockReturnValue('blob:x'); const revogar = vi.fn()
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: revogar })
    montar('/producer/divulgacao?eventId=e1')
    await userEvent.click(screen.getByRole('button', { name: 'Baixar PNG' }))
    await userEvent.click(screen.getByRole('button', { name: 'Baixar SVG' }))
    expect(png).toHaveBeenCalledWith('image/png')
    expect(cliques[0]).toEqual({ download: 'qr-festa-um-instagram.png', href: 'data:image/png;base64,AAAA' })
    expect(cliques[1].download).toBe('qr-festa-um-instagram.svg')
    const blob = criar.mock.calls[0][0] as Blob
    expect(blob.type).toBe('image/svg+xml')
    expect(await new Promise<string>(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsText(blob) })).toContain('<svg')
    await waitFor(() => expect(revogar).toHaveBeenCalled(), { timeout: 3000 }) // baixarArquivo revoga após 1000 ms; o timeout padrão do waitFor também é 1000 ms
  })

  it('guarda o link na lista (no navegador, por usuário), copia de lá e remove', async () => {
    montar('/producer/divulgacao?eventId=e1')
    expect(screen.getByText(/Nenhum link guardado/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar na lista' }))
    const lista = screen.getByRole('list')
    expect(within(lista).getByText(/Festa Um · Instagram/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('evk.divulgacao.u1')!)).toHaveLength(1)
    await userEvent.click(within(lista).getByRole('button', { name: /^Copiar link de Festa Um/ }))
    expect(banco.copiar).toHaveBeenCalledWith(expect.stringContaining('utm_source=instagram'))
    await userEvent.click(within(lista).getByRole('button', { name: /^Remover da lista/ }))
    expect(screen.getByText(/Nenhum link guardado/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('evk.divulgacao.u1')!)).toHaveLength(0)
  })

  it('lista guardada de evento que não é mais do produtor não aparece', () => {
    localStorage.setItem('evk.divulgacao.u1', JSON.stringify([{ id: 'x', eventId: 'alheio', evento: 'Festa Alheia', canal: 'email', campanha: '', url: 'https://a.com/', criadoEm: '2026-10-08T10:00:00Z' }]))
    montar()
    expect(screen.queryByText(/Festa Alheia/)).toBeNull()
  })

  it('link guardado de evento que saiu do ar ou mudou de endereço não tem "Copiar"', () => {
    const base = `${window.location.origin}/event`
    const item = (id: string, eventId: string, url: string) => ({ id, eventId, evento: 'Festa', canal: 'email', campanha: '', url, criadoEm: '2026-10-08T10:00:00Z' })
    localStorage.setItem('evk.divulgacao.u1', JSON.stringify([
      item('a', 'e1', `${base}/festa-um?utm_source=email&utm_medium=email`),
      item('b', 'e1', `${base}/slug-antigo?utm_source=email&utm_medium=email`),
      item('c', 'e2', `${base}/rascunho?utm_source=email&utm_medium=email`),
    ]))
    montar()
    expect(screen.getAllByRole('button', { name: /^Copiar link de Festa/ })).toHaveLength(1)
    expect(screen.getAllByText('Fora do ar')).toHaveLength(2)
  })

  it('lista de eventos vazia com 2FA pendente não vira "nenhum evento no ar"', async () => {
    banco.eventos.current = eventos([]); banco.fator.mockResolvedValue(true)
    montar()
    expect(await screen.findByText('Confirme o 2FA para ver os seus eventos')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum evento no ar ainda')).toBeNull()
  })

  it('?eventId= de outro produtor é recusado e não monta link', async () => {
    montar('/producer/divulgacao?eventId=alheio')
    expect(screen.getByText('Evento não encontrado entre os seus')).toBeInTheDocument()
    expect(screen.queryByLabelText('Link com UTM')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Escolher outro evento' }))
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/producer\/divulgacao$/)
  })

  it('evento fora do ar não gera link; o select só oferece os que estão no ar', () => {
    montar('/producer/divulgacao?eventId=e2')
    expect(screen.getByText('Este evento ainda não está no ar')).toBeInTheDocument()
    expect(screen.queryByLabelText('Link com UTM')).toBeNull()
    const opcoes = within(screen.getByLabelText('Evento')).getAllByRole('option').map(o => o.textContent)
    expect(opcoes).toContain('Festa Um')
    expect(opcoes).toContain('Festa Rascunho (fora do ar)')
  })

  it('escolher o evento grava na URL', async () => {
    montar()
    await userEvent.selectOptions(screen.getByLabelText('Evento'), 'e1')
    expect(screen.getByTestId('url')).toHaveTextContent('eventId=e1')
  })

  it('estados: carregando, erro com "Tentar de novo", sem evento no ar', async () => {
    banco.eventos.current = { data: undefined, isPending: true, isError: false, isFetching: true, refetch: vi.fn() }
    const a = montar(); expect(screen.getByLabelText('Carregando eventos')).toHaveAttribute('aria-busy', 'true'); a.unmount()
    const refetch = vi.fn(); banco.eventos.current = { data: undefined, isPending: false, isError: true, isFetching: false, refetch }
    const b = montar(); await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })); expect(refetch).toHaveBeenCalled(); b.unmount()
    banco.eventos.current = eventos([rascunho]); montar()
    expect(await screen.findByText('Nenhum evento no ar ainda')).toBeInTheDocument()
  })

  it('diz a verdade: sem receita por canal e UTM só no Google Analytics; tem os 6 Em breve desativados', () => {
    montar()
    expect(screen.getByText(/ainda não grava de onde veio a compra/)).toBeInTheDocument()
    expect(screen.getByText(/Google Analytics/)).toBeInTheDocument()
    expect(screen.getAllByText('Em breve').length).toBeGreaterThanOrEqual(6)
    for (const nome of ['Convidar por e-mail', 'Criar ingresso privado', 'Ver receita por canal', 'Ver extrato', 'Agendar banner', 'Abrir integrações']) {
      expect(screen.getByRole('button', { name: nome })).toBeDisabled()
    }
  })

  it('as 4 abas levam o ?eventId= junto', async () => {
    montar('/producer/divulgacao?eventId=e1')
    const abas = screen.getByRole('tablist', { name: 'Divulgação' })
    expect(within(abas).getAllByRole('tab').map(t => t.textContent)).toEqual(['Links e QR', 'Afiliados', 'Banners', 'Lista de interesse'])
    expect(within(abas).getByRole('tab', { name: 'Links e QR' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(within(abas).getByRole('tab', { name: 'Afiliados' }))
    expect(screen.getByTestId('url')).toHaveTextContent('/producer/afiliados?eventId=e1')
  })
})
