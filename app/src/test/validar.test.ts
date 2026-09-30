import { describe, it, expect } from 'vitest'
import { validarContato, validarEmail } from '../../../supabase/functions/_shared/validar'

const base = { name: ' Ana ', email: ' Ana@Exemplo.com.br ', message: ' Olá ' }

describe('validarEmail (send-email)', () => {
  it('aceita formato comum, apara e põe em minúsculas', () => {
    expect(validarEmail('  Joao.Silva+x@Evokaa.com.br ')).toBe('joao.silva+x@evokaa.com.br')
  })
  it('recusa formato inválido, vazio, não-texto e acima de 254', () => {
    for (const v of ['', 'sem-arroba', 'a@b', 'a b@c.com', 'a@.com', 'a@b..com', '@b.com', undefined, null, 42])
      expect(validarEmail(v)).toBeNull()
    expect(validarEmail('a'.repeat(250) + '@b.co')).toBeNull()
    expect(validarEmail('a'.repeat(244) + '@b.com')).toBe('a'.repeat(244) + '@b.com') // 254 exatos
  })
})

describe('validarContato (send-email)', () => {
  it('aceita o mínimo e devolve tudo aparado, com opcionais vazios', () => {
    expect(validarContato(base)).toEqual({ ok: true, dados: { name: 'Ana', email: 'ana@exemplo.com.br', phone: '', subject: '', message: 'Olá', page: '' } })
  })
  it('limites: nome 120, telefone 30, assunto 120, mensagem 5000', () => {
    expect(validarContato({ ...base, name: 'n'.repeat(120), phone: '1'.repeat(30), subject: 's'.repeat(120), message: 'm'.repeat(5000) }).ok).toBe(true)
    for (const extra of [{ name: 'n'.repeat(121) }, { phone: '1'.repeat(31) }, { subject: 's'.repeat(121) }, { message: 'm'.repeat(5001) }, { page: 'p'.repeat(301) }])
      expect(validarContato({ ...base, ...extra }).ok).toBe(false)
  })
  it('obrigatórios: nome, e-mail válido e mensagem (espaços não contam)', () => {
    for (const extra of [{ name: '   ' }, { name: undefined }, { email: 'x' }, { message: '  ' }, { message: null }])
      expect(validarContato({ ...base, ...extra }).ok).toBe(false)
  })
})
