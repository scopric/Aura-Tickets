import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerTasks from '../pages/producer/Tasks'
import { atrasada, diaEmSP, prazoDoDia } from '../lib/tarefas'

// E2: Tarefas grava só as colunas de producer_tasks, com status/prioridade do CHECK e prazo em -03:00
const db = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), leitura: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({
  useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festa Um' }], isPending: false, isError: false }),
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => db.leitura() }) }),
      insert: (p: unknown) => { db.insert(p); return { select: () => ({ single: () => Promise.resolve({ data: { id: 't9' }, error: null }) }) } },
      update: (p: unknown) => { db.update(p); return { eq: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }) }) } },
    }),
  },
}))

const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/producer/tarefas']}><ProducerTasks /></MemoryRouter>
    </QueryClientProvider>,
  )
const tarefa = (o: object) => ({ id: 't1', producer_id: 'u1', event_id: null, assigned_to: null, title: 'Contratar DJ', description: null, due_date: null, status: 'todo', priority: 'medium', created_at: '2026-10-01T00:00:00Z', ...o })

describe('Tarefas', () => {
  afterEach(() => { vi.clearAllMocks(); cleanup() })

  it('criar grava só colunas do banco, status e prioridade válidos e prazo com -03:00', async () => {
    db.leitura.mockResolvedValue({ data: [], error: null })
    montar()
    fireEvent.click((await screen.findAllByRole('button', { name: /Criar tarefa/ }))[0])
    const d = within(screen.getByRole('dialog'))
    fireEvent.change(d.getByLabelText('Título'), { target: { value: '  Contratar DJ ' } })
    fireEvent.change(d.getByLabelText('Prioridade'), { target: { value: 'high' } })
    fireEvent.change(d.getByLabelText(/Prazo/), { target: { value: '2026-10-10' } })
    fireEvent.change(d.getByLabelText('Evento'), { target: { value: 'e1' } })
    fireEvent.submit(document.getElementById('form-tarefa')!)
    await waitFor(() => expect(db.insert).toHaveBeenCalledTimes(1))
    const p = db.insert.mock.calls[0][0]
    expect(p).toEqual({
      title: 'Contratar DJ', description: null, priority: 'high', status: 'todo',
      due_date: '2026-10-10T12:00:00-03:00', event_id: 'e1', producer_id: 'u1',
    })
  })

  it('o círculo cicla todo -> in_progress e grava só o status', async () => {
    db.leitura.mockResolvedValue({ data: [tarefa({})], error: null })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Contratar DJ: Pendente\. Mudar para Em andamento/ }))
    await waitFor(() => expect(db.update).toHaveBeenCalledWith({ status: 'in_progress' }))
  })

  it('erro de leitura aparece com a causa e não como lista vazia', async () => {
    db.leitura.mockResolvedValue({ data: null, error: { message: 'JWT expired', code: 'PGRST301' } })
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as tarefas.')
    expect(screen.getByRole('alert')).toHaveTextContent('JWT expired')
    expect(screen.queryByText('Nenhuma tarefa ainda')).toBeNull()
  })

  it('lista vazia mostra o convite para criar, não o erro', async () => {
    db.leitura.mockResolvedValue({ data: [], error: null })
    montar()
    expect(await screen.findByText('Nenhuma tarefa ainda')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('atrasada: compara o dia de Brasília, não o do UTC', () => {
    // 22h de 09/10 em Brasília já é 01h de 10/10 em UTC
    expect(diaEmSP('2026-10-10T01:00:00Z')).toBe('2026-10-09')
    expect(prazoDoDia('2026-10-09')).toBe('2026-10-09T12:00:00-03:00')
    const t = (status: string, due_date: string | null) => ({ status, due_date }) as Parameters<typeof atrasada>[0]
    expect(atrasada(t('todo', '2026-10-09T15:00:00Z'), '2026-10-10')).toBe(true)
    expect(atrasada(t('todo', '2026-10-10T15:00:00Z'), '2026-10-10')).toBe(false) // vence hoje: não é atrasada
    expect(atrasada(t('done', '2026-10-01T15:00:00Z'), '2026-10-10')).toBe(false)
    expect(atrasada(t('todo', null), '2026-10-10')).toBe(false)
  })

  it('card Atrasadas conta só as não concluídas com prazo vencido; Pendentes conta as não concluídas', async () => {
    db.leitura.mockResolvedValue({ data: [
      tarefa({ id: 'a', due_date: '2020-01-01T15:00:00+00:00' }),
      tarefa({ id: 'b', due_date: '2020-01-01T15:00:00+00:00', status: 'done' }),
      tarefa({ id: 'c', due_date: '2999-01-01T15:00:00+00:00', status: 'in_progress' }),
    ], error: null })
    montar()
    await screen.findAllByText('Contratar DJ')
    expect(screen.getByText('Atrasadas').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Pendentes').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Concluídas').nextElementSibling).toHaveTextContent('1')
  })
})
