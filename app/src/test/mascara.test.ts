import { describe, it, expect } from 'vitest'
import { resumir } from '../../../supabase/functions/_shared/mascara'

// Nenhum desses dados pode sobrar no resumo do log (ai_usage.resumo).
const casos: [string, string, string][] = [
  ['e-mail', 'meu email é joao.silva+evo@gmail.com ok', 'meu email é [email] ok'],
  ['e-mail com subdomínio', 'contato@mail.empresa.com.br', '[email]'],
  ['e-mail com acento no nome', 'escreve para joão.silva@gmail.com', 'escreve para [email]'],
  ['e-mail com acento e cedilha', 'mariaçã@x.com.br', '[email]'],
  ['CPF pontuado', 'cpf 123.456.789-09', 'cpf [cpf]'],
  ['CPF só dígitos', 'cpf 12345678909', 'cpf [cpf]'],
  ['CPF com espaços', 'cpf 123 456 789 09', 'cpf [número]'],
  ['CPF com barra e ponto', 'cpf 123/456.789-09', 'cpf [número]'],
  ['celular com DDD entre parênteses', 'liga (11) 98765-4321', 'liga [telefone]'],
  ['celular +55', 'zap +55 11 987654321', 'zap [telefone]'],
  ['celular com hífens', 'fone 11-98765-4321', 'fone [número]'],
  ['celular só dígitos (11 dígitos: cai no CPF)', 'fone 11987654321', 'fone [cpf]'],
  ['fixo sem DDD', 'fone 3456-7890', 'fone [número]'],
  ['CNPJ pontuado', 'cnpj 12.345.678/0001-90', 'cnpj [número]'],
  ['CNPJ só dígitos', 'cnpj 12345678000190', 'cnpj [número]'],
  ['RG', 'rg 12.345.678-9', 'rg [número]'],
  ['cartão com espaços', 'cartão 4111 1111 1111 1111', 'cartão [número]'],
  ['cartão só dígitos', 'cartão 4111111111111111', 'cartão [número]'],
  ['CPF com ponto e espaço', 'cpf 123. 456. 789-09', 'cpf [número]'],
  ['cartão com espaço duplo', 'cartão 4111  1111  1111  1111', 'cartão [número]'],
  ['CPF com vírgulas', 'cpf 123,456,789-09', 'cpf [número]'],
  ['CPF com sublinhado', 'cpf 123_456_789_09', 'cpf [número]'],
]

describe('resumir (máscara do log do Evo)', () => {
  it.each(casos)('%s', (_nome, entrada, esperado) => {
    const r = resumir(entrada)
    expect(r).toBe(esperado)
    expect(r).not.toMatch(/\d{4}/)
  })

  it('mantém números curtos do evento e corta em 200 caracteres', () => {
    expect(resumir('forró para 800 pessoas, ingresso R$ 60')).toBe('forró para 800 pessoas, ingresso R$ 60')
    expect(resumir('a'.repeat(300))).toHaveLength(200)
  })
})
