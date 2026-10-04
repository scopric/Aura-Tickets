import { describe, it, expect } from 'vitest'
import { cnpjValido } from '../lib/formatters'

describe('cnpjValido', () => {
  it('aceita CNPJ real, com ou sem máscara', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11222333000181')).toBe(true)
    expect(cnpjValido('00.000.000/0001-91')).toBe(true) // Banco do Brasil
  })
  it('recusa dígito verificador errado, tamanho errado e repetidos', () => {
    expect(cnpjValido('11.222.333/0001-82')).toBe(false)
    expect(cnpjValido('11222333000')).toBe(false)
    expect(cnpjValido('00000000000000')).toBe(false)
    expect(cnpjValido('')).toBe(false)
  })
})
