import { describe, it, expect } from 'vitest'
import { exigirLinhas } from '../lib/equipe'
import { iniciais } from '../hooks/useConversas'

describe('exigirLinhas', () => {
  it('passa quando alguma linha foi afetada', () => {
    expect(() => exigirLinhas(null, [{ id: 'a' }])).not.toThrow()
  })
  it('falha com 0 linhas ou lista nula (RLS bloqueou)', () => {
    expect(() => exigirLinhas(null, [])).toThrow()
    expect(() => exigirLinhas(null, null)).toThrow()
  })
  it('repassa o erro do banco', () => {
    const e = new Error('x')
    expect(() => exigirLinhas(e, null)).toThrow(e)
  })
})

describe('iniciais', () => {
  it('primeira e última letra, em maiúscula', () => {
    expect(iniciais('maria da silva')).toBe('MS')
    expect(iniciais('  ana ')).toBe('A')
    expect(iniciais('')).toBe('?')
  })
})
