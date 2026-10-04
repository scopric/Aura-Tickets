import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { publicoDoPapel, validarTelefoneBR, type MensagemChat } from '../hooks/useConversas'
import ChatThread from '../components/chat/ChatThread'
import SupportChatWidget, { JanelaSuporte, SupportChatPanel } from '../components/SupportChatWidget'
import Atendimento from '../pages/admin/Atendimento'
import AdminLayout from '../components/AdminLayout'

// o jsdom não tem matchMedia; o botão de feedback do topo do admin (useIsMobile) usa
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
vi.mock('../components/ThemeToggle', () => ({ default: () => null })) // o AdminLayout usa; o tema não importa aqui
Element.prototype.scrollIntoView = vi.fn()
// som: conta quantos AudioContext o bipe cria (o construtor falha de propósito: o bipe tem de engolir)
let bipes = 0
vi.stubGlobal('AudioContext', class { constructor() { bipes++; throw new Error('sem áudio no jsdom') } })
const mem: Record<string, string> = {}
vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v }, removeItem: (k: string) => { delete mem[k] } })

// Consulta encadeável que anota cada chamada (tabela, método, argumentos) e devolve respostas[tabela]
let chamadas: { tabela: string; metodo: string; args: unknown[] }[] = []
let respostas: Record<string, unknown> = {}
function consulta(tabela: string): unknown {
  const c: unknown = new Proxy(() => {}, {
    get: (_, k) => k === 'then'
      ? (ok: (v: unknown) => unknown) => ok({ data: respostas[tabela] ?? [], error: null })
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
  respostas = { chat_topics: [{ id: 't1', label: 'Assunto de teste', hint: 'Dica do assunto', urgent: false }], chat_contacts: null }
  rpc.mockReset()
  rpc.mockImplementation((nome: string) => Promise.resolve(nome === 'chat_public_settings'
    ? { data: { aberto_agora: true, prazo: 'Respondemos em até 1 dia útil.' }, error: null }
    : { data: { ok: true, id: 'c1' }, error: null }))
  ;(supabase as unknown as { rpc: unknown }).rpc = rpc
  vi.mocked(supabase.from).mockImplementation(((tabela: string) => consulta(tabela)) as never)
  vi.mocked(supabase.channel).mockImplementation(() => canal as never)
})

const montar = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>)

const filtroDePublico = () => chamadas.find((c) => c.tabela === 'chat_topics' && c.metodo === 'eq' && c.args[0] === 'audience')?.args[1]

describe('chat: telefone do Brasil', () => {
  it('aceita só 55 + DDD sem zero + 8 ou 9 dígitos (mesma regra do servidor)', () => {
    expect(validarTelefoneBR('+5511987654321')).toBe(true)
    expect(validarTelefoneBR('+55 (21) 3456-7890')).toBe(true)
    expect(validarTelefoneBR('11987654321')).toBe(false) // sem o 55
    expect(validarTelefoneBR('+5501987654321')).toBe(false) // DDD com zero
    expect(validarTelefoneBR('+55119876543')).toBe(false) // curto (7 dígitos)
    expect(validarTelefoneBR('+351912345678')).toBe(false)
    expect(validarTelefoneBR(null)).toBe(false)
  })
})

describe('chat: assuntos por público', () => {
  it('papel da conta → público (admin e desconhecido ficam no site)', () => {
    expect(publicoDoPapel('user')).toBe('participant_evokaa')
    expect(publicoDoPapel('customer')).toBe('participant_evokaa')
    expect(publicoDoPapel('producer')).toBe('producer')
    expect(publicoDoPapel('editor')).toBe('producer')
    expect(publicoDoPapel('admin')).toBe('site')
    expect(publicoDoPapel(undefined)).toBe('site')
  })

  it.each([['producer', 'producer'], ['user', 'participant_evokaa']])('janela do Evo, papel %s → assuntos de %s', async (papel, publico) => {
    role = papel
    montar(<SupportChatPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Enviar mensagem/ }))
    expect(await screen.findByText('Assunto de teste')).toBeInTheDocument()
    expect(screen.getByText('Dica do assunto')).toBeInTheDocument()
    expect(filtroDePublico()).toBe(publico)
  })

  it('balão do site → assuntos do site, mesmo para participante logado', async () => {
    role = 'user'
    montar(<SupportChatWidget />)
    fireEvent.click(screen.getByRole('button', { name: 'Falar com a Evokaa' }))
    fireEvent.click(await screen.findByRole('button', { name: /Enviar mensagem/ }))
    await screen.findByText('Assunto de teste')
    expect(filtroDePublico()).toBe('site')
  })
})

