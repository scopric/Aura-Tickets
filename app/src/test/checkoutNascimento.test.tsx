import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import Checkout from '../pages/checkout/Checkout'
import { useAuthStore } from '../stores/authStore'
import { toast } from 'sonner'

// S4b: birth_date não é filtrável pela API (42501). "Salvar data" confere no cliente e só grava quando sabe que está vazia.
const h = vi.hoisted(() => ({ update: vi.fn() }))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'u1', birth_date: null } }) }))
vi.mock('../hooks/useEvents', () => ({
  usePublicEvent: () => ({
    isLoading: false,
    error: null,
    data: { id: 'e1', title: 'Festa', ticket_types: [{ id: 'tt1', name: 'Match de Mesa', price: 80, type: 'coletiva' }] },
  }),
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: (v: unknown) => ({ eq: () => ({ select: async () => { h.update(v); return { data: [{ id: 'u1' }], error: null } } }) }),
    }),
  },
}))

const montar = () => render(
  <QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[{ pathname: '/checkout', state: { eventId: 'e1', cart: { tt1: 1 } } }]}><Checkout /></MemoryRouter></QueryClientProvider>
)
const salvar = async () => {
  fireEvent.change(await screen.findByLabelText('Data de nascimento'), { target: { value: '1995-06-15' } })
  fireEvent.click(screen.getByRole('button', { name: 'Salvar data' }))
}
const comPerfil = (birth_date: string | null | undefined) => {
  const fetchProfile = vi.fn(async () => { useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', full_name: 'A', avatar_url: null, role: 'user', birth_date } }) })
  useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', full_name: 'A', avatar_url: null, role: 'user' }, fetchProfile } as never)
  return fetchProfile
}

describe('Checkout: data de nascimento do Match de Mesa (S4b)', () => {
  beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks() })

  it('releitura sem birth_date (provisório, rede, 2FA): não grava e pede para aguardar', async () => {
    const releitura = comPerfil(undefined)
    montar()
    await salvar()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Aguarde o perfil terminar de carregar e tente de novo'))
    expect(releitura).toHaveBeenCalledWith({ force: true })
    expect(h.update).not.toHaveBeenCalled()
  })

  it('perfil já tem data: não sobrescreve', async () => {
    comPerfil('1990-01-01')
    montar()
    await salvar()
    await waitFor(() => expect(toast.info).toHaveBeenCalled())
    expect(h.update).not.toHaveBeenCalled()
  })

  it('perfil sem data (null): grava só a data, sem filtro por birth_date', async () => {
    comPerfil(null)
    montar()
    await salvar()
    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ birth_date: '1995-06-15' }))
  })
})
