import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, renderHook, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerTasks from '../pages/producer/Tasks'
import CartaoVerso from '../components/producer/quadro/CartaoVerso'
import { EscolhaLocal } from '../components/producer/quadro/CartaoEscolhas'
import LocalRota from '../components/producer/quadro/LocalRota'
import RoteiroLocais from '../components/producer/quadro/RoteiroLocais'
import { PrefsAvisos } from '../components/producer/quadro/AvisosQuadro'
import { Tique } from '../components/producer/quadro/Recibos'
import { RESUMO_VAZIO } from '../hooks/useCartao'
import { estadoDaMensagem, prefsDaLinha, useBipeAvisos, useMarcarEntregue, useMarcarLido, PREFS_PADRAO } from '../hooks/useQuadroAvisos'
import type { DbNotification } from '../hooks/useNotifications'
import type { ColunaQuadro, DbTask } from '../hooks/useProducerTools'
import { _zerarAudio } from '../lib/quadroBipe'

// Banco simulado por tabela: cada from(tabela) devolve um construtor encadeável que registra a chamada; rpc é um vi.fn
const m = vi.hoisted(() => {
  type Resp = { data?: unknown; error?: unknown }
  const chamadas: { tabela: string; op: string; args: unknown[]; filtros: [string, ...unknown[]][] }[] = []
  const tabelas: Record<string, (op: string, filtros: [string, ...unknown[]][]) => Resp> = {}
  const rpcs: Record<string, () => Resp> = {}
  const from = (tabela: string) => {
    let op = 'select'
    let args: unknown[] = []
    const filtros: [string, ...unknown[]][] = []
    const b: Record<string, unknown> = new Proxy({}, {
      get: (_, k: string) => {
        if (k === 'then') return (res: (v: unknown) => void) => { chamadas.push({ tabela, op, args, filtros }); res({ data: [], error: null, ...(tabelas[tabela]?.(op, filtros) ?? {}) }) }
        return (...a: unknown[]) => { if (['insert', 'update', 'delete', 'upsert'].includes(k)) { op = k; args = a } else filtros.push([k, ...a]); return b }
      },
    })
    return b
  }
  const rpc = vi.fn((nome: string) => Promise.resolve({ data: [], error: null, ...(rpcs[nome]?.() ?? {}) }))
  return { chamadas, tabelas, rpcs, from, rpc, toast: { error: vi.fn(), success: vi.fn() }, carregouMapa: vi.fn() }
})
vi.mock('../lib/supabase', () => ({
  supabase: { from: m.from, rpc: m.rpc, storage: { from: () => ({ upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() }) } },
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Ricardo', email: 'r@x.com' } }) }))
vi.mock('../hooks/useEvents', () => ({ useProducerEvents: () => ({ data: [{ id: 'e1', title: 'Festa Um' }], isPending: false, isError: false }) }))
vi.mock('sonner', () => ({ toast: m.toast }))
vi.mock('../components/producer/quadro/MapaCartao', () => { m.carregouMapa(); return { default: ({ lat, lng }: { lat: number; lng: number }) => <div data-testid="mapa">{lat},{lng}</div> } })

const feitas = (tabela: string, op: string) => m.chamadas.filter(c => c.tabela === tabela && c.op === op)
const rpcsDe = (nome: string) => m.rpc.mock.calls.filter(c => c[0] === nome)
const novoQc = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

const aviso = (id: string, o: Partial<DbNotification> = {}): DbNotification => ({
  id, user_id: 'u1', title: `Aviso ${id}`, body: null, type: 'info', is_read: false, created_at: '2026-10-09T12:00:00Z',
  metadata: { kind: 'quadro', tipo: 'mencao', task_id: 't1', board_id: 'b1', url: '/producer/tasks?cartao=t1' }, ...o,
})
const tarefa = (o: Partial<DbTask> = {}): DbTask => ({
  id: 't1', producer_id: 'u1', event_id: 'e1', assigned_to: null, title: 'Contratar som', description: null, due_date: null, status: 'todo', priority: 'medium',
  created_at: '2026-10-01T00:00:00Z', updated_at: 'v0', board_id: 'b1', column_id: 'c1', position: 1000, ...o,
} as DbTask)
const colunas: ColunaQuadro[] = [{ id: 'c1', name: 'A fazer', kind: 'todo' }, { id: 'c2', name: 'Feito', kind: 'done' }]

/** Banco com o SQL da fatia 1, 2A e 2B aplicado; cada teste muda o que precisa */
function bancoNovo(over: Record<string, (op: string, filtros: [string, ...unknown[]][]) => { data?: unknown; error?: unknown }> = {}, tarefas: DbTask[] = [tarefa()]) {
  m.tabelas.producer_tasks = () => ({ data: tarefas })
  m.tabelas.task_columns = () => ({ data: colunas })
  m.tabelas.task_boards = op => (op === 'update' ? { data: [{ id: 'b1' }] } : { data: { show_receipts: true, producer_id: 'u1' } })
  m.tabelas.task_notification_prefs = () => ({ data: null })
  m.tabelas.notifications = op => (op === 'update' ? { data: [{ id: 'a1' }] } : { data: [] })
  Object.assign(m.tabelas, over)
  m.rpcs.quadro_garantir = () => ({ data: 'b1' })
}

function Local() { return <span data-testid="url">{useLocation().pathname + useLocation().search}</span> }
function montarTasks(url = '/producer/tasks?eventId=e1') {
  render(<QueryClientProvider client={novoQc()}><MemoryRouter initialEntries={[url]}><ProducerTasks /><Local /></MemoryRouter></QueryClientProvider>)
}
const verQuadro = async () => fireEvent.click(await screen.findByRole('button', { name: 'Ver em quadro' }))

beforeEach(() => {
  for (const k of Object.keys(m.tabelas)) delete m.tabelas[k]
  for (const k of Object.keys(m.rpcs)) delete m.rpcs[k]
})
afterEach(() => { cleanup(); m.chamadas.length = 0; m.rpc.mockClear(); vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('sem o SQL da 2B (modo antigo)', () => {
  it('nada novo aparece e nenhuma função do banco é chamada', async () => {
    bancoNovo({
      task_notification_prefs: () => ({ data: null, error: { code: 'PGRST205', message: 'tabela não existe' } }),
      task_boards: () => ({ data: null, error: { code: '42703', message: 'coluna show_receipts não existe' } }),
    })
    montarTasks()
    await verQuadro()
    expect(await screen.findByRole('group', { name: 'Quadro de tarefas' })).toBeInTheDocument()
    await waitFor(() => expect(feitas('task_notification_prefs', 'select').length).toBeGreaterThan(0))
    expect(screen.queryByRole('button', { name: /Avisos do quadro/ })).toBeNull()
    expect(screen.queryByText('aviso novo')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Menu do quadro' }))
    expect(screen.getByRole('button', { name: 'Roteiro com locais' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Notificações e sons' })).toBeNull()
    expect(screen.queryByText('Mostrar quem viu')).toBeNull()
    expect(rpcsDe('quadro_marcar_entregue')).toHaveLength(0)
    expect(rpcsDe('quadro_marcar_lido')).toHaveLength(0)
  })
})

describe('sino do quadro', () => {
  const avisos = [aviso('a1'), aviso('a2', { metadata: { kind: 'quadro', tipo: 'prazo', task_id: 't1', url: '/producer/tasks?cartao=t1' } }),
    aviso('x9', { title: 'Venda aprovada', metadata: { url: '/producer/sales' } }), aviso('a3', { is_read: true })]

  it('conta só os avisos do quadro não lidos, marca um como lido e abre o cartão pelo link', async () => {
    bancoNovo({ notifications: op => (op === 'update' ? { data: [{ id: 'a1' }] } : { data: avisos }) })
    montarTasks()
    await verQuadro()
    const sino = await screen.findByRole('button', { name: 'Avisos do quadro, 2 não lidos' })
    fireEvent.click(sino)
    expect(screen.queryByText('Venda aprovada')).toBeNull() // aviso de outra área não entra
    fireEvent.click(await screen.findByRole('button', { name: /Aviso a1/ }))
    await waitFor(() => expect(feitas('notifications', 'update').length).toBeGreaterThan(0))
    const up = feitas('notifications', 'update').find(u => u.filtros.some(f => f[0] === 'eq' && f[1] === 'id'))!
    expect(up.args[0]).toEqual({ is_read: true })
    expect(up.filtros).toContainEqual(['eq', 'id', 'a1'])
    // o link do aviso leva ao cartão: o verso abre e o parâmetro some da URL
    expect(await screen.findByRole('dialog', { name: /Cartão: Contratar som/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('url').textContent).not.toContain('cartao='))
  })

  it('"Marcar todos como lidos" marca só os avisos do quadro que estão sem ler', async () => {
    bancoNovo({ notifications: op => (op === 'update' ? { data: [] } : { data: avisos }) })
    montarTasks()
    await verQuadro()
    fireEvent.click(await screen.findByRole('button', { name: /Avisos do quadro, 2/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todos como lidos' }))
    await waitFor(() => expect(feitas('notifications', 'update')).toHaveLength(1))
    expect(feitas('notifications', 'update')[0].filtros).toContainEqual(['in', 'id', ['a1', 'a2']])
  })

  it('60 avisos de outras áreas mais novos não escondem os do quadro (filtro no banco)', async () => {
    const outros = Array.from({ length: 60 }, (_, i) => aviso(`o${i}`, { title: `Outro ${i}`, created_at: `2026-10-09T13:${String(i).padStart(2, '0')}:00Z`, metadata: { url: '/producer/sales' } }))
    const dados = [...outros, aviso('a1', { created_at: '2026-10-08T10:00:00Z' }), aviso('a2', { created_at: '2026-10-08T09:00:00Z' })]
    bancoNovo({ notifications: (op, filtros) => {
      if (op === 'update') return { data: [{ id: 'a1' }] }
      const filtrado = filtros.some(f => f[0] === 'contains' && f[1] === 'metadata' && (f[2] as { kind?: string }).kind === 'quadro')
        ? dados.filter(d => d.metadata?.kind === 'quadro') : dados
      return { data: filtrado.sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 50) } // como o limit(50) do banco
    } })
    montarTasks()
    await verQuadro()
    expect(await screen.findByRole('button', { name: 'Avisos do quadro, 2 não lidos' })).toBeInTheDocument()
    const q = m.chamadas.find(c => c.tabela === 'notifications' && c.op === 'select')!
    expect(q.filtros).toContainEqual(['contains', 'metadata', { kind: 'quadro' }])
    expect(q.filtros).toContainEqual(['limit', 50])
  })

  it('aviso com link de fora não navega (urlDoAviso só aceita caminho interno)', async () => {
    bancoNovo({ notifications: () => ({ data: [aviso('a1', { metadata: { kind: 'quadro', tipo: 'mencao', task_id: 't1', url: 'https://evil.com/x' } })] }) })
    montarTasks()
    await verQuadro()
    fireEvent.click(await screen.findByRole('button', { name: /Avisos do quadro/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Aviso a1/ }))
    await waitFor(() => expect(feitas('notifications', 'update')).toHaveLength(1))
    await new Promise(r => setTimeout(r, 50))
    expect(screen.getByTestId('url').textContent).not.toContain('evil')
    expect(screen.queryByRole('dialog', { name: /Cartão:/ })).toBeNull()
  })

  it('o cartão com aviso não lido ganha o ponto "novo"', async () => {
    bancoNovo({ notifications: () => ({ data: [aviso('a1')] }) })
    montarTasks()
    await verQuadro()
    expect(await screen.findByText('aviso novo')).toBeInTheDocument()
  })
})

describe('deep link ?cartao=', () => {
  it('abre o verso do cartão e tira o parâmetro', async () => {
    bancoNovo()
    montarTasks('/producer/tasks?eventId=e1&cartao=t1')
    expect(await screen.findByRole('dialog', { name: /Cartão: Contratar som/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('/producer/tasks?eventId=e1'))
  })
  it('cartão que não existe só limpa o parâmetro', async () => {
    bancoNovo()
    montarTasks('/producer/tasks?eventId=e1&cartao=nao-existe')
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe('/producer/tasks?eventId=e1'))
    expect(screen.queryByRole('dialog', { name: /Cartão:/ })).toBeNull()
  })
})

describe('preferências', () => {
  const ordemPrefs = () => m.chamadas.filter(c => c.tabela === 'task_notification_prefs' && c.op !== 'select').map(c => c.op)

  it('grava com update filtrado por user_id (nunca upsert) quando a linha já existe', async () => {
    bancoNovo({ task_notification_prefs: op => (op === 'update' ? { data: [{ user_id: 'u1' }] } : { data: null }) })
    render(<QueryClientProvider client={novoQc()}><PrefsAvisos /></QueryClientProvider>)
    const som = await screen.findByRole('switch', { name: 'Bipe de aviso' })
    await waitFor(() => expect(som).not.toBeDisabled())
    fireEvent.click(som)
    await waitFor(() => expect(feitas('task_notification_prefs', 'update')).toHaveLength(1))
    const up = feitas('task_notification_prefs', 'update')[0]
    expect(up.args[0]).toMatchObject({ general: true, sound: false })
    expect(up.args[0]).not.toHaveProperty('user_id') // o banco só deixa atualizar general, sound e types
    expect(Object.keys((up.args[0] as { types: object }).types).sort()).toEqual(['atribuicao', 'automacao', 'mencao', 'mensagem', 'movido', 'prazo'])
    expect(up.filtros).toContainEqual(['eq', 'user_id', 'u1'])
    expect(ordemPrefs()).toEqual(['update']) // linha existia: sem insert
    fireEvent.click(screen.getByRole('switch', { name: 'Prazo chegando ou vencido: no app' }))
    await waitFor(() => expect(feitas('task_notification_prefs', 'update')).toHaveLength(2))
    const tipos = (feitas('task_notification_prefs', 'update')[1].args[0] as { types: Record<string, { app: boolean }> }).types
    expect(tipos.prazo.app).toBe(false)
    expect(tipos.mencao.app).toBe(true)
    expect(m.chamadas.some(c => c.op === 'upsert')).toBe(false)
    const email = screen.getByRole('switch', { name: 'Prazo chegando ou vencido: e-mail (em breve)' })
    expect(email).toBeDisabled()
    expect(screen.getAllByText('em breve')).toHaveLength(6)
  })
  it('primeira vez: update volta 0 linhas e só então vem o insert com user_id', async () => {
    bancoNovo({ task_notification_prefs: () => ({ data: [] }) })
    render(<QueryClientProvider client={novoQc()}><PrefsAvisos /></QueryClientProvider>)
    const som = await screen.findByRole('switch', { name: 'Bipe de aviso' })
    await waitFor(() => expect(som).not.toBeDisabled())
    fireEvent.click(som)
    await waitFor(() => expect(feitas('task_notification_prefs', 'insert')).toHaveLength(1))
    expect(ordemPrefs()).toEqual(['update', 'insert'])
    expect(feitas('task_notification_prefs', 'insert')[0].args[0]).toMatchObject({ user_id: 'u1', sound: false, general: true })
    expect(m.chamadas.some(c => c.op === 'upsert')).toBe(false)
  })
  it('corrida (23505 no insert): tenta o update de novo e dá certo', async () => {
    let updates = 0
    bancoNovo({ task_notification_prefs: op => (op === 'update' ? (++updates === 1 ? { data: [] } : { data: [{ user_id: 'u1' }] })
      : op === 'insert' ? { error: { code: '23505', message: 'duplicate' } } : { data: null }) })
    render(<QueryClientProvider client={novoQc()}><PrefsAvisos /></QueryClientProvider>)
    const som = await screen.findByRole('switch', { name: 'Bipe de aviso' })
    await waitFor(() => expect(som).not.toBeDisabled())
    fireEvent.click(som)
    await waitFor(() => expect(ordemPrefs()).toEqual(['update', 'insert', 'update']))
    expect(m.toast.error).not.toHaveBeenCalled()
  })
  it('sem linha no banco usa o padrão; linha estranha não quebra', () => {
    expect(prefsDaLinha(null)).toEqual(PREFS_PADRAO)
    expect(prefsDaLinha({ general: 'sim', types: { mencao: { app: false } } }).types.mencao).toEqual({ app: false, email: false })
    expect(prefsDaLinha({ general: false, sound: false, types: [] }).general).toBe(false)
  })
})

describe('bipe', () => {
  class FakeAudio {
    static criados = 0
    static tons: number[] = []
    state = 'running'
    currentTime = 0
    destination = {}
    constructor() { FakeAudio.criados++ }
    resume = vi.fn()
    createGain() { return { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() } }
    createOscillator() {
      const o = { type: '', frequency: { value: 0 }, connect: vi.fn(), start: () => { FakeAudio.tons.push(o.frequency.value) }, stop: vi.fn() }
      return o
    }
  }
  beforeEach(() => { FakeAudio.criados = 0; FakeAudio.tons = []; _zerarAudio(); vi.stubGlobal('AudioContext', FakeAudio) })
  afterEach(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }) })

  const rodar = (inicial: DbNotification[], prefs = PREFS_PADRAO) => {
    const r = renderHook(({ av, carregado, p }) => useBipeAvisos(av, carregado, p), { initialProps: { av: inicial, carregado: true, p: prefs } })
    fireEvent.pointerDown(document.body) // primeiro gesto: só então o navegador deixa tocar
    return r
  }

  it('não toca na primeira carga, toca uma vez por aviso novo e só cria o contexto depois do gesto', () => {
    const r = renderHook(({ av }) => useBipeAvisos(av, true, PREFS_PADRAO), { initialProps: { av: [aviso('a1')] } })
    expect(FakeAudio.criados).toBe(0)
    fireEvent.pointerDown(document.body)
    expect(FakeAudio.criados).toBe(1)
    expect(FakeAudio.tons).toEqual([])
    r.rerender({ av: [aviso('a2'), aviso('a1')] })
    expect(FakeAudio.tons).toEqual([660, 990, 1320]) // tom da menção
    r.rerender({ av: [aviso('a2'), aviso('a1')] })
    expect(FakeAudio.tons).toHaveLength(3) // o mesmo aviso não toca de novo
  })
  it('tom diferente por tipo', () => {
    const r = rodar([])
    r.rerender({ av: [aviso('p1', { metadata: { kind: 'quadro', tipo: 'prazo' } })], carregado: true, p: PREFS_PADRAO })
    expect(FakeAudio.tons).toEqual([520, 520])
  })
  it('respeita som desligado, avisos gerais desligados e aviso já lido', () => {
    const r = rodar([])
    r.rerender({ av: [aviso('n1')], carregado: true, p: { ...PREFS_PADRAO, sound: false } })
    r.rerender({ av: [aviso('n2'), aviso('n1')], carregado: true, p: { ...PREFS_PADRAO, general: false } })
    r.rerender({ av: [aviso('n3', { is_read: true }), aviso('n2'), aviso('n1')], carregado: true, p: PREFS_PADRAO })
    expect(FakeAudio.tons).toEqual([])
  })
  it('considera todos os avisos novos da rodada: primeiro tipo desligado, segundo ligado, toca uma vez', () => {
    const r = rodar([])
    const prefs = { ...PREFS_PADRAO, types: { ...PREFS_PADRAO.types, prazo: { app: false, email: false } } }
    r.rerender({ av: [aviso('p1', { metadata: { kind: 'quadro', tipo: 'prazo' } }), aviso('m1', { metadata: { kind: 'quadro', tipo: 'movido' } })], carregado: true, p: prefs })
    expect(FakeAudio.tons).toEqual([600]) // tom do "movido", uma vez só
  })
  it('fica mudo com a aba oculta', () => {
    const r = rodar([])
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    r.rerender({ av: [aviso('o1')], carregado: true, p: PREFS_PADRAO })
    expect(FakeAudio.tons).toEqual([])
  })
  it('sem gesto da pessoa não toca', () => {
    const r = renderHook(({ av }) => useBipeAvisos(av, true, PREFS_PADRAO), { initialProps: { av: [] as DbNotification[] } })
    r.rerender({ av: [aviso('g1')] })
    expect(FakeAudio.tons).toEqual([])
  })
})

describe('tiques', () => {
  const rec = (user_id: string, o: object = {}) => ({ comment_id: 'c1', user_id, delivered_at: null, read_at: null, device: null, ...o })
  const est = (membros: string[], recibos: ReturnType<typeof rec>[], observadores: string[] = []) => estadoDaMensagem('u1', membros, observadores, recibos, 'c1').estado

  it('sem destinatário não há tique; sem recibo é enviado; um recebeu é entregue; todos leram é lido', () => {
    expect(est(['u1'], [])).toBe('sem') // só o autor
    expect(est(['u1', 'u2', 'u3'], [])).toBe('enviado')
    expect(est(['u2', 'u3'], [rec('u2', { delivered_at: 'x' })])).toBe('entregue')
    expect(est(['u2', 'u3'], [rec('u2', { read_at: 'x' })])).toBe('entregue') // um leu, o outro não
    expect(est(['u2', 'u3'], [rec('u2', { read_at: 'x' }), rec('u3', { read_at: 'x' })])).toBe('lido')
  })
  it('observadores contam como destinatários; o autor e quem não é destinatário não', () => {
    expect(est(['u2'], [rec('u2', { read_at: 'x' })], ['u4'])).toBe('entregue')
    expect(est(['u2'], [rec('u2', { read_at: 'x' }), rec('u4', { read_at: 'x' })], ['u4'])).toBe('lido')
    expect(est(['u2'], [rec('u1', { read_at: 'x' })])).toBe('enviado')
  })
  it('o Tique tem texto para leitor de tela e cor só no lido', () => {
    const { container, rerender } = render(<Tique estado="enviado" />)
    expect(screen.getByText('Enviada')).toBeInTheDocument()
    expect(container.querySelectorAll('path')).toHaveLength(1)
    rerender(<Tique estado="entregue" />)
    expect(container.querySelectorAll('path')).toHaveLength(2)
    expect(container.firstElementChild).not.toHaveClass('text-[var(--brand-violet)]')
    rerender(<Tique estado="lido" />)
    expect(screen.getByText('Lida')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('text-[var(--brand-violet)]')
    rerender(<Tique estado="sem" />)
    expect(container.firstChild).toBeNull()
  })
})

describe('verso do cartão: confirmação de leitura', () => {
  const pessoas = [{ id: 'u1', nome: 'Ricardo' }, { id: 'u2', nome: 'Ana Souza' }, { id: 'u3', nome: 'Caio Lima' }]
  const comentario = { id: 'c1', task_id: 't1', user_id: 'u1', body: 'Fechado o som', mentions: [], created_at: '2026-10-09T12:00:00Z' }
  function Harness() {
    const [id, setId] = useState<string | null>(null)
    return (<><button onClick={() => setId('t1')}>Abrir cartão</button>
      <CartaoVerso tarefaId={id} tarefas={[tarefa()]} boardId="b1" colunas={colunas} pessoas={pessoas} resumo={{ ...RESUMO_VAZIO, membros: ['u2', 'u3'] }} onFechar={() => setId(null)} onMover={vi.fn()} /></>)
  }
  const abrir = async () => {
    render(<QueryClientProvider client={novoQc()}><MemoryRouter><Harness /></MemoryRouter></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir cartão' }))
    await screen.findByText('Fechado o som')
  }
  const comRecibos = (recibos: object[], vistas: object[] = []) => bancoNovo({
    task_comments: () => ({ data: [comentario] }), task_comment_receipts: () => ({ data: recibos }), task_card_views: () => ({ data: vistas }),
  })

  it('o autor vê enviado, depois entregue, depois lido (violeta) nas próprias mensagens', async () => {
    comRecibos([])
    await abrir()
    expect(await screen.findByText('Enviada')).toBeInTheDocument()
    cleanup()
    comRecibos([{ comment_id: 'c1', user_id: 'u2', delivered_at: '2026-10-09T12:01:00Z', read_at: null, device: 'celular' }])
    await abrir()
    expect(await screen.findByText('Entregue')).toBeInTheDocument()
    cleanup()
    comRecibos([{ comment_id: 'c1', user_id: 'u2', delivered_at: 'x', read_at: '2026-10-09T12:02:00Z', device: 'celular' }, { comment_id: 'c1', user_id: 'u3', delivered_at: 'x', read_at: '2026-10-09T12:03:00Z', device: 'computador' }])
    await abrir()
    expect(await screen.findByText('Lida')).toBeInTheDocument()
    expect(document.querySelector('[data-tique="lido"]')).toBeTruthy()
  })

  it('"Visto por N" mostra nome, horário e aparelho, e o verso chama quadro_marcar_lido', async () => {
    comRecibos([], [{ task_id: 't1', user_id: 'u2', last_seen_at: new Date().toISOString(), device: 'celular' }])
    await abrir()
    expect(await screen.findByText('Visto por 1')).toBeInTheDocument()
    const lista = within(screen.getByRole('list', { name: 'Quem viu o cartão' }))
    expect(lista.getByText('Ana Souza')).toBeInTheDocument()
    expect(lista.getByText(/agora · celular/)).toBeInTheDocument()
    expect(screen.getByText(/Não guardamos o número de IP/)).toBeInTheDocument()
    await waitFor(() => expect(rpcsDe('quadro_marcar_lido')).toHaveLength(1))
    const args = rpcsDe('quadro_marcar_lido')[0][1] as { p_task: string; p_device: string }
    expect(args.p_task).toBe('t1')
    expect(['computador', 'celular', 'tablet', 'outro']).toContain(args.p_device)
    expect(Object.keys(args).sort()).toEqual(['p_device', 'p_task']) // nada de IP nem user agent
  })

  it('com "Mostrar quem viu" desligado: sem "Visto por", sem tiques e nenhuma RPC', async () => {
    bancoNovo({ task_comments: () => ({ data: [comentario] }), task_boards: () => ({ data: { show_receipts: false, producer_id: 'u1' } }) })
    await abrir()
    await waitFor(() => expect(feitas('task_boards', 'select').length).toBeGreaterThan(0))
    expect(screen.queryByText(/Visto por/)).toBeNull()
    expect(screen.queryByText('Enviada')).toBeNull()
    expect(rpcsDe('quadro_marcar_lido')).toHaveLength(0)
    expect(feitas('task_card_views', 'select')).toHaveLength(0)
  })
})

describe('RPCs de leitura e entrega (hooks)', () => {
  const qcHooks = novoQc()
  const env = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qcHooks}>{children}</QueryClientProvider>
  it('quadro_marcar_lido roda ao abrir e de novo quando chega mensagem nova, com teto de 20', async () => {
    const r = renderHook(({ n }) => useMarcarLido('t1', true, n), { wrapper: env, initialProps: { n: null as number | null } })
    expect(rpcsDe('quadro_marcar_lido')).toHaveLength(0) // ainda carregando
    r.rerender({ n: 2 }); await waitFor(() => expect(rpcsDe('quadro_marcar_lido')).toHaveLength(1))
    r.rerender({ n: 2 }); expect(rpcsDe('quadro_marcar_lido')).toHaveLength(1) // nada mudou: sem nova chamada
    r.rerender({ n: 3 }); await waitFor(() => expect(rpcsDe('quadro_marcar_lido')).toHaveLength(2))
    for (let n = 4; n < 60; n++) r.rerender({ n })
    expect(rpcsDe('quadro_marcar_lido').length).toBe(20)
  })
  it('desligado não chama', () => {
    renderHook(() => useMarcarLido('t1', false, 3), { wrapper: env })
    expect(rpcsDe('quadro_marcar_lido')).toHaveLength(0)
  })
  it('quadro_marcar_entregue reenvia quando "Mostrar quem viu" volta de desligado para ligado', async () => {
    const r = renderHook(({ on }) => useMarcarEntregue(['t1', 't2'], on), { initialProps: { on: true } })
    await waitFor(() => expect(rpcsDe('quadro_marcar_entregue')).toHaveLength(1))
    r.rerender({ on: true }); expect(rpcsDe('quadro_marcar_entregue')).toHaveLength(1)
    r.rerender({ on: false }); expect(rpcsDe('quadro_marcar_entregue')).toHaveLength(1)
    r.rerender({ on: true })
    await waitFor(() => expect(rpcsDe('quadro_marcar_entregue')).toHaveLength(2))
  })
})

describe('"Mostrar quem viu" e entrega', () => {
  it('ao carregar o quadro marca como entregues os cartões visíveis (até 200) e o dono liga e desliga o interruptor', async () => {
    const muitos = Array.from({ length: 230 }, (_, i) => tarefa({ id: `t${i}`, title: `Cartão ${i}`, position: i }))
    bancoNovo({}, muitos)
    montarTasks()
    await verQuadro()
    await waitFor(() => expect(rpcsDe('quadro_marcar_entregue')).toHaveLength(1))
    const a = rpcsDe('quadro_marcar_entregue')[0][1] as { p_tasks: string[]; p_device: string }
    expect(a.p_tasks).toHaveLength(200)
    expect(Object.keys(a).sort()).toEqual(['p_device', 'p_tasks'])
    fireEvent.click(screen.getByRole('button', { name: 'Menu do quadro' }))
    const chave = await screen.findByRole('switch', { name: 'Mostrar quem viu' })
    expect(chave).toBeChecked()
    expect(screen.getByText(/sem IP|Não guardamos o número de IP/)).toBeInTheDocument()
    fireEvent.click(chave)
    await waitFor(() => expect(feitas('task_boards', 'update')).toHaveLength(1))
    expect(feitas('task_boards', 'update')[0].args[0]).toEqual({ show_receipts: false })
  })
  it('desligado, não chama a RPC de entrega; quem não é dono nem vê o interruptor', async () => {
    bancoNovo({ task_boards: () => ({ data: { show_receipts: false, producer_id: 'outro' } }) })
    montarTasks()
    await verQuadro()
    await screen.findByRole('group', { name: 'Quadro de tarefas' })
    fireEvent.click(screen.getByRole('button', { name: 'Menu do quadro' }))
    expect(screen.queryByRole('switch', { name: 'Mostrar quem viu' })).toBeNull()
    expect(rpcsDe('quadro_marcar_entregue')).toHaveLength(0)
  })
})

describe('local, mapa e rota', () => {
  it('"Ir até lá" monta os três links https com encoding e abre em nova aba seguro', () => {
    render(<LocalRota local={{ txt: 'Rua A, 1 & Cia', lat: -23.5, lng: -46.6 }} />)
    const g = within(screen.getByRole('group', { name: 'Ir até lá' }))
    const hrefs = { google: g.getByRole('link', { name: 'Google Maps' }), waze: g.getByRole('link', { name: 'Waze' }), apple: g.getByRole('link', { name: 'Mapas da Apple' }) }
    expect(hrefs.google).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=-23.5%2C-46.6&travelmode=driving&dir_action=navigate')
    expect(hrefs.waze).toHaveAttribute('href', 'https://waze.com/ul?ll=-23.5%2C-46.6&navigate=yes')
    expect(hrefs.apple).toHaveAttribute('href', 'https://maps.apple.com/?daddr=-23.5%2C-46.6&dirflg=d')
    for (const a of Object.values(hrefs)) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a).toHaveAttribute('rel', 'noopener noreferrer')
      expect(a.getAttribute('href')).toMatch(/^https:\/\//)
    }
    expect(screen.getByText(/© OpenStreetMap contributors/)).toBeInTheDocument()
  })
  it('só texto: Waze usa ?q= e não há botão de mapa nem import', () => {
    render(<LocalRota local={{ txt: 'Teatro Municipal' }} />)
    expect(screen.getByRole('link', { name: 'Waze' })).toHaveAttribute('href', 'https://waze.com/ul?q=Teatro%20Municipal&navigate=yes')
    expect(screen.queryByRole('button', { name: 'Mostrar mapa' })).toBeNull()
    expect(screen.queryByText(/OpenStreetMap/)).toBeNull()
  })
  it('com coordenadas o mapa (Leaflet e imagens) só é baixado depois do clique em "Mostrar mapa"', async () => {
    const { container } = render(<LocalRota local={{ lat: 1, lng: 2 }} />)
    await new Promise(r => setTimeout(r, 50))
    expect(m.carregouMapa).not.toHaveBeenCalled() // módulo do mapa nunca foi importado
    expect(screen.queryByTestId('mapa')).toBeNull()
    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(screen.getByText(/O mapa vem do OpenStreetMap, que recebe o seu endereço IP/)).toBeInTheDocument()
    expect(screen.getByText(/© OpenStreetMap contributors/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mapa' }))
    expect(await screen.findByTestId('mapa')).toHaveTextContent('1,2')
    expect(m.carregouMapa).toHaveBeenCalledTimes(1)
  })
  it('o formulário do local recusa coordenada fora da faixa ou pela metade', () => {
    const salvar = vi.fn()
    render(<EscolhaLocal local={null} salvar={salvar} />)
    const tentar = (lat: string, lng: string) => {
      fireEvent.change(screen.getByLabelText(/Latitude/), { target: { value: lat } })
      fireEvent.change(screen.getByLabelText(/Longitude/), { target: { value: lng } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar local' }))
    }
    tentar('91', '0'); expect(screen.getByRole('alert')).toHaveTextContent('Latitude vai de -90 a 90')
    tentar('0', '-181'); expect(screen.getByRole('alert')).toHaveTextContent('longitude de -180 a 180')
    tentar('abc', '0'); expect(screen.getByRole('alert')).toBeInTheDocument()
    tentar('10', ''); expect(screen.getByRole('alert')).toHaveTextContent('juntas')
    expect(salvar).not.toHaveBeenCalled()
    tentar('-23,5', '-46.6')
    expect(salvar).toHaveBeenCalledWith({ lat: -23.5, lng: -46.6 })
  })
})

describe('roteiro com locais', () => {
  const doze = Array.from({ length: 12 }, (_, i) => tarefa({ id: `r${i}`, title: `Visita ${i}`, due_date: `2026-11-${String(i + 1).padStart(2, '0')}T12:00:00-03:00`, location: { txt: `Rua ${i}`, lat: -23 + i * 0.01, lng: -46 } }))

  it('lista por prazo com distância entre paradas e limita o link a 9 paradas, com aviso do celular', () => {
    render(<RoteiroLocais tarefas={doze} concluida={() => false} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(12)
    expect(screen.getByText(/Rua 1 · 1,1 km da parada anterior/)).toBeInTheDocument() // 0,01 grau de latitude = 1,1 km
    expect(screen.getAllByText(/Fora do roteiro/)).toHaveLength(3)
    expect(screen.getByText(/No celular, o Google Maps aceita menos paradas/)).toBeInTheDocument()
    const a = screen.getByRole('link', { name: /Abrir roteiro no Google Maps \(9 paradas\)/ })
    expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    expect(new URL(a.getAttribute('href')!).searchParams.get('waypoints')!.split('|')).toHaveLength(8)
  })

  it('"Usar minha localização" só pede no clique, ordena na memória e não grava nem envia nada', async () => {
    const pos = vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude: -22.8, longitude: -46 } }))
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: pos } })
    const grava = vi.spyOn(Storage.prototype, 'setItem')
    const rede = vi.fn(); vi.stubGlobal('fetch', rede)
    const antes = m.chamadas.length
    render(<RoteiroLocais tarefas={doze} concluida={() => false} />)
    expect(pos).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Usar minha localização' }))
    expect(pos).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/do mais perto ao mais longe de você/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Visita 11')
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('de você')
    const href = screen.getByRole('link', { name: /Abrir roteiro/ }).getAttribute('href')!
    expect(href).not.toContain('origin')
    expect(href).not.toContain('-22.8%2C')
    expect(grava).not.toHaveBeenCalled()
    expect(rede).not.toHaveBeenCalled()
    expect(m.chamadas.length).toBe(antes)
    expect(m.rpc).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Parar de usar minha localização' }))
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Visita 0')
  })

  it('endereços longos: o link fica em 2.000 caracteres e a tela avisa quantas paradas entraram', () => {
    const longas = Array.from({ length: 9 }, (_, i) => tarefa({ id: `l${i}`, title: `Longa ${i}`, location: { txt: `${i}ç `.repeat(60) } }))
    render(<RoteiroLocais tarefas={longas} concluida={() => false} />)
    const a = screen.getByRole('link', { name: /Abrir roteiro no Google Maps/ })
    expect(a.getAttribute('href')!.length).toBeLessThanOrEqual(2000)
    expect(screen.getByRole('status')).toHaveTextContent(/comporta só \d+ paradas?/)
  })

  it('permissão negada mostra a frase em português', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_ok: unknown, err: (e: { code: number }) => void) => err({ code: 1 }) } })
    render(<RoteiroLocais tarefas={doze} concluida={() => false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Usar minha localização' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Permissão de localização negada.')
  })
})
