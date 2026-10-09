import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CartaoVerso from '../components/producer/quadro/CartaoVerso'
import Quadro from '../components/producer/quadro/Quadro'
import { mencoesDe, destinoVinculo, ROTAS_VINCULO } from '../components/producer/quadro/cartaoLib'
import { RESUMO_VAZIO, type ResumoCartao } from '../hooks/useCartao'
import type { ColunaQuadro, DbTask } from '../hooks/useProducerTools'

// Banco simulado (mesmo molde de useCartao.test.tsx): cada from(tabela) devolve um construtor encadeável que registra a chamada
const m = vi.hoisted(() => {
  const chamadas: { tabela: string; op: string; args: unknown[]; eqs: unknown[][] }[] = []
  const estado = { resposta: ((): { data?: unknown; error?: unknown } => ({ data: [], error: null })) as (t: string, op: string, args: unknown[]) => { data?: unknown; error?: unknown } }
  const from = (tabela: string) => {
    let op = 'select'
    let args: unknown[] = []
    const eqs: unknown[][] = []
    const b: Record<string, unknown> = new Proxy({}, {
      get: (_, k: string) => {
        if (k === 'then') return (res: (v: unknown) => void) => { chamadas.push({ tabela, op, args, eqs }); res({ data: null, error: null, ...estado.resposta(tabela, op, args) }) }
        return (...a: unknown[]) => { if (['insert', 'update', 'delete'].includes(k)) { op = k; args = a }; if (k === 'eq') eqs.push(a); return b }
      },
    })
    return b
  }
  return { chamadas, estado, from, toast: { error: vi.fn(), success: vi.fn() } }
})
vi.mock('../lib/supabase', () => ({
  supabase: { from: m.from, rpc: () => Promise.resolve({ data: [], error: null }), storage: { from: () => ({ upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() }) } },
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Ricardo', email: 'r@x.com' } }) }))
vi.mock('sonner', () => ({ toast: m.toast }))

const colunas: ColunaQuadro[] = [{ id: 'c1', name: 'A fazer', kind: 'todo' }, { id: 'c2', name: 'Feito', kind: 'done' }]
const tarefa: DbTask = {
  id: 't1', producer_id: 'u1', event_id: 'ev1', assigned_to: null, title: 'Contratar som', description: null, due_date: null, status: 'todo', priority: 'medium',
  created_at: '2026-10-01T00:00:00Z', board_id: 'b1', column_id: 'c1', position: 1000,
}
const pessoas = [{ id: 'u1', nome: 'Ricardo' }, { id: 'u2', nome: 'Ana Souza' }, { id: 'u3', nome: 'Caio Lima' }]
const etiqueta = { id: 'e1', board_id: 'b1', name: 'Urgente', color: '#c8322b' }
const feitas = (tabela: string, op: string) => m.chamadas.filter(c => c.tabela === tabela && c.op === op)

function Harness({ resumo, gente = pessoas }: { resumo?: ResumoCartao; gente?: typeof pessoas }) {
  const [id, setId] = useState<string | null>(null)
  return (
    <>
      <div id="quadro-tarefas" tabIndex={-1}>quadro</div>
      <button onClick={() => setId('t1')}>Abrir cartão</button>
      <CartaoVerso tarefaId={id} tarefas={[tarefa]} boardId="b1" colunas={colunas} pessoas={gente} resumo={resumo} onFechar={() => setId(null)} onMover={vi.fn()} />
    </>
  )
}
function montar(resumo?: ResumoCartao, gente?: typeof pessoas) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  qc.setQueryData(['producer-tasks', 'u1'], [{ ...tarefa, updated_at: 'v0' }])
  render(<QueryClientProvider client={qc}><MemoryRouter><Harness resumo={resumo} gente={gente} /></MemoryRouter></QueryClientProvider>)
  const botao = screen.getByRole('button', { name: 'Abrir cartão' })
  botao.focus()
  fireEvent.click(botao)
  return Object.assign(botao, { qc })
}
const checklist = { id: 'k1', task_id: 't1', title: 'Checklist', position: 1000, itens: [{ id: 'i1', checklist_id: 'k1', text: 'Pedir orçamento', done: true, position: 1000, done_at: null, done_by: null }, { id: 'i2', checklist_id: 'k1', text: 'Assinar', done: false, position: 2000, done_at: null, done_by: null }] }

beforeEach(() => {
  m.chamadas.length = 0
  m.toast.error.mockReset()
  m.estado.resposta = t => ({ data: t === 'task_labels' ? [etiqueta] : t === 'task_checklists' ? [checklist] : [], error: null })
})
afterEach(cleanup)

describe('verso do cartão', () => {
  it('abre como diálogo, Esc fecha e o foco volta ao botão de origem', async () => {
    const origem = montar()
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByRole('textbox', { name: 'Título do cartão' })).toHaveValue('Contratar som')
    fireEvent.keyDown(dialogo, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(origem))
  })

  it('mostra o progresso do checklist e adiciona um item', async () => {
    montar()
    expect(await screen.findByText('Pedir orçamento')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Progresso de Checklist: 1 de 2' })).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Novo item em Checklist' }), { target: { value: 'Anexar comprovante' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item em Checklist' }))
    await waitFor(() => expect(feitas('task_checklist_items', 'insert')).toHaveLength(1))
    expect(feitas('task_checklist_items', 'insert')[0].args[0]).toMatchObject({ checklist_id: 'k1', text: 'Anexar comprovante', done: false })
  })

  it('alterna uma etiqueta pela lista da barra lateral', async () => {
    montar()
    await screen.findByText('Pedir orçamento')
    fireEvent.click(screen.getByRole('button', { name: 'Etiquetas' }))
    const caixa = await screen.findByRole('checkbox', { name: 'Urgente' })
    fireEvent.click(caixa)
    await waitFor(() => expect(feitas('task_card_labels', 'insert')).toHaveLength(1))
    expect(feitas('task_card_labels', 'insert')[0].args[0]).toEqual({ task_id: 't1', label_id: 'e1' })
  })

  it('comentário com @nome grava o id da pessoa na lista de menções', async () => {
    montar()
    await screen.findByText('Pedir orçamento')
    fireEvent.change(screen.getByLabelText('Escreva uma mensagem'), { target: { value: 'Oi @Ana confere isso' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(feitas('task_comments', 'insert')).toHaveLength(1))
    expect(feitas('task_comments', 'insert')[0].args[0]).toMatchObject({ task_id: 't1', user_id: 'u1', body: 'Oi @Ana confere isso', mentions: ['u2'] })
  })

  it('mostra "Bloqueado" quando a dependência está em aberto', async () => {
    m.estado.resposta = t => ({ data: t === 'task_dependencies' ? [{ task_id: 't1', depends_on: 't0', pai: { title: 'Fechar contrato', archived_at: null, task_columns: { kind: 'doing' } } }] : [], error: null })
    montar()
    expect(await screen.findByText(/Bloqueado: aguarda Fechar contrato/)).toBeTruthy()
  })

  it('erro de leitura do banco aparece na tela com "Tentar de novo"', async () => {
    m.estado.resposta = t => (t === 'task_checklists' ? { error: { code: 'XX000', message: 'falha do banco' } } : { data: [] })
    montar()
    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain('Não foi possível carregar o cartão')
    expect(within(aviso).getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })

  it('erro do banco ao gravar vira aviso (toast) com a mensagem', async () => {
    m.estado.resposta = (t, op) => (t === 'task_comments' && op === 'insert' ? { error: { code: '42501', message: 'x' } } : { data: t === 'task_checklists' ? [checklist] : [] })
    montar()
    await screen.findByText('Pedir orçamento')
    fireEvent.change(screen.getByLabelText('Escreva uma mensagem'), { target: { value: 'oi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(m.toast.error).toHaveBeenCalledWith('Sem permissão'))
  })

  it('vínculos: toda rota da lista é uma página real e o evento exige evento', () => {
    expect(Object.keys(ROTAS_VINCULO)).toHaveLength(15)
    expect(destinoVinculo('cupom', 'ev1')).toBe('/producer/cupons?eventId=ev1')
    expect(destinoVinculo('evento', 'ev1')).toBe('/producer/event/ev1')
    expect(destinoVinculo('evento', null)).toBeNull()
  })

  it('mencoesDe: primeiro nome ou nome completo, sem confundir prefixos', () => {
    expect(mencoesDe('@ana veja', pessoas)).toEqual(['u2'])
    expect(mencoesDe('oi @Ana Souza!', pessoas)).toEqual(['u2'])
    expect(mencoesDe('a@ana.com e @Anabela', pessoas)).toEqual([])
  })
})

describe('correções da rodada de revisão', () => {
  const comAB: ResumoCartao = { ...RESUMO_VAZIO, membros: ['u1', 'u2'] }

  it('marcar C com A e B no cartão grava só C: nenhum delete', async () => {
    montar(comAB)
    await screen.findByText('Pedir orçamento')
    fireEvent.click(screen.getByRole('button', { name: 'Membros' }))
    expect(await screen.findByRole('checkbox', { name: 'Ricardo' })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Caio Lima' }))
    await waitFor(() => expect(feitas('task_card_members', 'insert')).toHaveLength(1))
    expect(feitas('task_card_members', 'insert')[0].args[0]).toEqual({ task_id: 't1', user_id: 'u3' })
    expect(feitas('task_card_members', 'delete')).toHaveLength(0)
  })

  it('enquanto o resumo não chegou, o seletor de membros fica desabilitado e nada é gravado', async () => {
    montar(undefined)
    await screen.findByText('Pedir orçamento')
    fireEvent.click(screen.getByRole('button', { name: 'Membros' }))
    const caixa = await screen.findByRole('checkbox', { name: 'Caio Lima' })
    expect(caixa).toBeDisabled()
    fireEvent.click(caixa)
    expect(feitas('task_card_members', 'insert')).toHaveLength(0)
  })

  it('pessoa que a equipe não devolveu aparece como "Sem nome", sem fingir quem é', async () => {
    montar({ ...RESUMO_VAZIO, membros: ['u9'] })
    await screen.findByText('Pedir orçamento')
    expect(screen.getAllByRole('img', { name: 'Sem nome' }).length).toBeGreaterThan(0)
  })

  it('editar o título e salvar a descrição em seguida não dá conflito: o segundo usa o updated_at do primeiro', async () => {
    let n = 0
    m.estado.resposta = (t, op) => (t === 'producer_tasks' && op === 'update' ? { data: [{ updated_at: `v${++n}` }] } : { data: t === 'task_checklists' ? [checklist] : [] })
    const origem = montar()
    await screen.findByText('Pedir orçamento')
    const titulo = screen.getByRole('textbox', { name: 'Título do cartão' })
    fireEvent.change(titulo, { target: { value: 'Contratar som e luz' } })
    fireEvent.blur(titulo)
    fireEvent.change(screen.getByRole('textbox', { name: 'Descrição do cartão' }), { target: { value: 'Três orçamentos' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar descrição' }))
    await waitFor(() => expect(feitas('producer_tasks', 'update')).toHaveLength(2))
    const [um, dois] = feitas('producer_tasks', 'update')
    expect(um.args[0]).toEqual({ title: 'Contratar som e luz' })
    expect(um.eqs).toContainEqual(['updated_at', 'v0'])
    expect(dois.eqs).toContainEqual(['updated_at', 'v1'])
    expect(m.toast.error).not.toHaveBeenCalled()
    expect((origem as unknown as { qc: QueryClient }).qc.getQueryData<{ updated_at: string }[]>(['producer-tasks', 'u1'])?.[0].updated_at).toBe('v2')
  })

  it('erro do banco com nome de constraint nunca aparece na tela', async () => {
    m.estado.resposta = (t, op) => (t === 'task_comments' && op === 'insert' ? { error: { code: '23514', message: 'new row violates check constraint "task_comments_body_ck"' } } : { data: t === 'task_checklists' ? [checklist] : [] })
    montar()
    await screen.findByText('Pedir orçamento')
    fireEvent.change(screen.getByLabelText('Escreva uma mensagem'), { target: { value: 'oi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(m.toast.error).toHaveBeenCalledWith('Valor não permitido'))
    expect(JSON.stringify(m.toast.error.mock.calls)).not.toMatch(/constraint|_ck/)
  })

  it('erro de leitura não mostra o texto do banco', async () => {
    m.estado.resposta = t => (t === 'task_checklists' ? { error: { code: 'XX000', message: 'relation "task_checklists" violates constraint foo_fk' } } : { data: [] })
    montar()
    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).not.toMatch(/constraint|foo_fk|relation/)
  })

  it('mais de 20 menções: avisa em português e não envia', async () => {
    const gente = Array.from({ length: 21 }, (_, i) => ({ id: `p${i}`, nome: `Nome${String.fromCharCode(65 + i)}` }))
    montar(undefined, gente)
    await screen.findByText('Pedir orçamento')
    fireEvent.change(screen.getByLabelText('Escreva uma mensagem'), { target: { value: gente.map(g => `@${g.nome}`).join(' ') } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(m.toast.error).toHaveBeenCalledWith('Marque no máximo 20 pessoas por mensagem.')
    expect(feitas('task_comments', 'insert')).toHaveLength(0)
  })

  it('arquivar pelo verso devolve o foco ao quadro, não ao body', async () => {
    m.estado.resposta = (t, op) => (t === 'producer_tasks' && op === 'update' ? { data: [{ updated_at: 'v1' }] } : { data: t === 'task_checklists' ? [checklist] : [] })
    montar()
    await screen.findByText('Pedir orçamento')
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('quadro-tarefas')))
  })
})

describe('cartão do quadro', () => {
  const tarefas = [tarefa]
  const quadro = (extra: Partial<React.ComponentProps<typeof Quadro>> = {}) =>
    render(<Quadro tarefas={tarefas} colunas={colunas} colunaDe={t => t.column_id ?? ''} ordenavel onMover={vi.fn()} {...extra} />)

  it('modo antigo (sem resumo): nada de etiquetas, contadores nem bloqueio', () => {
    quadro()
    expect(screen.queryByText('bloqueado')).toBeNull()
    expect(screen.queryByLabelText('Etiquetas')).toBeNull()
  })

  it('modo novo: etiquetas, bloqueado, contadores e membros; Enter e clique abrem o verso', () => {
    const onAbrir = vi.fn()
    const resumo = new Map([['t1', { ...RESUMO_VAZIO, etiquetas: [etiqueta], membros: ['u2'], anexos: 2, comentarios: 1, bloqueado: true }]])
    quadro({ resumo, onAbrir, nomePessoa: id => pessoas.find(p => p.id === id)!.nome })
    const li = screen.getByRole('listitem', { name: /Contratar som/ })
    expect(within(li).getByText('bloqueado')).toBeTruthy()
    expect(within(li).getByText('2 anexos')).toBeTruthy()
    expect(within(li).getByText('1 mensagem')).toBeTruthy()
    expect(within(li).getByRole('img', { name: 'Ana Souza' })).toBeTruthy()
    expect(within(li).getByText('Urgente')).toBeTruthy()
    fireEvent.keyDown(li, { key: 'Enter' })
    fireEvent.click(li)
    fireEvent.click(within(li).getByRole('button', { name: /Mover/ }))
    expect(onAbrir).toHaveBeenCalledTimes(2) // Enter e clique no cartão; o clique no botão Mover não abre
  })

  it('sem a lista de nomes (modo antigo) o avatar também nunca é "?"', () => {
    quadro({ tarefas: [{ ...tarefa, assigned_to: 'u9' }] })
    expect(screen.queryByText('?')).toBeNull()
    expect(screen.getByTitle('Sem nome').textContent).toBe('S')
  })

  it('responsável sem nome: avatar "S" de "Sem nome", nunca "?"', () => {
    quadro({ tarefas: [{ ...tarefa, assigned_to: 'u9' }], nomeDe: () => undefined })
    expect(screen.queryByText('?')).toBeNull()
    expect(screen.getByTitle('Sem nome').textContent).toBe('S')
  })
})
