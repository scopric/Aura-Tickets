import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { Environment, SeatNode } from '../pages/producer/mapa/modelo'

const bd = vi.hoisted(() => ({ lido: { data: null as any, error: null }, gravado: null as any, opcoes: null as any }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => bd.lido }) }),
      upsert: async (linha: unknown, opcoes: unknown) => { bd.gravado = linha; bd.opcoes = opcoes; return { error: null } },
    }),
  },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

import { useMapa } from '../pages/producer/mapa/usarMapa'
import { TEMPLATES, aplicarTemplate } from '../pages/producer/mapa/templates'
import { novosPavimentos } from '../pages/producer/mapa/modelo'
import { resumoVenda, lugaresDaMesa } from '../pages/producer/mapa/regras'
import { ESTRUTURA } from '../pages/producer/mapa/paleta'

const ENV = { id: 'terreo', name: 'T', seats: [], sections: [], walls: [], pixelsPerMeter: 40 }
beforeEach(() => { bd.gravado = null; bd.opcoes = null })

describe('interruptor "mapa visível" (seating_maps.is_active)', () => {
  const abrir = async (data: unknown) => {
    bd.lido = { data, error: null }
    const h = renderHook(() => useMapa('ev1'))
    await waitFor(() => expect(h.result.current.pronto).toBe(true))
    return h
  }
  it('sem mapa salvo: desligado; salvar grava false e o mesmo onConflict do editor antigo', async () => {
    const h = await abrir(null)
    expect(h.result.current.visivel).toBe(false)
    await act(() => h.result.current.salvar(0))
    expect(bd.gravado.is_active).toBe(false)
    expect(bd.opcoes).toEqual({ onConflict: 'event_id' })
    expect(Object.keys(bd.gravado).sort()).toEqual(['config', 'environments', 'event_id', 'is_active', 'name'])
  })
  it('mapa ligado no banco: salvar sem tocar no interruptor NÃO desliga (round-trip)', async () => {
    const h = await abrir({ environments: [ENV], config: {}, is_active: true })
    expect(h.result.current.visivel).toBe(true)
    await act(() => h.result.current.salvar(0))
    expect(bd.gravado.is_active).toBe(true)
  })
  it.each([[false], [null], [undefined], ['true'], [1]])('is_active %s lido do banco conta como desligado', async v => {
    const h = await abrir({ environments: [ENV], config: {}, is_active: v })
    expect(h.result.current.visivel).toBe(false)
    await act(() => h.result.current.salvar(0))
    expect(bd.gravado.is_active).toBe(false)
  })
  it('ligar e desligar mudam o "alterado" e o que vai ao banco; nada liga sozinho', async () => {
    const h = await abrir({ environments: [ENV], config: {}, is_active: false })
    expect(h.result.current.sujo).toBe(false)
    act(() => h.result.current.setVisivel(true))
    expect(h.result.current.sujo).toBe(true)
    await act(() => h.result.current.salvar(0))
    expect(bd.gravado.is_active).toBe(true)
    await waitFor(() => expect(h.result.current.sujo).toBe(false))
    act(() => h.result.current.setVisivel(false))
    await act(() => h.result.current.salvar(0))
    expect(bd.gravado.is_active).toBe(false)
  })
  it('mapa ligado com pavimentos vazios ou inválidos: salvar também não desliga', async () => {
    for (const environments of [[], null, 'x']) {
      const h = await abrir({ environments, config: {}, is_active: true })
      expect(h.result.current.visivel).toBe(true)
      await act(() => h.result.current.salvar(0))
      expect(bd.gravado.is_active).toBe(true)
      h.unmount()
    }
  })
  it('troca de evento volta a desligado até o mapa do novo evento ser lido', async () => {
    bd.lido = { data: { environments: [ENV], config: {}, is_active: true }, error: null }
    const h = renderHook(({ id }) => useMapa(id), { initialProps: { id: 'ev1' } })
    await waitFor(() => expect(h.result.current.visivel).toBe(true))
    bd.lido = { data: null, error: null }
    h.rerender({ id: 'ev2' })
    await waitFor(() => expect(h.result.current.pronto).toBe(true))
    expect(h.result.current.visivel).toBe(false)
  })
})

// ---- Contrato com reservar_assentos (docs/sql/20261008_assento_reserva.sql, l.132-190), reproduzido sem banco ----
const UUID = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
const UUID_RE = /^[0-9a-fA-F-]{36}$/

