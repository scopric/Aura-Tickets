import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminLayout from '../components/AdminLayout'

let permissoes: string[] | undefined = ['manage_events']
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Ricardo', email: 'r@x.com', admin_permissions: permissoes }, logout: vi.fn() }),
}))
vi.mock('../lib/supabase', () => ({ supabase: { channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: vi.fn() } }))
vi.mock('../hooks/useConversas', () => ({ bipe: vi.fn() }))
vi.mock('../lib/avatarUpload', () => ({ uploadAvatar: vi.fn() }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
vi.mock('../components/FeedbackTopButton', () => ({ default: () => null }))
vi.mock('../components/NotificationsTopButton', () => ({ default: () => null }))

const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/admin/events']}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin/events" element={<h1>Eventos</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

describe('AdminLayout (V12a): casca com tokens, mesma regra de acesso', () => {
  afterEach(() => { cleanup(); permissoes = ['manage_events'] })

  it('mostra só os itens da permissão da pessoa; item da tela atual com aria-current', () => {
    montar()
    const menu = screen.getByRole('navigation', { name: 'Menu do admin' })
    const nomes = Array.from(menu.querySelectorAll('a')).map(a => a.textContent)
    expect(nomes).toEqual(['Dashboard', 'Eventos', 'Meu cadastro'])
    expect(screen.getByRole('link', { name: 'Eventos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })

  it('super_admin vê os 18 itens', () => {
    permissoes = ['super_admin']
    montar()
    expect(screen.getByRole('navigation', { name: 'Menu do admin' }).querySelectorAll('a')).toHaveLength(18)
  })

  it('usuário sem admin_permissions vê só o que não exige permissão', () => {
    permissoes = undefined
    montar()
    const nomes = Array.from(screen.getByRole('navigation', { name: 'Menu do admin' }).querySelectorAll('a')).map(a => a.textContent)
    expect(nomes).toEqual(['Dashboard', 'Meu cadastro'])
  })

  it('Esc fecha a gaveta e devolve o foco ao botão de menu', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus() // abriu: foco no 1º item
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveFocus()
  })

  it('recolher vira trilho (itens só com ícone, mas com nome acessível) e expandir volta', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Recolher menu' }))
    const expandir = screen.getByRole('button', { name: 'Expandir menu' })
    expect(expandir).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Eventos' }).textContent).toBe('')
    fireEvent.click(expandir)
    expect(screen.getByRole('button', { name: 'Recolher menu' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('gaveta do celular: botão abre, Esc fecha', () => {
    montar()
    const abrir = screen.getByRole('button', { name: 'Abrir menu' })
    expect(abrir).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(abrir)
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('trocar a foto é um botão (alcançável pelo teclado) e não o contêiner clicável de antes', () => {
    montar()
    expect(screen.getByRole('button', { name: 'Alterar foto de perfil' })).toBeInTheDocument()
  })
})
