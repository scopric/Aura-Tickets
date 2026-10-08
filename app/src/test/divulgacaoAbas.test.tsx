import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerAffiliates from '../pages/producer/Affiliates'
import ProducerEventBanners from '../pages/producer/EventBanners'
import ProducerInterestList from '../pages/producer/InterestList'

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
const banco = vi.hoisted(() => ({
  afiliados: { current: [] as unknown[] }, banners: { current: {} as Record<string, unknown> }, interessados: { current: {} as Record<string, unknown> },
  eventosErro: { current: false }, refetchEventos: vi.fn(), fator: vi.fn(), baixar: vi.fn(), copiar: vi.fn(), toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: banco.toast }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({
  useProducerEvents: () => banco.eventosErro.current ? { data: undefined, isPending: false, isError: true, isFetching: false, refetch: banco.refetchEventos } : ({
    data: [
      { id: 'e1', title: 'Festa Um', slug: 'festa-um', visibility: 'public', status: 'published', approval_status: 'approved', ticket_types: [] },
      { id: 'e2', title: 'Festa Rascunho', slug: 'r', visibility: 'public', status: 'draft', ticket_types: [] },
    ], isPending: false, isError: false,
  }),
}))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: () => Promise.resolve({ data: banco.afiliados.current, error: null }) } }))
vi.mock('../lib/vendasPagas', () => ({ faltaSegundoFator: banco.fator }))
vi.mock('../lib/exportCsv', async orig => ({ ...(await orig<typeof import('../lib/exportCsv')>()), downloadCsv: banco.baixar }))
const parado = { mutateAsync: vi.fn(), isPending: false }
vi.mock('../hooks/useProducerTools', () => ({
  useEventBanners: () => banco.banners.current, useCreateBanner: () => parado, useUpdateBanner: () => parado, useDeleteBanner: () => parado,
}))
vi.mock('../hooks/useInteresse', () => ({ useInteressados: () => banco.interessados.current, useRemoverInteressado: () => parado }))

const Local = () => <span data-testid="url">{useLocation().pathname + useLocation().search}</span>
const montar = (ui: React.ReactNode, url: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[url]}>{ui}<Local /></MemoryRouter></QueryClientProvider>,
)
const nomesDasAbas = () => within(screen.getByRole('tablist', { name: 'Divulgação' })).getAllByRole('tab').map(t => t.textContent)
const ABAS = ['Links e QR', 'Afiliados', 'Banners', 'Lista de interesse']

const afi = (id: string, sales: number, total_earned: number, status = 'active') => ({ id, email_mascarado: `${id}***@x.com`, commission_percent: 10, status, event_id: 'e1', evento: 'Festa Um', sales, total_earned, created_at: '2026-01-01' })
const banner = (id: string, active: boolean, clicks = 0) => ({ id, name: `Banner ${id}`, event_name: 'Festa', image_url: 'https://x.com/a.png', position: 'hero', active, clicks, created_at: '2026-10-01T10:00:00Z' })
const pessoa = (id: string, extra: Record<string, unknown> = {}) => ({ id, event_id: 'e1', event_title: 'Festa Um', full_name: 'Ana', email: 'ana@x.y', city: 'Curitiba', notified: false, notified_at: null, consentiu: true, created_at: '2026-10-01T10:00:00Z', ...extra })
const ok = (data: unknown[]) => ({ data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() })

beforeEach(() => {
  vi.clearAllMocks(); banco.eventosErro.current = false
  banco.fator.mockResolvedValue(false)
  banco.afiliados.current = []
  banco.banners.current = ok([])
  banco.interessados.current = ok([])
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: banco.copiar.mockResolvedValue(undefined) } })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

describe('faixa de abas nas três páginas', () => {
  it('Afiliados, Banners e Lista de interesse mostram as 4 abas, a própria marcada, e levam o ?eventId=', async () => {
    banco.afiliados.current = [afi('af1', 0, 0)]
    for (const [ui, rota, aba] of [
      [<ProducerAffiliates />, '/producer/afiliados', 'Afiliados'],
      [<ProducerEventBanners />, '/producer/banners', 'Banners'],
      [<ProducerInterestList />, '/producer/lista-interesse', 'Lista de interesse'],
    ] as const) {
      const r = montar(ui, `${rota}?eventId=e1`)
      await screen.findByRole('tablist', { name: 'Divulgação' })
      expect(nomesDasAbas()).toEqual(ABAS)
      expect(screen.getByRole('tab', { name: aba })).toHaveAttribute('aria-selected', 'true')
      await userEvent.click(screen.getByRole('tab', { name: 'Links e QR' }))
      expect(screen.getByTestId('url')).toHaveTextContent('/producer/divulgacao?eventId=e1')
      r.unmount()
    }
  })
})

