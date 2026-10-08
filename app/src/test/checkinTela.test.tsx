import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerCheckIn, { EquipeCheckIn } from '../pages/producer/CheckIn'

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
const banco = vi.hoisted(() => ({ linhas: { current: [] as unknown[] }, total: { current: null as number | null }, invoke: vi.fn(), fator: vi.fn(), baixar: vi.fn(), rpc: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festa Um', status: 'published', approval_status: 'approved', date: '2026-10-16' }], isLoading: false }) }))
vi.mock('../lib/vendasPagas', () => ({ faltaSegundoFator: banco.fator }))
vi.mock('../lib/exportCsv', async orig => ({ ...(await orig<typeof import('../lib/exportCsv')>()), downloadCsv: banco.baixar }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    // lista (data) e contagens (count; "in" guarda o filtro de status)
    from: () => {
      const q: any = { select: () => q, eq: () => q, order: () => q, range: () => q, in: (_c: string, v: string[]) => { q.v = v; return q },
        then: (ok: any) => { const n = banco.linhas.current.length; const usados = banco.linhas.current.filter((l: any) => l.status === 'used').length
          return Promise.resolve({ data: banco.linhas.current, count: q.v ? (q.v[0] === 'used' ? usados : 0) : (banco.total.current ?? n), error: null }).then(ok) } }
      return q
    },
    rpc: (...a: unknown[]) => banco.rpc(...a),
    functions: { invoke: (...a: unknown[]) => banco.invoke(...a) },
  },
}))

const t = (id: string, nome: string, status: string, checked_in_at: string | null) => ({ id, buyer_name: nome, qr_code: `3f2504e0-4f89-41d3-9a0c-0305e82c33${id}`, status, checked_in_at, ticket_types: { name: 'Pista' }, events: { title: 'Festa Um' } })
const dois = [t('01', 'Ana Souza', 'used', '2026-10-10T22:30:00Z'), t('02', 'Bia Lima', 'active', null)]

const montar = (el: React.ReactElement, url: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[url]}>{el}</MemoryRouter>
  </QueryClientProvider>,
)

