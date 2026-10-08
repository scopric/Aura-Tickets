import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProducerDashboard from '../pages/producer/Dashboard'

const confetti = vi.hoisted(() => vi.fn())
vi.mock('canvas-confetti', () => ({ default: confetti }))

// Supabase falso: guarda a cadeia de chamadas (.select().eq().in()...) e responde por tabela
type Chamada = [string, unknown[]]
type Resposta = { data?: unknown; error: unknown; count?: number | null }
const tabelas: Record<string, (c: Chamada[]) => Resposta> = {}
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Ricardo Scoparo' } }) }))
// RPC produtor_vendas_pagas e nível do 2FA: por padrão falham (a tela cai na soma parcial)
const rpc = vi.hoisted(() => ({ soma: vi.fn(), nivel: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (_nome: string, args: unknown) => { const p = Promise.resolve(rpc.soma(args)); return Object.assign(p, { abortSignal: () => p }) },
    auth: { mfa: { getAuthenticatorAssuranceLevel: () => Promise.resolve(rpc.nivel()) } },
    from: (t: string) => {
      const c: Chamada[] = []
      const r = () => Promise.resolve(tabelas[t](c))
      type Cb = (v: unknown) => unknown
      const b: object = new Proxy({}, {
        get: (_o, k) => k === 'then' ? (ok: Cb, no: Cb) => r().then(ok, no)
          : k === 'maybeSingle' ? r
          : (...a: unknown[]) => { c.push([String(k), a]); return b },
      })
      return b
    },
  },
}))
let reduzir = true // prefers-reduced-motion
vi.stubGlobal('matchMedia', () => ({ matches: reduzir }))

const DIA = 86400000
const ha = (dias: number, min = 0) => new Date(Date.now() - dias * DIA - min * 60000).toISOString()

type Pedido = { total: number; created_at: string; event_id: string }
type Ingresso = { order_id: string; event_id: string; ticket_type_id: string; created_at: string }
const pedidos = (linhas: Pedido[], count = linhas.length) => () => ({ data: linhas, error: null, count })
// o check-in usa .not(); a contagem de um evento, .eq('event_id'); as vendas, .in('status') sem eq de evento
const ingressos = (linhas: Ingresso[], checkin = false, count = linhas.length) => (c: Chamada[]): Resposta => {
  if (c.some(([n]) => n === 'not')) return { data: checkin ? [{ id: 't1' }] : [], error: null }
  const ev = c.find(([n, a]) => n === 'eq' && a[0] === 'event_id')
  return ev ? { data: null, error: null, count: linhas.filter(l => l.event_id === ev[1][1]).length } : { data: linhas, error: null, count }
}
const ing = (n: number, ordem = (i: number) => `o${i}`): Ingresso[] =>
  Array.from({ length: n }, (_, i) => ({ order_id: ordem(i), event_id: 'e1', ticket_type_id: 'tt1', created_at: ha(0, i + 1) }))

const e1 = {
  id: 'e1', title: '[TESTE] Show', status: 'published', approval_status: 'pending', date: '2099-01-10', time: '22:00:00',
  start_date: '2099-01-10T20:00:00Z', capacity: null, accent_color: null, cover_image: null, image_url: null,
  venue_name: 'Espaço Torres', venue_city: 'Curitiba',
  ticket_types: [{ id: 'tt1', name: 'Pista', quantity_total: 100, capacity: null, is_active: true }],
}
const noAr = { ...e1, approval_status: 'approved', approved_at: ha(1) }
const lote10 = { ...noAr, ticket_types: [{ id: 'tt1', name: 'Pista', quantity_total: 10, capacity: null, is_active: true }] }
const passado = { ...e1, id: 'e2', title: 'Rascunho velho', status: 'draft', date: '2020-01-01', start_date: '2020-01-01T00:00:00Z', capacity: 50, ticket_types: [] }