describe('abas e ?eventId=', () => {
  it('Banners e Lista de interesse não recebem o eventId; Afiliados e Links e QR recebem', async () => {
    banco.afiliados.current = [afi('af1', 0, 0)]
    for (const [aba, url] of [['Banners', '/producer/banners'], ['Lista de interesse', '/producer/lista-interesse'], ['Links e QR', '/producer/divulgacao?eventId=e1']]) {
      const r = montar(<ProducerAffiliates />, '/producer/afiliados?eventId=e1')
      await screen.findByRole('tablist', { name: 'Divulgação' })
      await userEvent.click(screen.getByRole('tab', { name: aba }))
      expect(screen.getByTestId('url').textContent).toBe(url)
      r.unmount()
    }
  })
})

describe('Afiliados', () => {
  it('KPIs com o que listar_afiliados devolve e Em breve para link e extrato', async () => {
    banco.afiliados.current = [afi('af1', 3, 150), afi('af2', 2, 50.5), afi('af3', 0, 0, 'inactive')]
    montar(<ProducerAffiliates />, '/producer/afiliados')
    const ativos = (await screen.findByText('Afiliados ativos')).closest('div')!.parentElement!
    expect(within(ativos).getByText('2')).toBeInTheDocument()
    expect(within(ativos).getByText('de 3 vinculados')).toBeInTheDocument()
    expect(screen.getByText('Vendas').closest('div')!.parentElement!).toHaveTextContent('5')
    expect(screen.getByText('Comissão total').closest('div')!.parentElement!).toHaveTextContent(/200,50/)
    for (const nome of ['Copiar link', 'Ver extrato']) expect(screen.getByRole('button', { name: nome })).toBeDisabled()
  })
  it('2FA pendente não vira "nenhum afiliado"', async () => {
    banco.fator.mockResolvedValue(true)
    montar(<ProducerAffiliates />, '/producer/afiliados')
    expect(await screen.findByText('Confirme o 2FA para ver os afiliados')).toBeInTheDocument()
  })
  it('vazio de verdade explica o próximo passo', async () => {
    montar(<ProducerAffiliates />, '/producer/afiliados')
    expect(await screen.findByText('Nenhum afiliado vinculado')).toBeInTheDocument()
  })
})

describe('Banners', () => {
  it('avisa que não aparecem no site público, KPIs de ativos e cliques e agendar é Em breve', () => {
    banco.banners.current = ok([banner('a', true, 4), banner('b', false, 1)])
    montar(<ProducerEventBanners />, '/producer/banners')
    expect(screen.getByText('Os banners ainda não aparecem no site público.')).toBeInTheDocument()
    expect(screen.getByText('Banners ativos').closest('div')!.parentElement!).toHaveTextContent('1')
    expect(screen.getByText('Cliques').closest('div')!.parentElement!).toHaveTextContent('5')
    expect(screen.getByRole('button', { name: 'Agendar' })).toBeDisabled()
  })
  it('erro tem "Tentar de novo"; vazio tem próximo passo', async () => {
    const refetch = vi.fn(); banco.banners.current = { data: [], isLoading: false, isError: true, isFetching: false, refetch }
    const r = montar(<ProducerEventBanners />, '/producer/banners')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })); expect(refetch).toHaveBeenCalled(); r.unmount()
    banco.banners.current = ok([]); montar(<ProducerEventBanners />, '/producer/banners')
    expect(screen.getByText('Nenhum banner ainda')).toBeInTheDocument()
  })
})

