import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import ProducerIngressos from '../pages/producer/Ingressos'

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
const m = vi.hoisted(() => ({
  eventos: { current: {} as Record<string, unknown> }, vendidos: { current: {} as Record<string, unknown> }, receita: { current: {} as Record<string, unknown> },
  reordenar: vi.fn(), pendente: { current: false }, alternar: vi.fn(), alternarAsync: vi.fn(), gravar: vi.fn(), fator: vi.fn(),
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../hooks/useEvents', () => ({
  useProducerEvents: () => m.eventos.current,
  useUpdateEvent: () => ({ mutateAsync: m.gravar, isPending: false }),
}))
vi.mock('../hooks/useIngressos', () => ({
  useVendidosPorTipo: () => m.vendidos.current,
  useReceitaDoEvento: () => m.receita.current,
  useReordenarIngressos: () => ({ mutate: m.reordenar, isPending: m.pendente.current }),
  useAlternarIngresso: () => ({ mutate: m.alternar, mutateAsync: m.alternarAsync, isPending: false }),
}))
vi.mock('../lib/vendasPagas', () => ({ faltaSegundoFator: m.fator }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const tt = (id: string, extra: object = {}) => ({ id, event_id: 'e1', name: id, price: 50, is_active: true, quantity_total: 100, sold: 0, type: 'individual', permite_meia: true, sort_order: 0, created_at: '2026-01-01', sale_start: null, sale_end: null, ...extra })
const evento = (tipos: object[]) => ({ id: 'e1', title: 'Festa Um', status: 'draft', date: '2026-12-01', ticket_types: tipos })
const q = (data: unknown) => ({ data, isPending: false, isError: false, isFetching: false, refetch: vi.fn() })
const montar = (url = '/producer/ingressos?eventId=e1') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[url]}><ProducerIngressos /></MemoryRouter>
  </QueryClientProvider>,
)
const tres = [tt('Pista', { sort_order: 1 }), tt('VIP', { sort_order: 2, type: 'vip', price: 120 }), tt('Mesa', { sort_order: 3, type: 'coletiva', permite_meia: false, price: 0 })]

