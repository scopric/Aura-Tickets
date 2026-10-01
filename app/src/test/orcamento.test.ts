import { describe, it, expect } from 'vitest'
import { mensagemMovimento } from '../lib/orcamento'

// Códigos que a caixinha_movimentar levanta (docs/sql/20261005_produtor_acesso.sql). Código novo no banco entra
// aqui e na lib/orcamento.ts; sem mensagem própria ele cairia no texto genérico e o teste falha.
const CODIGOS = ['23514', '22023', '42501']

describe('mensagemMovimento', () => {
  const generica = mensagemMovimento(null)

  it('todo código da função tem mensagem própria e diferente', () => {
    for (const c of CODIGOS) expect(mensagemMovimento({ code: c }), c).not.toBe(generica)
    expect(new Set(CODIGOS.map(c => mensagemMovimento({ code: c }))).size).toBe(CODIGOS.length)
  })

  it('saldo insuficiente, valor inválido e 2FA', () => {
    expect(mensagemMovimento({ code: '23514' })).toMatch(/^Saldo insuficiente/)
    expect(mensagemMovimento({ code: '22023' })).toMatch(/^Valor ou observação inválidos/)
    expect(mensagemMovimento({ code: '42501' })).toMatch(/2FA/)
  })

  it('erro de rede, código estranho e nada viram texto genérico', () => {
    expect(mensagemMovimento(new Error('Failed to fetch'))).toBe(generica)
    expect(mensagemMovimento({ code: 'PGRST301' })).toBe(generica)
    expect(mensagemMovimento({ code: 'toString' })).toBe(generica)
    expect(mensagemMovimento(undefined)).toBe(generica)
  })
})
