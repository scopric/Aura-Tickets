import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MensagemChat } from '../hooks/useConversas'
import ChatThread from '../components/chat/ChatThread'
import { SupportChatPanel } from '../components/SupportChatWidget'
import Atendimento from '../pages/admin/Atendimento'
import AdminLayout from '../components/AdminLayout'

// Assistente do chat (etapa 3, PR 3a): "Isso resolveu?", passagem para a equipe, rótulos e bipe só humano.

if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

let role = 'user'
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({
  user: { id: 'u1', role, email: 'ana@exemplo.com', full_name: 'Ana Souza', phone: null, admin_permissions: role === 'admin' ? ['manage_support'] : [] },
  logout: vi.fn(),
}) }))
vi.mock('../components/ThemeToggle', () => ({ default: () => null }))
Element.prototype.scrollIntoView = vi.fn()
let bipes = 0
vi.stubGlobal('AudioContext', class { constructor() { bipes++; throw new Error('sem áudio no jsdom') } })
const mem: Record<string, string> = {}
vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } })

let chamadas: { tabela: string; metodo: string; args: unknown[] }[] = []
let respostas: Record<string, unknown> = {}
function consulta(tabela: string): unknown {
  const c: unknown = new Proxy(() => {}, {
    get: (_, k) => k === 'then'
      ? (ok: (v: unknown) => unknown) => ok({ data: respostas[tabela] ?? [], error: null, count: 0 })
      : (...args: unknown[]) => { chamadas.push({ tabela, metodo: String(k), args }); return c },
  })
  return c
}
const rpc = vi.fn()
const canal: Record<string, unknown> = {}
canal.on = vi.fn(() => canal)
canal.subscribe = vi.fn(() => canal)

beforeEach(() => {
  chamadas = []
  respostas = {}
  rpc.mockReset()
  rpc.mockImplementation(() => Promise.resolve({ data: { ok: true }, error: null }))
  ;(supabase as unknown as { rpc: unknown }).rpc = rpc
  vi.mocked(supabase.from).mockImplementation(((tabela: string) => consulta(tabela)) as never)
  vi.mocked(supabase.channel).mockImplementation(() => canal as never)
})

const montar = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>)

const msg = (m: Partial<MensagemChat>): MensagemChat => ({
  id: crypto.randomUUID(), conversation_id: 'c1', sender_id: 'x', sender_role: 'customer', sender_name: 'Fulano', body: 'oi', is_internal: false,
  attachment_path: null, attachment_name: null, attachment_mime: null, attachment_size: null, bot_layer: null, created_at: '2026-09-30T12:00:00Z', ...m,
})
// o banco devolve da mais nova para a mais antiga; a tela inverte
const bot = (body: string, bot_layer: number | null = 1) => msg({ sender_role: 'bot', sender_id: null, sender_name: 'Assistente Evokaa', body, bot_layer, created_at: '2026-09-30T12:00:01Z' })

