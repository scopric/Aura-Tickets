import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import Conhecimento from '../pages/admin/Conhecimento'

// /admin/conhecimento (etapa 3, PR 3a): artigos, dicionário, perguntas sem resposta, interruptor do assistente.

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'admin', admin_permissions: ['manage_support'] } }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

let chamadas: { tabela: string; metodo: string; args: unknown[] }[] = []
let respostas: Record<string, unknown> = {}
function consulta(tabela: string): unknown {
  const c: unknown = new Proxy(() => {}, {
    get: (_, k) => k === 'then'
      ? (ok: (v: unknown) => unknown) => ok({ data: typeof respostas[tabela] === 'function' ? (respostas[tabela] as () => unknown)() : respostas[tabela] ?? [], error: null })
      : (...args: unknown[]) => { chamadas.push({ tabela, metodo: String(k), args }); return c },
  })
  return c
}
const rpc = vi.fn()

const artigo = (a: Record<string, unknown>) => ({
  id: crypto.randomUUID(), slug: null, title: 'Título', body: 'Corpo do artigo', keywords: '', audience: 'all', department_id: null,
  status: 'published', origin: 'manual', review_note: null, updated_at: '2026-09-30T12:00:00Z', ...a,
})

beforeEach(() => {
  chamadas = []
  respostas = {
    kb_articles: [
      artigo({ id: 'a1', slug: 'lev-a03', title: 'Esqueci minha senha. Como recupero?', keywords: 'recuperar senha', origin: 'seed' }),
      artigo({ id: 'a2', slug: 'lev-a15', title: 'Como cancelo meu ingresso ou peço reembolso?', status: 'draft', origin: 'seed', audience: 'participant', review_note: 'Não há reembolso real sem gateway.' }),
    ],
    chat_departments: [{ id: 'd1', name: 'Suporte técnico' }],
    chat_settings: { bot_enabled: true },
    kb_perguntas_sem_resposta: [{ id: 'p1', texto: 'qdo abre o portao', audience: 'participant', vezes: 3, ultima_em: '2026-09-30T12:00:00Z' }],
    kb_termos: [{ id: 't1', forma: 'vc', normal: 'você' }],
  }
  rpc.mockReset()
  rpc.mockImplementation(() => Promise.resolve({ data: { ok: true }, error: null }))
  ;(supabase as unknown as { rpc: unknown }).rpc = rpc
  vi.mocked(supabase.from).mockImplementation(((tabela: string) => consulta(tabela)) as never)
  vi.mocked(toast.error).mockClear()
  vi.mocked(toast.success).mockClear()
})

const montar = (rota = '/admin/conhecimento') =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[rota]}><Conhecimento /></MemoryRouter></QueryClientProvider>)
const de = (tabela: string, metodo: string) => chamadas.filter((c) => c.tabela === tabela && c.metodo === metodo)

