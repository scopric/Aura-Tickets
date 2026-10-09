import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { MENSAGENS_DO_SQL, falharAcao, useBotoes, useConfigAcoes, useGerarRecorrente, useModelos, usePapeis, usePessoasSugeridas } from '../hooks/useQuadroAcoes'
import { mensagemSegura } from '../hooks/useCartao'
import { SEMENTES_MODELOS } from './quadroSementes'

// Banco simulado: from(tabela) registra a operação (e qualquer upsert) e resolve pela função `resposta`; rpc(nome, args) idem
const m = vi.hoisted(() => {
  type R = { data?: unknown; error?: unknown }
  const chamadas: { tabela: string; op: string; args: unknown[]; eqs: unknown[][] }[] = []
  const rpcs: { nome: string; args: Record<string, unknown> }[] = []
  const estado = { resposta: ((): R => ({ data: [], error: null })) as (t: string, op: string, args: unknown[]) => R, rpc: ((): R => ({ data: null, error: null })) as (n: string, a: Record<string, unknown>) => R }
  const from = (tabela: string) => {
    let op = 'select'
    let args: unknown[] = []
    const eqs: unknown[][] = []
    const b: Record<string, unknown> = new Proxy({}, {
      get: (_, k: string) => {
        if (k === 'then') return (res: (v: unknown) => void) => { chamadas.push({ tabela, op, args, eqs }); res({ data: null, error: null, ...estado.resposta(tabela, op, args) }) }
        return (...a: unknown[]) => { if (['insert', 'update', 'delete', 'upsert'].includes(k)) { op = k; args = a }; if (k === 'eq') eqs.push(a); return b }
      },
    })
    return b
  }
  const rpc = (nome: string, args: Record<string, unknown>) => { rpcs.push({ nome, args }); return Promise.resolve({ data: null, error: null, ...estado.rpc(nome, args) }) }
  return { chamadas, rpcs, estado, from, rpc }
})
vi.mock('../lib/supabase', () => ({ supabase: { from: m.from, rpc: m.rpc } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

const novoClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
const wrapper = (qc: QueryClient) => ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
const rejeita = async (fn: () => Promise<unknown>) => { let erro: Error | undefined; await act(async () => { try { await fn() } catch (e) { erro = e as Error } }); return erro }
const feitas = (tabela: string, op: string) => m.chamadas.filter(c => c.tabela === tabela && c.op === op)
const SEM_TABELA = { error: { code: 'PGRST205', message: 'Could not find the table' } }
const BOARD = '11111111-1111-4111-8111-111111111111'
const COL = '22222222-2222-4222-8222-222222222222'
const BTN = '44444444-4444-4444-8444-444444444444'
const TASK = '55555555-5555-4555-8555-555555555555'
const PESSOA = '66666666-6666-4666-8666-666666666666'

beforeEach(() => {
  m.chamadas.length = 0
  m.rpcs.length = 0
  m.estado.resposta = () => ({ data: [], error: null })
  m.estado.rpc = () => ({ data: null, error: null })
})

describe('modo antigo (banco sem o SQL da 2C)', () => {
  it('botões, papéis, modelos e configuração ficam indisponíveis, sem erro', async () => {
    m.estado.resposta = t => (t === 'task_boards' ? { error: { code: '42703', message: 'column review_column_id does not exist' } } : SEM_TABELA)
    const qc = novoClient()
    const botoes = renderHook(() => useBotoes(BOARD), { wrapper: wrapper(qc) })
    const papeis = renderHook(() => usePapeis(BOARD), { wrapper: wrapper(qc) })
    const modelos = renderHook(() => useModelos(BOARD), { wrapper: wrapper(qc) })
    const cfg = renderHook(() => useConfigAcoes(BOARD), { wrapper: wrapper(qc) })
    await waitFor(() => expect(botoes.result.current.carregando || papeis.result.current.carregando || modelos.result.current.carregando || cfg.result.current.carregando).toBe(false))
    expect(botoes.result.current).toMatchObject({ disponivel: false, erro: false, botoes: [] })
    expect(papeis.result.current).toMatchObject({ disponivel: false, erro: false })
    expect(modelos.result.current).toMatchObject({ disponivel: false, erro: false, modelos: [] })
    expect(cfg.result.current.config).toMatchObject({ disponivel: false, podeEditar: false })
  })
})

describe('configuração: quem edita', () => {
  it('o dono edita sem perguntar ao banco; membro só edita se equipe_pode disser true; na dúvida só vê', async () => {
    m.estado.resposta = () => ({ data: { producer_id: 'u1', review_column_id: COL } })
    const dono = renderHook(() => useConfigAcoes(BOARD), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(dono.result.current.config.disponivel).toBe(true))
    expect(dono.result.current.config).toMatchObject({ dono: true, podeEditar: true, revisaoId: COL })
    expect(m.rpcs).toHaveLength(0)

    m.estado.resposta = () => ({ data: { producer_id: 'outro', review_column_id: null } })
    m.estado.rpc = () => ({ data: false })
    const membro = renderHook(() => useConfigAcoes(BOARD), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(membro.result.current.config.disponivel).toBe(true))
    expect(membro.result.current.config).toMatchObject({ dono: false, podeEditar: false })
    expect(m.rpcs[0]).toEqual({ nome: 'equipe_pode', args: { p_produtor: 'outro', p_ferramenta: 'quadro', p_nivel: 'editar' } })
  })
})

describe('botões', () => {
  const passos = [{ t: 'mover' as const, v: COL }, { t: 'atribuir' as const, v: 'revisao' }, { t: 'prazo' as const, v: 2 }, { t: 'arquivar' as const }]
  async function montar() {
    const r = renderHook(() => useBotoes(BOARD), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(r.result.current.carregando).toBe(false))
    return r
  }

  it('cria com passos válidos: grava nome, escopo, coluna nula (cartão) e só os campos do passo', async () => {
    const { result } = await montar()
    await act(async () => { await result.current.criar.mutateAsync({ name: '  Enviar para revisão ', scope: 'card', columnId: COL, steps: passos }) })
    const ins = feitas('task_buttons', 'insert')[0].args[0] as Record<string, unknown>
    expect(ins).toMatchObject({ board_id: BOARD, name: 'Enviar para revisão', scope: 'card', column_id: null })
    expect(Object.keys(ins).sort()).toEqual(['board_id', 'column_id', 'name', 'position', 'scope', 'steps']) // o grant de insert não cobre created_by
    expect(ins.steps).toEqual([{ t: 'mover', v: COL }, { t: 'atribuir', v: 'revisao' }, { t: 'prazo', v: 2 }, { t: 'arquivar' }])
  })

  it('recusa sem passos, com passo incompleto, com mais de 6 passos e botão de quadro sem coluna', async () => {
    const { result } = await montar()
    const base = { name: 'X', scope: 'card' as const, columnId: null }
    expect((await rejeita(() => result.current.criar.mutateAsync({ ...base, steps: [] })))?.message).toBe('Escolha pelo menos um passo')
    expect((await rejeita(() => result.current.criar.mutateAsync({ ...base, steps: [{ t: 'mover', v: 'nao-e-uuid' }] })))?.message).toBe('Há um passo incompleto')
    expect((await rejeita(() => result.current.criar.mutateAsync({ ...base, steps: [{ t: 'prazo', v: 31 }] })))?.message).toBe('Há um passo incompleto')
    expect((await rejeita(() => result.current.criar.mutateAsync({ ...base, steps: [{ t: 'atribuir', v: 'chefe' }] })))?.message).toBe('Há um passo incompleto')
    expect((await rejeita(() => result.current.criar.mutateAsync({ ...base, steps: Array(7).fill({ t: 'arquivar' }) })))?.message).toBe('No máximo 6 passos')
    expect((await rejeita(() => result.current.criar.mutateAsync({ ...base, scope: 'board', steps: [{ t: 'arquivar' }] })))?.message).toBe('Escolha a coluna em que o botão age')
    expect((await rejeita(() => result.current.criar.mutateAsync({ ...base, name: '   ', steps: [{ t: 'arquivar' }] })))?.message).toBe('Nome do botão: escreva alguma coisa')
    expect(feitas('task_buttons', 'insert')).toHaveLength(0)
  })

  it('botão de quadro grava a coluna alvo', async () => {
    const { result } = await montar()
    await act(async () => { await result.current.criar.mutateAsync({ name: 'Limpar Feito', scope: 'board', columnId: COL, steps: [{ t: 'arquivar' }] }) })
    expect(feitas('task_buttons', 'insert')[0].args[0]).toMatchObject({ scope: 'board', column_id: COL })
  })

  it('rodar devolve afetados, ignorados e motivos e chama a função com o botão e o cartão', async () => {
    m.estado.rpc = () => ({ data: { afetados: 3, ignorados: 2, motivos: ['Papel “Revisão” sem pessoa definida.', 7, 'duplicate key value violates unique constraint "x"', 'Sem mudança.'] } })
    const { result } = await montar()
    let r: unknown
    await act(async () => { r = await result.current.rodar.mutateAsync({ button: BTN, task: TASK }) })
    expect(r).toEqual({ afetados: 3, ignorados: 2, motivos: ['Papel “Revisão” sem pessoa definida.', 'Não foi possível neste cartão.', 'Sem mudança.'] })
    expect(m.rpcs[0]).toEqual({ nome: 'quadro_rodar_botao', args: { p_button: BTN, p_task: TASK } })
    await act(async () => { await result.current.rodar.mutateAsync({ button: BTN }) })
    expect(m.rpcs[1].args).toEqual({ p_button: BTN, p_task: null })
  })

  it('apagar usa o id; editar com 0 linhas vira "Sem permissão"', async () => {
    const { result } = await montar()
    await act(async () => { await result.current.apagar.mutateAsync(BTN) })
    expect(feitas('task_buttons', 'delete')[0].eqs).toContainEqual(['id', BTN])
    const erro = await rejeita(() => result.current.editar.mutateAsync({ id: BTN, name: 'X', scope: 'card', columnId: null, steps: [{ t: 'arquivar' }] }))
    expect(erro?.message).toBe('Sem permissão')
  })
})

describe('modelos', () => {
  it('lê os itens reais dos 4 modelos da semente e aplica enviando apenas os índices marcados', async () => {
    m.estado.resposta = () => ({ data: SEMENTES_MODELOS })
    m.estado.rpc = () => ({ data: { criados: 2, existentes: 1 } })
    const { result } = renderHook(() => useModelos(BOARD), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(result.current.disponivel).toBe(true))
    expect(result.current.modelos.map(x => [x.key, x.items.length])).toEqual([['show', 9], ['festa', 6], ['curso', 6], ['congresso', 8]])
    expect(result.current.modelos[0].items[0]).toEqual({ titulo: 'Contratar som, luz e palco', papel: 'fornecedores', dias: 45 })
    let r: unknown
    await act(async () => { r = await result.current.aplicar.mutateAsync({ kind: 'show', itens: [0, 2, 5] }) })
    expect(r).toEqual({ criados: 2, existentes: 1 })
    expect(m.rpcs[0]).toEqual({ nome: 'quadro_aplicar_modelo', args: { p_board: BOARD, p_kind: 'show', p_itens: [0, 2, 5] } })
    expect((await rejeita(() => result.current.aplicar.mutateAsync({ kind: 'show', itens: [] })))?.message).toBe('Marque pelo menos um item')
    expect(m.rpcs).toHaveLength(1)
  })
})

describe('papéis', () => {
  async function montar() {
    m.estado.resposta = t => (t === 'task_roles' ? { data: [{ papel: 'portaria', user_id: PESSOA }, { papel: 'invasor', user_id: PESSOA }] } : { data: [] })
    const r = renderHook(() => usePapeis(BOARD), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(r.result.current.disponivel).toBe(true))
    return r
  }
  it('lê só papéis da lista fechada', async () => {
    const { result } = await montar()
    expect(result.current.mapa).toEqual({ portaria: PESSOA })
  })
  it('update filtrado por quadro e papel; com 0 linhas faz insert; nunca upsert', async () => {
    const { result } = await montar()
    m.chamadas.length = 0
    m.estado.resposta = (t, op) => (op === 'update' ? { data: [] } : { data: [] })
    await act(async () => { await result.current.definir.mutateAsync({ papel: 'juridico', userId: PESSOA }) })
    const up = feitas('task_roles', 'update')[0]
    expect(up.args[0]).toEqual({ user_id: PESSOA })
    expect(up.eqs).toEqual([['board_id', BOARD], ['papel', 'juridico']])
    expect(feitas('task_roles', 'insert')[0].args[0]).toEqual({ board_id: BOARD, papel: 'juridico', user_id: PESSOA })
    expect(feitas('task_roles', 'upsert')).toHaveLength(0)
  })
  it('com update que acha a linha não faz insert; 23505 no insert tenta o update de novo', async () => {
    const { result } = await montar()
    m.chamadas.length = 0
    m.estado.resposta = (t, op) => (op === 'update' ? { data: [{ papel: 'portaria' }] } : { data: [] })
    await act(async () => { await result.current.definir.mutateAsync({ papel: 'portaria', userId: PESSOA }) })
    expect(feitas('task_roles', 'insert')).toHaveLength(0)

    m.chamadas.length = 0
    let ups = 0
    m.estado.resposta = (t, op) => (op === 'update' ? { data: ++ups === 1 ? [] : [{ papel: 'financeiro' }] } : { error: { code: '23505', message: 'duplicate key' } })
    await act(async () => { await result.current.definir.mutateAsync({ papel: 'financeiro', userId: PESSOA }) })
    expect(feitas('task_roles', 'update')).toHaveLength(2)
    expect(feitas('task_roles', 'insert')).toHaveLength(1)
  })
  it('limpar apaga a linha do papel; papel ou pessoa fora do formato é recusado', async () => {
    const { result } = await montar()
    m.chamadas.length = 0
    await act(async () => { await result.current.definir.mutateAsync({ papel: 'revisao', userId: null }) })
    expect(feitas('task_roles', 'delete')[0].eqs).toEqual([['board_id', BOARD], ['papel', 'revisao']])
    const erro = await rejeita(() => result.current.definir.mutateAsync({ papel: 'revisao', userId: 'joao@x.com' }))
    expect(erro?.message).toBe('Papel ou pessoa inválidos')
  })
  it('pessoas sugeridas: só id e nome (e-mail descartado), nome vazio vira "Sem nome"', async () => {
    m.estado.rpc = () => ({ data: [{ id: PESSOA, nome: ' Ana ', email: 'ana@x.com' }, { id: 'x', nome: 'Fora' }, { id: BOARD, nome: '' }] })
    const { result } = renderHook(() => usePessoasSugeridas(BOARD), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: PESSOA, nome: 'Ana' }, { id: BOARD, nome: 'Sem nome' }])
    expect(JSON.stringify(result.current.data)).not.toContain('@')
  })
})

describe('recorrência', () => {
  it('gerar cópia chama a função com o cartão; id inválido não chama', async () => {
    m.estado.rpc = () => ({ data: PESSOA })
    const { result } = renderHook(() => useGerarRecorrente(), { wrapper: wrapper(novoClient()) })
    await act(async () => { await result.current.mutateAsync(TASK) })
    expect(m.rpcs[0]).toEqual({ nome: 'quadro_gerar_recorrente', args: { p_task: TASK } })
    await rejeita(() => result.current.mutateAsync('t1'))
    expect(m.rpcs).toHaveLength(1)
  })
})

describe('erros nunca crus', () => {
  const erro = (code: string, message: string) => { try { falharAcao({ code, message }) } catch (e) { return mensagemSegura(e) } }
  it('cada mensagem da lista fechada passa; o resto vira frase genérica', () => {
    for (const msg of [...MENSAGENS_DO_SQL, 'Papel “Portaria” sem pessoa definida.', 'Papel “Jurídico”: a pessoa saiu da equipe.', 'Limite de 30 anexos por cartão.']) expect(erro('22023', msg)).toBe(msg)
    expect(erro('P0001', 'Máximo de 50 botões por quadro.')).toBe('Não foi possível salvar. Tente de novo.') // fora da lista
    expect(erro('P0001', 'function quadro_rodar_botao(uuid) does not exist')).toBe('Não foi possível salvar. Tente de novo.')
    expect(erro('23514', 'new row for relation "task_buttons" violates check constraint "x"')).toBe('Valor não permitido')
    expect(erro('XX000', 'O quadro não tem coluna.')).toBe('Não foi possível salvar. Tente de novo.') // código fora de P0001/22023/23514
    expect(erro('42501', 'permission denied for table task_roles')).toBe('Sem permissão')
  })
})

describe('botões: nome, edição e leitura', () => {
  it('nome de até 40 caracteres, sem < >, controle nem direção de texto', async () => {
    const { result } = renderHook(() => useBotoes(BOARD), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(result.current.carregando).toBe(false))
    const tenta = (name: string) => rejeita(() => result.current.criar.mutateAsync({ name, scope: 'card', columnId: null, steps: [{ t: 'arquivar' }] }))
    expect((await tenta('a'.repeat(41)))?.message).toBe('Nome do botão: no máximo 40 caracteres')
    for (const nome of ['<b>x</b>', 'a\u202eb', 'a\u2066b', 'a\u0007b']) expect((await tenta(nome))?.message).toMatch(/^Nome do botão: não use/)
    expect(feitas('task_buttons', 'insert')).toHaveLength(0)
    await act(async () => { await result.current.criar.mutateAsync({ name: 'a'.repeat(40), scope: 'card', columnId: null, steps: [{ t: 'arquivar' }] }) })
    expect(feitas('task_buttons', 'insert')).toHaveLength(1)
  })
  it('editar grava só nome, coluna e passos (o escopo não vai); botão com passo que a tela não entende vem como só leitura', async () => {
    m.estado.resposta = (t, op) => (t === 'task_buttons' && op === 'select'
      ? { data: [{ id: BTN, board_id: BOARD, name: 'Novo', scope: 'card', column_id: null, steps: [{ t: 'mover', v: COL }, { t: 'futuro', v: 'x' }], position: 1 },
        { id: COL, board_id: BOARD, name: 'Ok', scope: 'card', column_id: null, steps: [{ t: 'prazo', v: 2 }], position: 2 }] }
      : { data: [{ id: BTN }] })
    const { result } = renderHook(() => useBotoes(BOARD), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(result.current.botoes).toHaveLength(2))
    expect(result.current.botoes.map(b => b.somenteLeitura)).toEqual([true, false])
    await act(async () => { await result.current.editar.mutateAsync({ id: COL, name: 'Ok2', scope: 'card', columnId: null, steps: [{ t: 'prazo', v: 3 }] }) })
    expect(feitas('task_buttons', 'update')[0].args[0]).toEqual({ name: 'Ok2', column_id: null, steps: [{ t: 'prazo', v: 3 }] })
  })
  it('pessoas sugeridas: 42501 vira erro (a tela avisa), outro erro vira lista vazia', async () => {
    m.estado.rpc = () => ({ error: { code: '42501', message: 'x' } })
    const a = renderHook(() => usePessoasSugeridas(BOARD), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(a.result.current.isError).toBe(true))
    m.estado.rpc = () => ({ error: { code: 'XX000', message: 'x' } })
    const b = renderHook(() => usePessoasSugeridas(BOARD), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(b.result.current.data).toEqual([]))
  })
})