describe('Check-in do produtor', () => {
  beforeEach(() => { banco.total.current = null; banco.linhas.current = dois; banco.fator.mockReset().mockResolvedValue(false); banco.baixar.mockReset() })

  it('cabeçalho do evento, números, botão da câmera, campo de digitar e Em breve', async () => {
    montar(<ProducerCheckIn />, '/producer/checkin?eventId=e1')
    expect(screen.getByRole('heading', { level: 1, name: 'Festa Um' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ler com a câmera/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Código do ingresso')).toBeInTheDocument()
    // até a 1ª resposta, esqueleto: nunca "0" falso
    expect(screen.getByLabelText('Carregando os números')).toBeInTheDocument()
    expect(await screen.findByText('Comparecimento')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('1 de 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Modo offline' })).toBeInTheDocument()
    expect(screen.getByText(/Hoje o check-in precisa de internet/)).toBeInTheDocument()
    for (const n of ['Desfazer entrada', 'PIN do porteiro', 'Selo de meia-entrada', 'Filtro por portaria e por membro', 'Etiqueta e impressão']) expect(screen.getByRole('heading', { name: n })).toBeInTheDocument()
  })

  it('lista: filtra por situação, ordena, mostra o ritmo e exporta CSV sem e-mail nem CPF', async () => {
    const u = userEvent.setup()
    montar(<ProducerCheckIn />, '/producer/checkin?eventId=e1')
    await screen.findByText('Comparecimento')
    await u.click(screen.getByRole('radio', { name: /Lista/ }))
    expect(screen.getByRole('region', { name: 'Ritmo de entrada por hora' })).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('Bia Lima')).toBeInTheDocument()

    await u.selectOptions(screen.getByLabelText('Situação'), 'pendente')
    expect(screen.queryByText('Ana Souza')).toBeNull()
    expect(screen.getByText('Bia Lima')).toBeInTheDocument()
    await u.selectOptions(screen.getByLabelText('Situação'), 'todos')
    await u.selectOptions(screen.getByLabelText('Ordem'), 'entrada')
    const nomes = within(screen.getByRole('list')).getAllByRole('listitem').map(li => li.textContent)
    expect(nomes[0]).toContain('Ana Souza') // quem entrou vem antes de quem não entrou

    await u.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    expect(banco.baixar).toHaveBeenCalledTimes(1)
    const [nome, csv] = banco.baixar.mock.calls[0]
    expect(nome).toMatch(/^evokaa-checkin-festa-um-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(csv).toContain('Ana Souza;Pista;Entrou;10/10/2026 19:30')
    expect(csv).toContain('Bia Lima;Pista;Não entrou;')
    expect(csv).not.toMatch(/@|3f2504e0/)
  })

  it('sem entradas, o gráfico de ritmo não aparece', async () => {
    banco.linhas.current = [dois[1]]
    const u = userEvent.setup()
    montar(<ProducerCheckIn />, '/producer/checkin?eventId=e1')
    await screen.findByText('Comparecimento')
    await u.click(screen.getByRole('radio', { name: /Lista/ }))
    expect(screen.queryByText('Ritmo de entrada por hora')).toBeNull()
  })

  it('zerado com 2FA pendente: pede o 2FA em vez de mostrar 0 ingressos', async () => {
    banco.linhas.current = []; banco.fator.mockResolvedValue(true)
    montar(<ProducerCheckIn />, '/producer/checkin?eventId=e1')
    expect(await screen.findByText('Confirme o 2FA para ver os ingressos')).toBeInTheDocument()
    expect(screen.queryByText('Comparecimento')).toBeNull()
    expect(screen.getByLabelText('Código do ingresso')).toBeInTheDocument() // a leitura continua disponível
  })

  it('zerado sem 2FA pendente: estado vazio honesto', async () => {
    banco.linhas.current = []
    montar(<ProducerCheckIn />, '/producer/checkin?eventId=e1')
    expect(await screen.findByText('Nenhum ingresso emitido neste evento ainda')).toBeInTheDocument()
    expect(screen.queryByText('Comparecimento')).toBeNull()
  })

  it('aviso quando a lista chegou ao limite de 1000 linhas', async () => {
    banco.linhas.current = Array.from({ length: 1000 }, (_, i) => t(String(i).padStart(4, '0'), `P${i}`, 'used', '2026-10-10T22:30:00Z'))
    banco.total.current = 1500
    const u = userEvent.setup()
    montar(<ProducerCheckIn />, '/producer/checkin?eventId=e1')
    await screen.findByText('Comparecimento')
    await u.click(screen.getByRole('radio', { name: /Lista/ }))
    expect(screen.getByText(/Calculado sobre os 1\.000 ingressos mais recentes/)).toBeInTheDocument()
    expect(screen.getByText(/Mostrando os 1\.000 ingressos mais recentes de 1\.500/)).toBeInTheDocument()
  })

  it('falha de rede na leitura da câmera: o mesmo QR pode ser lido de novo; leitura que deu certo não repete', async () => {
    const track = { stop: vi.fn() }
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn().mockResolvedValue(stream) }, configurable: true })
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true })
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    ;(window as any).BarcodeDetector = class { detect = async () => [{ rawValue: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' }] }
    banco.invoke.mockReset().mockRejectedValueOnce(new Error('rede')).mockResolvedValue({ data: { valid: true, message: 'ok', buyerName: 'Ana' }, error: null })
    const u = userEvent.setup()
    montar(<ProducerCheckIn />, '/producer/checkin?eventId=e1')
    await u.click(screen.getByRole('button', { name: /Ler com a câmera/ }))
    await waitFor(() => expect(banco.invoke).toHaveBeenCalledTimes(2), { timeout: 6000 })
    await waitFor(() => expect(screen.getByText('Acesso Permitido')).toBeInTheDocument())
    await new Promise(r => setTimeout(r, 2200))
    expect(banco.invoke).toHaveBeenCalledTimes(2) // cartão de sucesso na tela: não repete
    delete (window as any).BarcodeDetector
  }, 15000)
})

describe('Check-in da equipe', () => {
  beforeEach(() => {
    banco.rpc.mockReset().mockImplementation(async (nome: string) => ({
      team_eventos: { data: [{ id: 'e1', title: 'Festa Um', start_date: '2026-10-16T22:00:00Z', producer_id: 'p1', producer_name: 'Casa' }], error: null },
      team_lista_ingressos: { data: [{ id: 'k1', buyer_name: 'Ana', status: 'used', checked_in_at: '2026-10-10T22:30:00Z', tipo: 'Pista' }], error: null },
      team_contagem: { data: [{ total: 2, usados: 1, cancelados: 0, transferidos: 0 }], error: null },
    }[nome] ?? { data: [], error: null }))
  })

  it('tem câmera e números, mas sem cabeçalho do evento, sem Em breve e sem exportar CSV', async () => {
    const u = userEvent.setup()
    montar(<EquipeCheckIn />, '/equipe/checkin?eventId=e1')
    expect(await screen.findByText('Comparecimento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ler com a câmera/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Check-in' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Editar/ })).toBeNull()
    expect(screen.queryByText('Em breve')).toBeNull()
    await u.click(screen.getByRole('radio', { name: /Lista/ }))
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Exportar CSV/ })).toBeNull()
    expect(screen.getByRole('region', { name: 'Ritmo de entrada por hora' })).toBeInTheDocument()
  })
})
