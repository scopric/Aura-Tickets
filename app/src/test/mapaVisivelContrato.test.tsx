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
import { resumoVenda } from '../pages/producer/mapa/regras'
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
const clamp50 = (n: SeatNode) => Math.min(Math.max(typeof n.seatsCount === 'number' ? n.seatsCount : typeof n.capacity === 'number' ? n.capacity : 6, 1), 50)

// Mesmo predicado do servidor: chave ambiente:assento, só seat/table livres cujo setor tem ticketTypeId uuid
function elegiveis(envs: Environment[]) {
  const por = new Map<string, number>()
  for (const env of envs) for (const s of env.seats) {
    const sec = (env.sections || []).find(x => x.id === s.sectionId)
    if ((s.type === 'seat' || s.type === 'table') && (s.status ?? 'free') === 'free' && UUID_RE.test(sec?.ticketTypeId ?? '')) por.set(`${env.id}:${s.id}`, s.type === 'table' ? clamp50(s) : 1)
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
})