describe('tela Ingressos', () => {
  beforeEach(() => {
    Object.values(m).forEach(v => typeof v === 'function' && 'mockReset' in v && v.mockReset())
    vi.mocked(toast.success).mockClear(); vi.mocked(toast.error).mockClear()
    m.pendente.current = false; m.gravar.mockResolvedValue(null); m.fator.mockResolvedValue(false)
    m.eventos.current = q([evento(tres)]); m.vendidos.current = q({ Pista: 30, VIP: 5 }); m.receita.current = q(1500)
  })

  it('lista na ordem, com números do topo e abas Ingressos | Cupons levando o evento', () => {
    montar()
    const nomes = screen.getAllByRole('listitem').map(li => li.querySelector('p')!.textContent)
    expect(nomes).toEqual(['Pista', 'VIP', 'Mesa'])
    expect(screen.getByText('35')).toBeInTheDocument() // vendidos
    expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument()
    expect(screen.getByText('Gratuito')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Ingressos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Cupons' })).toBeInTheDocument()
  })

  it('sem evento escolhido pede para escolher; evento alheio é recusado', () => {
    montar('/producer/ingressos')
    expect(screen.getByText('Escolha um evento')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })
  it('evento de outro produtor: "não encontrado entre os seus"', () => {
    montar('/producer/ingressos?eventId=alheio')
    expect(screen.getByText('Evento não encontrado entre os seus')).toBeInTheDocument()
    expect(screen.queryByText('Pista')).toBeNull()
  })

  it('subir e descer gravam só quem mudou; o primeiro não sobe e o último não desce', async () => {
    montar()
    expect(screen.getByRole('button', { name: 'Subir Pista' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Descer Mesa' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Subir VIP' }))
    expect(m.reordenar).toHaveBeenCalledWith({ eventId: 'e1', ordens: [{ id: 'VIP', sort_order: 1 }, { id: 'Pista', sort_order: 2 }] }, expect.anything())
  })

  it('arrastar e soltar reordena', () => {
    montar()
    const [pista, , mesa] = screen.getAllByRole('listitem')
    fireEvent.dragStart(mesa)
    fireEvent.dragOver(pista)
    fireEvent.drop(pista)
    expect(m.reordenar).toHaveBeenCalledWith({ eventId: 'e1', ordens: [{ id: 'Mesa', sort_order: 1 }, { id: 'Pista', sort_order: 2 }, { id: 'VIP', sort_order: 3 }] }, expect.anything())
  })

  it('com gravação em andamento, arrastar não reordena e os botões ficam desativados', () => {
    m.pendente.current = true
    montar()
    const [pista, , mesa] = screen.getAllByRole('listitem')
    fireEvent.dragStart(mesa); fireEvent.dragOver(pista); fireEvent.drop(pista)
    expect(m.reordenar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Subir VIP' })).toBeDisabled()
  })

  it('Ocultar pede confirmação (derruba compras em andamento) e depois oferece Desfazer que volta à venda', async () => {
    m.alternar.mockImplementation((_v: unknown, o: { onSuccess: () => void }) => o.onSuccess())
    m.alternarAsync.mockResolvedValue(null)
    montar()
    await userEvent.click(screen.getByRole('switch', { name: 'Visível: Pista' }))
    expect(m.alternar).not.toHaveBeenCalled() // ainda não gravou
    expect(screen.getByText('Ocultar este ingresso?')).toBeInTheDocument()
    expect(screen.getByText(/Quem está pagando agora pode não conseguir concluir a compra/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(m.alternar).toHaveBeenCalledWith({ eventId: 'e1', id: 'Pista', ativo: false }, expect.anything())
    const [msg, opts] = vi.mocked(toast.success).mock.calls.at(-1) as [string, { id: string; duration: number; action: { label: string; onClick: () => void } }]
    expect(msg).toMatch(/"Pista" oculto.*Quem já comprou continua com o ingresso/)
    expect(opts.action.label).toBe('Desfazer'); expect(opts.duration).toBe(8000); expect(opts.id).toBe('desfazer-ingresso-Pista') // o aviso novo substitui o velho
    opts.action.onClick()
    await waitFor(() => expect(m.alternarAsync).toHaveBeenCalledWith({ eventId: 'e1', id: 'Pista', ativo: true }))
  })

  it('Mostrar (voltar à venda) grava direto, sem diálogo, e oferece Desfazer que oculta de novo', async () => {
    m.eventos.current = q([evento([tt('Pista', { sort_order: 1, is_active: false })])])
    m.alternar.mockImplementation((_v: unknown, o: { onSuccess: () => void }) => o.onSuccess())
    m.alternarAsync.mockResolvedValue(null)
    montar()
    await userEvent.click(screen.getByRole('switch', { name: 'Visível: Pista' }))
    expect(screen.queryByText('Ocultar este ingresso?')).toBeNull()
    expect(m.alternar).toHaveBeenCalledWith({ eventId: 'e1', id: 'Pista', ativo: true }, expect.anything())
    const [msg, opts] = vi.mocked(toast.success).mock.calls.at(-1) as [string, { action: { onClick: () => void } }]
    expect(msg).toBe('"Pista" voltou à venda.')
    opts.action.onClick()
    await waitFor(() => expect(m.alternarAsync).toHaveBeenCalledWith({ eventId: 'e1', id: 'Pista', ativo: false }))
  })

  it('erro ao mudar: avisa e não oferece Desfazer', async () => {
    m.eventos.current = q([evento([tt('Pista', { sort_order: 1, is_active: false })])])
    m.alternar.mockImplementation((_v: unknown, o: { onError: () => void }) => o.onError())
    montar()
    await userEvent.click(screen.getByRole('switch', { name: 'Visível: Pista' }))
    expect(toast.error).toHaveBeenCalledWith('Não foi possível mudar o ingresso. Tente de novo.')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('editar ingresso com vendas: quantidade abaixo do vendido não grava', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Editar Pista' }))
    expect(screen.getByText(/Já vendidos: 30/)).toBeInTheDocument()
    const qtd = screen.getByLabelText('Quantidade')
    await userEvent.clear(qtd); await userEvent.type(qtd, '10')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(m.gravar).not.toHaveBeenCalled()
    expect(screen.getAllByText(/Já foram vendidos 30/).length).toBeGreaterThan(0)
    await userEvent.clear(qtd); await userEvent.type(qtd, '40')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(m.gravar).toHaveBeenCalledTimes(1))
    const arg = m.gravar.mock.calls[0][0]
    expect(arg).toMatchObject({ eventId: 'e1', event: {} })
    expect(arg.tickets).toHaveLength(1)
    expect(arg.tickets[0]).toMatchObject({ id: 'Pista', name: 'Pista', price: 50, capacity: 40, type: 'individual' })
  })

  it('virar gratuito pede confirmação; com vendas, mudar o preço avisa que não afeta quem comprou', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Editar Pista' }))
    const preco = screen.getByLabelText('Preço (R$)')
    await userEvent.clear(preco); await userEvent.type(preco, '0')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(m.gravar).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/passa a ser gratuito/)
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/quem já comprou não é afetado/)
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar e salvar' }))
    await waitFor(() => expect(m.gravar).toHaveBeenCalledTimes(1))
    expect(m.gravar.mock.calls[0][0].tickets[0].price).toBe(0)
  })

  it('editar sem mexer no preço grava direto (sem confirmação)', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Editar VIP' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(m.gravar).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('novo ingresso gratuito: preço 0 travado e vai como individual', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Novo ingresso' }))
    await userEvent.click(screen.getByRole('button', { name: /Gratuito/ }))
    expect(screen.getByLabelText('Preço (R$)')).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Nome'), 'Convidado')
    await userEvent.type(screen.getByLabelText('Quantidade'), '20')
    await userEvent.click(screen.getByRole('button', { name: 'Criar ingresso' }))
    await waitFor(() => expect(m.gravar).toHaveBeenCalledTimes(1))
    expect(m.gravar.mock.calls[0][0].tickets[0]).toMatchObject({ id: undefined, name: 'Convidado', price: 0, capacity: 20, type: 'individual' })
  })

  it('novo ingresso pago mostra comprador paga × você recebe e recusa preço 0', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Novo ingresso' }))
    await userEvent.click(screen.getByRole('button', { name: /Pago/ }))
    await userEvent.type(screen.getByLabelText('Preço (R$)'), '50,00')
    expect(screen.getByText(/Comprador paga/)).toHaveTextContent('R$ 55,00')
    expect(screen.getByText(/Você recebe/)).toHaveTextContent('R$ 50,00')
    await userEvent.clear(screen.getByLabelText('Preço (R$)')); await userEvent.type(screen.getByLabelText('Preço (R$)'), '0')
    await userEvent.type(screen.getByLabelText('Nome'), 'X'); await userEvent.type(screen.getByLabelText('Quantidade'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Criar ingresso' }))
    expect(m.gravar).not.toHaveBeenCalled()
    expect(screen.getAllByText(/Ingresso pago precisa de preço maior que zero/).length).toBeGreaterThan(0)
  })

  it('grupo: meia desligada e travada, vai como coletiva', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Novo ingresso' }))
    await userEvent.click(screen.getByRole('button', { name: /Grupo/ }))
    await userEvent.click(screen.getByText('Avançado'))
    expect(screen.getByLabelText('Aceita meia-entrada')).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Nome'), 'Mesa 4'); await userEvent.type(screen.getByLabelText('Preço (R$)'), '200'); await userEvent.type(screen.getByLabelText('Quantidade'), '8')
    await userEvent.click(screen.getByRole('button', { name: 'Criar ingresso' }))
    await waitFor(() => expect(m.gravar).toHaveBeenCalledTimes(1))
    expect(m.gravar.mock.calls[0][0].tickets[0]).toMatchObject({ type: 'coletiva', permite_meia: false, price: 200 })
  })

  it('Esc fecha o modal sem gravar', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Novo ingresso' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(m.gravar).not.toHaveBeenCalled()
  })

  it('prévia abre com o selo Em breve da logo do produtor', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Prévia de VIP' }))
    expect(screen.getByRole('article', { name: 'Ingresso VIP' })).toBeInTheDocument()
    expect(screen.getByText(/Prévia com logo do produtor \(plano PRO\)/)).toBeInTheDocument()
  })

  it('2FA pendente: vendidos e receita viram traço, não zero', async () => {
    m.vendidos.current = q({}); m.receita.current = q(0); m.fator.mockResolvedValue(true)
    montar()
    expect(await screen.findByText(/Confirme o 2FA/)).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3) // vendidos, disponíveis e receita
  })

  it('erro mostra Tentar de novo; carregando mostra esqueleto; sem ingresso mostra o próximo passo', () => {
    m.vendidos.current = { ...q(undefined), isError: true }
    const { unmount } = montar()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    unmount()
    m.vendidos.current = { ...q(undefined), isPending: true }
    const b = montar(); expect(screen.getByLabelText('Carregando ingressos')).toBeInTheDocument(); b.unmount()
    m.vendidos.current = q({}); m.eventos.current = q([evento([])]); m.receita.current = q(0)
    montar()
    expect(screen.getByText('Este evento ainda não tem ingressos')).toBeInTheDocument()
  })

  it('itens Em breve estão desativados', () => {
    montar()
    expect(screen.getByRole('button', { name: 'Absorver taxa' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Criar lote' })).toBeDisabled()
  })
})
