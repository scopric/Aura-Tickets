import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '../stores/authStore'
import AviseMe from '../components/AviseMe'
import ProducerInterestList from '../pages/producer/InterestList'
import { CONSENTIMENTO_VERSAO, fimDasVendas } from '../lib/interesse'

// public.interest_lists simulada: select().eq().eq().maybeSingle() lê `inscrito`; insert e delete().eq().eq() usam `resposta`
let inscrito: boolean
let resposta: { error: { code: string } | null }
let lista: Record<string, unknown>[]
const rpc = vi.fn((nome: string) => {
  if (nome === 'interesse_lista') return Promise.resolve({ data: lista, error: null })
  if (nome === 'interesse_entrar' || nome === 'interesse_sair') {
    if (!resposta.error) inscrito = nome === 'interesse_entrar'
    return Promise.resolve({ data: true, error: resposta.error })
  }
  return Promise.resolve({ data: true, error: null })
})
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'x', removido_em: inscrito ? null : '2026-10-01T00:00:00Z' }, error: null }) }) }) }),
    }),
    rpc: (nome: string, args: unknown) => rpc(nome, args),
  },
}))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [], isPending: false, isError: false, isFetching: false, refetch: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const entrar = (role: string) =>
  act(() => { useAuthStore.setState({ user: { id: 'u-1', email: 'x@y.z', full_name: 'X', avatar_url: null, role } as never, isAuthenticated: true, isLoading: false }) })

let cliente: QueryClient
const wrapper = (ui: React.ReactNode) => (
  <QueryClientProvider client={cliente}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>
)

beforeEach(() => {
  cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  inscrito = false
  resposta = { error: null }
  lista = []
  vi.clearAllMocks()
  act(() => { useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false }) })
})

describe('fimDasVendas', () => {
  const agora = Date.parse('2026-10-10T12:00:00Z')
  const em = (ms: number) => new Date(agora + ms).toISOString()
  it('conta dias, horas e minutos até o último fim', () => {
    expect(fimDasVendas([em(3 * 86_400_000 + 3_600_000)], agora)).toBe('Vendas terminam em 3 dias')
    expect(fimDasVendas([em(86_400_000)], agora)).toBe('Vendas terminam em 1 dia')
    expect(fimDasVendas([em(5 * 3_600_000)], agora)).toBe('Vendas terminam em 5 horas')
    expect(fimDasVendas([em(30_000)], agora)).toBe('Vendas terminam em 1 minuto')
    expect(fimDasVendas([em(86_400_000), em(2 * 86_400_000)], agora)).toBe('Vendas terminam em 2 dias')
  })
  it('não mostra sem fim em algum ingresso, com fim longe ou já passado', () => {
    expect(fimDasVendas([], agora)).toBeNull()
    expect(fimDasVendas([em(86_400_000), null], agora)).toBeNull()
    expect(fimDasVendas([em(8 * 86_400_000)], agora)).toBeNull()
    expect(fimDasVendas([em(-1000)], agora)).toBeNull()
  })
})

describe('AviseMe', () => {
  it('só confirma com o consentimento marcado e grava a versão do texto', async () => {
    entrar('user')
    render(wrapper(<AviseMe eventId="e1" />))
    fireEvent.click(await screen.findByRole('button', { name: 'Avise-me quando abrir' }))
    const confirmar = await screen.findByRole('button', { name: 'Quero ser avisado' })
    expect(confirmar).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(confirmar)
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('interesse_entrar', { p_event_id: 'e1', p_ticket_type_id: null, p_versao: CONSENTIMENTO_VERSAO }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Remover aviso' })).toBeInTheDocument()
  })

  it('erro do banco não vira "pronto": avisa de verdade e sugere o 2FA no 42501', async () => {
    entrar('user')
    resposta = { error: { code: '42501' } }
    render(wrapper(<AviseMe eventId="e1" />))
    fireEvent.click(await screen.findByRole('button', { name: 'Avise-me quando abrir' }))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Quero ser avisado' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('dois fatores')))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('inscrito vê "Remover aviso" e remove', async () => {
    entrar('user')
    inscrito = true
    render(wrapper(<AviseMe eventId="e1" />))
    fireEvent.click(await screen.findByRole('button', { name: 'Remover aviso' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('interesse_sair', { p_event_id: 'e1' }))
    expect(await screen.findByRole('button', { name: 'Avise-me quando abrir' })).toBeInTheDocument()
  })

  it('produtor não vê o botão', async () => {
    entrar('producer')
    render(wrapper(<AviseMe eventId="e1" />))
    await new Promise(r => setTimeout(r, 20))
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('Lista de interesse do produtor', () => {
  it('mostra os números reais e remove só da lista', async () => {
    entrar('producer')
    lista = [
      { id: 'a', event_id: 'e1', event_title: 'Festa', full_name: 'Ana', email: 'ana@x.y', city: 'Curitiba', notified: true, notified_at: '2026-10-10T10:00:00Z', consentiu: true, created_at: '2026-10-01T10:00:00Z' },
      { id: 'b', event_id: 'e1', event_title: 'Festa', full_name: null, email: null, city: null, notified: false, notified_at: null, consentiu: false, created_at: '2026-10-02T10:00:00Z' },
    ]
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(wrapper(<ProducerInterestList />))
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Inscrição sem consentimento registrado')).toBeInTheDocument()
    expect(screen.queryByText(/marcar como avisado/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Remover Ana da lista' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('interesse_remover', { p_id: 'a' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('CRM')))
  })
})
