import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useResumoCartoes, useAlternarMembro, useAlternarEtiqueta, useEnviarAnexo, useAtualizarCartao, useAcoesCartao, nomeSeguro, caminhoAnexo, erroDoArquivo, erroDosBytes, textoDoErro, mensagemSegura, falhar,
} from '../hooks/useCartao'
import { ConflitoCartao, type DbTask } from '../hooks/useProducerTools'

// Banco simulado: cada from(tabela) devolve um construtor encadeável que registra as chamadas e resolve pela função `resposta`.
const m = vi.hoisted(() => {
  const chamadas: { tabela: string; op: string; args: unknown[] }[] = []
  const estado = { resposta: ((): { data?: unknown; error?: unknown } => ({ data: [], error: null })) as (t: string, op: string, args: unknown[]) => { data?: unknown; error?: unknown } }
  const from = (tabela: string) => {
    let op = 'select'
    let args: unknown[] = []
    const b: Record<string, unknown> = new Proxy({}, {
      get: (_, k: string) => {
        if (k === 'then') return (res: (v: unknown) => void) => { chamadas.push({ tabela, op, args }); res({ data: null, error: null, ...estado.resposta(tabela, op, args) }) }
        return (...a: unknown[]) => {
          if (['insert', 'update', 'delete'].includes(k)) { op = k; args = a }
          return b
        }
      },
    })
    return b
  }
  const storage = { upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() }
  return { chamadas, estado, from, storage }
})
vi.mock('../lib/supabase', () => ({ supabase: { from: m.from, storage: { from: () => m.storage } } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

const novoClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
const wrapper = (qc: QueryClient) => ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
// roda a ação dentro de um único act e devolve o erro (ou undefined)
const rejeita = async (fn: () => Promise<unknown>) => { let erro: Error | undefined; await act(async () => { try { await fn() } catch (e) { erro = e as Error } }); return erro }
const feitas = (tabela: string, op: string) => m.chamadas.filter(c => c.tabela === tabela && c.op === op)
const PROD = '11111111-1111-4111-8111-111111111111'
const TASK = '22222222-2222-4222-8222-222222222222'
const INICIO: Record<string, number[]> = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/webp': [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 'application/pdf': [0x25, 0x50, 0x44, 0x46] }
const arquivo = (nome: string, type: string, size = 100, bytes = INICIO[type] ?? [0]) => { const f = new File([new Uint8Array([...bytes, 0, 0, 0, 0])], nome, { type }); Object.defineProperty(f, 'size', { value: size }); return f }

beforeEach(() => {
  m.chamadas.length = 0
  m.estado.resposta = () => ({ data: [], error: null })
  m.storage.upload.mockReset().mockResolvedValue({ error: null })
  m.storage.remove.mockReset().mockResolvedValue({ error: null })
  m.storage.createSignedUrl.mockReset()
})

describe('resumo dos cartões', () => {
  it('modo antigo (PGRST205): resumo vazio, sem erro', async () => {
    m.estado.resposta = () => ({ error: { code: 'PGRST205', message: 'Could not find the table' } })
    const { result } = renderHook(() => useResumoCartoes('b1', ['t1']), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.size).toBe(0)
    expect(result.current.isError).toBe(false)
  })

  it('outro erro do banco não é engolido', async () => {
    m.estado.resposta = () => ({ error: { code: '42501', message: 'x' } })
    const { result } = renderHook(() => useResumoCartoes('b1', ['t1']), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('agrega por cartão com uma consulta por tabela', async () => {
    const etq = { id: 'e1', board_id: 'b1', name: 'Urgente', color: '#ff0000' }
    const dados: Record<string, unknown[]> = {
      task_card_labels: [{ task_id: 't1', etiqueta: etq }],
      task_card_members: [{ task_id: 't1', user_id: 'a' }, { task_id: 't1', user_id: 'b' }],
      task_checklists: [{ task_id: 't1', itens: [{ done: true }, { done: false }, { done: true }] }, { task_id: 't1', itens: [{ done: false }] }],
      task_attachments: [{ task_id: 't1' }, { task_id: 't2' }],
      task_comments: [{ task_id: 't2' }, { task_id: 't2' }, { task_id: 't2' }],
      task_dependencies: [
        { task_id: 't1', pai: { archived_at: null, task_columns: { kind: 'done' } } }, // concluída: não bloqueia
        { task_id: 't2', pai: { archived_at: null, task_columns: { kind: 'doing' } } }, // aberta: bloqueia
        { task_id: 't3', pai: { archived_at: '2026-10-01T00:00:00Z', task_columns: { kind: 'doing' } } }, // arquivada: não bloqueia
      ],
    }
    m.estado.resposta = t => ({ data: dados[t] ?? [], error: null })
    const { result } = renderHook(() => useResumoCartoes('b1', ['t2', 't1', 't3']), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(m.chamadas.map(c => c.tabela).sort()).toEqual(['task_attachments', 'task_card_labels', 'task_card_members', 'task_checklists', 'task_comments', 'task_dependencies'])
    const r = result.current.data!
    expect(r.get('t1')).toMatchObject({ etiquetas: [etq], membros: ['a', 'b'], checkFeitos: 2, checkTotal: 4, anexos: 1, comentarios: 0, bloqueado: false })
    expect(r.get('t2')).toMatchObject({ anexos: 1, comentarios: 3, bloqueado: true })
    expect(r.get('t3')?.bloqueado ?? false).toBe(false)
  })
})

describe('membros e etiquetas: um por vez', () => {
  it('ligar insere só aquela pessoa; desligar apaga só ela; nunca lê nem escreve a lista inteira', async () => {
    const { result } = renderHook(() => useAlternarMembro('t1'), { wrapper: wrapper(novoClient()) })
    await act(() => result.current.mutateAsync({ userId: 'c', ligar: true }))
    await act(() => result.current.mutateAsync({ userId: 'a', ligar: false }))
    expect(feitas('task_card_members', 'insert')).toHaveLength(1)
    expect(feitas('task_card_members', 'insert')[0].args[0]).toEqual({ task_id: 't1', user_id: 'c' })
    expect(feitas('task_card_members', 'delete')).toHaveLength(1)
    expect(feitas('task_card_members', 'select')).toHaveLength(0)
  })

  it('23505 (já existe) conta como sucesso em membro e em etiqueta; outro erro não', async () => {
    m.estado.resposta = () => ({ error: { code: '23505', message: 'duplicate key value violates unique constraint "task_card_members_pkey"' } })
    const mem = renderHook(() => useAlternarMembro('t1'), { wrapper: wrapper(novoClient()) })
    await act(() => mem.result.current.mutateAsync({ userId: 'c', ligar: true }))
    const etq = renderHook(() => useAlternarEtiqueta('t1'), { wrapper: wrapper(novoClient()) })
    await act(() => etq.result.current.mutateAsync({ taskId: 't1', etiqueta: { id: 'e1', board_id: 'b', name: 'x', color: '#ffffff' }, ligar: true }))
    m.estado.resposta = () => ({ error: { code: '42501', message: 'x' } })
    expect((await rejeita(() => mem.result.current.mutateAsync({ userId: 'c', ligar: true })))?.message).toBe('Sem permissão')
  })
})

describe('mensagens de erro', () => {
  it('só frases em português: constraint, RLS e Storage nunca aparecem', () => {
    expect(textoDoErro({ code: '42501', message: 'new row violates row-level security policy' })).toBe('Sem permissão')
    expect(textoDoErro({ code: '23505', message: 'duplicate key value violates unique constraint "task_labels_board_id_name_key"' })).toBe('Já existe')
    expect(textoDoErro({ code: '23514', message: 'new row violates check constraint "producer_tasks_cover_ck"' })).toBe('Valor não permitido')
    expect(textoDoErro({ code: '23514', message: 'Essa dependência cria um ciclo.' })).toBe('Essa dependência cria um ciclo.')
    expect(textoDoErro({ code: '23514', message: 'Limite de 30 anexos por cartão.' })).toBe('Limite de 30 anexos por cartão.')
    expect(textoDoErro({ code: 'P0001', message: 'Item "x" violates foreign key constraint task_fk' })).toBe('Não foi possível salvar. Tente de novo.')
    expect(textoDoErro({ code: undefined, message: 'The resource already exists' })).toBe('Não foi possível salvar. Tente de novo.')
    expect(mensagemSegura({ message: 'constraint "abc_ck"' })).toBe('Não foi possível salvar. Tente de novo.')
    expect(() => falhar({ code: '23505', message: 'constraint "abc"' })).toThrow('Já existe')
  })
})

describe('anexos', () => {
  it('valida tipo e tamanho no cliente, em português, antes de subir', async () => {
    expect(erroDoArquivo({ type: 'image/png', size: 10 })).toBeNull()
    expect(erroDoArquivo({ type: 'application/pdf', size: 10 * 1024 * 1024 })).toBeNull()
    expect(erroDoArquivo({ type: 'image/gif', size: 10 })).toMatch(/PNG, JPEG, WebP ou PDF/)
    expect(erroDoArquivo({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/)
    const { result } = renderHook(() => useEnviarAnexo(), { wrapper: wrapper(novoClient()) })
    expect(String((await rejeita(() => result.current.mutateAsync({ producerId: PROD, taskId: TASK, arquivo: arquivo('a.exe', 'application/x-msdownload') })))?.message)).toMatch(/PNG, JPEG/)
    expect(String((await rejeita(() => result.current.mutateAsync({ producerId: PROD, taskId: TASK, arquivo: arquivo('a.pdf', 'application/pdf', 11 * 1024 * 1024) })))?.message)).toMatch(/10 MB/)
    expect(String((await rejeita(() => result.current.mutateAsync({ producerId: PROD, taskId: TASK, arquivo: arquivo('a.png', 'application/pdf') })))?.message)).toMatch(/extensão/)
    expect(m.storage.upload).not.toHaveBeenCalled()
  })

  it('confere os primeiros bytes: PNG, JPEG, WebP e PDF; arquivo com outro conteúdo é recusado antes de subir', async () => {
    for (const [mime, bytes] of Object.entries(INICIO)) expect(erroDosBytes(mime, new Uint8Array([...bytes, 0, 0, 0, 0]))).toBeNull()
    expect(erroDosBytes('image/png', new Uint8Array([0x4d, 0x5a, 0x90]))).toMatch(/conteúdo/)
    expect(erroDosBytes('image/webp', new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20]))).toMatch(/conteúdo/)
    const { result } = renderHook(() => useEnviarAnexo(), { wrapper: wrapper(novoClient()) })
    const falso = arquivo('virus.png', 'image/png', 100, [0x4d, 0x5a, 0x90, 0x00])
    expect(String((await rejeita(() => result.current.mutateAsync({ producerId: PROD, taskId: TASK, arquivo: falso })))?.message)).toMatch(/conteúdo do arquivo/)
    expect(m.storage.upload).not.toHaveBeenCalled()
  })

  it('caminho gerado cumpre a regex do SQL (inclusive nome enorme, estranho e com "..")', () => {
    const sql = new RegExp(`^${PROD}/[0-9a-f-]{36}/[0-9a-f-]{36}-[A-Za-z0-9_-][A-Za-z0-9_.-]{0,82}\\.(png|jpe?g|webp|pdf)$`)
    for (const nome of ['foto.png', 'Relatório final (v2) ção.pdf', 'a'.repeat(300) + '.png', '../../etc/passwd', 'a..b.png', '日本語.webp', '', '.png', 'X.PDF', '.hidden', 'a.']) {
      const p = caminhoAnexo(PROD, TASK, nome, 'image/png')
      expect(p.startsWith(`${PROD}/${TASK}/`)).toBe(true)
      expect(p).toMatch(sql)
      expect(p).not.toContain('..')
    }
    expect(caminhoAnexo(PROD, TASK, 'laudo', 'application/pdf').endsWith('-laudo.pdf')).toBe(true)
    expect(caminhoAnexo(PROD, TASK, 'foto', 'image/jpeg').endsWith('-foto.jpg')).toBe(true)
    expect(caminhoAnexo(PROD, TASK, 'X.PDF', 'application/pdf').endsWith('-X.pdf')).toBe(true)
    expect(nomeSeguro('a'.repeat(300) + '.png').endsWith('.png')).toBe(true)
  })

  it('sobe o arquivo e grava a linha; se a linha falha, apaga o arquivo enviado', async () => {
    const { result } = renderHook(() => useEnviarAnexo(), { wrapper: wrapper(novoClient()) })
    await act(() => result.current.mutateAsync({ producerId: PROD, taskId: TASK, arquivo: arquivo('foto.png', 'image/png') }))
    expect(m.storage.upload).toHaveBeenCalledTimes(1)
    expect(m.storage.remove).not.toHaveBeenCalled()
    expect(feitas('task_attachments', 'insert')[0].args[0]).toMatchObject({ task_id: TASK, mime: 'image/png', created_by: 'u1', name: 'foto.png' })

    m.chamadas.length = 0
    m.estado.resposta = () => ({ error: { code: '23514', message: 'Limite de 30 anexos por cartão.' } })
    expect(String((await rejeita(() => result.current.mutateAsync({ producerId: PROD, taskId: TASK, arquivo: arquivo('b.png', 'image/png') })))?.message)).toMatch('Limite de 30 anexos por cartão.')  // mensagem conhecida do nosso SQL
    const enviado = m.storage.upload.mock.calls[1][0]
    expect(m.storage.remove).toHaveBeenCalledWith([enviado])
  })

  it('42501 vira "Sem permissão"', async () => {
    m.estado.resposta = () => ({ error: { code: '42501', message: 'new row violates row-level security policy' } })
    const { result } = renderHook(() => useEnviarAnexo(), { wrapper: wrapper(novoClient()) })
    expect(String((await rejeita(() => result.current.mutateAsync({ producerId: PROD, taskId: TASK, arquivo: arquivo('b.png', 'image/png') })))?.message)).toMatch('Sem permissão')
    expect(m.storage.remove).toHaveBeenCalledTimes(1)
  })
})

describe('campos do cartão', () => {
  const tarefa = { id: 't1', producer_id: 'u1', updated_at: '2026-10-09T10:00:00Z' } as DbTask

  it('grava com o updated_at lido e guarda o novo', async () => {
    m.estado.resposta = () => ({ data: [{ id: 't1', updated_at: '2026-10-09T10:05:00Z' }] })
    const qc = novoClient()
    qc.setQueryData(['producer-tasks', 'u1'], [tarefa])
    const { result } = renderHook(() => useAtualizarCartao(), { wrapper: wrapper(qc) })
    await act(() => result.current.mutateAsync({ tarefa, campos: { cover: '#112233' } }))
    expect(feitas('producer_tasks', 'update')[0].args[0]).toEqual({ cover: '#112233' })
    expect(qc.getQueryData<DbTask[]>(['producer-tasks', 'u1'])?.[0].updated_at).toBe('2026-10-09T10:05:00Z')
  })

  it('0 linhas atualizadas = ConflitoCartao, e a tela volta ao que era', async () => {
    m.estado.resposta = () => ({ data: [] })
    const qc = novoClient()
    qc.setQueryData(['producer-tasks', 'u1'], [tarefa])
    const { result } = renderHook(() => useAtualizarCartao(), { wrapper: wrapper(qc) })
    expect(await rejeita(() => result.current.mutateAsync({ tarefa, campos: { description: 'nova' } }))).toBeInstanceOf(ConflitoCartao)
    await waitFor(() => expect(qc.getQueryData<DbTask[]>(['producer-tasks', 'u1'])?.[0].description).toBeUndefined())
  })

  it('capa inválida é recusada antes do banco', async () => {
    const { result } = renderHook(() => useAtualizarCartao(), { wrapper: wrapper(novoClient()) })
    expect(String((await rejeita(() => result.current.mutateAsync({ tarefa, campos: { cover: 'vermelho' } })))?.message)).toMatch(/capa/)
    expect(m.chamadas).toHaveLength(0)
  })
})

describe('ações do verso', () => {
  it('comentário leva as menções sem repetir e o autor; texto vazio é recusado em português', async () => {
    const { result } = renderHook(() => useAcoesCartao('t1'), { wrapper: wrapper(novoClient()) })
    await act(() => result.current.comentar.mutateAsync({ body: ' oi ', mentions: ['a', 'a', 'b'] }))
    expect(feitas('task_comments', 'insert')[0].args[0]).toEqual({ task_id: 't1', user_id: 'u1', body: 'oi', mentions: ['a', 'b'] })
    expect(String((await rejeita(() => result.current.comentar.mutateAsync({ body: '   ' })))?.message)).toMatch(/escreva alguma coisa/)
  })
})

describe('resumo: blocos e troca de ids', () => {
  it('250 cartões viram 3 consultas por tabela (blocos de 100), sem estourar o endereço', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `t${i}`)
    const { result } = renderHook(() => useResumoCartoes('b1', ids), { wrapper: wrapper(novoClient()) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(feitas('task_card_members', 'select')).toHaveLength(3)
    expect(feitas('task_comments', 'select')).toHaveLength(3)
  })

  it('quando a lista de cartões muda, o resumo anterior continua na tela até o novo chegar', async () => {
    m.estado.resposta = t => ({ data: t === 'task_card_members' ? [{ task_id: 't1', user_id: 'a' }] : [] })
    const { result, rerender } = renderHook(({ ids }) => useResumoCartoes('b1', ids), { wrapper: wrapper(novoClient()), initialProps: { ids: ['t1'] } })
    await waitFor(() => expect(result.current.data?.get('t1')?.membros).toEqual(['a']))
    rerender({ ids: ['t1', 't2'] })
    expect(result.current.data?.get('t1')?.membros).toEqual(['a']) // placeholderData: não zera
  })
})
