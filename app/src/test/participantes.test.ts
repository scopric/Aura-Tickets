import { describe, it, expect } from 'vitest'
import { agrupar, csvParticipantes, filtrar, linhaDoTempo, resumo, abaDoPedido, AVISO_CSV, type Ingresso, type Pedido } from '../lib/participantes'

const ped = (id: string, status: string, nome: string, email: string): Pedido =>
  ({ id, status, customer_name: nome, customer_email: email, total: 100, payment_method: 'pix', created_at: '2026-10-01T12:00:00Z', event_id: 'e1' })
const ing = (id: string, order_id: string, tipo: string, feito: boolean): Ingresso =>
  ({ id, order_id, ticket_type_id: tipo, status: feito ? 'used' : 'active', buyer_name: 'Titular', buyer_email: null, price_paid: 50, checked_in_at: feito ? '2026-10-10T20:30:00Z' : null, created_at: '2026-10-01T12:00:00Z', ticket_types: { name: tipo === 't1' ? 'Pista' : 'VIP' } })

const todos = agrupar(
  [ped('p1', 'paid', 'Ana Álvares', 'ana@x.com'), ped('p2', 'pending', 'Bruno', 'bruno@x.com'), ped('p3', 'refunded', 'Carla', 'carla@x.com'), ped('p4', 'paid', 'Davi', 'davi@x.com')],
  [ing('i1', 'p1', 't1', true), ing('i2', 'p4', 't2', false)],
)
const base = { aba: 'confirmados' as const, busca: '', tipo: '', checkin: 'todos' as const }

describe('participantes (funções puras)', () => {
  it('cada status vai para uma aba; desconhecido não vai para nenhuma', () => {
    expect(['paid', 'pending', 'cancelled', 'refunded', 'failed', 'x'].map(abaDoPedido)).toEqual(['confirmados', 'pendentes', 'cancelados', 'cancelados', 'cancelados', null])
  })
  it('conta por aba e as entradas feitas só dos confirmados', () => {
    expect(resumo(todos)).toEqual({ confirmados: 2, pendentes: 1, cancelados: 1, entradas: 1, ingressos: 2 })
  })
  it('filtra por aba, busca sem acento/caixa, tipo e check-in', () => {
    expect(filtrar(todos, base).map(p => p.id)).toEqual(['p1', 'p4'])
    expect(filtrar(todos, { ...base, aba: 'pendentes' }).map(p => p.id)).toEqual(['p2'])
    expect(filtrar(todos, { ...base, busca: 'ALVARES' }).map(p => p.id)).toEqual(['p1'])
    expect(filtrar(todos, { ...base, busca: 'davi@' }).map(p => p.id)).toEqual(['p4'])
    expect(filtrar(todos, { ...base, tipo: 't2' }).map(p => p.id)).toEqual(['p4'])
    expect(filtrar(todos, { ...base, checkin: 'feito' }).map(p => p.id)).toEqual(['p1'])
    expect(filtrar(todos, { ...base, checkin: 'nao' }).map(p => p.id)).toEqual(['p4'])
  })
  it('linha do tempo: criado, pago e check-in com hora; pago sai sem hora', () => {
    const m = linhaDoTempo(todos[0])
    expect(m.map(x => x.texto)).toEqual(['Pedido criado', 'Pagamento confirmado', 'Check-in: Pista, Titular'])
    expect(m[1].quando).toBeNull()
    expect(m[2].quando).toBe('2026-10-10T20:30:00Z')
    expect(linhaDoTempo(todos[1]).map(x => x.texto)).toEqual(['Pedido criado'])
  })
  it('CSV: aviso de dado pessoal na primeira linha, sem CPF nem telefone', () => {
    const csv = csvParticipantes(filtrar(todos, base))
    const linhas = csv.replace('﻿', '').split('\r\n')
    expect(linhas[0]).toBe(AVISO_CSV)
    expect(linhas[1]).toContain('comprador;email')
    expect(linhas).toHaveLength(4)
    expect(csv).toContain('ana@x.com')
    expect(csv.toLowerCase()).not.toMatch(/cpf|telefone|phone/)
  })
  it('CSV: célula que começa com = (ou com quebra de linha) sai protegida; data em horário de Brasília', () => {
    const l = agrupar([{ ...ped('p9', 'paid', '=HYPERLINK("x")', 'a@x.com'), created_at: '2026-10-01T01:30:00Z' }, ped('p8', 'paid', '\n+1', 'b@x.com')], [])
    const csv = csvParticipantes(l)
    expect(csv).toContain(`'=HYPERLINK`)
    expect(csv).toContain(`"'\n+1"`)
    expect(csv).toContain('30/09/2026')
  })
  it('pedido com 3 ingressos e 1 entrada: conta como "feito" e some do filtro "sem entrada"', () => {
    const l = agrupar([ped('q1', 'paid', 'Edu', 'edu@x.com')], [ing('a', 'q1', 't1', true), ing('b', 'q1', 't1', false), ing('c', 'q1', 't1', false)])
    expect(resumo(l)).toMatchObject({ entradas: 1, ingressos: 3 })
    expect(filtrar(l, { ...base, checkin: 'nao' })).toHaveLength(0)
    expect(filtrar(l, { ...base, checkin: 'feito' })).toHaveLength(1)
  })
})