const aba = (nome: RegExp) => screen.getByRole('tab', { name: nome })
const montar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={['/producer/dashboard']}><ProducerDashboard /></MemoryRouter></QueryClientProvider>)
  return qc
}
// onboarding_logs com memória: o que o registrar() grava volta na próxima leitura
const gravados: string[] = []
const preparar = (eventos: unknown[], p: Pedido[], i: Ingresso[], opcoes: { empresa?: boolean; cortado?: number } = {}) => {
  tabelas.events = () => ({ data: eventos, error: null })
  tabelas.producer_profiles = () => ({ data: opcoes.empresa ? { company_name: 'Seda' } : null, error: opcoes.empresa ? null : { code: '42501' } })
  tabelas.profiles = () => ({ data: { full_name: 'Fulano de Tal' }, error: null })
  tabelas.orders = pedidos(p, opcoes.cortado)
  tabelas.tickets = ingressos(i, false, opcoes.cortado)
  gravados.length = 0
  tabelas.onboarding_logs = c => {
    const grava = c.find(([n]) => n === 'upsert')
    if (grava) {
      expect(grava[1][1]).toEqual({ onConflict: 'user_id,step_name' }) // o índice único do banco
      gravados.push((grava[1][0] as { step_name: string }).step_name); return { data: null, error: null }
    }
    return { data: gravados.map(step_name => ({ step_name })), error: null }
  }
}

const vazio = { total: 0, pedidos: 0, reembolsados: { pedidos: 0, total: 0 }, por_evento: [], por_dia: [], por_forma: [] }
beforeEach(() => {
  localStorage.clear(); reduzir = true; confetti.mockClear()
  rpc.soma.mockReset().mockReturnValue({ data: null, error: { message: 'sem rpc' } })
  rpc.nivel.mockReset().mockReturnValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' } })
})
afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('matchMedia', () => ({ matches: reduzir })) })

