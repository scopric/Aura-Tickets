import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as exportCsv from '../lib/exportCsv'
import EventOverview from '../pages/producer/EventOverview'
import { colunas, inicioDaSerie, serieDiaria } from '../lib/visaoEvento'

// Supabase falso (mesmo molde do Início): guarda a cadeia de chamadas e responde por tabela
type Chamada = [string, unknown[]]
type Resposta = { data?: unknown; error: unknown; count?: number | null }
const tabelas: Record<string, (c: Chamada[]) => Resposta> = {}
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Ricardo Scoparo' } }) }))
const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => { const p = Promise.resolve(rpc(...a)); return Object.assign(p, { abortSignal: () => p }) },
    auth: { mfa: { getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: 'aal2', nextLevel: 'aal2' } }) } },
    from: (t: string) => {
      const c: Chamada[] = []
      const r = () => Promise.resolve(tabelas[t](c))
      type Cb = (v: unknown) => unknown
      const b: object = new Proxy({}, {
        get: (_o, k) => k === 'then' ? (ok: Cb, no: Cb) => r().then(ok, no)
          : (...a: unknown[]) => { c.push([String(k), a]); return b },
      })
      return b
    },
  },
}))

const agora = () => new Date().toISOString()
const hojeISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const diaEm = (d: number) => new Date(Date.now() + d * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const tipo = (id: string, name: string, quantity_total: number, extra: object = {}) =>
  ({ id, event_id: 'e1', name, price: 50, quantity_total, capacity: quantity_total, sold: 0, is_active: true, sale_start: null, ...extra })
const evento = (extra: object = {}) => ({
  id: 'e1', producer_id: 'u1', title: 'Noite de Forró', slug: 'noite-de-forro', status: 'published', approval_status: 'approved',
  date: diaEm(10), time: '22:00:00', start_date: `${diaEm(10)}T22:00:00-03:00`, created_at: agora(),
  venue_name: 'Espaço Torres', venue_city: 'Curitiba', cover_image: null, image_url: null, accent_color: '#a55c65', capacity: null,
  ticket_types: [tipo('ta', 'Pista', 2), tipo('tb', 'Camarote', 10), tipo('tc', 'Pista 2º lote', 8, { sale_start: `${diaEm(5)}T12:00:00Z` })],
  ...extra,
})

type Linha = Record<string, unknown>
type Opcoes = { eventos?: object[]; ingressos?: Linha[]; pagos?: Linha[]; iniciados?: number; entraram?: number; erroIngressos?: boolean }
// aplica à fixture os filtros da cadeia que a tela usa (eq nas colunas que a linha tem e gte)
const filtra = (linhas: Linha[], c: Chamada[]) => linhas.filter(l => c.every(([n, a]) => {
  const col = a[0] as string
  return n === 'eq' ? !(col in l) || l[col] === a[1] : n === 'gte' ? String(l[col]) >= String(a[1]) : true
}))
function dadosDoBanco({ eventos = [evento()], ingressos = [], pagos = [], iniciados = 0, entraram = 0, erroIngressos = false }: Opcoes = {}) {
  tabelas.events = c => {
    const dono = c.find(([n, a]) => n === 'eq' && a[0] === 'producer_id')?.[1][1]
    return { data: eventos.filter(e => (e as { producer_id: string }).producer_id === dono), error: null }
  }
  tabelas.orders = c => {
    if (!c.some(([n, a]) => n === 'eq' && a[0] === 'status')) return { data: null, error: null, count: iniciados }
    const l = filtra(pagos, c)
    return { data: l, error: null, count: l.length }
  }
  // RPC produtor_vendas_pagas: soma a fixture `pagos` (por dia de Brasília)
  const porDia = new Map<string, { dia: string; pedidos: number; total: number }>()
  for (const p of pagos) {
    const dia = new Date(p.created_at as string).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const d = porDia.get(dia) ?? { dia, pedidos: 0, total: 0 }
    d.pedidos += 1; d.total += Number(p.total); porDia.set(dia, d)
  }
  rpc.mockResolvedValue({ data: { total: pagos.reduce((s, p) => s + Number(p.total), 0), pedidos: pagos.length, reembolsados: { pedidos: 0, total: 0 }, por_evento: [], por_dia: [...porDia.values()], por_forma: [] }, error: null })
  tabelas.tickets = c => {
    if (c.some(([n]) => n === 'not')) return { data: null, error: null, count: entraram }
    if (erroIngressos) return { data: null, error: { message: 'falhou' } }
    const l = filtra(ingressos, c)
    const head = (c.find(([n]) => n === 'select')?.[1][1] as { head?: boolean } | undefined)?.head
    return { data: head ? null : l, error: null, count: l.length }
  }
}

const montar = (url = '/producer/event/e1') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}><Routes><Route path="/producer/event/:eventId" element={<EventOverview />} /></Routes></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => { localStorage.clear(); rpc.mockReset() })

