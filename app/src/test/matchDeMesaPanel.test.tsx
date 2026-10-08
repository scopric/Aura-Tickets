import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MatchDeMesaPanel from '../components/producer/MatchDeMesaPanel'

// Hooks falsos: o painel só desenha e chama as ações; as regras ficam no banco
const formar = vi.hoisted(() => vi.fn())
const mesas = [{
  numero: 1, nome: 'Mesa 1', capacidade: 4,
  membros: [
    { ingresso: 'aaaaaaaa-1111', nome: 'Ana Souza', pode_remover: true },
    { ingresso: 'bbbbbbbb-2222', nome: 'Bruno Lima', pode_remover: false },
  ],
}]
vi.mock('../hooks/useMesaAdmin', async orig => ({
  ...(await orig<typeof import('../hooks/useMesaAdmin')>()),
  useMesasDoEvento: () => ({ isLoading: false, isError: false, data: mesas }),
  useMesaDenuncias: () => ({ isLoading: false, isError: false, data: [{ denunciado: 'Bruno Lima', motivo: 'assedio', mesa: 'Mesa 1', resultado: 'procedente' }] }),
  useFormarMesas: () => ({ isPending: false, mutate: formar }),
  useRemoverMembro: () => ({ isPending: false, mutate: vi.fn() }),
}))

afterEach(cleanup)

describe('MatchDeMesaPanel', () => {
  it('lista as mesas e só oferece remover a quem tem denúncia liberada', () => {
    render(<MatchDeMesaPanel eventId="e1" />)
    expect(screen.getByText('Ana Souza')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Remover da mesa' })).toHaveLength(1)
    expect(screen.getByText('Sem denúncia que você possa usar')).toBeTruthy()
    expect(screen.getByText(/Procedente/)).toBeTruthy()
  })

  it('formar mesas pede confirmação antes de chamar o banco', () => {
    render(<MatchDeMesaPanel eventId="e1" />)
    fireEvent.click(screen.getByRole('button', { name: /Formar mesas agora/ }))
    expect(formar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Confirmar formação/ }))
    expect(formar).toHaveBeenCalledTimes(1)
  })

  it('remover abre o formulário com a confirmação travada até escolher o motivo', () => {
    render(<MatchDeMesaPanel eventId="e1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Remover da mesa' }))
    expect((screen.getByRole('button', { name: 'Confirmar remoção' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
