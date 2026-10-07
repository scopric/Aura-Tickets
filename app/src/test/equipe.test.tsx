import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Equipe from '../pages/app/Equipe'
import { EquipeCheckIn } from '../pages/producer/CheckIn'

const rpc = vi.fn()
const from = vi.fn()
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a), functions: { invoke: vi.fn() } },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))

const pendente = { id: 't1', producer_id: 'p1', producer_name: 'Casa Azul', role: 'editor', invited_at: '2026-10-01', accepted_at: null }
const evento = { id: 'e1', title: 'Festa no ar', start_date: '2026-10-16T22:00:00Z', producer_id: 'p1', producer_name: 'Casa Azul' }

const montar = (el = <Equipe />, rota = '/equipe') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[rota]}>{el}</MemoryRouter>
  </QueryClientProvider>,
)
// respostas por nome de RPC
const responder = (r: Record<string, () => unknown>) => rpc.mockImplementation(async (nome: string, args?: unknown) => r[nome]?.call(args) ?? { data: [], error: null })

describe('Equipe', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset() })

  it('sem convites', async () => {
    responder({})
    montar()
    expect(await screen.findByText('Você não tem convites de equipe.')).toBeTruthy()
  })

  it('lista o convite pendente e aceita; depois mostra os eventos (só por RPC)', async () => {
    let aceito = false
    rpc.mockImplementation(async (nome: string, args?: unknown) => {
      if (nome === 'team_aceitar_convite') { expect(args).toEqual({ p_id: 't1' }); aceito = true; return { data: null, error: null } }
      if (nome === 'team_eventos') return { data: aceito ? [evento] : [], error: null }
      return { data: [aceito ? { ...pendente, accepted_at: '2026-10-07' } : pendente], error: null }
    })
    montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceitar convite de Casa Azul' }))
    const link = await screen.findByRole('link', { name: 'Festa no ar' })
    expect(link.getAttribute('href')).toBe('/equipe/checkin?eventId=e1')
    expect(screen.queryByRole('button', { name: /Aceitar/ })).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('viewer aceito: aviso, sem eventos', async () => {
    responder({ team_meus_convites: () => ({ data: [{ ...pendente, role: 'viewer', accepted_at: '2026-10-07' }], error: null }), team_eventos: () => ({ data: [evento], error: null }) })
    montar()
    expect(await screen.findByText(/Seu cargo é Visualizador/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Festa no ar' })).toBeNull()
  })

  it('erro ao carregar eventos não vira "nenhum evento"', async () => {
    responder({ team_meus_convites: () => ({ data: [{ ...pendente, accepted_at: '2026-10-07' }], error: null }), team_eventos: () => ({ data: null, error: { message: 'x' } }) })
    montar()
    expect(await screen.findByText('Não deu para carregar os eventos.')).toBeTruthy()
    expect(screen.queryByText('Nenhum evento publicado no momento.')).toBeNull()
  })

  it('conta com 2FA sem o código: pede o código', async () => {
    responder({ team_meus_convites: () => ({ data: null, error: { code: '42501', message: 'x' } }) })
    montar()
    expect(await screen.findByText(/entre de novo com o código do aplicativo/)).toBeTruthy()
  })

  it('erro de 2FA no aceite vira mensagem clara', async () => {
    responder({ team_meus_convites: () => ({ data: [pendente], error: null }), team_aceitar_convite: () => ({ data: null, error: { code: '42501', message: 'x' } }) })
    montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceitar convite de Casa Azul' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/verificação em duas etapas/))
  })

  it('convite indisponível (P0001)', async () => {
    responder({ team_meus_convites: () => ({ data: [pendente], error: null }), team_aceitar_convite: () => ({ data: null, error: { code: 'P0001', message: 'x' } }) })
    montar()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceitar convite de Casa Azul' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/não está mais disponível/))
  })
})

describe('Check-in da equipe', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset() })

  it('lista vem de team_lista_ingressos, sem botão de confirmar e sem ler tickets direto', async () => {
    responder({
      team_eventos: () => ({ data: [evento], error: null }),
      team_lista_ingressos: () => ({ data: [{ id: 'k1', buyer_name: 'Ana', status: 'active', checked_in_at: null, tipo: 'Pista' }], error: null }),
    })
    montar(<EquipeCheckIn />, '/equipe/checkin?eventId=e1')
    await userEvent.click(await screen.findByRole('radio', { name: /Lista/ }))
    expect(await screen.findByText('Ana')).toBeTruthy()
    expect(screen.getByText('Pista')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Confirmar Entrada/ })).toBeNull()
    expect(rpc).toHaveBeenCalledWith('team_lista_ingressos', { p_event_id: 'e1' })
    expect(from).not.toHaveBeenCalled()
  })

  it('números vêm de team_contagem (não da lista)', async () => {
    responder({
      team_eventos: () => ({ data: [evento], error: null }),
      team_lista_ingressos: () => ({ data: [{ id: 'k1', buyer_name: 'Ana', status: 'active', checked_in_at: null, tipo: 'Pista' }], error: null }),
      team_contagem: () => ({ data: [{ total: 1500, usados: 300, cancelados: 0, transferidos: 0 }], error: null }),
    })
    montar(<EquipeCheckIn />, '/equipe/checkin?eventId=e1')
    expect(await screen.findByText('20% · 300/1500')).toBeTruthy()
  })

  it('erro ao carregar eventos tem mensagem própria', async () => {
    responder({ team_eventos: () => ({ data: null, error: { message: 'x' } }) })
    montar(<EquipeCheckIn />, '/equipe/checkin')
    expect(await screen.findByText('Não deu para carregar os eventos')).toBeTruthy()
    expect(screen.queryByText('Nenhum evento ativo')).toBeNull()
  })
})