describe('Visão geral do evento (V7)', () => {
  it('vendidos, hoje, bruto, esgotado, "abre em" e funil vêm do banco', async () => {
    dadosDoBanco({
      ingressos: [
        { ticket_type_id: 'ta', created_at: agora() }, { ticket_type_id: 'ta', created_at: agora() }, // Pista esgotada (2 de 2)
        { ticket_type_id: 'tb', created_at: agora() },
        { ticket_type_id: 'tb', created_at: '2020-01-01T15:00:00Z' }, // venda antiga: não conta em "hoje"
      ],
      pagos: [{ total: 55, created_at: agora() }, { total: 110, created_at: '2020-01-01T15:00:00Z' }],
      iniciados: 4,
    })
    montar()
    expect(await screen.findByRole('heading', { level: 1, name: 'Noite de Forró' })).toBeTruthy()
    expect(screen.getByText('Publicado')).toBeTruthy()
    expect(screen.getByText(/Espaço Torres, Curitiba/)).toBeTruthy()
    expect(screen.getByText('20 lugares')).toBeTruthy() // 2 + 10 + 8

    const barra = await screen.findByRole('progressbar', { name: 'Ingressos vendidos' })
    expect(barra.getAttribute('aria-valuenow')).toBe('4')
    expect(barra.getAttribute('aria-valuemax')).toBe('20')
    expect(screen.getByText('de 20 vendidos')).toBeTruthy()
    expect(screen.getByText('20%')).toBeTruthy()
    expect(screen.getByText(/R\$\s55,00 hoje · 3 ingressos hoje · R\$\s165,00 bruto/)).toBeTruthy()
    expect(screen.queryByText(/líquido/)).toBeNull()

    const lista = within(screen.getByRole('region', { name: 'Ingressos' }))
    expect(lista.getByText('2/2')).toBeTruthy()
    expect(lista.getByText('Esgotado')).toBeTruthy()
    expect(lista.getByText('2/10')).toBeTruthy()
    expect(lista.getByText(/^abre em \d+ [a-zç]{3}$/)).toBeTruthy()
    expect(screen.getByRole('img', { name: /De 20 lugares: Pista 2, Camarote 2, não vendidos 16/ })).toBeTruthy()

    expect(screen.getByText('Pedidos iniciados')).toBeTruthy()
    expect(screen.getByText('50% dos pedidos foram pagos · não pagos: 2 (pendentes, recusados, cancelados e reembolsados)')).toBeTruthy()
    expect(screen.queryByText(/desistiram/)).toBeNull()
    expect(screen.getByRole('img', { name: /Ingressos vendidos por semana.*4 no total/ })).toBeTruthy() // série longa: uma barra por semana

    // sem fonte no banco: não aparece
    expect(screen.queryByText(/visitas/i)).toBeNull()
    expect(screen.queryByText(/De onde vêm/i)).toBeNull()
    expect(screen.queryByText(/Entraram/)).toBeNull() // não é o dia do evento
  })

  it('sem pedido e sem venda: vazio honesto, sem número inventado', async () => {
    dadosDoBanco()
    montar()
    expect(await screen.findByText('Nenhum pedido ainda.')).toBeTruthy()
    expect(screen.getByText('Nenhum ingresso vendido ainda.')).toBeTruthy()
    expect(screen.getByText(/R\$\s0,00 hoje · 0 ingressos hoje · R\$\s0,00 bruto/)).toBeTruthy()
  })

  it('evento de outro produtor (ou que não existe): "Evento não encontrado"', async () => {
    dadosDoBanco({ eventos: [evento({ id: 'e9', producer_id: 'outro' })] })
    montar('/producer/event/e9')
    expect(await screen.findByText('Evento não encontrado')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('só no dia do evento aparece "Entraram"', async () => {
    dadosDoBanco({
      eventos: [evento({ date: hojeISO(), start_date: agora() })],
      ingressos: [{ ticket_type_id: 'ta', created_at: agora() }],
      entraram: 1,
    })
    montar()
    const faixa = await screen.findByRole('region', { name: 'Hoje é o dia do evento' })
    expect(faixa.textContent).toMatch(/Entraram: 1 de 1 ingressos/)
    expect(within(faixa).getByRole('link', { name: /Abrir check-in/ }).getAttribute('href')).toBe('/producer/checkin?eventId=e1')
  })

  it('dia do evento cancelado ou encerrado: sem a faixa "Entraram"', async () => {
    dadosDoBanco({ eventos: [evento({ date: hojeISO(), start_date: agora(), status: 'cancelled' })], entraram: 3 })
    montar()
    expect(await screen.findByRole('heading', { level: 1, name: 'Noite de Forró' })).toBeTruthy()
    await screen.findByText('Nenhum ingresso vendido ainda.')
    expect(screen.queryByText('Hoje é o dia do evento')).toBeNull()
  })

  it('evento sem data: "sem data" e nada de dia do evento', async () => {
    dadosDoBanco({ eventos: [evento({ date: null, start_date: agora() })], ingressos: [{ ticket_type_id: 'ta', created_at: agora() }] })
    montar()
    expect(await screen.findByText('sem data')).toBeTruthy()
    await screen.findByRole('img', { name: /Ingressos vendidos por dia/ })
    expect(screen.queryByText('Hoje é o dia do evento')).toBeNull()
    expect(screen.queryByText(/até o evento|faltam/)).toBeNull()
  })

  it('erro nas vendas: aviso com "Tentar de novo" e o cabeçalho continua', async () => {
    dadosDoBanco({ erroIngressos: true })
    montar()
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent('Não foi possível carregar as vendas deste evento.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Noite de Forró' })).toBeTruthy()
  })

  it('ações: Editar leva à edição, Ver página ao site público e a estrela grava em evk.nav.fixados', async () => {
    dadosDoBanco()
    montar()
    const grupo = within(await screen.findByRole('group', { name: 'Ações do evento' }))
    expect(grupo.getByRole('link', { name: 'Editar' }).getAttribute('href')).toBe('/producer/events/e1/edit')
    expect(grupo.getByRole('link', { name: /Ver página/ }).getAttribute('href')).toMatch(/\/event\/noite-de-forro$/)
    const estrela = grupo.getByRole('button', { name: 'Fixar evento na lateral' })
    expect(estrela.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(estrela)
    expect(JSON.parse(localStorage.getItem('evk.nav.fixados')!)).toEqual(['e1'])
    expect(grupo.getByRole('button', { name: 'Fixar evento na lateral' }).getAttribute('aria-pressed')).toBe('true') // o nome não muda, só o estado
  })

  it('fixar em outra aba (evento storage) atualiza a estrela', async () => {
    dadosDoBanco()
    montar()
    const estrela = await screen.findByRole('button', { name: 'Fixar evento na lateral' })
    localStorage.setItem('evk.nav.fixados', JSON.stringify(['e1']))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'evk.nav.fixados' })) })
    expect(estrela.getAttribute('aria-pressed')).toBe('true')
  })

  it('rascunho: sem "Ver página" nem "Compartilhar" (a página pública ainda não existe)', async () => {
    dadosDoBanco({ eventos: [evento({ status: 'draft' })] })
    montar()
    const grupo = within(await screen.findByRole('group', { name: 'Ações do evento' }))
    expect(screen.getByText('Rascunho')).toBeTruthy()
    expect(grupo.queryByText(/Ver página/)).toBeNull()
    expect(grupo.queryByText('Compartilhar')).toBeNull()
    expect(grupo.getByRole('link', { name: 'Editar' })).toBeTruthy()
  })
})

