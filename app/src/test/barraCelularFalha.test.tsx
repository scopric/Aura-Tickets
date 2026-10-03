import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import BarraCelular from '../components/producer/BarraCelular'

// a folha não baixa (rede caiu): a página segue de pé e a pessoa recebe o aviso
vi.mock('../components/producer/FolhaMenu', () => { throw new Error('Failed to fetch dynamically imported module') })
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [], isLoading: false }) }))

describe('folha Menu que não baixa', () => {
  it('mostra o aviso e a barra continua funcionando', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/producer/dashboard']}><BarraCelular /></MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível abrir o menu. Tente de novo.'))
    expect(screen.getByRole('navigation', { name: 'Navegação do celular' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
