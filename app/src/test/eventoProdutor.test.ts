import { describe, it, expect } from 'vitest'
import { situacaoEvento, erroAoExcluir } from '../lib/eventoProdutor'

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