describe('Visão geral: período, soma no banco e CSV (L5)', () => {
  it('bruto e "hoje" vêm da RPC (mais de 1.000 pedidos), sem "+" nem "soma parcial"', async () => {
    dadosDoBanco()
    rpc.mockResolvedValue({ data: { total: 123456.7, pedidos: 1500, reembolsados: { pedidos: 0, total: 0 }, por_evento: [], por_forma: [],
      por_dia: [{ dia: hojeISO(), pedidos: 3, total: 300 }, { dia: '2020-01-01', pedidos: 1497, total: 123156.7 }] }, error: null })
    montar()
    expect(await screen.findByText(/R\$\s300,00 hoje · 0 ingressos hoje · R\$\s123\.456,70 bruto/)).toBeTruthy()
    expect(screen.queryByText(/Soma parcial/)).toBeNull()
    expect(screen.queryByText(/\+ (hoje|bruto)/)).toBeNull()
  })

  it('?periodo=7d manda p_de e p_event_id; sem período, p_de é nulo', async () => {
    dadosDoBanco()
    montar('/producer/event/e1?periodo=7d')
    await screen.findByText('Nenhum pedido ainda.')
    expect(rpc).toHaveBeenCalledWith('produtor_vendas_pagas', expect.objectContaining({ p_event_id: 'e1', p_de: expect.any(String) }))
    rpc.mockClear()
    montar()
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('produtor_vendas_pagas', expect.objectContaining({ p_de: null, p_event_id: 'e1' })))
  })

  it('Exportar CSV baixa dia, pedidos_pagos e valor_bruto com vírgula decimal', async () => {
    dadosDoBanco()
    rpc.mockResolvedValue({ data: { total: 150.5, pedidos: 3, reembolsados: { pedidos: 0, total: 0 }, por_evento: [], por_forma: [],
      por_dia: [{ dia: '2026-10-01', pedidos: 3, total: 150.5 }] }, error: null })
    const baixa = vi.spyOn(exportCsv, 'downloadCsv').mockImplementation(() => {})
    montar()
    await screen.findByText(/bruto/)
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    expect(baixa).toHaveBeenCalledTimes(1)
    const [nome, csv] = baixa.mock.calls[0]
    expect(nome).toMatch(/^evokaa-vendas-noite-de-forro-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(csv).toContain('dia;pedidos_pagos;valor_bruto')
    expect(csv).toContain('2026-10-01;3;"150,50"')
    baixa.mockRestore()
  })
})

