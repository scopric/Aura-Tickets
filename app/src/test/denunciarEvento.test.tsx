import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EventoConteudo from '../components/EventoConteudo'
import type { DbEvent } from '../hooks/useEvents'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
vi.mock('../hooks/useOrganizadorDoEvento', () => ({ useOrganizadorDoEvento: () => ({ data: null }) })) // o bloco Organizador tem teste próprio
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({}) } }))
vi.mock('../components/SupportChatWidget', () => ({
  JanelaSuporte: (p: { publico: string; assuntoInicial?: string; textoInicial?: string }) => <div role="dialog">{`${p.publico}|${p.assuntoInicial}|${p.textoInicial}`}</div>,
}))

const evento = {
  id: 'e1', title: 'Baile do Sol', date: '2099-01-01', time: '22:00:00', status: 'published',
  venue_name: 'Casa Mirante', venue_city: 'Curitiba', ticket_types: [],
} as unknown as DbEvent

describe('Denunciar evento', () => {
  it('mostra o e-mail e abre o chat no assunto "Denunciar evento" já com o título e o link do evento', () => {
    render(<MemoryRouter><EventoConteudo evento={evento} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'contato@evokaa.com.br' }).getAttribute('href')).toBe('mailto:contato@evokaa.com.br')
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Denunciar evento' }))
    const t = screen.getByRole('dialog').textContent ?? ''
    expect(t).toMatch(/^site\|Denunciar evento\|Denúncia do evento "Baile do Sol" \(http/)
  })
  it('na prévia do produtor não há denúncia', () => {
    render(<MemoryRouter><EventoConteudo evento={evento} previa="moldura" /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: 'Denunciar evento' })).toBeNull()
  })
})