// Mesmo predicado do servidor: chave ambiente:assento, só seat/table livres cujo setor tem ticketTypeId uuid
type TT = { id: string; ativo: boolean; tipo?: string }
const todos = (envs: Environment[]): TT[] => envs.flatMap(e => e.sections).filter(x => x.ticketTypeId).map(x => ({ id: x.ticketTypeId!, ativo: true }))
// l.194-195 do SQL: o ticket_type tem de existir, estar ativo e não ser coletiva
function elegiveis(envs: Environment[], tts: TT[] = todos(envs)) {
  const por = new Map<string, number>()
  for (const env of envs) for (const s of env.seats) {
    const sec = (env.sections || []).find(x => x.id === s.sectionId)
    if ((s.type === 'seat' || s.type === 'table') && (s.status ?? 'free') === 'free' && UUID_RE.test(sec?.ticketTypeId ?? '') && tts.some(t => t.id === sec!.ticketTypeId && t.ativo && t.tipo !== 'coletiva')) por.set(`${env.id}:${s.id}`, s.type === 'table' ? lugaresDaMesa(s) : 1)
  }
  return por
}
const ligado = (env: Environment): Environment => ({ ...env, sections: env.sections.map((s, i) => (s.id === ESTRUTURA.id ? s : { ...s, ticketTypeId: UUID(i + 1) })) })