describe('série de vendas por dia', () => {
  it('vai do começo até o dia do evento e venda depois do evento cai no último dia', () => {
    const s = serieDiaria(
      [
        { ticket_type_id: 'a', created_at: '2026-10-01T15:00:00Z' },
        { ticket_type_id: 'b', created_at: '2026-10-03T15:00:00Z' },
        { ticket_type_id: 'a', created_at: '2026-10-09T15:00:00Z' },
        { ticket_type_id: 'x', created_at: '2026-10-02T15:00:00Z' }, // tipo que não é do evento: fora
      ],
      ['a', 'b'], '2026-10-01', '2026-10-05',
    )
    expect(s.dias).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'])
    expect(s.porDia).toEqual([[1, 0], [0, 0], [0, 1], [0, 0], [1, 0]])
  })

  it('começa na 1ª venda ou na abertura; sem venda antiga, nunca antes de 120 dias do evento', () => {
    expect(inicioDaSerie([], [], '2026-10-05')).toBe('2026-10-05')
    expect(inicioDaSerie([{ created_at: '2026-09-20T15:00:00Z' }], [], '2026-10-05')).toBe('2026-09-20')
    expect(inicioDaSerie([{ created_at: '2026-09-20T15:00:00Z' }], ['2026-09-01T12:00:00Z'], '2026-10-05')).toBe('2026-09-01')
    expect(inicioDaSerie([], ['2025-01-01T12:00:00Z'], '2026-10-05')).toBe('2026-06-07') // 120 dias antes
    expect(inicioDaSerie([{ created_at: '2025-12-01T15:00:00Z' }], ['2025-01-01T12:00:00Z'], '2026-10-05')).toBe('2025-12-01') // venda anterior vale
  })

  it('colunas semanais contam do fim: a última termina no dia do evento', () => {
    const s = serieDiaria([], [], '2026-10-01', '2026-10-05')
    expect(colunas(s, 1)).toHaveLength(5)
    expect(colunas(s, 2).map(c => [c.de, c.ate])).toEqual([[0, 0], [1, 2], [3, 4]])
  })
})
