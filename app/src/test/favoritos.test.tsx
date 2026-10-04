import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '../stores/authStore'
import { useFavoritos, useSalvarPendente } from '../hooks/useFavoritos'
import { consumirVolta } from '../lib/voltaEvento'
import BotaoSalvar from '../components/BotaoSalvar'
import Salvos from '../pages/app/Salvos'

// public.favoritos simulada. select('event_id').eq() lê `linhas`; select('… events (*)').eq().order() lê `salvos`;
// insert e delete().eq().eq() respondem com `resposta`
let linhas: { event_id: string }[]
let salvos: { event_id: string; criado_em: string; events: Record<string, unknown> | null }[]
let salvosErro = false
let salvosPendente = false
let resposta: { error: { code: string } | null }
// sucesso muda `linhas`, como o banco: a releitura depois de gravar traz o novo estado
const insert = vi.fn((l: { event_id: string }) => { if (!resposta.error) linhas = [...linhas, { event_id: l.event_id }]; return Promise.resolve(resposta) })
const apagar = vi.fn((_c: string, id: string) => { if (!resposta.error) linhas = linhas.filter(l => l.event_id !== id); return Promise.resolve(resposta) })
const select = vi.fn((cols: string) => ({
  eq: () => cols.includes('events')
    ? { order: () => salvosPendente ? new Promise(() => {}) : Promise.resolve(salvosErro ? { data: null, error: new Error('falhou') } : { data: salvos, error: null }) }
    : Promise.resolve({ data: linhas, error: null }),
}))
const from = vi.fn(() => ({ select, insert, delete: () => ({ eq: () => ({ eq: apagar }) }) }))
vi.mock('../lib/supabase', () => ({ supabase: { from: () => from() } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const entrar = (role: 'user' | 'producer') =>
  act(() => { useAuthStore.setState({ user: { id: 'u-1', email: 'x@y.z', full_name: 'X', avatar_url: null, role }, isAuthenticated: true, isLoading: false }) })

let cliente: QueryClient // um por teste (um novo a cada render do wrapper zeraria o cache)
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={cliente}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

beforeEach(() => {
  cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  linhas = [{ event_id: 'a' }]
  salvos = []
  salvosErro = false
  salvosPendente = false
  resposta = { error: null }
  vi.clearAllMocks()
  sessionStorage.clear()
  act(() => { useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false }) })
})

describe('useFavoritos', () => {
  it('lista os meus favoritos e alterna: salva com insert e remove com delete, atualizando na hora', async () => {
    entrar('user')
    const { result } = renderHook(() => useFavoritos(), { wrapper })
    await waitFor(() => expect(result.current.salvo('a')).toBe(true))
    expect(result.current.salvo('b')).toBe(false)

    act(() => result.current.definir('b', true))
    await waitFor(() => expect(result.current.salvo('b')).toBe(true))
    expect(insert).toHaveBeenCalledWith({ user_id: 'u-1', event_id: 'b' })

    act(() => result.current.definir('a', false))
    await waitFor(() => expect(result.current.salvo('a')).toBe(false))
    expect(apagar).toHaveBeenCalledTimes(1)
  })

  it('erro ao gravar: aparece salvo na hora, depois volta ao estado anterior e avisa com toast', async () => {
    entrar('user')
    const { result } = renderHook(() => useFavoritos(), { wrapper })
    await waitFor(() => expect(result.current.salvo('a')).toBe(true))

    let recusar!: () => void
    insert.mockImplementationOnce(() => new Promise(resolve => { recusar = () => resolve({ error: { code: '42501' } }) }))
    act(() => result.current.definir('b', true))
    await waitFor(() => expect(result.current.salvo('b')).toBe(true)) // otimista: antes de o banco responder
    expect(toast.error).not.toHaveBeenCalled()

    await act(async () => recusar())
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não deu para salvar o evento. Tente de novo.'))
    await waitFor(() => expect(result.current.salvo('b')).toBe(false))
    expect(result.current.salvo('a')).toBe(true)
  })

  it('23505 (já estava salvo em outra aba) é sucesso: sem aviso e continua salvo', async () => {
    entrar('user')
    const { result } = renderHook(() => useFavoritos(), { wrapper })
    await waitFor(() => expect(result.current.salvo('a')).toBe(true))

    resposta = { error: { code: '23505' } }
    linhas = [...linhas, { event_id: 'b' }] // a outra aba já gravou
    act(() => result.current.definir('b', true))
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(toast.error).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.salvo('b')).toBe(true))
  })

  it('dois toques rápidos no mesmo coração rodam em ordem e terminam no último estado', async () => {
    entrar('user')
    const { result } = renderHook(() => useFavoritos(), { wrapper })
    await waitFor(() => expect(result.current.salvo('a')).toBe(true))

    let liberar!: () => void
    insert.mockImplementationOnce((l: { event_id: string }) => new Promise(resolve => { liberar = () => { linhas = [...linhas, { event_id: l.event_id }]; resolve({ error: null }) } }))
    act(() => { result.current.definir('b', true); result.current.definir('b', false) })
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
    expect(apagar).not.toHaveBeenCalled() // o delete espera o insert terminar

    await act(async () => liberar())
    await waitFor(() => expect(apagar).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.salvo('b')).toBe(false))
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('produtor não consulta a tabela', async () => {
    entrar('producer')
    const { result } = renderHook(() => useFavoritos(), { wrapper })
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    expect(from).not.toHaveBeenCalled()
    expect(result.current.userId).toBeUndefined()
    expect(result.current.salvo('a')).toBe(false)
  })
})