describe('chat: atalho "Não vejo meu ingresso"', () => {
  it('a janela do participante abre direto no formulário do assunto pedido (pelo rótulo)', async () => {
    role = 'user'
    montar(<JanelaSuporte publico="participant_evokaa" posicao="" aoFechar={() => {}} assuntoInicial="Assunto de teste" />)
    expect(await screen.findByLabelText('Mensagem')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Assunto de teste' })).toBeInTheDocument()
  })
  it('rótulo que não existe mais não quebra: fica na tela inicial', async () => {
    role = 'user'
    montar(<JanelaSuporte publico="participant_evokaa" posicao="" aoFechar={() => {}} assuntoInicial="Assunto que sumiu" />)
    expect(await screen.findByRole('button', { name: /Enviar mensagem/ })).toBeInTheDocument()
    expect(screen.queryByLabelText('Mensagem')).toBeNull()
  })
})

describe('chat: formulário', () => {
  it('e-mail da conta só leitura, +55 fixo, novidades desmarcada; telefone inválido não chama o servidor', async () => {
    role = 'user'
    montar(<SupportChatPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Enviar mensagem/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Assunto de teste/ }))
    const email = await screen.findByLabelText('E-mail')
    expect(email).toHaveValue('ana@exemplo.com')
    expect(email).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'DDI do Brasil, +55' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /Quero receber novidades da Evokaa por e-mail e WhatsApp/ })).not.toBeChecked()
    expect(screen.getByText(/Seus dados são tratados conforme a/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana Souza')

    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Não recebi meu ingresso' } })
    fireEvent.change(screen.getByLabelText('Telefone (WhatsApp)'), { target: { value: '1198765' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    expect(await screen.findByText('Informe um celular ou telefone do Brasil com DDD.')).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalledWith('chat_start', expect.anything())

    rpc.mockImplementationOnce(() => Promise.resolve({ data: { ok: false, motivo: 'limite_abertas' }, error: null }))
    fireEvent.change(screen.getByLabelText('Telefone (WhatsApp)'), { target: { value: '11987654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    expect(await screen.findByText(/Você já tem 3 conversas abertas/)).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('chat_start', {
      p_topic_id: 't1', p_event_id: null, p_name: 'Ana Souza', p_phone: '5511987654321', p_marketing_opt_in: false, p_body: 'Não recebi meu ingresso',
    })
  })
})

const msg = (m: Partial<MensagemChat>): MensagemChat => ({
  id: crypto.randomUUID(), conversation_id: 'c1', sender_id: 'x', sender_role: 'customer', sender_name: 'Fulano', body: 'oi', is_internal: false,
  attachment_path: null, attachment_name: null, attachment_mime: null, attachment_size: null, created_at: '2026-09-30T12:00:00Z', ...m,
})

describe('chat: conversa (ChatThread)', () => {
  it('alternância Responder / Nota interna só para quem pode nota (agente)', async () => {
    const { unmount } = montar(<ChatThread conversaId="c1" souEquipe podeNota podeAnexar />)
    expect(screen.getByRole('button', { name: 'Nota interna' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nota interna' }))
    expect(screen.getByRole('button', { name: 'Nota interna' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /Anexar/ })).toBeNull() // nota não leva anexo
    unmount()
    montar(<ChatThread conversaId="c1" souEquipe={false} podeAnexar />)
    expect(screen.queryByRole('button', { name: 'Nota interna' })).toBeNull()
    expect(screen.getByRole('button', { name: /Anexar/ })).toBeInTheDocument()
  })

  it('selo pelo sender_role, nunca pelo nome: cliente chamado "Equipe Evokaa" continua Cliente', async () => {
    // o banco devolve da mais nova para a mais antiga (as 500 mais novas); a tela inverte
    respostas.conversation_messages = [
      msg({ sender_role: 'agent', sender_name: 'Bia', sender_id: 'a1', body: 'resposta de verdade', created_at: '2026-09-30T12:01:00Z' }),
      msg({ sender_role: 'customer', sender_name: 'Equipe Evokaa', sender_id: 'u1', body: 'sou da equipe, confia' }),
    ]
    montar(<ChatThread conversaId="c1" souEquipe podeNota podeAnexar />)
    await screen.findByText('resposta de verdade')
    const [doCliente, daEquipe] = screen.getAllByRole('listitem')
    expect(within(doCliente).getByText('Cliente')).toBeInTheDocument()
    expect(within(doCliente).queryByText('Equipe')).toBeNull()
    expect(within(daEquipe).getByText('Equipe')).toBeInTheDocument()
  })

  it('cliente nunca vê nota interna, mesmo se ela chegar da consulta; a consulta do cliente já filtra', async () => {
    respostas.conversation_messages = [msg({ sender_role: 'agent', sender_name: 'Bia', is_internal: true, body: 'nota secreta' }), msg({ body: 'minha pergunta' })]
    montar(<ChatThread conversaId="c1" souEquipe={false} podeAnexar />)
    await screen.findByText('minha pergunta')
    expect(screen.queryByText('nota secreta')).toBeNull()
    expect(chamadas).toContainEqual({ tabela: 'conversation_messages', metodo: 'eq', args: ['is_internal', false] })
  })

  it('nota interna aparece destacada e envio de nota chama chat_send com is_internal', async () => {
    respostas.conversation_messages = [msg({ sender_role: 'agent', sender_name: 'Bia', is_internal: true, body: 'cliente VIP' })]
    montar(<ChatThread conversaId="c1" souEquipe podeNota podeAnexar />)
    expect(await screen.findByText(/Nota interna · Bia/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nota interna' }))
    fireEvent.change(screen.getByLabelText('Nota interna (só a equipe vê)'), { target: { value: 'ligar amanhã' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nota interna' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('chat_send', { p_conv: 'c1', p_body: 'ligar amanhã', p_is_internal: true, p_attachment_path: null, p_attachment_name: null }))
  })

  it('erro de envio mantém o texto e oferece "Tentar de novo"', async () => {
    rpc.mockImplementationOnce(() => Promise.resolve({ data: { ok: false, motivo: 'limite_minuto' }, error: null }))
    montar(<ChatThread conversaId="c1" souEquipe={false} podeAnexar />)
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'olá' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    expect(await screen.findByText(/Muitas mensagens em pouco tempo/)).toBeInTheDocument()
    expect(screen.getByLabelText('Mensagem')).toHaveValue('olá')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(screen.getByLabelText('Mensagem')).toHaveValue(''))
  })
})

describe('chat: caixa de entrada do admin', () => {
  it('abrir conversa não lida chama chat_mark_read; desmontar remove o canal', async () => {
    role = 'admin'
    vi.mocked(supabase.channel).mockClear()
    vi.mocked(supabase.removeChannel).mockClear()
    rpc.mockImplementation((nome: string) => Promise.resolve(nome === 'chat_inbox'
      ? { data: [{ id: 'c1', user_id: null, status: 'open', priority: 'normal', assignee_id: null, department_name: 'Geral', topic_label: 'Outros', mediation: false,
          contact_name: 'Carla Dias', last_message_at: '2026-09-30T12:00:00Z', last_message_preview: 'preciso de ajuda', last_customer_message_at: '2026-09-30T12:00:00Z', last_reply_at: null, nao_lida: true }], error: null }
      : { data: { ok: true }, error: null }))
    respostas.conversations = { id: 'c1', user_id: null, status: 'open', priority: 'normal', assignee_id: null, department_id: null, customer_last_read_at: null,
      agent_last_read_at: null, last_customer_message_at: '2026-09-30T12:00:00Z', created_at: '2026-09-30T12:00:00Z', rating: null,
      chat_topics: { label: 'Outros', mediation: false }, chat_contacts: { name: 'Carla Dias', email: 'carla@exemplo.com', phone: '5511987654321', origin: 'app', marketing_opt_in: false } }
    const { unmount } = montar(<Atendimento />)
    expect(supabase.channel).toHaveBeenCalledTimes(1)
    fireEvent.click(await screen.findByRole('button', { name: /Carla Dias/ }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('chat_mark_read', { p_conv: 'c1' }))
    expect(supabase.channel).toHaveBeenCalledTimes(1) // trocar de conversa não recria o canal
    unmount()
    expect(supabase.removeChannel).toHaveBeenCalledWith(canal)
  })

  it('escolher filtro pelo menu muda a consulta; painel de detalhes abre e fecha com Esc', async () => {
    role = 'admin'
    rpc.mockImplementation((nome: string) => Promise.resolve(nome === 'chat_inbox'
      ? { data: [{ id: 'c1', user_id: null, status: 'open', priority: 'normal', assignee_id: null, department_name: 'Geral', topic_label: 'Outros', mediation: false,
          contact_name: 'Carla Dias', last_message_at: '2026-09-30T12:00:00Z', last_message_preview: 'preciso de ajuda', last_customer_message_at: '2026-09-30T12:00:00Z', last_reply_at: null, nao_lida: false }], error: null }
      : { data: { ok: true }, error: null }))
    respostas.conversations = { id: 'c1', user_id: null, status: 'open', priority: 'normal', assignee_id: null, department_id: null, customer_last_read_at: null,
      agent_last_read_at: null, last_customer_message_at: null, created_at: '2026-09-30T12:00:00Z', rating: null,
      chat_topics: { label: 'Outros', mediation: false }, chat_contacts: { name: 'Carla Dias', email: 'carla@exemplo.com', phone: null, origin: 'app', marketing_opt_in: false } }
    montar(<Atendimento />)
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('chat_inbox', expect.objectContaining({ p_filtro: 'abertas' })))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Filtro: Abertas' }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Urgentes/ }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('chat_inbox', expect.objectContaining({ p_filtro: 'urgentes' })))
    expect(screen.getByRole('button', { name: 'Filtro: Urgentes' })).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /Carla Dias/ }))
    const detalhes = await screen.findByRole('button', { name: 'Detalhes do contato' })
    expect(detalhes).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(detalhes)
    expect(detalhes).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(detalhes).toHaveAttribute('aria-expanded', 'false')
    expect(detalhes).toHaveFocus()
  })
})

describe('chat: nome de quem atende', () => {
  const conversa = (assignee_name: string | null) => ({
    id: 'c9', status: 'open', priority: 'normal', last_message_at: '2026-09-30T12:00:00Z', last_message_preview: 'oi', last_reply_at: null,
    customer_last_read_at: null, agent_last_read_at: null, rating: null, created_at: '2026-09-30T12:00:00Z', assignee_name, chat_topics: { label: 'Minha conta e acesso' },
  })
  it.each([['Ana', 'Ana está te atendendo'], [null, 'Equipe Evokaa']])('assignee_name %s → cabeçalho "%s"', async (nome, titulo) => {
    role = 'user'
    respostas.conversations = [conversa(nome)]
    montar(<SupportChatPanel />)
    fireEvent.click(await screen.findByRole('button', { name: /Minha conta e acesso/ }))
    expect(await screen.findByRole('heading', { name: titulo })).toBeInTheDocument()
    if (nome) expect(screen.getByText('Equipe Evokaa')).toBeInTheDocument()
    expect(chamadas.some((c) => c.tabela === 'conversations' && c.metodo === 'select' && String(c.args[0]).includes('assignee_name'))).toBe(true)
  })
})

describe('chat: som das mensagens', () => {
  // dispara no canal do AdminLayout uma mensagem nova (payload do Realtime)
  const chegar = (m: Record<string, unknown>) => {
    const chamada = vi.mocked(canal.on as (...a: unknown[]) => unknown).mock.calls
      .find((c) => (c[1] as { table?: string }).table === 'conversation_messages')
    ;(chamada![2] as (p: unknown) => void)({ new: m })
  }
  beforeEach(() => {
    role = 'admin'
    bipes = 0
    delete mem['evokaa-som-chat']
    vi.mocked(canal.on as (...a: unknown[]) => unknown).mockClear()
  })

  it('admin, em qualquer página: mensagem de cliente toca; a própria, nota interna e resposta da equipe não', () => {
    montar(<AdminLayout />)
    chegar({ sender_role: 'customer', is_internal: false, sender_id: 'cliente-1', bot_state: 'humano' })
    expect(bipes).toBe(1)
    chegar({ sender_role: 'customer', is_internal: false, sender_id: 'u1', bot_state: 'humano' }) // o próprio admin como cliente
    chegar({ sender_role: 'agent', is_internal: false, sender_id: 'a2', bot_state: 'humano' })
    chegar({ sender_role: 'customer', is_internal: true, sender_id: 'cliente-1', bot_state: 'humano' })
    expect(bipes).toBe(1)
  })

  it('som desligado no botão: nada toca, e a escolha fica guardada', async () => {
    montar(<><AdminLayout /><Atendimento /></>)
    const botao = screen.getByRole('button', { name: 'Som das mensagens' })
    expect(botao).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(botao)
    expect(botao).toHaveAttribute('aria-pressed', 'false')
    expect(mem['evokaa-som-chat']).toBe('off')
    chegar({ sender_role: 'customer', is_internal: false, sender_id: 'cliente-1', bot_state: 'humano' })
    expect(bipes).toBe(0)
  })

  it('participante não tem o canal do admin', () => {
    role = 'user'
    montar(<AdminLayout />)
    expect(vi.mocked(canal.on as (...a: unknown[]) => unknown).mock.calls.some((c) => (c[1] as { table?: string }).table === 'conversation_messages')).toBe(false)
  })
})
