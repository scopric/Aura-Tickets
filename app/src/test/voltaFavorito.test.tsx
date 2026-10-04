import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { consumirVolta, pegarSalvarPendente, voltaValida } from '../lib/voltaEvento'
import Login from '../pages/auth/Login'
import Register from '../pages/auth/Register'
import { useAuth } from '../hooks/useAuth'

const signInWithOAuth = vi.fn(() => Promise.resolve({ error: null }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...a: unknown[]) => signInWithOAuth(...(a as [])),
      signOut: vi.fn(() => Promise.resolve({})),
      mfa: { getAuthenticatorAssuranceLevel: vi.fn(() => Promise.resolve({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })) },
    },
  },
}))

const Destino = () => <p data-testid="destino">{useLocation().pathname}</p>

describe('voltaValida', () => {
  it('só aceita caminho de evento', () => {
    expect(voltaValida('/event/abc-123_X')).toBe('/event/abc-123_X')
    for (const ruim of ['//evil.com', '/event/../x', '/event/a/b', 'https://evil.com/event/a', '/app/hub', '/event/', '', null, undefined]) {
      expect(voltaValida(ruim)).toBeNull()
    }
    // %2F%2Fx: a URL decodifica para //x; e o valor ainda codificado também não é caminho de evento
    expect(voltaValida(new URLSearchParams('volta=%2F%2Fx').get('volta'))).toBeNull()
    expect(voltaValida('%2F%2Fx')).toBeNull()
  })
})

describe('consumirVolta', () => {
  beforeEach(() => sessionStorage.clear())

  it('participante volta ao evento e deixa o evento marcado para salvar uma vez', () => {
    expect(consumirVolta('user', '/event/abc')).toBe('/event/abc')
    expect(pegarSalvarPendente('outro')).toBe(false)
    expect(pegarSalvarPendente('abc')).toBe(true)
    expect(pegarSalvarPendente('abc')).toBe(false)
  })

  it('produtor, equipe e admin ignoram a volta e nada fica pendente', () => {
    for (const papel of ['producer', 'editor', 'admin']) {
      sessionStorage.setItem('aura_volta', '/event/abc')
      expect(consumirVolta(papel, '/event/abc')).toBeNull()
      expect(sessionStorage.getItem('aura_volta')).toBeNull()
      expect(sessionStorage.getItem('aura_salvar_pendente')).toBeNull()
    }
  })

  it('a volta guardada vale e é limpa; valor adulterado no storage é recusado; a da URL manda', () => {
    sessionStorage.setItem('aura_volta', '/event/guardada')
    expect(consumirVolta('user', null)).toBe('/event/guardada')
    expect(sessionStorage.getItem('aura_volta')).toBeNull()
    sessionStorage.setItem('aura_volta', '//evil.com')
    expect(consumirVolta('user', null)).toBeNull()
    sessionStorage.setItem('aura_volta', '/event/guardada')
    expect(consumirVolta('user', '/event/da-url')).toBe('/event/da-url')
  })

  it('daUrl inválido é recusado (defesa em profundidade); vale a guardada, se houver', () => {
    expect(consumirVolta('user', '//evil.com')).toBeNull()
    expect(sessionStorage.getItem('aura_salvar_pendente')).toBeNull()
    sessionStorage.setItem('aura_volta', '/event/guardada')
    expect(consumirVolta('user', 'https://evil.com/event/x')).toBe('/event/guardada')
  })
})

describe('Login com volta', () => {
  const montar = (url: string) => render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/auth/login" element={<Login />} />
          <Route path="*" element={<Destino />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const logar = (role: 'user' | 'producer') =>
    act(() => { useAuthStore.setState({ user: { id: 'u-1', email: 'x@y.z', full_name: 'X', avatar_url: null, role }, isAuthenticated: true, isLoading: false }) })

  beforeEach(() => {
    sessionStorage.clear()
    signInWithOAuth.mockClear()
    act(() => { useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false }) })
  })

  it('já logado como participante: volta ao evento do ?volta=', async () => {
    logar('user')
    montar('/auth/login?volta=/event/abc')
    await waitFor(() => expect(screen.getByTestId('destino')).toHaveTextContent('/event/abc'))
    expect(sessionStorage.getItem('aura_salvar_pendente')).toBe('abc')
  })

  it.each(['//evil.com', '/event/../x', '%2F%2Fx'])('?volta=%s é ignorada: vai ao hub', async (ruim) => {
    logar('user')
    montar(`/auth/login?volta=${ruim}`)
    await waitFor(() => expect(screen.getByTestId('destino')).toHaveTextContent('/app/hub'))
    expect(sessionStorage.getItem('aura_salvar_pendente')).toBeNull()
  })

  it('produtor ignora a volta: vai ao painel dele', async () => {
    logar('producer')
    montar('/auth/login?volta=/event/abc')
    await waitFor(() => expect(screen.getByTestId('destino')).toHaveTextContent('/producer/dashboard'))
    expect(sessionStorage.getItem('aura_salvar_pendente')).toBeNull()
  })

  it('Google: guarda a volta antes do OAuth; na chegada logada, volta ao evento e limpa', async () => {
    montar('/auth/login?volta=/event/abc')
    fireEvent.click(screen.getByRole('checkbox', { name: /Li e aceito/ }))
    fireEvent.click(screen.getByRole('button', { name: /Google/ }))
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled())
    expect(sessionStorage.getItem('aura_volta')).toBe('/event/abc')

    // o Google devolve ao /auth/login sem a ?volta=
    document.body.innerHTML = ''
    logar('user')
    montar('/auth/login')
    await waitFor(() => expect(screen.getByTestId('destino')).toHaveTextContent('/event/abc'))
    expect(sessionStorage.getItem('aura_volta')).toBeNull()
  })

  it('"Criar conta": guarda a volta; sem volta válida não guarda nada', () => {
    montar('/auth/login?volta=/event/abc')
    fireEvent.click(screen.getByRole('link', { name: 'Criar conta' }))
    expect(sessionStorage.getItem('aura_volta')).toBe('/event/abc')
  })

  it('"Criar conta" com volta inválida não guarda nada', () => {
    montar('/auth/login?volta=//evil.com')
    fireEvent.click(screen.getByRole('link', { name: 'Criar conta' }))
    expect(sessionStorage.getItem('aura_volta')).toBeNull()
  })
})

describe('Cadastro e logout limpam a volta', () => {
  it('Register de produtor já logado: limpa a volta guardada e vai ao painel', async () => {
    sessionStorage.setItem('aura_volta', '/event/abc')
    act(() => { useAuthStore.setState({ user: { id: 'p-1', email: 'p@y.z', full_name: 'P', avatar_url: null, role: 'producer' }, isAuthenticated: true, isLoading: false }) })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/auth/register']}>
          <Routes>
            <Route path="/auth/register" element={<Register />} />
            <Route path="*" element={<Destino />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('destino')).toHaveTextContent('/producer/dashboard'))
    expect(sessionStorage.getItem('aura_volta')).toBeNull()
    expect(sessionStorage.getItem('aura_salvar_pendente')).toBeNull()
  })

  it('logout remove aura_volta e aura_salvar_pendente', async () => {
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    sessionStorage.setItem('aura_volta', '/event/abc')
    sessionStorage.setItem('aura_salvar_pendente', 'abc')
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>,
    })
    await act(async () => { await result.current.logout() })
    expect(sessionStorage.getItem('aura_volta')).toBeNull()
    expect(sessionStorage.getItem('aura_salvar_pendente')).toBeNull()
    expect(replace).toHaveBeenCalledWith('/')
    vi.unstubAllGlobals()
  })
})
