import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Header from '../components/Header'

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, isAuthenticated: false, logout: vi.fn(), role: null }) }))
// consulta do painel de eventos: lista vazia (encadeia .eq/.gte/.order e termina em .order)
vi.mock('../lib/supabase', () => {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte']) q[m] = () => q
  q.order = () => Promise.resolve({ data: [], error: null })
  return { supabase: { from: () => q } }
})

const montar = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><Header /></MemoryRouter>
  </QueryClientProvider>,
)

describe('Header em pílula (menu do topo)', () => {
  it('painel de eventos: abre e fecha por clique e por Esc, aria-expanded certo, foco volta ao botão', () => {
    montar()
    const botao = screen.getByRole('button', { name: /^Eventos/ })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('painel-eventos')).toBeNull()
    fireEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('painel-eventos')).not.toBeNull()
    fireEvent.click(botao)
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(botao)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('painel-eventos')).toBeNull()
    expect(botao).toHaveFocus()
  })

  it('celular: a folha abre pelo botão Menu e fecha ao escolher um link', async () => {
    montar()
    const menu = screen.getByRole('button', { name: 'Menu' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('link', { name: 'Contato' }).at(-1)!)
    expect(menu).toHaveAttribute('aria-expanded', 'false')
  })
})