describe('Lista de interesse', () => {
  beforeEach(() => { banco.interessados.current = ok([pessoa('a', { notified: true, notified_at: '2026-10-10T10:00:00Z' }), pessoa('b', { full_name: '=SOMA(1)', email: 'b@x.y' }), pessoa('c', { event_id: 'e9', event_title: 'Outra', full_name: 'Zé' })]) })

  it('KPIs de inscritos, avisados e pendentes (do evento da URL)', () => {
    montar(<ProducerInterestList />, '/producer/lista-interesse?eventId=e1')
    expect(screen.getByText('Inscritos').closest('div')!.parentElement!).toHaveTextContent('2')
    expect(screen.getByText('Avisados').closest('div')!.parentElement!).toHaveTextContent('1')
    expect(screen.getByText('Pendentes').closest('div')!.parentElement!).toHaveTextContent('1')
    expect(screen.queryByText('Zé')).toBeNull()
  })

  it('copia o link da página do evento e mostra o QR com os downloads', async () => {
    montar(<ProducerInterestList />, '/producer/lista-interesse?eventId=e1')
    await userEvent.click(screen.getByRole('button', { name: 'Copiar link da página' }))
    expect(banco.copiar).toHaveBeenCalledWith(expect.stringMatching(/\/event\/festa-um$/))
    expect(screen.getByRole('button', { name: 'Baixar PNG' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Baixar SVG' })).toBeInTheDocument()
  })

  it('sem evento escolhido ou com evento fora do ar não há link', () => {
    const r = montar(<ProducerInterestList />, '/producer/lista-interesse')
    expect(screen.getByText(/Escolha um evento acima/)).toBeInTheDocument(); r.unmount()
    montar(<ProducerInterestList />, '/producer/lista-interesse?eventId=e2')
    expect(screen.getByText(/ainda não está no ar/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar link da página' })).toBeNull()
  })

  it('eventId de outro produtor é recusado e não mostra inscritos', () => {
    montar(<ProducerInterestList />, '/producer/lista-interesse?eventId=e9')
    expect(screen.getByText('Evento não encontrado entre os seus')).toBeInTheDocument()
    expect(screen.queryByText('Zé')).toBeNull()
  })

  it('exporta CSV só do filtro, com aviso de dado pessoal e fórmula neutralizada', async () => {
    montar(<ProducerInterestList />, '/producer/lista-interesse?eventId=e1')
    await userEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    const [nome, csv] = banco.baixar.mock.calls[0] as [string, string]
    expect(nome).toMatch(/^evokaa-lista-de-interesse-festa-um-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(csv).toContain('dados pessoais')
    expect(csv).toContain('ana@x.y')
    expect(csv).toContain("'=SOMA(1)")
    expect(csv).not.toContain('Zé')
    expect(banco.toast.info).toHaveBeenCalledWith(expect.stringContaining('LGPD'))
  })

  it('2FA pendente não vira "ninguém na lista"; vazio de verdade explica; erro tem "Tentar de novo"', async () => {
    banco.interessados.current = ok([]); banco.fator.mockResolvedValue(true)
    const a = montar(<ProducerInterestList />, '/producer/lista-interesse')
    expect(await screen.findByText('Confirme o 2FA para ver a lista')).toBeInTheDocument(); a.unmount()
    banco.fator.mockResolvedValue(false)
    const b = montar(<ProducerInterestList />, '/producer/lista-interesse')
    expect(await screen.findByText('Ninguém na lista ainda')).toBeInTheDocument(); b.unmount()
    const refetch = vi.fn(); banco.interessados.current = { data: [], isLoading: false, isError: true, isFetching: false, refetch }
    montar(<ProducerInterestList />, '/producer/lista-interesse')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })); await waitFor(() => expect(refetch).toHaveBeenCalled())
  })

  it('copiar e-mails mostra o aviso de LGPD', async () => {
    montar(<ProducerInterestList />, '/producer/lista-interesse?eventId=e1')
    await userEvent.click(screen.getByRole('button', { name: /Copiar e-mails/ }))
    await waitFor(() => expect(banco.toast.info).toHaveBeenCalledWith(expect.stringContaining('LGPD')))
  })

  it('erro ao carregar os eventos tem "Tentar de novo" e não diz "Escolha um evento"', async () => {
    banco.eventosErro.current = true
    montar(<ProducerInterestList />, '/producer/lista-interesse?eventId=e1')
    expect(screen.queryByText(/Escolha um evento/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(banco.refetchEventos).toHaveBeenCalled()
  })

  it('página própria é Em breve', () => {
    montar(<ProducerInterestList />, '/producer/lista-interesse')
    expect(screen.getByRole('button', { name: 'Criar página' })).toBeDisabled()
  })
})