describe('conhecimento: artigos', () => {
  it('lista com situação, busca e filtro; rascunho mostra o motivo no editor', async () => {
    montar()
    expect(await screen.findByText('Esqueci minha senha. Como recupero?')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Artigos (1 publicados)' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'draft' } })
    expect(screen.queryByText('Esqueci minha senha. Como recupero?')).toBeNull()
    expect(screen.getByText('Como cancelo meu ingresso ou peço reembolso?')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'todos' } })
    fireEvent.change(screen.getByLabelText('Buscar artigos'), { target: { value: 'RECUPERAR' } })
    expect(screen.getByText('Esqueci minha senha. Como recupero?')).toBeInTheDocument()
    expect(screen.queryByText('Como cancelo meu ingresso ou peço reembolso?')).toBeNull()
    fireEvent.change(screen.getByLabelText('Buscar artigos'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Editar artigo Como cancelo meu ingresso ou peço reembolso?' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar artigo' })
    expect(within(dialogo).getByText(/Não há reembolso real sem gateway/)).toBeInTheDocument()
    expect(within(dialogo).getByRole('checkbox', { name: /Publicado/ })).not.toBeChecked()
  })

  it('novo artigo: grava com .select("id"), origem manual e autor; zero linhas vira erro', async () => {
    montar()
    await screen.findByText('Esqueci minha senha. Como recupero?')
    fireEvent.click(screen.getByRole('button', { name: 'Novo artigo' }))
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Que horas abre o portão?' } })
    fireEvent.change(screen.getByLabelText(/Resposta/), { target: { value: 'O portão abre no horário da página do evento.' } })
    expect(screen.getByText('45 / 3.500')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Publicado/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar artigo' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Artigo criado.'))
    expect(de('kb_articles', 'insert')[0].args[0]).toMatchObject({
      title: 'Que horas abre o portão?', status: 'published', origin: 'manual', created_by: 'u1', source_conversation_id: null,
    })
    expect(de('kb_articles', 'select').some((c) => c.args[0] === 'id')).toBe(true)

    respostas.kb_articles = []  // RLS barrou: zero linhas
    fireEvent.click(screen.getByRole('button', { name: 'Novo artigo' }))
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Outro título' } })
    fireEvent.change(screen.getByLabelText(/Resposta/), { target: { value: 'Outro corpo qualquer.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar artigo' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não foi possível salvar: Nada foi gravado (sem permissão ou artigo inexistente).'))
    expect(screen.getByRole('dialog', { name: 'Novo artigo' })).toBeInTheDocument()
  })

  it('título curto não chama o banco', async () => {
    montar()
    await screen.findByText('Esqueci minha senha. Como recupero?')
    fireEvent.click(screen.getByRole('button', { name: 'Novo artigo' }))
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Oi' } })
    fireEvent.change(screen.getByLabelText(/Resposta/), { target: { value: 'Corpo com tamanho bom.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar artigo' }))
    expect(toast.error).toHaveBeenCalledWith('Título: de 5 a 160 caracteres.')
    expect(de('kb_articles', 'insert')).toHaveLength(0)
  })

  it('excluir: modal próprio (nunca window.confirm) e delete com .select("id")', async () => {
    const confirmar = vi.spyOn(window, 'confirm')
    montar()
    await screen.findByText('Esqueci minha senha. Como recupero?')
    fireEvent.click(screen.getByRole('button', { name: 'Excluir artigo Esqueci minha senha. Como recupero?' }))
    const dialogo = screen.getByRole('dialog', { name: 'Excluir' })
    expect(within(dialogo).getByText(/não volta, mesmo se a carga inicial rodar de novo/)).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar exclusão' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Excluído.'))
    expect(confirmar).not.toHaveBeenCalled()
    expect(de('kb_articles', 'delete')).toHaveLength(1)
    expect(chamadas).toContainEqual({ tabela: 'kb_articles', metodo: 'eq', args: ['id', 'a1'] })
  })

  it('interruptor do assistente chama chat_bot_ligar', async () => {
    montar()
    expect(await screen.findByText('Assistente no atendimento: ligado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('chat_bot_ligar', { p_ligado: false }))
  })

  it('"Virar artigo": ?mensagem= abre o editor com a resposta do atendente', async () => {
    respostas.conversation_messages = { id: 'm1', conversation_id: 'c7', body: 'O ingresso aparece em Meus Ingressos.', sender_role: 'agent', is_internal: false }
    montar('/admin/conhecimento?mensagem=m1')
    const dialogo = await screen.findByRole('dialog', { name: 'Artigo a partir da resposta do atendente' })
    expect(within(dialogo).getByLabelText(/Resposta/)).toHaveValue('O ingresso aparece em Meus Ingressos.')
    fireEvent.change(within(dialogo).getByLabelText(/Título/), { target: { value: 'Onde fica meu ingresso?' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar artigo' }))
    await waitFor(() => expect(de('kb_articles', 'insert')[0]?.args[0]).toMatchObject({ origin: 'atendente', source_conversation_id: 'c7', status: 'draft' }))
  })
})

describe('conhecimento: dicionário e perguntas sem resposta', () => {
  it('forma é gravada minúscula e sem acento', async () => {
    montar()
    fireEvent.click(screen.getByRole('tab', { name: 'Dicionário' }))
    expect(await screen.findByText('vc')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nova forma' }))
    fireEvent.change(screen.getByLabelText(/Forma/), { target: { value: 'Ñ!' } })
    expect(screen.getByText('Guardada como “n”: minúscula, sem acento e sem espaço.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Quer dizer *'), { target: { value: 'não' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(de('kb_termos', 'insert')[0]?.args[0]).toEqual({ forma: 'n', normal: 'não' }))
  })

  it('pergunta sem resposta: "Criar artigo" preenche e, ao salvar, tira a pergunta da lista', async () => {
    montar()
    fireEvent.click(await screen.findByRole('tab', { name: 'Perguntas sem resposta (1)' }))
    expect(screen.getByText('qdo abre o portao')).toBeInTheDocument()
    expect(screen.getByText(/3 vezes/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Criar artigo para: qdo abre o portao' }))
    expect(screen.getByLabelText(/Palavras-chave/)).toHaveValue('qdo abre o portao')
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: 'Que horas abre o portão?' } })
    fireEvent.change(screen.getByLabelText(/Resposta/), { target: { value: 'No horário da página do evento.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar artigo' }))
    await waitFor(() => expect(de('kb_perguntas_sem_resposta', 'delete')).toHaveLength(1))
    expect(chamadas).toContainEqual({ tabela: 'kb_perguntas_sem_resposta', metodo: 'eq', args: ['id', 'p1'] })
  })

  it('"Acrescentar ao dicionário" abre a forma com a 1ª palavra', async () => {
    montar()
    fireEvent.click(await screen.findByRole('tab', { name: 'Perguntas sem resposta (1)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Acrescentar ao dicionário: qdo abre o portao' }))
    expect(screen.getByLabelText(/Forma/)).toHaveValue('qdo')
  })
})