describe('contrato com reservar_assentos nos 13 templates', () => {
  it('são 13 templates', () => expect(TEMPLATES).toHaveLength(13))
  for (const t of TEMPLATES) {
    describe(t.nome, () => {
      const base = aplicarTemplate(novosPavimentos()[0], t)
      const env = ligado(base)
      it('chaves ambiente:assento únicas; ids sem ":" (o separador da chave); ids não vazios', () => {
        const chaves = env.seats.map(s => `${env.id}:${s.id}`)
        expect(new Set(chaves).size).toBe(chaves.length)
        expect(`${env.id}${env.seats.map(s => s.id).join('')}`).not.toContain(':')
        expect(env.seats.every(s => s.id.length > 0)).toBe(true)
      })
      it('sem ticketTypeId nada é elegível', () => expect(elegiveis([base]).size).toBe(0))
      it('elegíveis: só seat/table livres em lote com ingresso; Estrutura nunca; mesa = 1..50 lugares', () => {
        const e = elegiveis([env])
        for (const s of env.seats) {
          const chave = `${env.id}:${s.id}`
          const venda = (s.type === 'seat' || s.type === 'table') && s.sectionId !== ESTRUTURA.id
          expect(e.has(chave)).toBe(venda)
          if (venda && s.type === 'table') { expect(e.get(chave)).toBeGreaterThanOrEqual(1); expect(e.get(chave)).toBeLessThanOrEqual(50) }
        }
      })
      it('o resumo do editor (resumoVenda) conta o mesmo que o servidor', () => {
        expect(resumoVenda([env])).toMatchObject({ vendaveis: elegiveis([env]).size, semIngresso: 0, foraDoPrimeiro: 0 })
      })
      it('bloqueado e contato nunca são elegíveis', () => {
        const bloqueado = { ...env, seats: env.seats.map(s => ({ ...s, status: 'blocked' as const })) }
        expect(elegiveis([bloqueado]).size).toBe(0)
      })
    })
  }

  it('divergência conhecida: tipos que o editor põe em lote mas o servidor não vende por lugar (dancefloor, vip_lounge, vip_area, bleacher, box_elevated, stand)', () => {
    const vendemNoEditor = new Set<string>()
    for (const t of TEMPLATES) for (const s of ligado(aplicarTemplate(novosPavimentos()[0], t)).seats) {
      if (s.sectionId !== ESTRUTURA.id && s.type !== 'seat' && s.type !== 'table') vendemNoEditor.add(s.type)
    }
    // o editor conta esses itens na seção de venda (cor, preço, capacidade), mas reservar_assentos só aceita 'seat' e 'table'
    console.info('tipos em lote que o servidor ignora, nos templates:', [...vendemNoEditor])
    for (const tipo of vendemNoEditor) expect(['dancefloor', 'vip_lounge', 'vip_area', 'bleacher', 'box_elevated', 'stand']).toContain(tipo)
  })

  it('o checkout só mostra o primeiro pavimento: lugar vendável no segundo é avisado', () => {
    const a = ligado(aplicarTemplate(novosPavimentos()[0], TEMPLATES[1] /* teatro */))
    const b = { ...a, id: 'pav-2' }
    const r = resumoVenda([a, b])
    expect(elegiveis([b]).size).toBeGreaterThan(0)
    expect(r.foraDoPrimeiro).toBe(elegiveis([b]).size)
    expect(elegiveis([a, b]).size).toBe(2 * elegiveis([a]).size) // o banco aceita os dois
  })

  it('assento/mesa em lote sem ingresso é contado como "sem ingresso"; Estrutura não', () => {
    const base = aplicarTemplate(novosPavimentos()[0], TEMPLATES[1] /* teatro */)
    const r = resumoVenda([base])
    expect(r.vendaveis).toBe(0)
    expect(r.semIngresso).toBeGreaterThan(0)
    expect(r.semIngresso).toBe(base.seats.filter(s => (s.type === 'seat' || s.type === 'table') && s.sectionId !== ESTRUTURA.id).length)
  })

  it('lugaresDaMesa segue o servidor: seatsCount 0 vira 1, 80 vira 50, não numérico cai para capacity, depois 6', () => {
    expect(lugaresDaMesa({ seatsCount: 0, capacity: 8 })).toBe(1)
    expect(lugaresDaMesa({ seatsCount: 80, capacity: 8 })).toBe(50)
    expect(lugaresDaMesa({ seatsCount: undefined, capacity: 8 })).toBe(8)
    expect(lugaresDaMesa({ seatsCount: '5' as never, capacity: undefined as never })).toBe(6)
    expect(lugaresDaMesa({ seatsCount: undefined, capacity: 0 })).toBe(1)
  })

  it('mesa com seatsCount 0 e 80 no predicado: 1 e 50 lugares', () => {
    const e = ligado(aplicarTemplate(novosPavimentos()[0], TEMPLATES.find(t => t.id === 'casa-de-show')!))
    const mesas = e.seats.filter(s => s.type === 'table')
    const m = { ...e, seats: [{ ...mesas[0], seatsCount: 0 }, { ...mesas[1], seatsCount: 80 }] }
    expect([...elegiveis([m]).values()]).toEqual([1, 50])
  })

  it('status contact e blocked fora; lote sem ticketTypeId (um por template) deixa de ser elegível', () => {
    for (const t of TEMPLATES) {
      const e = ligado(aplicarTemplate(novosPavimentos()[0], t))
      const lote = e.sections.find(x => x.id !== ESTRUTURA.id)
      if (!lote) continue
      const sem = { ...e, sections: e.sections.map(x => (x.id === lote.id ? { ...x, ticketTypeId: undefined } : x)) }
      const dele = e.seats.filter(s => s.sectionId === lote.id && (s.type === 'seat' || s.type === 'table')).length
      expect(elegiveis([e]).size - elegiveis([sem], todos([e])).size).toBe(dele)
      expect(elegiveis([{ ...e, seats: e.seats.map(s => ({ ...s, status: 'contact' as const })) }]).size).toBe(0)
    }
  })

  it('ingresso inativo ou coletivo não vende (SQL l.194-195) e o editor avisa como indisponível; lista ainda não carregada não avisa', () => {
    const e = ligado(aplicarTemplate(novosPavimentos()[0], TEMPLATES[1] /* teatro */))
    const ids = e.sections.filter(x => x.ticketTypeId).map(x => x.ticketTypeId!)
    const tudo = ids.map(id => ({ id, ativo: true }))
    expect(elegiveis([e], tudo).size).toBeGreaterThan(0)
    expect(elegiveis([e], ids.map(id => ({ id, ativo: false }))).size).toBe(0)
    expect(elegiveis([e], ids.map(id => ({ id, ativo: true, tipo: 'coletiva' }))).size).toBe(0)
    // o editor só recebe ingressos ativos e não coletivos: o que faltou na lista é "indisponível"
    const r = resumoVenda([e], [{ id: ids[0] }])
    expect(r.ingressoIndisponivel).toBe(ids.length - 1)
    expect(r.vendaveis).toBe(elegiveis([e], [{ id: ids[0], ativo: true }]).size)
    expect(resumoVenda([e], tudo).ingressoIndisponivel).toBe(0)
    expect(resumoVenda([e], null)).toMatchObject({ ingressoIndisponivel: 0, vendaveis: elegiveis([e]).size })
    expect(resumoVenda([e], []).vendaveis).toBe(0)
    // id que não é uuid nunca vende, mesmo que esteja na lista
    const ruim = { ...e, sections: e.sections.map(x => (x.ticketTypeId ? { ...x, ticketTypeId: 'tt1' } : x)) }
    expect(resumoVenda([ruim], [{ id: 'tt1' }]).vendaveis).toBe(0)
  })

  it('tipos fora de seat/table em lote com ingresso são contados como "não vende por lugar"; em Estrutura não', () => {
    const e = ligado(aplicarTemplate(novosPavimentos()[0], TEMPLATES.find(t => t.id === 'arena')!))
    const lote = e.sections.find(x => x.id !== ESTRUTURA.id)!
    const pista = { ...e.seats[0], id: 'pista1', type: 'dancefloor' as const, sectionId: lote.id, status: 'free' as const }
    const naEstrutura = { ...pista, id: 'pista2', sectionId: ESTRUTURA.id }
    const antes = resumoVenda([e]).naoVendePorLugar
    const r = resumoVenda([{ ...e, seats: [...e.seats, pista, naEstrutura] }])
    expect(r.naoVendePorLugar).toBe(antes + 1)
    expect(elegiveis([{ ...e, seats: [pista] }]).size).toBe(0) // o servidor não vende pista por lugar
  })
})
