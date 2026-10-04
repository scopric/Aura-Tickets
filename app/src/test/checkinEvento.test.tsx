import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProducerCheckIn from '../pages/producer/CheckIn'

const eventos = [
  { id: 'e1', title: 'No ar', status: 'published' },
  { id: 'e2', title: 'Rascunho', status: 'draft' },
]
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: eventos, isLoading: false }) }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    // consulta encadeável que se resolve vazia (lista e contagens do check-in)
    from: () => { const q: any = { select: () => q, eq: () => q, in: () => q, order: () => q, range: () => q, then: (ok: any) => Promise.resolve({ data: [], count: 0, error: null }).then(ok) }; return q },
    functions: { invoke: vi.fn() },
  },
}))

const montar = (url: string) => render(<MemoryRouter initialEntries={[url]}><ProducerCheckIn /></MemoryRouter>)

describe('Check-in e ?eventId=', () => {
  it('evento que não está publicado: aviso honesto, sem cair em outro evento', () => {
    montar('/producer/checkin?eventId=e2')
    expect(screen.getByRole('status')).toHaveTextContent('Este evento ainda não está publicado')
    expect(screen.getByRole('status')).toHaveTextContent('check-in abre quando ele estiver no ar')
    expect(screen.queryByText('Total Emitido')).toBeNull()
  })

  it('evento publicado na URL é o selecionado', () => {
    montar('/producer/checkin?eventId=e1')
    expect(screen.getByLabelText('Selecionar Evento')).toHaveValue('e1')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
