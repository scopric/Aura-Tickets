import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import ProducerSettings from '../pages/producer/ProducerSettings'

// o mesmo objeto a cada render: o componente sincroniza o formulário em useEffect([data])
const dados = vi.hoisted(() => ( { profile: { full_name: 'Paula', email: 'p@x.com' }, producer_profile: { company_name: 'Paula Eventos', cnpj: null } }))
vi.mock('../hooks/useProducerSettings', () => ({
  useProducerSettings: () => ({
    data: dados,
    isPending: false, isError: false, refetch: vi.fn(), isFetching: false,
    saveProfile: vi.fn(), isSavingProfile: false, saveProducerProfile: vi.fn(), isSavingProducerProfile: false,
  }),
}))
vi.mock('../hooks/useTwoFactor', () => ({ useTwoFactor: () => ({ loading: false, enabled: false, toggle: vi.fn(), modal: null }) }))

const Local = () => { const l = useLocation(); return <p data-testid="local">{l.pathname + l.search}</p> }

describe('ProducerSettings: ?secao=notificacoes (link do sino)', () => {
  it('abre na aba Notificações, tira o parâmetro da URL e deixa trocar de aba', () => {
    render(<MemoryRouter initialEntries={['/producer/settings?secao=notificacoes']}><ProducerSettings /><Local /></MemoryRouter>)
    const notif = screen.getByRole('button', { name: 'Notificações' })
    expect(notif).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('local')).toHaveTextContent('/producer/settings')
    expect(screen.getByTestId('local')).not.toHaveTextContent('secao')
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }))
    expect(screen.getByRole('button', { name: 'Perfil' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Notificações' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('sem o parâmetro, começa em Perfil', () => {
    render(<MemoryRouter initialEntries={['/producer/settings']}><ProducerSettings /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Perfil' })).toHaveAttribute('aria-pressed', 'true')
  })
})