describe('Início do produtor', () => {
  it('sem eventos: data como título, convite, passos zerados e nada de gráfico', async () => {
    preparar([], [], [])
    montar()
    expect(await screen.findByText('Você ainda não tem eventos')).toBeTruthy()
    expect(await screen.findByText('0 de 5')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/^(Dom|Seg|Ter|Qua|Qui|Sex|Sáb), \d{1,2} de [a-zç]+$/)
    // o tour do Início tem onde apontar mesmo sem evento
    expect(document.querySelector('[data-tour="inicio-numeros"]')).toBeTruthy()
    expect(document.querySelector('[data-tour="inicio-checklist"]')).toBeTruthy()
    expect(document.querySelector('[data-tour="inicio-proximos"]')).toBeTruthy()
    expect(await screen.findByText('Nenhuma venda nos últimos 7 dias')).toBeTruthy()
  })

  it('com vendas: receita e ingressos do período, variação sobre o anterior, ticket médio e vendas recentes agrupadas', async () => {
    preparar([e1, passado],
      [{ total: 55, created_at: ha(0, 5), event_id: 'e1' }, { total: 110, created_at: ha(1), event_id: 'e1' }, { total: 100, created_at: ha(9), event_id: 'e1' }],
      [
        { order_id: 'o1', event_id: 'e1', ticket_type_id: 'tt1', created_at: ha(0, 5) },
        { order_id: 'o2', event_id: 'e1', ticket_type_id: 'tt1', created_at: ha(1) },
        { order_id: 'o2', event_id: 'e1', ticket_type_id: 'tt1', created_at: ha(1) },
      ], { empresa: true })
    montar()
    await screen.findByText('[TESTE] Show', { selector: 'h3' })
    await waitFor(() => expect(aba(/Receita bruta/).textContent).toMatch(/165,00/))
    expect(aba(/Receita bruta/).textContent).toMatch(/ticket médio R\$\s55,00/)
    expect(aba(/Receita bruta/).textContent).toMatch(/aumento de 65% sobre o período anterior/) // 165 contra 100
    expect(aba(/Ingressos vendidos/).textContent).toMatch(/^Ingressos vendidos3/)
    // próximo evento: só futuro, com "3 de 100" reais e o botão para a edição
    expect(screen.getByText('de 100')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('de 100').previousElementSibling?.textContent).toBe('3'))
    expect(aba(/Receita bruta/).textContent).toMatch(/inclui a taxa do comprador/)
    expect(screen.getByRole('columnheader', { name: /Receita bruta/ }).textContent).toMatch(/inclui a taxa do comprador/)
    expect(screen.getByRole('link', { name: 'Abrir evento' }).getAttribute('href')).toBe('/producer/events/e1/edit')
    // tabela: Total e evento (todas as vendas, também a de 9 dias atrás), situação em texto
    const tabela = screen.getByRole('table')
    expect(within(tabela).getByText('Em análise')).toBeTruthy()
    expect(within(tabela).getAllByText('3/100').length).toBe(1)
    expect(within(tabela).getAllByText(/265,00/).length).toBe(2)
    // vendas recentes: ingressos do mesmo pedido viram uma linha, sem nome de comprador
    expect(screen.getByText('2 × Pista')).toBeTruthy()
    expect(screen.getByText('1 × Pista')).toBeTruthy()
    expect(screen.getByText('há 5 min')).toBeTruthy()
    expect(await screen.findByText('4 de 6')).toBeTruthy() // checklist: falta o evento aprovado e o check-in
  })

  it('trocar o período refaz as contas; "Tudo" não tem período anterior', async () => {
    preparar([e1], [{ total: 80, created_at: ha(3), event_id: 'e1' }], [{ order_id: 'o1', event_id: 'e1', ticket_type_id: 'tt1', created_at: ha(3) }], { empresa: true })
    montar()
    await waitFor(() => expect(aba(/Receita bruta/).textContent).toMatch(/80,00/))
    fireEvent.click(screen.getByRole('radio', { name: 'Hoje' }))
    await waitFor(() => expect(screen.getByText('Nenhuma venda hoje')).toBeTruthy())
    fireEvent.click(screen.getByRole('radio', { name: 'Tudo' }))
    await waitFor(() => expect(aba(/Receita bruta/).textContent).toMatch(/80,00/))
    expect(screen.queryByText(/comparado a/)).toBeNull()
  })

  it('publicado e sem venda: gráfico fantasma, texto honesto e "Copiar link do evento"', async () => {
    preparar([noAr], [], [], { empresa: true })
    montar()
    expect(await screen.findByText('Nenhuma venda nos últimos 7 dias')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Copiar link do evento/ })).toBeTruthy()
    expect(screen.queryByText('Vendas recentes')).toBeNull()
    expect(aba(/Receita bruta/).textContent).toMatch(/R\$\s0,00/)
  })

  it('só rascunho e sem venda: não oferece copiar o link', async () => {
    preparar([{ ...e1, status: 'draft' }], [], [], { empresa: true })
    montar()
    expect(await screen.findByText('As vendas aparecem aqui quando um evento estiver no ar.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Copiar link/ })).toBeNull()
  })

  it('lote com 90% ou mais vendido: aviso com barra e dispensa lembrada', async () => {
    preparar([lote10], [], ing(9), { empresa: true })
    montar()
    const aviso = await screen.findByRole('region', { name: 'Evo sugere' })
    expect(aviso.textContent).toMatch(/Evo sugere.*Pista do \[TESTE\] Show: 9 de 10 vendidos\./)
    expect(aviso.textContent).toMatch(/90%/)
    expect(within(aviso).getByRole('link', { name: 'Editar ingressos' }).getAttribute('href')).toBe('/producer/events/e1/edit')
    fireEvent.click(within(aviso).getByRole('button', { name: 'Dispensar sugestão' }))
    await waitFor(() => expect(screen.queryByText(/de 10 vendidos/)).toBeNull()) // vem a próxima sugestão (sem foto)
    expect(gravados).toEqual(['celebracao:primeiro-evento', 'aviso-lote:tt1:10']) // a capacidade vai na chave: abrir mais lugares faz o aviso voltar
  })

  it('sem venda há 5 dias de aprovado: "Copiar link" copia o link daquele evento', async () => {
    const escrever = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: escrever } })
    preparar([{ ...noAr, slug: 'show-x', cover_image: 'https://x.supabase.co/capa.jpg', approved_at: ha(5) }], [], [], { empresa: true })
    montar()
    const faixa = await screen.findByRole('region', { name: 'Evo sugere' })
    expect(faixa.textContent).toMatch(/está no ar há 5 dias e ainda não vendeu/)
    fireEvent.click(within(faixa).getByRole('button', { name: 'Copiar link' }))
    await waitFor(() => expect(escrever).toHaveBeenCalledWith(expect.stringMatching(/\/event\/show-x$/)))
    fireEvent.click(within(faixa).getByRole('button', { name: 'Dispensar sugestão' }))
    await waitFor(() => expect(gravados).toEqual(['celebracao:primeiro-evento', 'sugestao:sem-venda:e1']))
  })

  it('vendas ainda carregando: nenhuma sugestão aparece (nem a que depende só dos eventos)', async () => {
    preparar([{ ...e1, cover_image: null }], [], [], { empresa: true })
    tabelas.orders = () => new Promise(() => {}) // nunca responde
    montar()
    await screen.findByText('[TESTE] Show', { selector: 'h3' })
    await new Promise(r => setTimeout(r, 300))
    expect(screen.queryByRole('region', { name: 'Evo sugere' })).toBeNull()
  })

  it('aviso de lote dispensado volta se a capacidade mudou', async () => {
    preparar([lote10], [], ing(9), { empresa: true })
    gravados.push('aviso-lote:tt1:9')
    montar()
    expect(await screen.findByRole('region', { name: 'Evo sugere' })).toBeTruthy()
  })

  it('lote abaixo de 90%, ou de evento que ainda não está no ar: sem aviso', async () => {
    preparar([lote10], [], ing(8, () => 'o'), { empresa: true })
    montar()
    await screen.findByText('8 × Pista')
    expect(screen.queryByText(/de 10 vendidos/)).toBeNull() // outra sugestão (ex.: sem foto) pode aparecer, a do lote não
    cleanup()
    preparar([{ ...lote10, approval_status: 'pending' }], [], ing(10, () => 'o'), { empresa: true })
    montar()
    await screen.findByText('10 × Pista')
    expect(screen.queryByText(/de 10 vendidos/)).toBeNull()
  })

  it('mais pedidos que o limite de linhas: soma com "+", sem ticket médio e sem variação', async () => {
    preparar([e1], [{ total: 10, created_at: ha(0, 1), event_id: 'e1' }], ing(1), { empresa: true, cortado: 1500 })
    montar()
    await waitFor(() => expect(aba(/Receita bruta/).textContent).toMatch(/10,00\+/))
    expect(aba(/Receita bruta/).textContent).toMatch(/Soma parcial: mais de 1\.000 pedidos pagos/)
    expect(aba(/Receita bruta/).textContent).not.toMatch(/ticket médio|aumento|queda/)
  })

  it('total exato do banco: sem "+" nem aviso de soma parcial, mesmo com mais de 1.000 pedidos', async () => {
    rpc.soma.mockReturnValue({ data: { ...vazio, total: 12345.67, pedidos: 1500 }, error: null })
    preparar([e1], [{ total: 10, created_at: ha(0, 1), event_id: 'e1' }], ing(1), { empresa: true, cortado: 1500 })
    montar()
    await waitFor(() => expect(aba(/Receita bruta/).textContent).toMatch(/12\.345,67/))
    expect(aba(/Receita bruta/).textContent).not.toMatch(/\+|Soma parcial/)
  })

  it('intervalo livre e evento: consulta o banco com meia-noite de São Paulo e mostra o total', async () => {
    preparar([e1], [], [], { empresa: true })
    montar()
    await screen.findByRole('region', { name: 'Filtro de vendas' })
    rpc.soma.mockReturnValue({ data: { ...vazio, total: 250, pedidos: 2 }, error: null })
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-03' } })
    fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'e1' } })
    await screen.findByText(/250,00/)
    expect(rpc.soma).toHaveBeenLastCalledWith({ p_de: '2026-10-01T03:00:00.000Z', p_ate: '2026-10-04T03:00:00.000Z', p_event_id: 'e1' })
  })

  it('"de" depois de "até": mensagem e nenhuma consulta com o filtro', async () => {
    preparar([e1], [], [], { empresa: true })
    montar()
    await screen.findByRole('region', { name: 'Filtro de vendas' })
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-10-05' } })
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-01' } })
    await screen.findByText('A data inicial não pode ser depois da final.')
    expect(rpc.soma.mock.calls.filter(c => (c[0] as { p_event_id: unknown }).p_event_id === null && (c[0] as { p_ate: unknown }).p_ate !== null)).toHaveLength(0)
  })

  it('2FA pendente: aviso no Início', async () => {
    rpc.nivel.mockReturnValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' } })
    preparar([e1], [], [], { empresa: true })
    montar()
    await screen.findByText('Confirme o 2FA para ver suas vendas')
  })

  it('lista de ingressos cortada: tabela e aviso com "+", e o próximo evento conta exato à parte', async () => {
    const nove = ing(9)
    preparar([lote10], [], nove, { empresa: true, cortado: 1500 })
    const base = tabelas.tickets
    // a contagem exata do evento (head + eq event_id) diz 1.480; a lista só trouxe 9 das 1.500
    tabelas.tickets = c => c.some(([n, a]) => n === 'eq' && a[0] === 'event_id') ? { data: null, error: null, count: 1480 } : base(c)
    montar()
    const aviso = await screen.findByRole('region', { name: 'Evo sugere' })
    expect(aviso.textContent).toMatch(/9\+ de 10 vendidos/)
    expect(screen.getByRole('table').textContent).toMatch(/9\+\/10/)
    await waitFor(() => expect(screen.getByText('de 10').previousElementSibling?.textContent).toBe('1.480'))
  })

  it('ingressos sem receita: diz "Nenhuma receita", não "Nenhuma venda"', async () => {
    preparar([noAr], [], ing(2), { empresa: true })
    montar()
    expect(await screen.findByText('Nenhuma receita nos últimos 7 dias')).toBeTruthy()
  })

  it('a aba Ingressos vendidos troca o gráfico', async () => {
    preparar([noAr], [{ total: 50, created_at: ha(0, 5), event_id: 'e1' }], ing(1), { empresa: true })
    montar()
    await waitFor(() => expect(aba(/Receita bruta/).getAttribute('aria-selected')).toBe('true'))
    fireEvent.mouseDown(aba(/Ingressos vendidos/), { button: 0 }) // o Radix troca a aba ao apertar
    await waitFor(() => expect(aba(/Ingressos vendidos/).getAttribute('aria-selected')).toBe('true'))
    expect(screen.getByRole('img', { name: /Ingressos vendidos, nos últimos 7 dias: 1/ })).toBeTruthy()
  })

  it('contagem animada vai a 0 quando o valor novo é 0', async () => {
    reduzir = false
    preparar([e1], [], ing(7), { empresa: true })
    const qc = montar()
    const valor = () => aba(/Ingressos vendidos/).querySelector('span span')?.textContent
    await waitFor(() => expect(valor()).toBe('7'), { timeout: 3000 })
    tabelas.tickets = ingressos([])
    await qc.refetchQueries()
    await new Promise(r => setTimeout(r, 100)) // deixa o React e a limpeza do efeito terminarem
    expect(valor()).toBe('0')
  })

  it('erro nas vendas: aviso dentro do painel, o resto da página fica e dá para tentar de novo', async () => {
    preparar([e1], [], [], { empresa: true })
    tabelas.orders = () => ({ data: null, error: { code: '', message: 'Failed to fetch' } })
    montar()
    // a tela tenta 1 vez de novo (retry: 1) antes de mostrar o erro
    expect(await screen.findByText('Não deu para carregar o gráfico de vendas.', {}, { timeout: 4000 })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(screen.getAllByText('[TESTE] Show').length).toBeGreaterThan(0)
    expect(screen.getByRole('table').textContent).toMatch(/—/) // vendidos e receita sem número inventado
    expect(screen.queryByText(/R\$\s0,00/)).toBeNull()
  })

  it('erro nos eventos vira aviso com "Tentar de novo", não zeros', async () => {
    preparar([], [], [])
    tabelas.events = () => ({ data: null, error: { code: '', message: 'Failed to fetch' } })
    montar()
    expect(await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 4000 })).toBeTruthy()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('empresa com o nome da própria pessoa (valor de nascença) não conta como perfil preenchido', async () => {
    preparar([e1], [], [], { empresa: true })
    tabelas.producer_profiles = () => ({ data: { company_name: 'Fulano de Tal' }, error: null })
    montar()
    await screen.findByText('[TESTE] Show', { selector: 'h3' })
    expect(await screen.findByText('Preencher o perfil da empresa')).toBeTruthy()
  })

  it('perfil com erro de rede: sem checklist (não finge "perfil não preenchido")', async () => {
    preparar([e1], [], [])
    tabelas.producer_profiles = () => ({ data: null, error: { code: '', message: 'Failed to fetch' } })
    montar()
    await screen.findByText('[TESTE] Show', { selector: 'h3' })
    await new Promise(r => setTimeout(r, 1500)) // a consulta tenta 1 vez de novo antes de falhar
    expect(screen.queryByText(/^\d de [56]$/)).toBeNull()
  })

  describe('celebração do 1º evento aprovado (Decisão 157.1)', () => {
    it('aprovado e sem registro: solta o confete e grava uma vez só', async () => {
      reduzir = false
      preparar([noAr], [], [], { empresa: true })
      montar()
      await waitFor(() => expect(confetti).toHaveBeenCalledTimes(1))
      await screen.findByText('[TESTE] Show', { selector: 'h3' })
      await new Promise(r => setTimeout(r, 300)) // sobra tempo para um segundo disparo, se houvesse
      expect(confetti).toHaveBeenCalledTimes(1)
      expect(gravados.filter(g => g === 'celebracao:primeiro-evento')).toHaveLength(1)
    })

    it('com reduzir movimento: não desenha, mas grava (não volta a celebrar depois)', async () => {
      preparar([noAr], [], [], { empresa: true })
      montar()
      await waitFor(() => expect(gravados).toContain('celebracao:primeiro-evento'))
      expect(confetti).not.toHaveBeenCalled()
    })

    it('já registrado: não solta nem grava de novo', async () => {
      reduzir = false
      preparar([noAr], [], [], { empresa: true })
      gravados.push('celebracao:primeiro-evento')
      montar()
      await screen.findByText('[TESTE] Show', { selector: 'h3' })
      await new Promise(r => setTimeout(r, 300))
      expect(confetti).not.toHaveBeenCalled()
      expect(gravados).toEqual(['celebracao:primeiro-evento'])
    })

    it('sem evento aprovado: não solta nem grava', async () => {
      reduzir = false
      preparar([e1], [], [], { empresa: true })
      montar()
      await screen.findByText('[TESTE] Show', { selector: 'h3' })
      await new Promise(r => setTimeout(r, 300))
      expect(confetti).not.toHaveBeenCalled()
      expect(gravados).not.toContain('celebracao:primeiro-evento')
    })

    const semConfete = async (eventos: unknown[]) => {
      reduzir = false
      preparar(eventos, [], [], { empresa: true })
      montar()
      await screen.findByText('[TESTE] Show', { selector: 'h3' })
      await new Promise(r => setTimeout(r, 300))
      expect(confetti).not.toHaveBeenCalled()
      expect(gravados).not.toContain('celebracao:primeiro-evento')
    }

    it('aprovado há 30 dias (conta antiga sem registro): sem confete e sem gravar', () => semConfete([{ ...noAr, approved_at: ha(30) }]))

    it('um aprovado recente e outro antigo: não é o primeiro, sem confete', () =>
      semConfete([noAr, { ...noAr, id: 'e3', title: 'Outro', approved_at: ha(30) }]))

    it('aprovado sem approved_at: sem confete', () => semConfete([{ ...noAr, approved_at: null }]))

    it('leitura do registro com erro: sem confete e sem gravar (não repete a festa)', async () => {
      reduzir = false
      preparar([noAr], [], [], { empresa: true })
      tabelas.onboarding_logs = () => ({ data: null, error: { code: '', message: 'Failed to fetch' } })
      montar()
      await screen.findByText('[TESTE] Show', { selector: 'h3' })
      await new Promise(r => setTimeout(r, 300))
      expect(confetti).not.toHaveBeenCalled()
      expect(gravados).toEqual([])
    })
  })
})
