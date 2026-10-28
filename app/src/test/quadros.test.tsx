import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup, renderHook, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMoverTarefa, type DbTask } from '../hooks/useProducerTools'
import ProducerQuadros from '../pages/producer/Quadros'
import QuadroPagina from '../pages/producer/QuadroPagina'
import TarefasRota from '../pages/producer/TarefasRota'
import {
  contarPorQuadro, filtrarQuadros, membrosParaRpc, ordenarQuadros, rotuloDias, textoDoErroQuadro, validarNome, visibilidadePadrao,
  useArquivarQuadro, useAtualizarQuadro, useCriarQuadro, useDefinirMembros, useSalvarComoModelo,
  type QuadroLinha,
} from '../hooks/useQuadros'

// Banco simulado: cada from(tabela) devolve um construtor encadeável (e esperável) que registra a chamada; rpc() registra nome e argumentos
const m = vi.hoisted(() => {
  const chamadas: { tabela: string; op: string; args: unknown[] }[] = []
  const rpcs: { nome: string; args: unknown }[] = []
  const est = {
    tabelas: {} as Record<string, { data?: unknown; error?: unknown }>,
    unico: {} as Record<string, { data?: unknown; error?: unknown }>,
    rpc: (() => ({ data: null, error: null })) as (nome: string, args: unknown) => { data?: unknown; error?: unknown },
  }
  const from = (tabela: string) => {
    const resp = () => est.tabelas[tabela] ?? { data: [], error: null }
    // qualquer método encadeado (select, order, eq, in, not...) devolve o mesmo construtor e registra a chamada; esperar ou maybeSingle() entrega a resposta
    const b: unknown = new Proxy({}, {
      get: (_, op: string) => {
        if (op === 'then') return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(resp()).then(ok, ko)
        if (op === 'maybeSingle') return () => Promise.resolve(est.unico[tabela] ?? resp())
        return (...args: unknown[]) => { chamadas.push({ tabela, op, args }); return b }
      },
    })
    return b
  }
  return { chamadas, rpcs, est, supabase: { from, rpc: (nome: string, args: unknown) => { rpcs.push({ nome, args }); return Promise.resolve(est.rpc(nome, args)) } } }
})
vi.mock('../lib/supabase', () => ({ supabase: m.supabase }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('../pages/producer/Tasks', () => ({ default: () => <p>lista de tarefas</p> }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Marina Teixeira' } }) }))
vi.mock('../hooks/useEvents', () => ({
  useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festival Maré Alta', date: '2099-10-24' }] }),
}))

const quadro = (o: Partial<QuadroLinha>): QuadroLinha => ({
  id: 'b1', producer_id: 'u1', event_id: null, name: 'Agenda da equipe', kind: 'equipe', visibility: 'equipe', description: null, color: null,
  archived_at: null, template_key: null, position: 1000, created_by: 'u1', is_default: false, created_at: '2026-10-01T00:00:00Z', ...o,
})
const novoCliente = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
const envolver = ({ children }: { children: ReactNode }) => <QueryClientProvider client={novoCliente()}>{children}</QueryClientProvider>

beforeEach(() => {
  m.chamadas.length = 0; m.rpcs.length = 0
  m.est.tabelas = {}; m.est.unico = {}
  m.est.rpc = () => ({ data: null, error: null })
})
afterEach(cleanup)

describe('validarNome (mesma regra de quadro_texto_ok)', () => {
  it('aceita 1 a 40 caracteres e recusa vazio, longo, < >, controle e invisível', () => {
    expect(validarNome('Agenda 2026')).toBe('')
    expect(validarNome('a'.repeat(40))).toBe('')
    expect(validarNome('   ')).toMatch(/Digite um nome/)
    expect(validarNome('a'.repeat(41))).toMatch(/no máximo 40/)
    expect(validarNome('<b>x</b>')).toMatch(/< ou >/)
    expect(validarNome('a' + String.fromCharCode(7) + 'b')).toMatch(/controle/)
    expect(validarNome(String.fromCharCode(0x200b))).toMatch(/Digite um nome|invisíveis/)
    expect(validarNome('x' + String.fromCharCode(0x202e) + 'y')).toMatch(/invisíveis/)
  })
  it('conta caracteres, não unidades UTF-16 (emoji vale 1)', () => {
    expect(validarNome('😀'.repeat(40))).toBe('')
    expect(validarNome('😀'.repeat(41))).toMatch(/no máximo 40/)
  })
  it('a mensagem de modelo diz "modelo"', () => expect(validarNome('', 'modelo')).toBe('Digite um nome para o modelo.'))
})

describe('textoDoErroQuadro', () => {
  it('deixa passar só as mensagens em português do SQL, com o código certo', () => {
    expect(textoDoErroQuadro({ code: '23514', message: 'Limite de 30 quadros por produtor (os arquivados contam).' })).toBe('Limite de 30 quadros por produtor (os arquivados contam).')
    expect(textoDoErroQuadro({ code: '22023', message: 'Escolha um evento seu para o quadro.' })).toBe('Escolha um evento seu para o quadro.')
    expect(textoDoErroQuadro({ code: '42501', message: 'Sem permissão para este quadro.' })).toBe('Sem permissão para este quadro.')
    expect(textoDoErroQuadro({ code: '23514', message: 'Limite de 20 modelos de quadro por produtor.' })).toBe('Limite de 20 modelos de quadro por produtor.')
  })
  it('42501 sem texto conhecido (2FA, RLS) vira "Sem permissão"; CHECK do nome vira a frase do nome; o resto vira genérica', () => {
    expect(textoDoErroQuadro({ code: '42501', message: 'sem permissão' })).toBe('Sem permissão para esta ação.')
    expect(textoDoErroQuadro({ code: '23514', message: 'new row for relation "task_boards" violates check constraint "task_boards_nome_ck"' })).toMatch(/1 a 40 caracteres/)
    expect(textoDoErroQuadro({ code: 'XX000', message: 'relation "x" does not exist: detalhe técnico' })).toBe('Não foi possível concluir. Tente de novo.')
    // mensagem conhecida com código diferente do contrato não passa
    expect(textoDoErroQuadro({ code: 'XX000', message: 'Escolha um evento seu para o quadro.' })).toBe('Não foi possível concluir. Tente de novo.')
  })
})

describe('listas', () => {
  const l = [
    quadro({ id: 'a', name: 'Zeta', kind: 'pessoal', created_at: '2026-10-01T00:00:00Z' }),
    quadro({ id: 'b', name: 'Ação', kind: 'equipe', created_at: '2026-10-03T00:00:00Z' }),
    quadro({ id: 'c', name: 'Festival', kind: 'evento', event_id: 'e1', created_at: '2026-10-02T00:00:00Z', archived_at: '2026-10-05T00:00:00Z' }),
  ]
  it('filtra por arquivado, tipo e busca sem acento nem caixa', () => {
    expect(filtrarQuadros(l, { busca: '', filtro: 'todos', arquivados: false }).map(b => b.id)).toEqual(['a', 'b'])
    expect(filtrarQuadros(l, { busca: '', filtro: 'todos', arquivados: true }).map(b => b.id)).toEqual(['c'])
    expect(filtrarQuadros(l, { busca: 'ACAO', filtro: 'todos', arquivados: false }).map(b => b.id)).toEqual(['b'])
    expect(filtrarQuadros(l, { busca: '', filtro: 'pessoal', arquivados: false }).map(b => b.id)).toEqual(['a'])
  })
  it('ordena por mais recentes, A-Z e prazo (sem prazo no fim)', () => {
    expect(ordenarQuadros(l, 'recentes', () => null).map(b => b.id)).toEqual(['b', 'c', 'a'])
    expect(ordenarQuadros(l, 'az', () => null).map(b => b.id)).toEqual(['b', 'c', 'a'])
    expect(ordenarQuadros(l, 'prazo', b => (b.id === 'c' ? '2026-12-01' : b.id === 'a' ? '2026-11-01' : null)).map(b => b.id)).toEqual(['a', 'c', 'b'])
  })
  it('conta abertos e atrasados por quadro, sem arquivados nem concluídos', () => {
    const c = contarPorQuadro([
      { board_id: 'a', status: 'todo', due_date: '2026-10-01T15:00:00Z', archived_at: null },
      { board_id: 'a', status: 'done', due_date: '2026-10-01T15:00:00Z', archived_at: null },
      { board_id: 'a', status: 'in_progress', due_date: null, archived_at: null },
      { board_id: 'a', status: 'todo', due_date: null, archived_at: '2026-10-02T00:00:00Z' },
      { board_id: null, status: 'todo', due_date: null, archived_at: null },
    ], '2026-10-09')
    expect(c.get('a')).toEqual({ abertos: 2, atrasados: 1 })
    expect(c.size).toBe(1)
  })
  it('auxiliares', () => {
    expect(membrosParaRpc({ x: 'ver', y: 'editar' })).toEqual([{ user_id: 'x', nivel: 'ver' }, { user_id: 'y', nivel: 'editar' }])
    expect(rotuloDias(45)).toBe('D-45'); expect(rotuloDias(0)).toBe('D0'); expect(rotuloDias(-2)).toBe('D+2')
    expect(visibilidadePadrao('pessoal')).toBe('pessoal'); expect(visibilidadePadrao('evento')).toBe('equipe')
  })
})

describe('chamadas ao banco (contrato do SQL 20261108)', () => {
  it('quadro_criar: nomes dos parâmetros; evento só em quadro de evento; membros só em "escolhidas"', async () => {
    m.est.rpc = () => ({ data: 'novo-id', error: null })
    const { result } = renderHook(() => useCriarQuadro(), { wrapper: envolver })
    await act(async () => { await result.current.mutateAsync({ nome: '  Festa  ', kind: 'equipe', eventId: 'e1', modelo: null, visibilidade: 'equipe', membros: { p1: 'ver' } }) })
    expect(m.rpcs[0]).toEqual({ nome: 'quadro_criar', args: { p_nome: 'Festa', p_kind: 'equipe', p_evento: null, p_template: null, p_visibilidade: 'equipe', p_membros: null } })
    await act(async () => { await result.current.mutateAsync({ nome: 'Festa', kind: 'evento', eventId: 'e1', modelo: 'evento_completo', visibilidade: 'escolhidas', membros: { p1: 'editar' } }) })
    expect(m.rpcs[1].args).toEqual({ p_nome: 'Festa', p_kind: 'evento', p_evento: 'e1', p_template: 'evento_completo', p_visibilidade: 'escolhidas', p_membros: [{ user_id: 'p1', nivel: 'editar' }] })
  })
  it('quadro_membros_definir, quadro_arquivar e quadro_salvar_como_modelo (3º parâmetro p_cartoes)', async () => {
    m.est.rpc = nome => ({ data: nome === 'quadro_salvar_como_modelo' ? 'meu_abc' : null, error: null })
    const d = renderHook(() => useDefinirMembros(), { wrapper: envolver })
    await act(async () => { await d.result.current.mutateAsync({ id: 'b1', visibilidade: 'escolhidas', membros: { p1: 'ver' } }) })
    await act(async () => { await d.result.current.mutateAsync({ id: 'b1', visibilidade: 'pessoal', membros: { p1: 'ver' } }) })
    const a = renderHook(() => useArquivarQuadro(), { wrapper: envolver })
    await act(async () => { await a.result.current.mutateAsync({ id: 'b1', arquivar: true }) })
    const s = renderHook(() => useSalvarComoModelo(), { wrapper: envolver })
    let chave = ''
    await act(async () => { chave = await s.result.current.mutateAsync({ id: 'b1', nome: ' Meu ', cartoes: true }) })
    expect(m.rpcs.map(r => r.nome)).toEqual(['quadro_membros_definir', 'quadro_membros_definir', 'quadro_arquivar', 'quadro_salvar_como_modelo'])
    expect(m.rpcs[0].args).toEqual({ p_board: 'b1', p_visibilidade: 'escolhidas', p_membros: [{ user_id: 'p1', nivel: 'ver' }] })
    expect(m.rpcs[1].args).toEqual({ p_board: 'b1', p_visibilidade: 'pessoal', p_membros: null })
    expect(m.rpcs[2].args).toEqual({ p_board: 'b1', p_arquivar: true })
    expect(m.rpcs[3].args).toEqual({ p_board: 'b1', p_nome: 'Meu', p_cartoes: true })
    expect(chave).toBe('meu_abc')
  })
  it('erro do banco vira frase em português; detalhe técnico não vaza', async () => {
    m.est.rpc = () => ({ data: null, error: { code: '23514', message: 'Limite de 30 quadros por produtor (os arquivados contam).' } })
    const { result } = renderHook(() => useCriarQuadro(), { wrapper: envolver })
    await expect(result.current.mutateAsync({ nome: 'x', kind: 'equipe', eventId: null, modelo: null, visibilidade: 'equipe', membros: {} })).rejects.toThrow('Limite de 30 quadros por produtor (os arquivados contam).')
    m.est.rpc = () => ({ data: null, error: { code: 'XX000', message: 'segredo técnico' } })
    await expect(result.current.mutateAsync({ nome: 'x', kind: 'equipe', eventId: null, modelo: null, visibilidade: 'equipe', membros: {} })).rejects.toThrow('Não foi possível concluir. Tente de novo.')
  })
  it('renomear/cor: UPDATE direto só de name e color; 0 linhas = sem permissão', async () => {
    m.est.tabelas.task_boards = { data: [{ id: 'b1' }], error: null }
    const { result } = renderHook(() => useAtualizarQuadro(), { wrapper: envolver })
    await act(async () => { await result.current.mutateAsync({ id: 'b1', name: 'Novo', color: 'azul' }) })
    expect(m.chamadas.find(c => c.op === 'update')).toEqual({ tabela: 'task_boards', op: 'update', args: [{ name: 'Novo', color: 'azul' }] })
    expect(m.chamadas.find(c => c.op === 'eq')?.args).toEqual(['id', 'b1'])
    m.est.tabelas.task_boards = { data: [], error: null }
    await expect(result.current.mutateAsync({ id: 'b1', name: 'Outro' })).rejects.toThrow('Sem permissão para este quadro.')
  })
})

describe('tela Meus quadros', () => {
  const montar = () => render(
    <QueryClientProvider client={novoCliente()}>
      <MemoryRouter initialEntries={['/producer/quadros']}>
        <Routes><Route path="/producer/quadros" element={<ProducerQuadros />} /><Route path="/producer/quadros/:id" element={<p>kanban do quadro</p>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const modelos = [
    { key: 'dia_a_dia', name: 'Dia a dia do produtor', description: 'Hoje.', kind_sugerido: 'pessoal', columns: [{ name: 'Hoje', kind: 'todo' }, { name: 'Feito', kind: 'done' }], cards: [{ titulo: 'Responder fornecedores', coluna: 0 }], owner_id: null },
    { key: 'evento_completo', name: 'Evento completo', description: 'Do alvará.', kind_sugerido: 'evento', columns: [{ name: 'A fazer', kind: 'todo' }, { name: 'Feito', kind: 'done' }], cards: [{ titulo: 'Confirmar local', coluna: 0, dias: 60 }], owner_id: null },
  ]

  it('carregando, depois a grade com Recentes, tipo, canhoto e contadores', async () => {
    m.est.tabelas.task_boards = { data: [
      quadro({ id: 'b1', name: 'Agenda da equipe', created_at: '2026-10-04T00:00:00Z' }), quadro({ id: 'b2', name: 'Minhas tarefas', kind: 'pessoal', visibility: 'pessoal', created_at: '2026-10-03T00:00:00Z' }),
      quadro({ id: 'b3', name: 'Festival Maré Alta', kind: 'evento', event_id: 'e1', created_at: '2026-10-02T00:00:00Z' }), quadro({ id: 'b4', name: 'Parcerias', created_at: '2026-10-01T00:00:00Z' }),
    ], error: null }
    m.est.tabelas.producer_tasks = { data: [{ board_id: 'b1', status: 'todo', due_date: null, archived_at: null }, { board_id: 'b1', status: 'todo', due_date: '2020-01-01T15:00:00Z', archived_at: null }], error: null }
    m.est.rpc = () => ({ data: [], error: null })
    montar()
    expect(screen.getByRole('status').textContent).toMatch(/Carregando quadros/)
    expect(await screen.findByRole('heading', { name: 'Recentes' })).toBeTruthy()
    const recentes = within(screen.getByRole('heading', { name: 'Recentes' }).closest('section')!)
    expect(recentes.getAllByRole('link').map(a => a.textContent)).toEqual(['Agenda da equipe', 'Minhas tarefas', 'Festival Maré Alta'])
    expect(screen.getByRole('heading', { name: 'Equipe e empresa' })).toBeTruthy()
    // o 4º quadro fica só na lista de baixo; os 3 de Recentes não se repetem lá
    expect(screen.getAllByRole('link', { name: 'Parcerias' })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Agenda da equipe' })).toHaveLength(1)
    await waitFor(() => expect(screen.getAllByText('abertos').length).toBeGreaterThan(0))
    expect(screen.getByText(/1 atrasado/)).toBeTruthy()
  })

  it('filtro por tipo e busca sem acento; "nenhum encontrado" mantém o botão de criar', async () => {
    m.est.tabelas.task_boards = { data: [quadro({ id: 'b1', name: 'Ação rápida' }), quadro({ id: 'b2', name: 'Pessoal', kind: 'pessoal', visibility: 'pessoal' })], error: null }
    montar()
    await screen.findByRole('heading', { name: 'Recentes' })
    fireEvent.click(screen.getByRole('radio', { name: 'Pessoais' }))
    expect(screen.queryByRole('heading', { name: 'Recentes' })).toBeNull()
    expect(screen.getAllByRole('link').map(a => a.textContent)).toEqual(['Pessoal'])
    fireEvent.change(screen.getByLabelText('Buscar quadro'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nenhum quadro encontrado.')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Criar quadro/ }).length).toBeGreaterThan(1)
    fireEvent.click(screen.getByRole('radio', { name: 'Todos' }))
    fireEvent.change(screen.getByLabelText('Buscar quadro'), { target: { value: 'acao' } })
    expect(screen.getAllByRole('link').map(a => a.textContent)).toEqual(['Ação rápida'])
  })

  it('estado vazio e estado de erro com "Tentar de novo"', async () => {
    m.est.tabelas.task_boards = { data: [], error: null }
    const v = montar()
    expect(await screen.findByText('Nenhum quadro ainda')).toBeTruthy()
    v.unmount()
    m.est.tabelas.task_boards = { data: null, error: { code: 'XX000', message: 'detalhe técnico' } }
    montar()
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toMatch(/Não foi possível carregar os quadros\. Não foi possível concluir/)
    expect(alerta.textContent).not.toMatch(/detalhe técnico/)
    expect(within(alerta).getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })

  it('arquivados ficam atrás do link "Ver arquivados"', async () => {
    m.est.tabelas.task_boards = { data: [quadro({ id: 'b1', name: 'Ativo' }), quadro({ id: 'b2', name: 'Velho', archived_at: '2026-10-05T00:00:00Z' })], error: null }
    montar()
    await screen.findByRole('link', { name: 'Ativo' })
    expect(screen.queryByRole('link', { name: 'Velho' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver arquivados (1)' }))
    expect(screen.getByRole('link', { name: 'Velho' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Arquivados' })).toBeTruthy()
  })

  it('modal Criar quadro: 2 passos, modelo vira nome/tipo, valida, chama quadro_criar e avisa', async () => {
    m.est.tabelas.task_boards = { data: [quadro({ id: 'b1' })], error: null }
    m.est.tabelas.task_board_templates = { data: modelos, error: null }
    m.est.rpc = nome => (nome === 'quadro_criar' ? { data: 'novo-id', error: null } : { data: [{ id: 'p1', nome: 'Rafael Nogueira' }, { id: 'p2', nome: 'Camila Duarte' }], error: null })
    montar()
    await screen.findByRole('link', { name: 'Agenda da equipe' })
    fireEvent.click(screen.getAllByRole('button', { name: /Criar quadro/ })[0])
    const dlg = await screen.findByRole('dialog', { name: 'Criar quadro' })
    expect(within(dlg).getByText('Passo 1 de 2')).toBeTruthy()
    fireEvent.click(await within(dlg).findByRole('radio', { name: /Evento completo/ }))
    fireEvent.click(within(dlg).getByRole('button', { name: 'Continuar' }))
    expect(within(dlg).getByText('Passo 2 de 2')).toBeTruthy()
    const nome = within(dlg).getByLabelText('Nome') as HTMLInputElement
    expect(nome.value).toBe('Evento completo')
    expect(within(dlg).getByRole('radio', { name: 'Evento' }).getAttribute('aria-checked')).toBe('true') // tipo sugerido pelo modelo
    // evento é obrigatório
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar quadro' }))
    expect(within(dlg).getByText('Escolha o evento do quadro.')).toBeTruthy()
    fireEvent.change(within(dlg).getByLabelText('Evento'), { target: { value: 'e1' } })
    // pessoas escolhidas: ao menos uma
    fireEvent.click(within(dlg).getByRole('radio', { name: 'Pessoas escolhidas' }))
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar quadro' }))
    expect(within(dlg).getByText('Escolha ao menos uma pessoa.')).toBeTruthy()
    fireEvent.click(await within(dlg).findByRole('checkbox', { name: 'Rafael Nogueira' }))
    fireEvent.change(within(dlg).getByLabelText('Nível de Rafael Nogueira'), { target: { value: 'editar' } })
    fireEvent.change(nome, { target: { value: 'Festival Maré Alta' } })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar quadro' }))
    await waitFor(() => expect(m.rpcs.find(r => r.nome === 'quadro_criar')).toBeTruthy())
    expect(m.rpcs.find(r => r.nome === 'quadro_criar')!.args).toEqual({
      p_nome: 'Festival Maré Alta', p_kind: 'evento', p_evento: 'e1', p_template: 'evento_completo', p_visibilidade: 'escolhidas', p_membros: [{ user_id: 'p1', nivel: 'editar' }],
    })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Criar quadro' })).toBeNull())
  })

  it('modal: Esc fecha; quadro pessoal trava a visibilidade; erro do banco aparece em português', async () => {
    m.est.tabelas.task_boards = { data: [quadro({ id: 'b1' })], error: null }
    m.est.tabelas.task_board_templates = { data: modelos, error: null }
    m.est.rpc = () => ({ data: null, error: { code: '23514', message: 'Limite de 30 quadros por produtor (os arquivados contam).' } })
    montar()
    await screen.findByRole('link', { name: 'Agenda da equipe' })
    fireEvent.click(screen.getAllByRole('button', { name: /Criar quadro/ })[0])
    const dlg = await screen.findByRole('dialog', { name: 'Criar quadro' })
    fireEvent.click(await within(dlg).findByRole('radio', { name: /Dia a dia/ }))
    fireEvent.click(within(dlg).getByRole('button', { name: 'Continuar' }))
    expect(within(dlg).getByRole('radio', { name: 'Só eu' }).getAttribute('aria-checked')).toBe('true')
    expect((within(dlg).getByRole('radio', { name: 'Equipe toda' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(dlg).getByRole('radio', { name: 'Pessoas escolhidas' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar quadro' }))
    expect(await within(dlg).findByText('Limite de 30 quadros por produtor (os arquivados contam).')).toBeTruthy()
    fireEvent.keyDown(dlg, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Criar quadro' })).toBeNull())
  })

  it('no teto de 30 quadros próprios o "Continuar" fica desligado e avisa', async () => {
    m.est.tabelas.task_boards = { data: Array.from({ length: 30 }, (_, i) => quadro({ id: `x${i}`, name: `Q${i}`, created_at: `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z` })), error: null }
    m.est.tabelas.task_board_templates = { data: modelos, error: null }
    montar()
    await screen.findByRole('link', { name: 'Q29' })
    fireEvent.click(screen.getAllByRole('button', { name: /Criar quadro/ })[0])
    const dlg = await screen.findByRole('dialog', { name: 'Criar quadro' })
    expect((within(dlg).getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(dlg).getByRole('alert').textContent).toMatch(/limite de 30 quadros/)
  })

  it('menu do quadro: dono arquiva; quem não é dono não altera nada', async () => {
    m.est.tabelas.task_boards = { data: [quadro({ id: 'b1', name: 'Meu' }), quadro({ id: 'b2', name: 'Alheio', producer_id: 'u9' })], error: null }
    montar()
    await screen.findByRole('link', { name: 'Meu' })
    fireEvent.keyDown(screen.getAllByRole('button', { name: 'Ações do quadro Meu' })[0], { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Arquivar' }))
    await waitFor(() => expect(m.rpcs.find(r => r.nome === 'quadro_arquivar')).toBeTruthy())
    expect(m.rpcs.find(r => r.nome === 'quadro_arquivar')!.args).toEqual({ p_board: 'b1', p_arquivar: true })
    cleanup()
    m.rpcs.length = 0
    montar()
    await screen.findByRole('link', { name: 'Alheio' })
    fireEvent.keyDown(screen.getAllByRole('button', { name: 'Ações do quadro Alheio' })[0], { key: 'Enter' })
    const itens = await screen.findAllByRole('menuitem')
    const por = (t: RegExp) => itens.find(i => t.test(i.textContent ?? ''))!
    expect(por(/Renomear/).getAttribute('aria-disabled') ?? por(/Renomear/).getAttribute('data-disabled')).not.toBeNull()
    expect(por(/Salvar como modelo/).getAttribute('data-disabled')).not.toBeNull()
    expect(por(/Arquivar/).getAttribute('data-disabled')).not.toBeNull()
    expect(por(/Ver membros/)).toBeTruthy()
  })
})

describe('tela do quadro (kanban com board_id)', () => {
  const cols = [{ id: 'c1', name: 'A fazer', kind: 'todo' }, { id: 'c2', name: 'Feito', kind: 'done' }]
  const cartao = (id: string, o: object) => ({ id, producer_id: 'u1', board_id: 'b1', column_id: 'c1', title: `Cartão ${id}`, status: 'todo', priority: 'medium', due_date: null, created_at: '2026-10-01T00:00:00Z', position: 1000, assigned_to: null, event_id: null, description: null, ...o })
  const montar = (url = '/producer/quadros/b1') => render(
    <QueryClientProvider client={novoCliente()}>
      <MemoryRouter initialEntries={[url]}><Routes><Route path="/producer/quadros/:boardId" element={<QuadroPagina />} /></Routes></MemoryRouter>
    </QueryClientProvider>,
  )

  it('lê o quadro e os cartões pelo board_id e mostra as colunas do banco', async () => {
    m.est.unico.task_boards = { data: quadro({ id: 'b1', name: 'Agenda da equipe' }), error: null }
    m.est.tabelas.task_columns = { data: cols, error: null }
    m.est.tabelas.producer_tasks = { data: [cartao('t1', {}), cartao('t2', { column_id: 'c2', status: 'done' })], error: null }
    montar()
    expect(await screen.findByRole('heading', { level: 1, name: 'Agenda da equipe' })).toBeTruthy()
    expect(await screen.findByRole('region', { name: 'A fazer' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'A fazer' })).getByText('Cartão t1')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Feito' })).getByText('Cartão t2')).toBeTruthy()
    expect(m.chamadas.some(c => c.tabela === 'producer_tasks' && c.op === 'eq' && c.args[0] === 'board_id' && c.args[1] === 'b1')).toBe(true)
  })

  it('novo cartão grava producer_id do quadro, board_id e a coluna escolhida', async () => {
    m.est.unico.task_boards = { data: quadro({ id: 'b1' }), error: null }
    m.est.tabelas.task_columns = { data: cols, error: null }
    m.est.tabelas.producer_tasks = { data: [], error: null }
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /Novo cartão/ }))
    const dlg = await screen.findByRole('dialog', { name: 'Novo cartão' })
    fireEvent.change(within(dlg).getByLabelText('Título'), { target: { value: '  Contratar DJ ' } })
    fireEvent.click(within(dlg).getByRole('button', { name: 'Criar cartão' }))
    await waitFor(() => expect(m.chamadas.find(c => c.op === 'insert')).toBeTruthy())
    expect(m.chamadas.find(c => c.op === 'insert')).toEqual({ tabela: 'producer_tasks', op: 'insert', args: [{ producer_id: 'u1', board_id: 'b1', column_id: 'c1', title: 'Contratar DJ' }] })
  })

  it('quadro que não existe ou sem acesso mostra a mensagem, sem dados', async () => {
    m.est.unico.task_boards = { data: null, error: null }
    montar('/producer/quadros/zzz')
    expect(await screen.findByText('Quadro não encontrado')).toBeTruthy()
  })

  it('quadro "equipe" de outro dono mostra Novo cartão (o banco decide) e "escolhidas" com nível ver não', async () => {
    m.est.unico.task_boards = { data: quadro({ id: 'b1', producer_id: 'u9', visibility: 'equipe' }), error: null }
    m.est.tabelas.task_columns = { data: cols, error: null }
    m.est.tabelas.producer_tasks = { data: [], error: null }
    montar()
    expect(await screen.findByRole('button', { name: /Novo cartão/ })).toBeTruthy()
  })

  it('quem só vê (nível ver em "escolhidas") não tem o botão Novo cartão', async () => {
    m.est.unico.task_boards = { data: quadro({ id: 'b1', producer_id: 'u9', visibility: 'escolhidas' }), error: null }
    m.est.tabelas.task_columns = { data: cols, error: null }
    m.est.tabelas.producer_tasks = { data: [], error: null }
    m.est.tabelas.task_board_members = { data: [{ board_id: 'b1', user_id: 'u1', nivel: 'ver' }], error: null }
    montar()
    await screen.findByRole('region', { name: 'A fazer' })
    expect(screen.queryByRole('button', { name: /Novo cartão/ })).toBeNull()
  })

  it('?cartao=<id> abre o verso do cartão e tira o parâmetro', async () => {
    m.est.unico.task_boards = { data: quadro({ id: 'b1' }), error: null }
    m.est.tabelas.task_columns = { data: cols, error: null }
    m.est.tabelas.producer_tasks = { data: [cartao('aaaa1111-0000-0000-0000-000000000001', { title: 'Abrir este' })], error: null }
    montar('/producer/quadros/b1?cartao=aaaa1111-0000-0000-0000-000000000001')
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })
})

describe('/producer/tarefas: link antigo de cartão vai para o quadro certo', () => {
  const ID = 'aaaa1111-0000-0000-0000-000000000001'
  const montar = (url: string) => render(
    <QueryClientProvider client={novoCliente()}>
      <MemoryRouter initialEntries={[url]}><Routes>
        <Route path="/producer/tarefas" element={<TarefasRota />} />
        <Route path="/producer/quadros/:boardId" element={<p>no quadro</p>} />
      </Routes></MemoryRouter>
    </QueryClientProvider>,
  )
  it('?cartao= com cartão existente redireciona para /producer/quadros/<board>?cartao=', async () => {
    m.est.unico.producer_tasks = { data: { board_id: 'b7' }, error: null }
    montar(`/producer/tarefas?cartao=${ID}`)
    expect(await screen.findByText('no quadro')).toBeTruthy()
    expect(m.chamadas.find(c => c.tabela === 'producer_tasks' && c.op === 'eq')?.args).toEqual(['id', ID])
  })
  it('cartão que não existe (ou sem acesso), sem ?cartao= e ?eventId= ficam na lista de tarefas', async () => {
    m.est.unico.producer_tasks = { data: null, error: null }
    const a = montar(`/producer/tarefas?cartao=${ID}`)
    expect(await screen.findByText('lista de tarefas')).toBeTruthy()
    a.unmount()
    montar('/producer/tarefas?eventId=e1')
    expect(await screen.findByText('lista de tarefas')).toBeTruthy()
    cleanup()
    montar('/producer/tarefas?cartao=nao-e-uuid')
    expect(await screen.findByText('lista de tarefas')).toBeTruthy()
    expect(m.chamadas.filter(c => c.tabela === 'producer_tasks' && c.op === 'eq')).toHaveLength(1) // só a 1ª tentativa consultou o banco
  })
})

describe('mover cartão com a lista do quadro em outra chave do cache', () => {
  const t = (updated_at: string) => ({ id: 't1', producer_id: 'u1', board_id: 'b1', column_id: 'c1', updated_at } as DbTask)
  it('usa o updated_at mais novo entre a lista geral (velha) e a do quadro (já refeita depois da edição pelo verso): sem conflito falso', async () => {
    const qc = novoCliente()
    qc.setQueryData(['producer-tasks', 'u1'], [t('2026-10-01T10:00:00Z')]) // geral, velha
    qc.setQueryData(['producer-tasks', 'u1', 'quadro', 'b1'], [t('2026-10-01T12:00:00Z')]) // do quadro, após editar
    m.est.tabelas.producer_tasks = { data: [{ updated_at: '2026-10-01T13:00:00Z' }], error: null }
    const { result } = renderHook(() => useMoverTarefa(), { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> })
    await act(async () => { await result.current.mutateAsync({ tarefa: t('2026-10-01T09:00:00Z'), mudanca: { column_id: 'c2' } }) })
    expect(m.chamadas.filter(c => c.op === 'eq' && c.args[0] === 'updated_at').map(c => c.args[1])).toEqual(['2026-10-01T12:00:00Z'])
    expect(qc.getQueryData<DbTask[]>(['producer-tasks', 'u1', 'quadro', 'b1'])?.[0].updated_at).toBe('2026-10-01T13:00:00Z') // o gravado vale para as duas listas
  })
})
