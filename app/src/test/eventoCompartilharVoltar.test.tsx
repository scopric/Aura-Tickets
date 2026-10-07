import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import EventoConteudo from '../components/EventoConteudo'
import type { DbEvent } from '../hooks/useEvents'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
vi.mock('../hooks/useOrganizadorDoEvento', () => ({ useOrganizadorDoEvento: () => ({ data: null }) })) // o bloco Organizador tem teste próprio
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({}) } }))

const evento = {
  id: 'e1', title: 'Baile do Sol', date: '2099-01-01', time: '22:00:00', status: 'published',
  venue_name: 'Casa Mirante', venue_city: 'Curitiba', ticket_types: [],
} as unknown as DbEvent

const Local = () => <p data-testid="local">{useLocation().pathname}</p>
const IrAoEvento = () => { const n = useNavigate(); return <button onClick={() => n('/evento')}>ir</button> }
const montar = (entradas: string[]) => render(
  <MemoryRouter initialEntries={entradas}>
    <Routes>
      <Route path="/lista" element={<IrAoEvento />} />
      <Route path="/evento" element={<EventoConteudo evento={evento} />} />
      <Route path="*" element={<p>outra</p>} />
    </Routes>
    <Local />
  </MemoryRouter>
)

beforeEach(() => { vi.clearAllMocks(); Object.assign(navigator, { share: undefined }) })
afterEach(cleanup)

describe('Página do evento: Compartilhar', () => {
  it('copia e só então avisa', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    montar(['/evento'])
    fireEvent.click(screen.getByLabelText('Compartilhar'))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(writeText).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })
  it('falha ao copiar: aviso de erro, sem "copiado"', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('negado')) } })
    montar(['/evento'])
    fireEvent.click(screen.getByLabelText('Compartilhar'))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
  })
  it('compartilhamento cancelado (AbortError) não é erro', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }))
    Object.assign(navigator, { share })
    montar(['/evento'])
    fireEvent.click(screen.getByLabelText('Compartilhar'))
    await waitFor(() => expect(share).toHaveBeenCalled())
    await Promise.resolve()
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('Página do evento: Voltar', () => {
  it('veio de dentro do app: volta uma página', () => {
    montar(['/lista'])
    fireEvent.click(screen.getByText('ir'))
    fireEvent.click(screen.getByLabelText('Voltar'))
    expect(screen.getByTestId('local').textContent).toBe('/lista')
  })
  it('entrou direto (de outro site): vai para o Explorar', () => {
    montar(['/evento'])
    fireEvent.click(screen.getByLabelText('Voltar'))
    expect(screen.getByTestId('local').textContent).toBe('/events')
  })
})
