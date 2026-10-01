import { describe, it, expect } from 'vitest'
import { situacaoEvento, erroAoExcluir, copiaDoEvento, confirmacaoCancelar } from '../lib/eventoProdutor'
import type { DbEvent, DbTicketType } from '../hooks/useEvents'

describe('situacaoEvento (selo do produtor: status + moderação)', () => {
  it('status do produtor manda primeiro', () => {
    expect(situacaoEvento({ status: 'draft', approval_status: 'approved' })).toBe('Rascunho')
    expect(situacaoEvento({ status: 'ended', approval_status: 'approved' })).toBe('Encerrado')
    expect(situacaoEvento({ status: 'cancelled', approval_status: 'rejected' })).toBe('Cancelado')
  })
  it('publicado só está no ar se aprovado', () => {
    expect(situacaoEvento({ status: 'published', approval_status: 'approved' })).toBe('Publicado')
    expect(situacaoEvento({ status: 'published', approval_status: 'rejected' })).toBe('Recusado')
    expect(situacaoEvento({ status: 'published', approval_status: 'pending' })).toBe('Em análise')
    expect(situacaoEvento({ status: 'published', approval_status: null })).toBe('Em análise')
    expect(situacaoEvento({ status: 'published' })).toBe('Em análise')
  })
})

describe('erroAoExcluir', () => {
  it('23503 de afiliado pede cancelar em vez de excluir', () => {
    const r = erroAoExcluir({ code: '23503', message: 'violates foreign key constraint "affiliates_event_id_fkey" on table "affiliates"' })
    expect(r).toEqual({ mensagem: 'Este evento tem afiliados vinculados. Cancele o evento em vez de excluir.', oferecerCancelar: true })
  })
  it('23503 de outra tabela também oferece cancelar, sem falar de afiliado', () => {
    const r = erroAoExcluir({ code: '23503', details: 'Key is still referenced from table "orders".' })
    expect(r.oferecerCancelar).toBe(true)
    expect(r.mensagem).not.toMatch(/afiliado/)
  })
  it('outro erro não oferece cancelar', () => {
    expect(erroAoExcluir(new Error('Nada foi apagado')).oferecerCancelar).toBe(false)
  })
})

describe('copiaDoEvento', () => {
  const tipo = (o: Partial<DbTicketType>) => ({ id: 't', event_id: 'e1', name: 'Pista', description: null, price: 50, capacity: 10, quantity_total: 100, sold: 7, type: 'individual', perks: [], is_active: true, sale_start: null, sale_end: null, created_at: '', updated_at: '', ...o }) as DbTicketType
  const evento = {
    id: 'e1', slug: 'festa-1', producer_id: 'p1', title: 'Festa', status: 'published', approval_status: 'approved',
    end_date: '2026-12-01T04:00:00Z', ticket_types: [tipo({}), tipo({ id: 't2', name: 'Oculto', is_active: false })],
  } as unknown as DbEvent
  const { event, tickets } = copiaDoEvento(evento)

  it('nasce rascunho, sem id, slug, dono nem moderação', () => {
    expect(event.status).toBe('draft')
    expect(event.title).toBe('Festa (cópia)')
    expect(event.end_date).toBe('2026-12-01T04:00:00Z')
    for (const k of ['id', 'slug', 'producer_id', 'approval_status']) expect(event).not.toHaveProperty(k)
  })
  it('ingressos sem id nem vendas, com a quantidade real e o oculto continua oculto', () => {
    for (const t of tickets) for (const k of ['id', 'event_id', 'sold']) expect(t).not.toHaveProperty(k)
    expect(tickets.map(t => [t.name, t.capacity, t.is_active])).toEqual([['Pista', 100, true], ['Oculto', 100, false]])
  })
})

describe('confirmacaoCancelar', () => {
  it('sem venda não fala de reembolso', () => {
    expect(confirmacaoCancelar('Festa', 0)).not.toMatch(/reembols/)
  })
  it('com venda, ou sem saber, avisa que não há aviso nem reembolso automático', () => {
    expect(confirmacaoCancelar('Festa', 3)).toMatch(/não são avisados nem reembolsados automaticamente/)
    expect(confirmacaoCancelar('Festa', undefined)).toMatch(/Fale com o suporte da Evokaa antes de cancelar/)
  })
})
