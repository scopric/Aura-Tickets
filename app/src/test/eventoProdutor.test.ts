import { describe, it, expect } from 'vitest'
import { situacaoEvento, erroAoExcluir, erroDeStatus, vendidosDe, dataPorVir, confirmacaoArquivar, copiaDoEvento, confirmacaoCancelar, CANCELAR_COM_VENDA, SAIR_DO_AR_COM_VENDA } from '../lib/eventoProdutor'
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
  it('23503 com ingresso vendido não oferece cancelar e manda falar com o suporte (Decisão 129)', () => {
    expect(erroAoExcluir({ code: '23503', details: 'table "tickets"' }, 2)).toEqual({ mensagem: CANCELAR_COM_VENDA, oferecerCancelar: false })
  })
  it('23503 com zero vendidos ou contagem não carregada continua oferecendo cancelar', () => {
    expect(erroAoExcluir({ code: '23503' }, 0).oferecerCancelar).toBe(true)
    expect(erroAoExcluir({ code: '23503' }, undefined).oferecerCancelar).toBe(true)
  })
})

describe('erroDeStatus (Decisão 129)', () => {
  it('EV001 do gatilho vira a mensagem de cancelar com venda', () => {
    expect(erroDeStatus({ code: 'EV001', message: 'qualquer' }, 'x')).toBe('Este evento tem ingressos vendidos. Para cancelar, fale com o suporte da Evokaa.')
  })
  it('EV002 (rascunho ou encerrar antes da data) vira a mensagem de sair do ar', () => {
    expect(erroDeStatus({ code: 'EV002' }, 'x')).toBe('Este evento tem ingressos vendidos e não pode sair do ar. Fale com o suporte da Evokaa.')
    expect(erroDeStatus({ code: 'EV002' }, 'x')).toBe(SAIR_DO_AR_COM_VENDA)
  })
  it('outro erro (inclusive P0001 genérico) vira a mensagem padrão', () => {
    expect(erroDeStatus({ code: 'P0001' }, 'Não foi possível cancelar o evento.')).toBe('Não foi possível cancelar o evento.')
    expect(erroDeStatus(null, 'padrão')).toBe('padrão')
  })
})

describe('vendidosDe', () => {
  it('sem contagem carregada: não sei', () => {
    expect(vendidosDe(undefined, 'e1')).toBeUndefined()
  })
  it('lista completa: zero é zero', () => {
    expect(vendidosDe({ porEvento: { e1: 3 }, cortado: false }, 'e2')).toBe(0)
    expect(vendidosDe({ porEvento: { e1: 3 }, cortado: false }, 'e1')).toBe(3)
  })
  it('lista cortada (mais de 1.000): zero vira "não sei", mas venda na lista continua venda', () => {
    expect(vendidosDe({ porEvento: { e1: 3 }, cortado: true }, 'e2')).toBeUndefined()
    expect(vendidosDe({ porEvento: { e1: 3 }, cortado: true }, 'e1')).toBe(3)
  })
})

describe('dataPorVir e confirmacaoArquivar', () => {
  const agora = Date.parse('2026-10-01T12:00:00Z')
  it('usa o fim e, sem fim, o início', () => {
    expect(dataPorVir({ start_date: '2026-09-30T20:00:00Z', end_date: '2026-10-02T04:00:00Z' }, agora)).toBe(true)
    expect(dataPorVir({ start_date: '2026-10-05T20:00:00Z', end_date: null }, agora)).toBe(true)
    expect(dataPorVir({ start_date: '2026-09-30T20:00:00Z', end_date: null }, agora)).toBe(false)
  })
  it('só avisa do suporte quando não se sabe a venda e a data está por vir', () => {
    expect(confirmacaoArquivar('Festa', undefined, true)).toMatch(/não pode sair do ar antes da data: fale com o suporte/)
    expect(confirmacaoArquivar('Festa', 0, true)).not.toMatch(/suporte/)
    expect(confirmacaoArquivar('Festa', undefined, false)).not.toMatch(/suporte/)
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
  it('sem saber se há venda, avisa que o banco recusa se houver e manda falar com o suporte', () => {
    expect(confirmacaoCancelar('Festa', undefined)).toMatch(/cancelamento é recusado: fale com o suporte da Evokaa/)
    expect(confirmacaoCancelar('Festa', 0)).not.toMatch(/suporte/)
  })
})