describe('assistente: "Isso resolveu?"', () => {
  it('aparece abaixo da última resposta do assistente; Sim chama chat_bot_feedback', async () => {
    respostas.conversation_messages = [bot('Esqueci minha senha. Como recupero?\n\nNa tela de entrar…'), msg({ body: 'esqueci minha senha' })]
    montar(<ChatThread conversaId="c1" souEquipe={false} podeAnexar assistente />)
    const grupo = await screen.findByRole('group', { name: 'Isso resolveu?' })
    expect(within(grupo).getByText('Isso resolveu?')).toBeInTheDocument()
    expect(screen.getByText('Assistente Evokaa')).toBeInTheDocument()
    expect(screen.getByText('Assistente')).toBeInTheDocument() // selo pelo sender_role
    fireEvent.click(within(grupo).getByRole('button', { name: 'Sim' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('chat_bot_feedback', { p_conv: 'c1', p_resolveu: true }))
  })

  it('Não chama chat_bot_feedback com falso', async () => {
    respostas.conversation_messages = [bot('Resposta'), msg({ body: 'pergunta' })]
    montar(<ChatThread conversaId="c1" souEquipe={false} podeAnexar assistente />)
    fireEvent.click(within(await screen.findByRole('group', { name: 'Isso resolveu?' })).getByRole('button', { name: 'Não' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('chat_bot_feedback', { p_conv: 'c1', p_resolveu: false }))
  })

  it('não aparece na cortesia, fora do assistente, para a equipe nem se o cliente escreveu depois', async () => {
    respostas.conversation_messages = [bot('Oi! Tudo bem? Como posso ajudar?', null), msg({ body: 'oi' })]
    const a = montar(<ChatThread conversaId="c1" souEquipe={false} podeAnexar assistente />)
    await screen.findByText('Oi! Tudo bem? Como posso ajudar?')
    expect(screen.queryByText('Isso resolveu?')).toBeNull()
    a.unmount()
    respostas.conversation_messages = [bot('Resposta')]
    const b = montar(<ChatThread conversaId="c1" souEquipe={false} podeAnexar />)
    await screen.findByText('Resposta')
    expect(screen.queryByText('Isso resolveu?')).toBeNull()
    b.unmount()
    const c = montar(<ChatThread conversaId="c1" souEquipe podeNota podeAnexar assistente />)
    await screen.findByText('Resposta')
    expect(screen.queryByText('Isso resolveu?')).toBeNull()
    c.unmount()
    respostas.conversation_messages = [msg({ body: 'outra coisa', created_at: '2026-09-30T12:00:02Z' }), bot('Resposta')]
    montar(<ChatThread conversaId="c1" souEquipe={false} podeAnexar assistente />)
    await screen.findByText('outra coisa')
    expect(screen.queryByText('Isso resolveu?')).toBeNull()
  })
})

describe('assistente: rótulos da conversa', () => {
  it('mensagem do sistema centralizada, sem selo nem avatar', async () => {
    respostas.conversation_messages = [msg({ sender_role: 'system', sender_id: null, sender_name: 'Evokaa', body: 'Vou passar sua conversa para um atendente humano.', created_at: '2026-09-30T12:00:02Z' }), msg({ body: 'quero uma pessoa' })]
    montar(<ChatThread conversaId="c1" souEquipe={false} podeAnexar />)
    const aviso = await screen.findByText('Vou passar sua conversa para um atendente humano.')
    expect(aviso.closest('li')).toHaveClass('text-center')
    expect(screen.queryByText('Sistema')).toBeNull()
  })

  it('"Virar artigo" só na resposta pública de atendente, só para a equipe', async () => {
    const resposta = msg({ id: 'm-ag', sender_role: 'agent', sender_id: 'a1', sender_name: 'Bia', body: 'O ingresso fica em Meus Ingressos.', created_at: '2026-09-30T12:00:02Z' })
    respostas.conversation_messages = [
      msg({ sender_role: 'agent', sender_id: 'a1', sender_name: 'Bia', body: 'nota', is_internal: true, created_at: '2026-09-30T12:00:03Z' }),
      resposta, msg({ body: 'cadê meu ingresso' }),
    ]
    const a = montar(<ChatThread conversaId="c1" souEquipe podeNota podeAnexar />)
    await screen.findByText('O ingresso fica em Meus Ingressos.')
    const links = screen.getAllByRole('link', { name: /Virar artigo/ })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/admin/conhecimento?mensagem=m-ag')
    a.unmount()
    montar(<ChatThread conversaId="c1" souEquipe={false} podeAnexar />)
    await screen.findByText('O ingresso fica em Meus Ingressos.')
    expect(screen.queryByRole('link', { name: /Virar artigo/ })).toBeNull()
  })
})

describe('assistente: widget do cliente', () => {
  const conversa = (extra: Record<string, unknown>) => ({
    id: 'c9', status: 'open', priority: 'normal', last_message_at: '2026-09-30T12:00:00Z', last_message_preview: 'oi', last_reply_at: null,
    customer_last_read_at: null, agent_last_read_at: null, rating: null, created_at: '2026-09-30T12:00:00Z', assignee_name: null,
    bot_state: 'bot', bot_resolveu: false, chat_topics: { label: 'Minha conta e acesso' }, ...extra,
  })

  it('com o assistente: cabeçalho "Assistente Evokaa" e "Falar com um atendente" chama chat_handoff', async () => {
    role = 'user'
    respostas.conversations = [conversa({})]
    montar(<SupportChatPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Minha conta e acesso/ }))
    expect(await screen.findByRole('heading', { name: 'Assistente Evokaa' })).toBeInTheDocument()
    expect(screen.getByText('assistente virtual')).toBeInTheDocument()
    expect(screen.getByLabelText('Mensagem para o assistente Evokaa')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Falar com um atendente' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('chat_handoff', { p_conv: 'c9' }))
    expect(chamadas.some((c) => c.tabela === 'conversations' && c.metodo === 'select' && String(c.args[0]).includes('bot_state')
      && String(c.args[0]).includes('bot_resolveu'))).toBe(true)
  })

  it('resolvida pelo assistente: sem avaliação de 1 a 3 e sem o botão de atendente', async () => {
    role = 'user'
    respostas.conversations = [conversa({ status: 'resolved', bot_resolveu: true })]
    montar(<SupportChatPanel />)
    expect(await screen.findByText('Resolvida pelo assistente')).toBeInTheDocument() // selo na lista
    fireEvent.click(screen.getByRole('button', { name: /Minha conta e acesso/ }))
    expect(await screen.findByRole('heading', { name: 'Equipe Evokaa' })).toBeInTheDocument()
    expect(screen.getAllByText('Resolvida pelo assistente').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Ótimo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Falar com um atendente' })).toBeNull()
  })

  it('do assistente, fechada pelo cron ou pela equipe (sem o "Sim"): sem selo e sem avaliação', async () => {
    role = 'user'
    respostas.conversations = [conversa({ status: 'resolved' })]
    montar(<SupportChatPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Minha conta e acesso/ }))
    expect(await screen.findByRole('heading', { name: 'Equipe Evokaa' })).toBeInTheDocument()
    expect(screen.queryByText('Resolvida pelo assistente')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ótimo' })).toBeNull()
  })

  it('resolvida com a equipe e selo antigo (bot_resolveu): na lista, só "Resolvida"', async () => {
    role = 'user'
    respostas.conversations = [conversa({ status: 'resolved', bot_state: 'humano', bot_resolveu: true })]
    montar(<SupportChatPanel />)
    expect(await screen.findByText('Resolvida')).toBeInTheDocument()
    expect(screen.queryByText('Resolvida pelo assistente')).toBeNull()
  })

  it('com a equipe: cabeçalho de sempre, sem o botão de atendente', async () => {
    role = 'user'
    respostas.conversations = [conversa({ bot_state: 'humano', assignee_name: 'Bia' })]
    montar(<SupportChatPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Minha conta e acesso/ }))
    expect(await screen.findByRole('heading', { name: 'Bia está te atendendo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Falar com um atendente' })).toBeNull()
  })
})

describe('assistente: caixa de entrada e menu do admin', () => {
  it('filtro "Com o assistente" chama chat_inbox com "assistente" e mostra o selo', async () => {
    role = 'admin'
    rpc.mockImplementation((nome: string, args: { p_filtro?: string }) => Promise.resolve(nome === 'chat_inbox' && args.p_filtro === 'assistente'
      ? { data: [{ id: 'c1', user_id: null, status: 'open', priority: 'normal', assignee_id: null, department_name: 'Geral', topic_label: 'Outros', mediation: false,
          contact_name: 'Carla Dias', last_message_at: '2026-09-30T12:00:00Z', last_message_preview: 'oi', last_customer_message_at: '2026-09-30T12:00:00Z',
          last_reply_at: null, nao_lida: false, bot_state: 'bot', handoff_at: null }], error: null }
      : { data: [], error: null }))
    montar(<Atendimento />)
    fireEvent.keyDown(await screen.findByRole('button', { name: /^Filtro:/ }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Com o assistente/ }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('chat_inbox', { p_filtro: 'assistente', p_busca: '', p_limite: 100 }))
    const linha = await screen.findByRole('button', { name: /Carla Dias/ })
    expect(within(linha).getByText('Assistente')).toBeInTheDocument()
    expect(within(linha).queryByText('Sem dono')).toBeNull()
  })

  it('"Resolvida pelo assistente" só com o selo (Sim do cliente); sem ele, "Assistente"', async () => {
    role = 'admin'
    const linha = (id: string, contact_name: string, bot_resolveu: boolean) => ({ id, user_id: null, status: 'resolved', priority: 'normal', assignee_id: null,
      department_name: null, topic_label: 'Outros', mediation: false, contact_name, last_message_at: '2026-09-30T12:00:00Z', last_message_preview: 'oi',
      last_customer_message_at: '2026-09-30T12:00:00Z', last_reply_at: null, nao_lida: false, bot_state: 'bot', handoff_at: null, bot_resolveu })
    rpc.mockImplementation((nome: string, args: { p_filtro?: string }) => Promise.resolve(nome === 'chat_inbox' && args.p_filtro === 'resolvidas'
      ? { data: [linha('c1', 'Carla Dias', true), linha('c2', 'Bruno Reis', false)], error: null }
      : { data: [], error: null }))
    respostas.conversations = { id: 'c2', user_id: null, status: 'resolved', priority: 'normal', assignee_id: null, assignee_name: null, department_id: null,
      customer_last_read_at: null, agent_last_read_at: null, last_customer_message_at: null, created_at: '2026-09-30T12:00:00Z', rating: null,
      bot_state: 'bot', bot_resolveu: false, chat_topics: { label: 'Outros', mediation: false }, chat_contacts: { name: 'Bruno Reis', email: null, phone: null, origin: 'app', marketing_opt_in: false } }
    montar(<Atendimento />)
    fireEvent.keyDown(await screen.findByRole('button', { name: /^Filtro:/ }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Resolvidas/ }))
    const carla = await screen.findByRole('button', { name: /Carla Dias/ })
    expect(within(carla).getByText('Resolvida pelo assistente')).toBeInTheDocument()
    const bruno = screen.getByRole('button', { name: /Bruno Reis/ })
    expect(within(bruno).getByText('Assistente')).toBeInTheDocument()
    expect(within(bruno).queryByText('Resolvida pelo assistente')).toBeNull()
    // cabeçalho da conversa fechada pela equipe ou pelo cron: "Resolvida", sem "pelo assistente"
    fireEvent.click(bruno)
    const cab = await screen.findByRole('heading', { name: 'Bruno Reis' })
    expect(cab.nextElementSibling?.textContent).toMatch(/Outros · Resolvida/)
    expect(cab.nextElementSibling?.textContent).not.toMatch(/pelo assistente/)
    expect(chamadas.some((c) => c.tabela === 'conversations' && c.metodo === 'select' && String(c.args[0]).includes('bot_resolveu'))).toBe(true)
  })

  it('contador e bipe só de conversa com a equipe: cliente com o assistente não toca; passagem toca', () => {
    role = 'admin'
    bipes = 0
    delete mem['evokaa-som-chat']
    vi.mocked(canal.on as (...a: unknown[]) => unknown).mockClear()
    montar(<AdminLayout />)
    const chamada = vi.mocked(canal.on as (...a: unknown[]) => unknown).mock.calls.find((c) => (c[1] as { table?: string }).table === 'conversation_messages')!
    expect((chamada[1] as { filter?: string }).filter).toBe('bot_state=eq.humano')
    const chegar = (m: Record<string, unknown>) => (chamada[2] as (p: unknown) => void)({ new: m })
    chegar({ sender_role: 'customer', is_internal: false, sender_id: 'cliente-1', bot_state: 'bot' })
    chegar({ sender_role: 'bot', is_internal: false, sender_id: null, bot_state: 'humano' })
    expect(bipes).toBe(0)
    chegar({ sender_role: 'system', is_internal: false, sender_id: null, bot_state: 'humano' })
    expect(bipes).toBe(1)
    chegar({ sender_role: 'customer', is_internal: false, sender_id: 'cliente-1', bot_state: 'humano' })
    expect(bipes).toBe(2)
    expect(chamadas).toContainEqual({ tabela: 'conversations', metodo: 'eq', args: ['bot_state', 'humano'] })
    expect(screen.getByRole('link', { name: /Conhecimento/ })).toHaveAttribute('href', '/admin/conhecimento')
  })
})