describe('useSalvarPendente', () => {
  it('depois do login, grava o favorito do evento uma única vez e limpa', async () => {
    entrar('user')
    consumirVolta('user', '/event/b') // o login marcou o evento para salvar
    const { rerender } = renderHook(() => useSalvarPendente('b'), { wrapper })
    await waitFor(() => expect(insert).toHaveBeenCalledWith({ user_id: 'u-1', event_id: 'b' }))
    rerender()
    await act(async () => {})
    expect(insert).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('aura_salvar_pendente')).toBeNull()
  })

  it('ao gravar, avisa "Evento salvo" com Desfazer, que remove o favorito', async () => {
    entrar('user')
    consumirVolta('user', '/event/b')
    renderHook(() => useSalvarPendente('b'), { wrapper })
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    const [msg, opcoes] = vi.mocked(toast.success).mock.calls[0] as unknown as [string, { action: { label: string; onClick: () => void } }]
    expect(msg).toBe('Evento salvo')
    expect(opcoes.action.label).toBe('Desfazer')
    opcoes.action.onClick()
    await waitFor(() => expect(apagar).toHaveBeenCalledWith('event_id', 'b'))
  })

  it('outro evento: não grava, não avisa e limpa a marca', async () => {
    consumirVolta('user', '/event/b')
    entrar('user')
    renderHook(() => useSalvarPendente('c'), { wrapper })
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    expect(insert).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('aura_salvar_pendente')).toBeNull()
  })

  it('evento que não carregou: limpa a marca; enquanto carrega, espera', async () => {
    entrar('user')
    consumirVolta('user', '/event/b')
    const { rerender } = renderHook(({ carregando }) => useSalvarPendente(undefined, carregando), { wrapper, initialProps: { carregando: true } })
    expect(sessionStorage.getItem('aura_salvar_pendente')).toBe('b')
    rerender({ carregando: false })
    expect(sessionStorage.getItem('aura_salvar_pendente')).toBeNull()
  })

  it('produtor: não grava e não consome', async () => {
    consumirVolta('user', '/event/b')
    entrar('producer')
    renderHook(() => useSalvarPendente('b'), { wrapper })
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    expect(insert).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('aura_salvar_pendente')).toBe('b')
  })
})

