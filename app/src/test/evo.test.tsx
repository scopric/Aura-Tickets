import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EvoMarkdown, type Mensagem } from '../components/evo/EvoChat'
import { conversaParaMarkdown, nomeArquivoConversa } from '../lib/evoConversa'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import EvoHub from '../components/EvoHub'
import { _resetCamadasParaTeste, cookiesDecididosEmMemoria, fecharPolitica } from '../lib/camadas'
import { PRIVACY_VERSION } from '../lib/legal'
import userEvent from '@testing-library/user-event'

let role = 'producer'
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', role, email: 'a@b.c' } }) }))
const criar = vi.fn(() => Promise.resolve({ id: 'ev1' }))
vi.mock('../hooks/useEvents', () => ({ useCreateEvent: () => ({ mutateAsync: criar, isPending: false }) }))
vi.mock('../hooks/useFeedback', () => ({ useFeedback: () => ({ mutateAsync: vi.fn(), isPending: false }) }))

// jsdom não tem scrollIntoView nem ResizeObserver (tooltip do Radix); no Node 26 o localStorage global vem vazio
Element.prototype.scrollIntoView = vi.fn()
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
// cookies decididos e Política fechada: o balão do Evo só corre com as outras camadas resolvidas (lib/camadas.ts)
const mem: Record<string, string> = { 'aura-cookie-consent': JSON.stringify({ version: '1.0', consent: { necessary: true, analytics: false } }), [`aviso-politica-${PRIVACY_VERSION}`]: '1' }
vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } })

const SALDO_OK = { data: { habilitado: true, plano: 'free', cota: 5, concedido: 0, usado: 1, restante: 4, periodo: 'mes' }, error: null }
// O EvoHub também lê as conversas do suporte (selo) e abre um canal do Realtime: consulta encadeável
// que devolve lista vazia e canal encadeável (.on().on().subscribe())
function consultaVazia(data: unknown[] = []): unknown {
  const c: unknown = new Proxy(() => {}, { get: (_, k) => (k === 'then' ? (ok: (v: unknown) => unknown) => ok({ data, error: null }) : () => c) })
  return c
}
const canal: Record<string, unknown> = {}
canal.on = vi.fn(() => canal)
canal.subscribe = vi.fn(() => canal)
// Mostra a rota atual e deixa o teste navegar como o resto do app (links, ?tour= aberto por outro caminho)
const Local = () => {
  const l = useLocation()
  const nav = useNavigate()
  return (
    <>
      <p data-testid="local">{l.pathname + l.search}</p>
      <button onClick={() => nav('/producer/dashboard')}>ir para o início</button>
      <button onClick={() => nav('/producer/events?tour=eventos')}>abrir tour por outro caminho</button>
      <button onClick={() => nav('/producer/events')}>fechar o tour</button>
    </>
  )
}
function montar(saldo: unknown = SALDO_OK, conversas: unknown[] = [], rota = '/', porTabela?: (tabela: string) => unknown) {
  ;(supabase as unknown as { rpc: unknown }).rpc = vi.fn((nome: string) => Promise.resolve(nome === 'ai_balance' ? saldo : { data: null, error: null }))
  vi.mocked(supabase.from).mockImplementation(((tabela: string) => porTabela?.(tabela) ?? consultaVazia(conversas)) as never)
  vi.mocked(supabase.channel).mockImplementation(() => canal as never)
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[rota]}><EvoHub /><Local /></MemoryRouter></QueryClientProvider>)
}

describe('Evo: markdown mínimo e exportação da conversa', () => {
  it('renderiza títulos, listas e negrito, e escapa HTML', () => {
    const html = renderToStaticMarkup(
      <EvoMarkdown texto={'## Bebida\nConta **simples**\n\n- cerveja\n- água\n1. um\n2. dois\n<img src=x onerror=alert(1)> **aberto'} />
    )
    expect(html).toContain('<h4 class="font-semibold">Bebida</h4>')
    expect(html).toContain('<strong class="font-semibold">simples</strong>')
    expect(html).toContain('<ul class="list-disc space-y-1 pl-5"><li>cerveja</li><li>água</li></ul>')
    expect(html).toContain('<ol class="list-decimal space-y-1 pl-5"><li>um</li><li>dois</li></ol>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; **aberto')
    expect(html).not.toContain('<img')
  })

  it('monta o .md e o nome do arquivo com data local', () => {
    const agora = new Date(2026, 8, 29, 7, 5)
    const msgs: Mensagem[] = [
      { id: '1', role: 'user', text: 'Oi' },
      { id: '2', role: 'model', text: '**Olá!**' },
    ]
    expect(conversaParaMarkdown(msgs, agora)).toBe('# Conversa com o Evo — 29/09/2026 07:05\n\n**Você:** Oi\n\n**Evo:** **Olá!**\n')
    expect(nomeArquivoConversa(agora)).toBe('evo-conversa-2026-09-29-0705.md')
  })
})

