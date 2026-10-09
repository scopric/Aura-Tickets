import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PaginaBotoes from '../components/producer/quadro/BotoesQuadro'
import { ColunaRevisao, PaginaModelos, PaginaPapeis } from '../components/producer/quadro/ModelosPapeis'
import CartaoPlanejamento from '../components/producer/quadro/CartaoPlanejamento'
import MenuQuadro from '../components/producer/quadro/MenuQuadro'
import { SEMENTES_MODELOS } from './quadroSementes'
import type { ColunaQuadro, DbTask } from '../hooks/useProducerTools'

// Banco simulado (mesmo molde de quadroAcoes.test.tsx)
const m = vi.hoisted(() => {
  type R = { data?: unknown; error?: unknown }
  const chamadas: { tabela: string; op: string; args: unknown[] }[] = []
  const rpcs: { nome: string; args: Record<string, unknown> }[] = []
  const estado = { resposta: ((): R => ({ data: [], error: null })) as (t: string, op: string) => R, rpc: ((): R => ({ data: null, error: null })) as (n: string) => R }
  const from = (tabela: string) => {
    let op = 'select'
    let args: unknown[] = []
    const b: Record<string, unknown> = new Proxy({}, {
      get: (_, k: string) => {
        if (k === 'then') return (res: (v: unknown) => void) => { chamadas.push({ tabela, op, args }); res({ data: null, error: null, ...estado.resposta(tabela, op) }) }
        return (...a: unknown[]) => { if (['insert', 'update', 'delete', 'upsert'].includes(k)) { op = k; args = a }; return b }
      },
    })
    return b
  }
  const rpc = (nome: string, args: Record<string, unknown>) => { rpcs.push({ nome, args }); return Promise.resolve({ data: null, error: null, ...estado.rpc(nome) }) }
  return { chamadas, rpcs, estado, from, rpc, toast: { error: vi.fn(), success: vi.fn() } }
})
vi.mock('../lib/supabase', () => ({ supabase: { from: m.from, rpc: m.rpc } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('sonner', () => ({ toast: m.toast }))

const BOARD = '11111111-1111-4111-8111-111111111111'
const C1 = '22222222-2222-4222-8222-222222222222'
const C2 = '33333333-3333-4333-8333-333333333333'
const BTN = '44444444-4444-4444-8444-444444444444'
const BTN2 = '55555555-5555-4555-8555-555555555555'
const PESSOA = '66666666-6666-4666-8666-666666666666'
const colunas: ColunaQuadro[] = [{ id: C1, name: 'A fazer', kind: 'todo' }, { id: C2, name: 'Feito', kind: 'done' }]
const feitas = (tabela: string, op: string) => m.chamadas.filter(c => c.tabela === tabela && c.op === op)
const SEM_TABELA = { error: { code: 'PGRST205', message: 'Could not find the table' } }
const LINHAS = [
  { id: BTN, board_id: BOARD, name: 'Limpar o Feito', scope: 'board', column_id: C2, steps: [{ t: 'arquivar' }], position: 1000 },
  { id: BTN2, board_id: BOARD, name: 'Enviar para revisão', scope: 'card', column_id: null, steps: [{ t: 'mover', v: C2 }, { t: 'prazo', v: 2 }], position: 2000 },
]

function montar(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}
beforeEach(() => {
  m.chamadas.length = 0; m.rpcs.length = 0
  m.estado.resposta = () => ({ data: [], error: null })
  m.estado.rpc = () => ({ data: null, error: null })
  m.toast.error.mockClear(); m.toast.success.mockClear()
})
afterEach(cleanup)

describe('página Botões', () => {
  it('sem o SQL: diz que está indisponível, sem erro e sem ações', async () => {
    m.estado.resposta = () => SEM_TABELA
    montar(<PaginaBotoes boardId={BOARD} colunas={colunas} pode />)
    expect(await screen.findByText('Indisponível até a atualização do banco.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Novo botão/ })).toBeNull()
    expect(m.toast.error).not.toHaveBeenCalled()
  })

  it('quem só vê enxerga a lista, sem Rodar, Editar, Apagar nem Novo botão', async () => {
    m.estado.resposta = t => (t === 'task_buttons' ? { data: LINHAS } : { data: [] })
    montar(<PaginaBotoes boardId={BOARD} colunas={colunas} pode={false} />)
    expect(await screen.findByText('Limpar o Feito')).toBeTruthy()
    expect(screen.getByText('Arquivar o cartão')).toBeTruthy()
    expect(screen.getByText('Mover para Feito')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Rodar agora|Editar|Apagar|Novo botão/ })).toBeNull()
  })

  it('cria botão: nome, escopo de quadro com coluna, passo; grava passos válidos. Sem coluna não grava', async () => {
    m.estado.resposta = t => (t === 'task_buttons' ? { data: [] } : { data: [] })
    montar(<PaginaBotoes boardId={BOARD} colunas={colunas} pode />)
    fireEvent.click(await screen.findByRole('button', { name: /Novo botão/ }))
    fireEvent.change(screen.getByLabelText('Nome do botão'), { target: { value: 'Revisar tudo' } })
    fireEvent.change(screen.getByLabelText('Onde age'), { target: { value: 'board' } })
    fireEvent.change(screen.getByLabelText('Passo 1: o que fazer'), { target: { value: 'atribuir' } })
    fireEvent.change(screen.getByLabelText('Passo 1: valor'), { target: { value: 'revisao' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar passo' }))
    fireEvent.change(screen.getByLabelText('Passo 2: o que fazer'), { target: { value: 'prazo' } })
    fireEvent.change(screen.getByLabelText('Passo 2: dias'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar botão' }))
    await waitFor(() => expect(m.toast.error).toHaveBeenCalledWith('Escolha a coluna em que o botão age'))
    expect(feitas('task_buttons', 'insert')).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Coluna'), { target: { value: C1 } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar botão' }))
    await waitFor(() => expect(feitas('task_buttons', 'insert')).toHaveLength(1))
    expect(feitas('task_buttons', 'insert')[0].args[0]).toMatchObject({ name: 'Revisar tudo', scope: 'board', column_id: C1, steps: [{ t: 'atribuir', v: 'revisao' }, { t: 'prazo', v: 5 }] })
  })

  it('recusa salvar sem nenhum passo', async () => {
    m.estado.resposta = () => ({ data: [] })
    montar(<PaginaBotoes boardId={BOARD} colunas={colunas} pode />)
    fireEvent.click(await screen.findByRole('button', { name: /Novo botão/ }))
    fireEvent.change(screen.getByLabelText('Nome do botão'), { target: { value: 'Vazio' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tirar o passo 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar botão' }))
    await waitFor(() => expect(m.toast.error).toHaveBeenCalledWith('Escolha pelo menos um passo'))
    expect(feitas('task_buttons', 'insert')).toHaveLength(0)
  })

  it('Rodar agora mostra "N afetados, M ignorados" e os motivos', async () => {
    m.estado.resposta = t => (t === 'task_buttons' ? { data: LINHAS } : { data: [] })
    m.estado.rpc = () => ({ data: { afetados: 3, ignorados: 1, motivos: ['Papel “Revisão” sem pessoa definida.', 'violates foreign key constraint "x"'] } })
    montar(<PaginaBotoes boardId={BOARD} colunas={colunas} pode />)
    fireEvent.click(await screen.findByRole('button', { name: /Rodar agora/ }))
    expect(await screen.findByText('3 afetados, 1 ignorado')).toBeTruthy()
    expect(screen.getByText('Papel “Revisão” sem pessoa definida.')).toBeTruthy()
    expect(screen.getByText('Não foi possível neste cartão.')).toBeTruthy()
    expect(document.body.innerHTML).not.toContain('foreign key')
    expect(m.rpcs[0]).toEqual({ nome: 'quadro_rodar_botao', args: { p_button: BTN, p_task: null } })
    expect(screen.getAllByRole('button', { name: /Rodar agora/ })).toHaveLength(1) // só o de quadro tem "Rodar agora"
  })

  it('apagar pede confirmação e só então apaga', async () => {
    m.estado.resposta = t => (t === 'task_buttons' ? { data: LINHAS } : { data: [] })
    montar(<PaginaBotoes boardId={BOARD} colunas={colunas} pode />)
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar o botão Limpar o Feito' }))
    expect(feitas('task_buttons', 'delete')).toHaveLength(0)
    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).getByText(/Apagar o botão “Limpar o Feito”\?/)).toBeTruthy()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(feitas('task_buttons', 'delete')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar o botão Limpar o Feito' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Apagar' }))
    await waitFor(() => expect(feitas('task_buttons', 'delete')).toHaveLength(1))
  })

  it('erro do banco aparece como frase genérica, nunca crua', async () => {
    m.estado.resposta = (t, op) => (t === 'task_buttons' ? (op === 'delete' ? { error: { code: 'XX000', message: 'relation "task_buttons" violates foreign key constraint' } } : { data: LINHAS }) : { data: [] })
    montar(<PaginaBotoes boardId={BOARD} colunas={colunas} pode />)
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar o botão Limpar o Feito' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Apagar' }))
    await waitFor(() => expect(m.toast.error).toHaveBeenCalledWith('Não foi possível salvar. Tente de novo.'))
  })
})

describe('página Modelos', () => {
  const modelos = SEMENTES_MODELOS
  it('lista "papel · D-n", aplica só os marcados e conta criados e existentes', async () => {
    m.estado.resposta = () => ({ data: modelos })
    m.estado.rpc = () => ({ data: { criados: 1, existentes: 1 } })
    montar(<PaginaModelos boardId={BOARD} pode temEvento />)
    expect(await screen.findByText('Fornecedores · D-45')).toBeTruthy()
    for (const t of ['Festa', 'Curso', 'Congresso']) { fireEvent.click(screen.getByRole('button', { name: t })); expect((await screen.findAllByRole('checkbox')).length).toBe(t === 'Festa' ? 6 : t === 'Curso' ? 6 : 8) }
    fireEvent.click(screen.getByRole('button', { name: 'Curso' }))
    expect(screen.getByText('Divulgação · D+1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Testar o check-in/ })) // desmarca o do meio
    fireEvent.click(screen.getByRole('button', { name: /Aplicar ao quadro/ }))
    await waitFor(() => expect(m.rpcs).toHaveLength(1))
    expect(m.rpcs[0]).toEqual({ nome: 'quadro_aplicar_modelo', args: { p_board: BOARD, p_kind: 'show', p_itens: [0, 1, 2, 3, 4, 5, 6, 8] } })
    await waitFor(() => expect(m.toast.success).toHaveBeenCalledWith('1 cartão criado, 1 já existia.'))
  })
  it('sem evento: avisa e não deixa aplicar', async () => {
    m.estado.resposta = () => ({ data: modelos })
    montar(<PaginaModelos boardId={BOARD} pode temEvento={false} />)
    expect(await screen.findByText(/Este quadro não é de um evento/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Aplicar ao quadro/ }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('quem só vê não tem o botão Aplicar; sem o SQL fica indisponível', async () => {
    m.estado.resposta = () => ({ data: modelos })
    const a = montar(<PaginaModelos boardId={BOARD} pode={false} temEvento />)
    await screen.findByText('Fornecedores · D-45')
    expect(screen.queryByRole('button', { name: /Aplicar ao quadro/ })).toBeNull()
    a.unmount()
    m.estado.resposta = () => SEM_TABELA
    montar(<PaginaModelos boardId={BOARD} pode temEvento />)
    expect(await screen.findByText('Indisponível até a atualização do banco.')).toBeTruthy()
  })
})

describe('página Papéis', () => {
  it('mostra o aviso, define pelo update e nunca mostra e-mail', async () => {
    m.estado.resposta = t => (t === 'task_roles' ? { data: [] } : { data: [] })
    m.estado.rpc = () => ({ data: [{ id: PESSOA, nome: 'Ana Souza', email: 'ana@x.com' }] })
    const { container } = montar(<PaginaPapeis boardId={BOARD} pode />)
    expect(await screen.findByText(/Papel sem pessoa faz o passo ser ignorado/)).toBeTruthy()
    const sel = await screen.findByLabelText('Portaria')
    await waitFor(() => expect(within(sel).getByText('Ana Souza')).toBeTruthy())
    fireEvent.change(sel, { target: { value: PESSOA } })
    await waitFor(() => expect(feitas('task_roles', 'update')).toHaveLength(1))
    expect(feitas('task_roles', 'upsert')).toHaveLength(0)
    expect(container.innerHTML).not.toContain('@')
  })
  it('quem só vê enxerga o nome, sem selects', async () => {
    m.estado.resposta = () => ({ data: [{ papel: 'portaria', user_id: PESSOA }] })
    m.estado.rpc = () => ({ data: [{ id: PESSOA, nome: 'Ana Souza' }] })
    montar(<PaginaPapeis boardId={BOARD} pode={false} />)
    expect(await screen.findByText('Ana Souza')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})

describe('verso: botões, repetir e checklist que move', () => {
  const tarefa: DbTask = {
    id: '77777777-7777-4777-8777-777777777777', producer_id: 'u1', event_id: 'ev1', assigned_to: null, title: 'Contratar som', description: null, due_date: null,
    status: 'todo', priority: 'medium', created_at: '2026-10-01T00:00:00Z', board_id: BOARD, column_id: C1, recur_days: null, recur_next: null, ck_move: false,
  }
  const banco = (revisao: string | null, podeEditar = true) => {
    m.estado.resposta = t => (t === 'task_boards' ? { data: { producer_id: podeEditar ? 'u1' : 'outro', review_column_id: revisao } } : t === 'task_buttons' ? { data: LINHAS } : { data: [] })
    m.estado.rpc = n => (n === 'equipe_pode' ? { data: false } : { data: { afetados: 1, ignorados: 0, motivos: [] } })
  }

  it('só mostra botões de cartão; clicar roda com o cartão e mostra o resultado', async () => {
    banco(C2)
    montar(<CartaoPlanejamento tarefa={tarefa} boardId={BOARD} colunas={colunas} temChecklist gravar={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Limpar o Feito' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar para revisão' }))
    expect(await screen.findByText('1 afetado, 0 ignorados')).toBeTruthy()
    expect(m.rpcs.find(r => r.nome === 'quadro_rodar_botao')?.args).toEqual({ p_button: BTN2, p_task: tarefa.id })
  })

  it('Repetir grava recur_days; desligar grava nulo; "Gerar cópia agora" só aparece ligado e mostra a próxima data', async () => {
    banco(C2)
    const gravar = vi.fn()
    const a = montar(<CartaoPlanejamento tarefa={tarefa} boardId={BOARD} colunas={colunas} temChecklist={false} gravar={gravar} />)
    const sel = await screen.findByLabelText('Repetir')
    await waitFor(() => expect((sel as HTMLSelectElement).disabled).toBe(false))
    expect(screen.queryByRole('button', { name: 'Gerar cópia agora' })).toBeNull()
    fireEvent.change(sel, { target: { value: '7' } })
    expect(gravar).toHaveBeenCalledWith({ recur_days: 7 })
    a.unmount()

    montar(<CartaoPlanejamento tarefa={{ ...tarefa, recur_days: 7, recur_next: '2026-10-16' }} boardId={BOARD} colunas={colunas} temChecklist={false} gravar={gravar} />)
    expect(await screen.findByText(/Próxima cópia em 16\/10\/2026/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Repetir'), { target: { value: '0' } })
    expect(gravar).toHaveBeenLastCalledWith({ recur_days: null })
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar cópia agora' }))
    expect(m.rpcs.some(r => r.nome === 'quadro_gerar_recorrente')).toBe(false) // pede confirmação antes
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Gerar cópia' }))
    await waitFor(() => expect(m.rpcs.some(r => r.nome === 'quadro_gerar_recorrente' && r.args.p_task === tarefa.id)).toBe(true))
  })

  it('o interruptor de mover aparece só com checklist e coluna de revisão; senão explica como definir', async () => {
    banco(C2)
    const gravar = vi.fn()
    const a = montar(<CartaoPlanejamento tarefa={tarefa} boardId={BOARD} colunas={colunas} temChecklist gravar={gravar} />)
    const sw = await screen.findByRole('switch')
    fireEvent.click(sw)
    expect(gravar).toHaveBeenCalledWith({ ck_move: true })
    expect(screen.getByText(/só muda de coluna quando você MARCA/)).toBeTruthy()
    expect(screen.getByText(/Feito/, { selector: 'b' })).toBeTruthy()
    a.unmount()

    montar(<CartaoPlanejamento tarefa={tarefa} boardId={BOARD} colunas={colunas} temChecklist={false} gravar={gravar} />)
    await screen.findByLabelText('Repetir')
    expect(screen.queryByRole('switch')).toBeNull()
    cleanup()

    banco(null)
    montar(<CartaoPlanejamento tarefa={tarefa} boardId={BOARD} colunas={colunas} temChecklist gravar={gravar} />)
    expect(await screen.findByText(/escolhe a “Coluna de revisão”/)).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('quem só vê: sem rodar botão, sem gerar cópia, controles travados', async () => {
    banco(C2, false)
    montar(<CartaoPlanejamento tarefa={{ ...tarefa, recur_days: 7, recur_next: '2026-10-16' }} boardId={BOARD} colunas={colunas} temChecklist gravar={vi.fn()} />)
    expect(await screen.findByText('Enviar para revisão')).toBeTruthy()
    await waitFor(() => expect(m.rpcs.some(r => r.nome === 'equipe_pode')).toBe(true))
    expect(screen.queryByRole('button', { name: 'Enviar para revisão' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Gerar cópia agora' })).toBeNull()
    expect((screen.getByLabelText('Repetir') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true)
  })

  it('modo antigo (sem tabelas nem colunas): a seção some inteira', async () => {
    m.estado.resposta = () => SEM_TABELA
    const antiga: DbTask = { ...tarefa }
    delete antiga.recur_days; delete antiga.recur_next; delete antiga.ck_move
    const { container } = montar(<CartaoPlanejamento tarefa={antiga} boardId={BOARD} colunas={colunas} temChecklist gravar={vi.fn()} />)
    await waitFor(() => expect(m.chamadas.length).toBeGreaterThan(0))
    expect(container.innerHTML).toBe('')
  })
})

describe('coluna de revisão (menu do quadro)', () => {
  it('o dono escolhe entre as colunas reais e grava review_column_id; quem não é dono não vê', async () => {
    m.estado.resposta = (t, op) => (t === 'task_boards' && op === 'select' ? { data: { producer_id: 'u1', review_column_id: null } } : { data: [{ id: BOARD }] })
    const a = montar(<ColunaRevisao boardId={BOARD} colunas={colunas} />)
    fireEvent.change(await screen.findByLabelText('Coluna de revisão'), { target: { value: C2 } })
    await waitFor(() => expect(feitas('task_boards', 'update')).toHaveLength(1))
    expect(feitas('task_boards', 'update')[0].args[0]).toEqual({ review_column_id: C2 })
    a.unmount()
    m.estado.resposta = () => ({ data: { producer_id: 'outro', review_column_id: null } })
    m.estado.rpc = () => ({ data: true })
    const { container } = montar(<ColunaRevisao boardId={BOARD} colunas={colunas} />)
    await waitFor(() => expect(m.rpcs.some(r => r.nome === 'equipe_pode')).toBe(true))
    expect(container.innerHTML).toBe('')
  })
})

describe('menu do quadro no modo antigo', () => {
  it('sem o SQL da 2C as entradas Botões, Modelos e Papéis nem aparecem', async () => {
    m.estado.resposta = () => SEM_TABELA
    montar(<MenuQuadro pagina={null} onPagina={vi.fn()} avisosDisponivel={false} config={{ disponivel: false, ligado: false, dono: false }} alterarRecibos={vi.fn()}
      boardId={BOARD} colunas={colunas} temEvento tarefas={[]} concluida={() => false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Menu do quadro' }))
    expect(await screen.findByRole('button', { name: /Roteiro com locais/ })).toBeTruthy()
    await waitFor(() => expect(m.chamadas.length).toBeGreaterThan(0))
    expect(screen.queryByRole('button', { name: /^Botões$|Modelos por tipo|^Papéis$/ })).toBeNull()
  })
})
