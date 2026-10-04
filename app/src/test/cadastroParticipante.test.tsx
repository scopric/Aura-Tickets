import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import Register from '../pages/auth/Register'

vi.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn(() => Promise.resolve({})) } } }))

const Destino = () => <p data-testid="destino">{useLocation().pathname}</p>

function montar(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/auth/register" element={<Register />} />
          <Route path="*" element={<Destino />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
  act(() => { useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false }) })
})

describe('cadastro (P14)', () => {
  const abaAtiva = (nome: string) => screen.getByRole('button', { name: nome }).className.includes('bg-plum')

  it('abre em Participante; ?tipo=produtor, ?plano= e ?ref= abrem em Produtor', () => {
    const { unmount } = montar('/auth/register')
    expect(abaAtiva('Participante')).toBe(true)
    expect(abaAtiva('Produtor')).toBe(false)
    unmount()
    for (const q of ['?tipo=produtor', '?plano=pro', '?ref=ABC']) {
      const m = montar(`/auth/register${q}`)
      expect(abaAtiva('Produtor')).toBe(true)
      m.unmount()
    }
  })

  it('participante que acabou de se cadastrar no meio da compra volta ao /checkout', async () => {
    sessionStorage.setItem('aura_pending_checkout', '{}')
    montar('/auth/register')
    act(() => { useAuthStore.setState({ user: { id: 'u-1', email: 'a@b.c', full_name: 'A', avatar_url: null, role: 'user' }, isAuthenticated: true, isLoading: false }) })
    await waitFor(() => expect(screen.getByTestId('destino')).toHaveTextContent('/checkout'))
  })

  it('sem compra em andamento, participante vai ao hub', async () => {
    montar('/auth/register')
    act(() => { useAuthStore.setState({ user: { id: 'u-1', email: 'a@b.c', full_name: 'A', avatar_url: null, role: 'user' }, isAuthenticated: true, isLoading: false }) })
    await waitFor(() => expect(screen.getByTestId('destino')).toHaveTextContent('/app/hub'))
  })
})
