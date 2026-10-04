import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerPartners from '../pages/producer/Partners'

// L22: Parceiros grava só as colunas de public.partners, edita, confirma a exclusão e mostra a causa do erro
const db = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), leitura: vi.fn(), apagou: vi.fn(), erro: vi.fn(), atualizou: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: db.erro, success: vi.fn() } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => db.leitura() }) }),
      insert: (p: unknown) => ({ select: () => ({ single: () => db.insert(p) }) }),
      delete: () => ({ eq: () => ({ eq: () => ({ select: () => db.apagou() }) }) }),
      update: (p: unknown) => ({ eq: () => ({ eq: () => ({ select: () => db.atualizou(p) }) }) }),
    }),
  },
}))

const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><ProducerPartners /></MemoryRouter>
    </QueryClientProvider>,
  )
const parceiro = (o: object = {}) => ({ id: 'p1', producer_id: 'u1', name: 'Cervejaria Alfa', type: 'fornecedor', contact: 'Ana', logo_url: null, notes: null, created_at: '2026-10-01T00:00:00Z', ...o })

describe('Parceiros', () => {
  afterEach(() => { vi.clearAllMocks(); cleanup() })

  it('cadastrar grava só name, type, contact, notes e producer_id', async () => {
    db.leitura.mockResolvedValue({ data: [], error: null })
    db.insert.mockResolvedValue({ data: { id: 'p9' }, error: null })
    montar()
    fireEvent.click((await screen.findAllByRole('button', { name: /Novo parceiro/ }))[0])
    const d = within(screen.getByRole('dialog'))
    fireEvent.change(d.getByLabelText('Nome da empresa'), { target: { value: '  Banco Beta ' } })
    fireEvent.change(d.getByLabelText('Contato'), { target: { value: 'beta@x.com' } })
    fireEvent.click(d.getByRole('button', { name: 'Adicionar parceiro' }))
    await waitFor(() => expect(db.insert).toHaveBeenCalledTimes(1))
    expect(db.insert.mock.calls[0][0]).toEqual({ name: 'Banco Beta', type: 'patrocinador', contact: 'beta@x.com', notes: null, producer_id: 'u1' })
  })

  it('nome vazio avisa e não grava', async () => {
    db.leitura.mockResolvedValue({ data: [], error: null })
    montar()
    fireEvent.click((await screen.findAllByRole('button', { name: /Novo parceiro/ }))[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Adicionar parceiro' }))
    await waitFor(() => expect(db.erro).toHaveBeenCalledWith('Informe o nome do parceiro'))
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('erro do banco ao cadastrar mostra a causa', async () => {
    db.leitura.mockResolvedValue({ data: [], error: null })
    db.insert.mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy' } })
    montar()
    fireEvent.click((await screen.findAllByRole('button', { name: /Novo parceiro/ }))[0])
    const d = within(screen.getByRole('dialog'))
    fireEvent.change(d.getByLabelText('Nome da empresa'), { target: { value: 'X' } })
    fireEvent.click(d.getByRole('button', { name: 'Adicionar parceiro' }))
    await waitFor(() => expect(db.erro).toHaveBeenCalledWith('Não foi possível adicionar o parceiro: new row violates row-level security policy'))
  })

  it('editar abre com os dados e grava só as colunas editáveis', async () => {
    db.leitura.mockResolvedValue({ data: [parceiro()], error: null })
    db.atualizou.mockResolvedValue({ data: [{ id: 'p1' }], error: null })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Cervejaria Alfa' }))
    const d = within(screen.getByRole('dialog'))
    expect(d.getByLabelText('Nome da empresa')).toHaveValue('Cervejaria Alfa')
    fireEvent.change(d.getByLabelText('Observações'), { target: { value: 'Entrega dia 10' } })
    fireEvent.click(d.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(db.atualizou).toHaveBeenCalledWith({ name: 'Cervejaria Alfa', type: 'fornecedor', contact: 'Ana', notes: 'Entrega dia 10' }))
  })

  it('remover pede confirmação e só apaga depois dela', async () => {
    db.leitura.mockResolvedValue({ data: [parceiro()], error: null })
    db.apagou.mockResolvedValue({ data: [{ id: 'p1' }], error: null })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Remover Cervejaria Alfa' }))
    expect(db.apagou).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(db.apagou).toHaveBeenCalledTimes(1))
  })

  it('remover que o banco barra (0 linhas, sem erro) avisa "Nada foi apagado"', async () => {
    db.leitura.mockResolvedValue({ data: [parceiro()], error: null })
    db.apagou.mockResolvedValue({ data: [], error: null })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Remover Cervejaria Alfa' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(db.erro).toHaveBeenCalledWith('Não foi possível remover o parceiro: Nada foi apagado'))
  })

  it('cartões contam todos os parceiros, mesmo com filtro de tipo ligado', async () => {
    db.leitura.mockResolvedValue({ data: [parceiro(), parceiro({ id: 'p2', name: 'Marca Gama', type: 'patrocinador' })], error: null })
    montar()
    await screen.findByText('Marca Gama')
    fireEvent.click(screen.getByRole('button', { name: 'Fornecedor' }))
    expect(screen.queryByText('Marca Gama')).toBeNull()
    expect(screen.getByText('Total de parceiros').parentElement).toHaveTextContent('2')
  })

  it('erro de leitura aparece com a causa e não como lista vazia', async () => {
    db.leitura.mockResolvedValue({ data: null, error: { message: 'JWT expired' } })
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os parceiros.')
    expect(screen.getByRole('alert')).toHaveTextContent('JWT expired')
  })
})