describe('BotaoSalvar', () => {
  it('participante: o rótulo é fixo e aria-pressed muda ao tocar', async () => {
    entrar('user')
    render(<BotaoSalvar eventId="b" />, { wrapper })
    const botao = await screen.findByRole('button', { name: 'Salvar evento' })
    expect(botao).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(botao)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar evento' })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('já salvo: nasce pressionado', async () => {
    entrar('user')
    render(<BotaoSalvar eventId="a" />, { wrapper })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar evento' })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('produtor e equipe não veem o coração', () => {
    entrar('producer')
    const { container } = render(<BotaoSalvar eventId="a" />, { wrapper })
    expect(container).toBeEmptyDOMElement()
  })

  it('visitante vê o coração (leva ao login)', () => {
    render(<BotaoSalvar eventId="a" />, { wrapper })
    expect(screen.getByRole('button', { name: 'Salvar evento' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Salvos', () => {
  const publicado = { id: 'e-1', title: 'Festa no ar', status: 'published', approval_status: 'approved' }

  it('evento fora do ar (rascunho ou escondido pela RLS) aparece sem link e com Remover, que apaga pelo event_id', async () => {
    linhas = [{ event_id: 'e-1' }, { event_id: 'e-2' }, { event_id: 'e-3' }]
    salvos = [
      { event_id: 'e-1', criado_em: '2026-10-03', events: publicado },
      { event_id: 'e-2', criado_em: '2026-10-02', events: { id: 'e-2', title: 'Rascunho', status: 'draft', approval_status: 'approved' } },
      { event_id: 'e-3', criado_em: '2026-10-01', events: null },
    ]
    entrar('user')
    render(<Salvos />, { wrapper })
    expect(await screen.findByText('Festa no ar')).toBeInTheDocument()
    expect(screen.getAllByText('Evento fora do ar')).toHaveLength(2)
    expect(screen.queryByText('Rascunho')).toBeNull() // o título de um evento fora do ar não aparece
    expect(screen.getAllByRole('link')).toHaveLength(1) // só o do evento no ar
    expect(select).toHaveBeenCalledWith('event_id, criado_em, events (*, ticket_types (*))')

    fireEvent.click(screen.getAllByRole('button', { name: 'Remover' })[1])
    await waitFor(() => expect(apagar).toHaveBeenCalledWith('event_id', 'e-3'))
  })

  it('vazio: a dica leva ao Explorar do app (/app/events)', async () => {
    linhas = []
    entrar('user')
    render(<Salvos />, { wrapper })
    expect(await screen.findByRole('link', { name: 'Explorar eventos' })).toHaveAttribute('href', '/app/events')
  })

  it('carregando: esqueleto com aviso para leitor de tela; erro: mensagem e Tentar de novo', async () => {
    entrar('user')
    salvosPendente = true
    const { unmount } = render(<Salvos />, { wrapper })
    expect(await screen.findByText('Carregando os eventos salvos')).toBeInTheDocument()
    unmount()
    cliente.clear()
    salvosPendente = false
    salvosErro = true
    render(<Salvos />, { wrapper })
    expect(await screen.findByText('Não deu para carregar os eventos salvos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('"Salvar não reserva ingresso"; preço com taxa; evento passado marcado', async () => {
    linhas = [{ event_id: 'e-1' }, { event_id: 'e-2' }]
    salvos = [
      { event_id: 'e-1', criado_em: '2026-10-03', events: { ...publicado, date: '2099-01-10', ticket_types: [{ price: 50 }] } },
      { event_id: 'e-2', criado_em: '2026-10-02', events: { ...publicado, id: 'e-2', title: 'Já foi', date: '2020-01-10', ticket_types: [{ price: 50 }] } },
    ]
    entrar('user')
    render(<Salvos />, { wrapper })
    expect(await screen.findByText(/não reserva ingresso/)).toBeInTheDocument()
    expect(screen.getByText(/com taxa/)).toBeInTheDocument()
    expect(screen.getByText('Evento passado')).toBeInTheDocument()
  })
})

describe('Remover dos salvos', () => {
  it('o coração marcado remove e avisa com Desfazer, que salva de novo', async () => {
    entrar('user')
    render(<BotaoSalvar eventId="a" />, { wrapper })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar evento' })).toHaveAttribute('aria-pressed', 'true'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar evento' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    const [msg, opcoes] = vi.mocked(toast.success).mock.calls[0] as unknown as [string, { action: { label: string; onClick: () => void } }]
    expect(msg).toBe('Removido dos salvos')
    expect(opcoes.action.label).toBe('Desfazer')
    opcoes.action.onClick()
    await waitFor(() => expect(insert).toHaveBeenCalledWith({ user_id: 'u-1', event_id: 'a' }))
  })
})