describe('EvoHub: painel, chat e rascunho', () => {
  it('produtor: abre, mostra abas, saldo, envia e trata recusa', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { ok: true, reply_md: '## Oi\n- **um**', usage_id: 'x', restante: 3 }, error: null } as never)
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { ok: false, motivo: 'sem_credito', message: 'x' }, error: null } as never)
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { ok: false, motivo: 'sem_credito', message: 'x', custo: 3, restante: 1 }, error: null } as never)
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { ok: false, motivo: 'nao_autorizado', message: 'x' }, error: null } as never)
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Evo', 'Falar com a Evokaa'])
    expect(screen.getByText(/Não cole dados de compradores \(CPF, e-mail, telefone\)\. As conversas são processadas pelo Google Gemini\./)).toBeInTheDocument()
    expect(await screen.findByText('4 créditos restantes este mês')).toBeInTheDocument()
    const caixa = screen.getByLabelText('Mensagem para o Evo')
    fireEvent.change(caixa, { target: { value: 'Oi Evo' } })
    fireEvent.keyDown(caixa, { key: 'Enter' })
    expect(await screen.findByRole('heading', { name: 'Oi' })).toBeInTheDocument()
    expect(supabase.functions.invoke).toHaveBeenCalledWith('agent', { body: { mode: 'chat', message: 'Oi Evo', history: [] } })
    expect(await screen.findByText('3 créditos restantes este mês')).toBeInTheDocument()
    fireEvent.change(caixa, { target: { value: 'De novo' } })
    fireEvent.keyDown(caixa, { key: 'Enter' })
    expect(await screen.findByText('Seus créditos do Evo acabaram este mês.')).toBeInTheDocument()
    const hist = (vi.mocked(supabase.functions.invoke).mock.calls[1][1] as { body: { history: unknown } }).body.history
    expect(hist).toEqual([{ role: 'user', text: 'Oi Evo' }, { role: 'model', text: '## Oi\n- **um**' }])
    fireEvent.change(caixa, { target: { value: 'Planeje tudo' } })
    fireEvent.keyDown(caixa, { key: 'Enter' })
    expect(await screen.findByText('Este pedido custa 3 créditos e você tem 1.')).toBeInTheDocument()
    fireEvent.change(caixa, { target: { value: 'Mais uma' } })
    fireEvent.keyDown(caixa, { key: 'Enter' })
    expect(await screen.findByText('Sua conta não tem acesso ao Evo.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Planejar meu primeiro evento' }))
    expect(screen.getByLabelText('Formato do evento')).toBeInTheDocument()
    expect(screen.getAllByRole('option').length).toBeGreaterThan(27)
  })
  it('fechar e reabrir o painel mantém o texto e não permite envio duplo', async () => {
    vi.mocked(supabase.functions.invoke).mockReset()
    vi.mocked(supabase.functions.invoke).mockReturnValue(new Promise(() => {}) as never) // pedido em voo
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    fireEvent.change(await screen.findByLabelText('Mensagem para o Evo'), { target: { value: 'Primeira' } })
    fireEvent.keyDown(screen.getByLabelText('Mensagem para o Evo'), { key: 'Enter' })
    fireEvent.change(screen.getByLabelText('Mensagem para o Evo'), { target: { value: 'Rascunho que não pode sumir' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar central do Evo' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'O Evo está pensando na sua resposta' }))
    const caixa = await screen.findByLabelText('Mensagem para o Evo')
    expect(caixa).toHaveValue('Rascunho que não pode sumir')
    expect(screen.getByText('O Evo está pensando…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    fireEvent.keyDown(caixa, { key: 'Enter' })
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
    vi.mocked(supabase.functions.invoke).mockReset()
  })
  it('participante: janela flutuante não modal (sem véu, sem abas); o mascote alterna e Esc fecha', async () => {
    role = 'user'
    mem['evo-convite-v1'] = JSON.stringify({ aberto: true, fechados: 0 })
    montar()
    const mascote = screen.getByRole('button', { name: 'Falar com o Evo' })
    expect(mascote).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(mascote)
    const janela = await screen.findByRole('dialog', { name: 'Falar com a Evokaa' })
    expect(janela).toHaveAttribute('aria-modal', 'false')
    expect(mascote).toHaveAttribute('aria-expanded', 'true')
    expect(document.querySelector('.glass-backdrop')).toBeNull() // sem véu: a página segue clicável
    expect(document.body.style.pointerEvents).not.toBe('none')
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.queryByLabelText('Mensagem para o Evo')).toBeNull()
    await waitFor(() => expect(janela).toContainElement(document.activeElement as HTMLElement)) // foco no título, dentro da janela
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mascote).toHaveFocus()
    fireEvent.click(mascote) // abre de novo
    expect(await screen.findByRole('dialog', { name: 'Falar com a Evokaa' })).toBeInTheDocument()
    fireEvent.click(mascote) // e o mesmo clique fecha
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('planejar: envia form, mostra proposta editável e cria rascunho só no clique', async () => {
    role = 'producer'
    vi.mocked(supabase.functions.invoke).mockReset()
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { ok: true, reply_md: 'Plano', usage_id: 'u-9', restante: 1, proposal: {
      title: 'Forró da Vila', description: 'd', category: 'show', temas: ['musica'], estilos: ['forro'], date: '2099-11-20', time: '22:00', venue_city: 'Recife', venue_state: 'PE', capacity: 300,
      tickets: [{ name: '1º lote', price: 40, quantity: 150 }] } }, error: null } as never)
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Planejar meu primeiro evento' }))
    fireEvent.change(screen.getByLabelText('Formato do evento'), { target: { value: 'show' } })
    fireEvent.click(screen.getByLabelText('Forró'))
    fireEvent.change(screen.getByLabelText('Público esperado'), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText('Duração (horas)'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: ' Recife ' } })
    fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'PE' } })
    fireEvent.submit(screen.getByLabelText('Formato do evento').closest('form')!)
    await screen.findByText('Plano')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('agent', { body: { mode: 'planejar', form: { formato: 'show', estilos: ['forro'], publico: 300, cidade: 'Recife', uf: 'PE', duracao_h: 6, layout: 'em_pe' } } })
    expect(criar).not.toHaveBeenCalled()
    expect(screen.getByText('Show ou apresentação')).toBeInTheDocument() // formato, pelo rótulo
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Forró pé de serra' } })
    fireEvent.change(screen.getByLabelText('Preço do lote 1 em reais'), { target: { value: '35' } })
    const insert = vi.fn(() => Promise.resolve({ error: null }))
    vi.mocked(supabase.from).mockReturnValueOnce({ insert } as never)
    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho do evento' }))
    expect(await screen.findByRole('link', { name: 'Abrir rascunho' })).toHaveAttribute('href', '/producer/events/ev1/edit')
    expect(criar).toHaveBeenCalledWith({
      event: { title: 'Forró da Vila', description: 'Forró pé de serra', category: 'show', temas: ['musica'], estilos: ['forro'], date: '2099-11-20', time: '22:00', venue_name: null, venue_city: 'Recife', venue_state: 'PE', capacity: 300, status: 'draft',
        settings: { uf: 'PE', origem: 'evo', ai_usage_id: 'u-9' } },
      tickets: [],
    })
    expect(supabase.from).toHaveBeenCalledWith('ticket_types')
    expect(insert).toHaveBeenCalledWith([{ event_id: 'ev1', name: '1º lote', description: null, price: 35, capacity: 150, quantity_total: 150, sold: 0, quantity_sold: 0, type: 'individual', perks: [], is_active: true }])
  })
  it('proposta com data passada: avisa e não cria o evento', async () => {
    criar.mockClear()
    vi.mocked(supabase.functions.invoke).mockReset()
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { ok: true, reply_md: 'Plano', usage_id: 'u-9', restante: 1, proposal: {
      title: 'Forró da Vila', description: 'd', category: 'show', temas: ['musica'], estilos: ['forro'], venue_city: 'Recife', venue_state: 'PE', capacity: 300,
      tickets: [{ name: 'Ingresso', price: 0, quantity: 300 }] } }, error: null } as never)
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    fireEvent.change(await screen.findByLabelText('Mensagem para o Evo'), { target: { value: 'Monte o rascunho' } })
    fireEvent.keyDown(screen.getByLabelText('Mensagem para o Evo'), { key: 'Enter' })
    await screen.findByText('Plano')
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2025-06-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho do evento' }))
    expect(await screen.findByText('A data do evento já passou.')).toBeInTheDocument()
    expect(criar).not.toHaveBeenCalled()
  })
  it('planejar: lotes falham depois do evento criado → guarda o id e não deixa criar de novo', async () => {
    criar.mockClear()
    vi.mocked(supabase.functions.invoke).mockReset()
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { ok: true, reply_md: 'Plano', usage_id: 'u-9', restante: 1, proposal: {
      title: 'Forró da Vila', description: 'd', category: 'show', temas: ['musica'], estilos: ['forro'], venue_city: 'Recife', venue_state: 'PE', capacity: 300,
      tickets: [{ name: '1º lote', price: 40, quantity: 150 }] } }, error: null } as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    fireEvent.change(await screen.findByLabelText('Mensagem para o Evo'), { target: { value: 'Monte o rascunho' } })
    fireEvent.keyDown(screen.getByLabelText('Mensagem para o Evo'), { key: 'Enter' })
    await screen.findByText('Plano')
    vi.mocked(supabase.from).mockReturnValueOnce({ insert: vi.fn(() => Promise.resolve({ error: { message: 'rls' } })) } as never)
    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho do evento' }))
    expect(await screen.findByText('Rascunho criado sem os lotes — abra o evento para completar')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir rascunho' })).toHaveAttribute('href', '/producer/events/ev1/edit')
    expect(screen.queryByRole('button', { name: 'Criar rascunho do evento' })).toBeNull()
    expect(criar).toHaveBeenCalledTimes(1)
  })

  it('convite: aparece ~2 s depois e some de vez ao abrir o Evo', async () => {
    role = 'producer'
    delete mem['evo-convite-v1']
    const { unmount } = montar()
    expect(await screen.findByText('Oi! Sou o Evo 👋 Posso te ajudar a planejar seu evento.', {}, { timeout: 3000 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    await screen.findByRole('dialog')
    expect(screen.queryByText('Oi! Sou o Evo 👋 Posso te ajudar a planejar seu evento.')).toBeNull()
    expect(JSON.parse(mem['evo-convite-v1'])).toEqual({ aberto: true, fechados: 0 })
    unmount()
    montar()
    await new Promise((r) => setTimeout(r, 2300))
    expect(screen.queryByText('Oi! Sou o Evo 👋 Posso te ajudar a planejar seu evento.')).toBeNull()
  })
  it('convite: localStorage falhando não quebra (mostra e fecha)', async () => {
    const quebrado = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
    vi.stubGlobal('localStorage', quebrado)
    cookiesDecididosEmMemoria() // sem armazenamento, cookies e Política se resolvem só em memória
    fecharPolitica()
    try {
      montar()
      expect(await screen.findByText('Oi! Sou o Evo 👋 Posso te ajudar a planejar seu evento.', {}, { timeout: 3000 })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso do Evo' }))
      expect(screen.queryByText('Oi! Sou o Evo 👋 Posso te ajudar a planejar seu evento.')).toBeNull()
    } finally {
      _resetCamadasParaTeste()
      vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } })
    }
  })
  it('resposta com o painel fechado: selo "1", balão e anúncio; abrir zera', async () => {
    mem['evo-convite-v1'] = JSON.stringify({ aberto: true, fechados: 0 })
    let responder: (v: unknown) => void = () => {}
    vi.mocked(supabase.functions.invoke).mockReset()
    vi.mocked(supabase.functions.invoke).mockReturnValueOnce(new Promise((r) => { responder = r }) as never)
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    fireEvent.change(await screen.findByLabelText('Mensagem para o Evo'), { target: { value: 'Oi' } })
    fireEvent.keyDown(screen.getByLabelText('Mensagem para o Evo'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar central do Evo' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'O Evo está pensando na sua resposta' })).toBeInTheDocument()
    await act(async () => { responder({ data: { ok: true, reply_md: 'Resposta', usage_id: 'x', restante: 2 }, error: null }) })
    const botao = await screen.findByRole('button', { name: 'Falar com o Evo (1 resposta nova)' })
    expect(botao).toHaveTextContent('1')
    expect(screen.getByText('O Evo respondeu! Toque para ver.')).toBeInTheDocument()
    expect(screen.getByText('Nova resposta do Evo')).toBeInTheDocument()
    fireEvent.click(botao)
    await screen.findByText('Resposta')
    expect(screen.getByRole('button', { name: 'Falar com o Evo', hidden: true })).not.toHaveTextContent('1') // atrás do modal aberto
    expect(screen.queryByText('O Evo respondeu! Toque para ver.')).toBeNull()
    expect(screen.queryByText('Nova resposta do Evo')).toBeNull()
    // 2ª rodada: o anúncio foi limpo ao abrir e é gravado de novo (o leitor de tela anuncia outra vez)
    vi.mocked(supabase.functions.invoke).mockReturnValueOnce(new Promise((r) => { responder = r }) as never)
    fireEvent.change(screen.getByLabelText('Mensagem para o Evo'), { target: { value: 'De novo' } })
    fireEvent.keyDown(screen.getByLabelText('Mensagem para o Evo'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar central do Evo' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await act(async () => { responder({ data: { ok: true, reply_md: 'Outra', usage_id: 'y', restante: 1 }, error: null }) })
    expect(await screen.findByText('Nova resposta do Evo')).toBeInTheDocument()
  })

  it('proposta: edição e "criando" sobrevivem a fechar e reabrir o painel; só 1 evento criado', async () => {
    role = 'producer'
    criar.mockClear()
    let terminar: (v: { id: string }) => void = () => {}
    criar.mockImplementationOnce(() => new Promise<{ id: string }>((r) => { terminar = r }))
    vi.mocked(supabase.functions.invoke).mockReset()
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: { ok: true, reply_md: 'Plano', usage_id: 'u-9', restante: 1, proposal: {
      title: 'Forró da Vila', description: 'd', category: 'show', temas: ['musica'], estilos: ['forro'], venue_city: 'Recife', venue_state: 'PE', capacity: 300, tickets: [] } }, error: null } as never)
    montar()
    const reabrir = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fechar central do Evo' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
      await screen.findByRole('dialog')
    }
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    fireEvent.change(await screen.findByLabelText('Mensagem para o Evo'), { target: { value: 'Monte o rascunho' } })
    fireEvent.keyDown(screen.getByLabelText('Mensagem para o Evo'), { key: 'Enter' })
    await screen.findByText('Plano')
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Descrição editada' } })
    await reabrir()
    expect(screen.getByLabelText('Descrição')).toHaveValue('Descrição editada')
    fireEvent.click(screen.getByRole('button', { name: 'Criar rascunho do evento' }))
    await reabrir()
    const botao = screen.getByRole('button', { name: 'Criar rascunho do evento' })
    expect(botao).toBeDisabled()
    fireEvent.click(botao)
    expect(criar).toHaveBeenCalledTimes(1)
    await act(async () => { terminar({ id: 'ev1' }) })
    expect(await screen.findByRole('link', { name: 'Abrir rascunho' })).toHaveAttribute('href', '/producer/events/ev1/edit')
    expect(criar).toHaveBeenCalledTimes(1)
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ description: 'Descrição editada' }) }))
  })

  it('planejar: o que foi digitado no formulário sobrevive a fechar e reabrir', async () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Planejar meu primeiro evento' }))
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Caruaru' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar central do Evo' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    expect(await screen.findByLabelText('Cidade')).toHaveValue('Caruaru')
  })

  it('função fora do ar não culpa a conexão (404, 5xx, CORS) e offline sim', async () => {
    const erro = (name: string, context: unknown) => ({ data: null, error: Object.assign(new Error(name), { name, context }) })
    vi.mocked(supabase.functions.invoke).mockReset()
    vi.mocked(supabase.functions.invoke)
      .mockResolvedValueOnce(erro('FunctionsHttpError', new Response('{"code":"NOT_FOUND"}', { status: 404 })) as never)
      .mockResolvedValueOnce(erro('FunctionsHttpError', new Response('{}', { status: 503 })) as never)
      .mockResolvedValueOnce(erro('FunctionsFetchError', new TypeError('Failed to fetch')) as never)
      .mockResolvedValueOnce(erro('FunctionsFetchError', new TypeError('Failed to fetch')) as never)
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    const perguntar = async (t: string) => {
      fireEvent.change(await screen.findByLabelText('Mensagem para o Evo'), { target: { value: t } })
      fireEvent.keyDown(screen.getByLabelText('Mensagem para o Evo'), { key: 'Enter' })
      await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument())
      await waitFor(() => expect(screen.queryByText('O Evo está pensando…')).toBeNull())
    }
    await perguntar('um')
    expect(screen.getByText('O Evo ainda não está disponível. Tente mais tarde.')).toBeInTheDocument()
    await perguntar('dois')
    expect(screen.getAllByText('O Evo está com instabilidade. Tente de novo em instantes.')).toHaveLength(1)
    await perguntar('três')
    expect(screen.getAllByText('O Evo está com instabilidade. Tente de novo em instantes.')).toHaveLength(2)
    expect(screen.queryByText(/Confira sua conexão/)).toBeNull()
    const offline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await perguntar('quatro')
    offline.mockRestore()
    expect(screen.getByText('Não consegui falar com o Evo. Confira sua conexão e tente de novo.')).toBeInTheDocument()
  })

  it('saldo: erro sai do "Carregando…" na hora; função inexistente avisa que o Evo não está disponível', async () => {
    const { unmount } = montar({ data: null, error: { code: 'PGRST202', message: 'not found' } })
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    expect(await screen.findByText('O Evo ainda não está disponível. Tente mais tarde.')).toBeInTheDocument()
    unmount()
    montar({ data: null, error: { code: '500', message: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    expect(await screen.findByText('Não consegui ver seus créditos agora.')).toBeInTheDocument()
    expect(supabase.rpc).toHaveBeenCalledTimes(1) // sem novas tentativas
  })

  it('selo soma as respostas não lidas da equipe (aba "Falar com a Evokaa")', async () => {
    mem['evo-convite-v1'] = JSON.stringify({ aberto: true, fechados: 0 })
    montar(SALDO_OK, [
      { id: 'c1', status: 'open', last_reply_at: '2026-09-30T12:05:00Z', customer_last_read_at: '2026-09-30T12:00:00Z', last_message_at: '2026-09-30T12:05:00Z' },
      { id: 'c2', status: 'open', last_reply_at: '2026-09-30T11:00:00Z', customer_last_read_at: '2026-09-30T11:30:00Z', last_message_at: '2026-09-30T11:00:00Z' },
    ])
    const botao = await screen.findByRole('button', { name: 'Falar com o Evo (1 resposta nova)' })
    expect(botao).toHaveTextContent('1')
    expect(supabase.channel).toHaveBeenCalled()
  })

  it('Evo flutuante: sem moldura (ring/rounded) e focável por Tab', async () => {
    mem['evo-convite-v1'] = JSON.stringify({ aberto: true, fechados: 0 })
    montar()
    const botao = screen.getByRole('button', { name: 'Falar com o Evo' })
    expect(botao.className).not.toMatch(/\b(ring|rounded)-/)
    await userEvent.tab()
    expect(botao).toHaveFocus()
  })
})

describe('EvoHub: pergunta do tour da tela (V9b)', () => {
  const CONVITE = 'Oi! Sou o Evo 👋 Posso te ajudar a planejar seu evento.'
  const PERGUNTA = 'Primeira vez em Eventos? Quer ver em 4 passos?'
  // onboarding_logs com memória: o upsert grava na lista, como o banco faria
  let registros: { step_name: string }[]
  let upserts: ReturnType<typeof vi.fn>
  function montarTour(rota: string, feitos: string[] = []) {
    registros = feitos.map((step_name) => ({ step_name }))
    upserts = vi.fn((linha: { step_name: string }) => { registros.push({ step_name: linha.step_name }); return Promise.resolve({ error: null }) })
    return montar(SALDO_OK, [], rota, (tabela) =>
      tabela === 'onboarding_logs' ? { select: () => ({ eq: () => Promise.resolve({ data: registros, error: null }) }), upsert: upserts } : undefined)
  }
  const COOKIES = 'aura-cookie-consent'
  const semConvitePrevio = () => { role = 'producer'; delete mem['evo-convite-v1'] }

  it('tela com tour não feito: vira a pergunta (sem emoji, com Mostrar e Agora não) e Mostrar põe ?tour=', async () => {
    semConvitePrevio()
    montarTour('/producer/events')
    expect(await screen.findByRole('button', { name: 'Mostrar' }, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText(CONVITE)).toBeNull()
    expect(screen.getByText(PERGUNTA, { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Ver esta tela em 4 passos?')).toBeInTheDocument() // versão compacta (< 380 px)
    expect(screen.getByRole('status')).toHaveTextContent(PERGUNTA) // a região ao vivo anuncia a pergunta
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
    expect(screen.getByTestId('local')).toHaveTextContent('/producer/events?tour=eventos')
    expect(screen.queryByRole('button', { name: 'Mostrar' })).toBeNull()
    expect(upserts).not.toHaveBeenCalled() // o registro do tour vem do ProducerLayout, ao fim
  })

  it('Agora não grava dica:<id>, fecha e a pergunta não volta', async () => {
    semConvitePrevio()
    const { unmount } = montarTour('/producer/events')
    await screen.findByRole('button', { name: 'Mostrar' }, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }))
    await waitFor(() => expect(upserts).toHaveBeenCalledWith(expect.objectContaining({ step_name: 'dica:eventos', skipped: false }), { onConflict: 'user_id,step_name' }))
    expect(screen.queryByText(PERGUNTA)).toBeNull()
    expect(screen.getByTestId('local')).toHaveTextContent(/^\/producer\/events$/)
    // outra carga da mesma tela: já dispensado, vale o convite normal
    unmount()
    montarTour('/producer/events', ['dica:eventos'])
    expect(await screen.findByText(CONVITE, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText(PERGUNTA)).toBeNull()
  })

  it('o X da pergunta vale como Agora não: grava dica:<id> e devolve o foco ao mascote', async () => {
    semConvitePrevio()
    montarTour('/producer/events')
    await screen.findByRole('button', { name: 'Mostrar' }, { timeout: 4000 })
    const x = screen.getByRole('button', { name: 'Fechar aviso do Evo' })
    x.focus()
    fireEvent.click(x)
    await waitFor(() => expect(upserts).toHaveBeenCalledWith(expect.objectContaining({ step_name: 'dica:eventos' }), { onConflict: 'user_id,step_name' }))
    expect(screen.queryByRole('button', { name: 'Mostrar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Falar com o Evo' })).toHaveFocus()
  })

  it('Mostrar mantém os outros parâmetros da URL', async () => {
    semConvitePrevio()
    montarTour('/producer/events?eventId=ev9')
    fireEvent.click(await screen.findByRole('button', { name: 'Mostrar' }, { timeout: 4000 }))
    expect(screen.getByTestId('local')).toHaveTextContent('/producer/events?eventId=ev9&tour=eventos')
  })

  it('navegar para tela cujo tour já foi feito: a pergunta sai e não volta', async () => {
    semConvitePrevio()
    montarTour('/producer/events', ['tour:inicio'])
    await screen.findByRole('button', { name: 'Mostrar' }, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: 'ir para o início' }))
    expect(screen.queryByRole('button', { name: 'Mostrar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agora não' })).toBeNull()
  })

  it('tour aberto por outro caminho (?tour= na URL): a pergunta sai e não volta ao fechar o tour', async () => {
    semConvitePrevio()
    montarTour('/producer/events')
    await screen.findByRole('button', { name: 'Mostrar' }, { timeout: 4000 })
    fireEvent.click(screen.getByRole('button', { name: 'abrir tour por outro caminho' }))
    expect(screen.queryByRole('button', { name: 'Mostrar' })).toBeNull()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    fireEvent.click(screen.getByRole('button', { name: 'fechar o tour' })) // tour termina: URL sem ?tour=
    expect(screen.getByTestId('local')).toHaveTextContent(/^\/producer\/events$/)
    expect(screen.queryByRole('button', { name: 'Mostrar' })).toBeNull()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('?tour= na URL antes dos 2 s: nenhum balão (nem o convite comum por baixo do tour)', async () => {
    semConvitePrevio()
    montarTour('/producer/finance?tour=eventos')
    await new Promise((r) => setTimeout(r, 2500))
    expect(screen.queryByText(CONVITE)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mostrar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fechar aviso do Evo' })).toBeNull()
  })

  it('o X do convite comum devolve o foco ao mascote', async () => {
    semConvitePrevio()
    montarTour('/producer/finance')
    await screen.findByText(CONVITE, {}, { timeout: 4000 })
    const x = screen.getByRole('button', { name: 'Fechar aviso do Evo' })
    x.focus()
    fireEvent.click(x)
    expect(screen.queryByText(CONVITE)).toBeNull()
    expect(screen.getByRole('button', { name: 'Falar com o Evo' })).toHaveFocus()
  })

  it.each(['user', 'admin'])('%s: sem tour, não lê onboarding_logs e vale o convite normal', async (papel) => {
    role = papel
    delete mem['evo-convite-v1']
    vi.mocked(supabase.from).mockClear() // as chamadas de outros casos ficam no mock
    montarTour('/producer/events')
    expect(await screen.findByText(papel === 'admin' ? CONVITE : 'Oi! Sou o Evo 👋 Precisa de ajuda?', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mostrar' })).toBeNull()
    expect(vi.mocked(supabase.from).mock.calls.map((c) => c[0])).not.toContain('onboarding_logs')
    role = 'producer'
  })

  it('com tour:<id> gravado: convite normal', async () => {
    semConvitePrevio()
    montarTour('/producer/events', ['tour:eventos'])
    expect(await screen.findByText(CONVITE, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText(PERGUNTA)).toBeNull()
  })

  it('tela sem tour: convite normal', async () => {
    semConvitePrevio()
    montarTour('/producer/finance')
    expect(await screen.findByText(CONVITE, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mostrar' })).toBeNull()
  })

  it('participante em /app/hub com o tour não feito: pergunta, e Mostrar põe ?tour=app-inicio', async () => {
    role = 'user'
    delete mem['evo-convite-v1']
    try {
      montarTour('/app/hub')
      expect(await screen.findByRole('button', { name: 'Mostrar' }, { timeout: 4000 })).toBeInTheDocument()
      expect(screen.getByText('Primeira vez em Início? Quer ver em 3 passos?', { selector: 'span' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
      expect(screen.getByTestId('local')).toHaveTextContent('/app/hub?tour=app-inicio')
      expect(inserts).not.toHaveBeenCalled() // quem grava é o AppLayout, ao fim
    } finally {
      role = 'producer'
    }
  })

  it('participante: Agora não grava dica:app-inicio', async () => {
    role = 'user'
    delete mem['evo-convite-v1']
    try {
      montarTour('/app/hub')
      fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }, { timeout: 4000 }))
      await waitFor(() => expect(inserts).toHaveBeenCalledWith(expect.objectContaining({ step_name: 'dica:app-inicio' })))
    } finally {
      role = 'producer'
    }
  })

  it('participante em rota sem tour: convite normal e nenhuma leitura de onboarding_logs', async () => {
    role = 'user'
    delete mem['evo-convite-v1']
    vi.mocked(supabase.from).mockClear()
    try {
      montarTour('/app/tickets')
      expect(await screen.findByText('Oi! Sou o Evo 👋 Precisa de ajuda?', {}, { timeout: 4000 })).toBeInTheDocument()
      expect(vi.mocked(supabase.from).mock.calls.map((c) => c[0])).not.toContain('onboarding_logs')
    } finally {
      role = 'producer'
    }
  })

  it('camada aberta (cookies ainda sem decisão): nem a pergunta nem o convite', async () => {
    semConvitePrevio()
    const salvo = mem[COOKIES]
    delete mem[COOKIES]
    try {
      montarTour('/producer/events')
      await new Promise((r) => setTimeout(r, 2500))
      expect(screen.queryByText(PERGUNTA)).toBeNull()
      expect(screen.queryByText(CONVITE)).toBeNull()
    } finally {
      mem[COOKIES] = salvo
    }
  })

  it('atalho "Mostrar esta tela" no chat: só navega para ?tour= e fecha o painel, sem gravar nem perguntar ao Evo', async () => {
    role = 'producer'
    mem['evo-convite-v1'] = JSON.stringify({ aberto: true, fechados: 0 })
    vi.mocked(supabase.functions.invoke).mockReset()
    montarTour('/producer/events')
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mostrar esta tela' }))
    expect(screen.getByTestId('local')).toHaveTextContent('/producer/events?tour=eventos')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(upserts).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('atalho "Mostrar esta tela" não aparece em tela sem tour', async () => {
    role = 'producer'
    mem['evo-convite-v1'] = JSON.stringify({ aberto: true, fechados: 0 })
    montarTour('/producer/finance')
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o Evo' }))
    await screen.findByLabelText('Mensagem para o Evo')
    expect(screen.queryByRole('button', { name: 'Mostrar esta tela' })).toBeNull()
  })
})
