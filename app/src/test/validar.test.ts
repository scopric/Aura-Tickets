import { describe, it, expect } from 'vitest'
import { chaveIp, validarContato, validarEmail } from '../../../supabase/functions/_shared/validar'

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
  it('recusa ? & # e caracteres de controle, e valor que não é texto', () => {
    for (const v of ['a?x@b.com', 'a&x@b.com', 'a#x@b.com', 'a@b.com?cc=x@y.com', 'a\u0000@b.com', 'a@b.com\u007f', { e: 'a@b.com' }, ['a@b.com']])
      expect(validarEmail(v)).toBeNull()
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
  it('caracteres de controle: nenhum em nome/telefone/assunto; na mensagem só \\n e \\t', () => {
    for (const extra of [{ name: 'A\nB' }, { name: 'A\u0000' }, { phone: '41\t9' }, { subject: 'x\ry' }, { subject: 'x\u007f' },
      { message: 'a\u0000b' }, { message: 'a\rb' }, { message: 'a\u001bb' }])
      expect(validarContato({ ...base, ...extra }).ok).toBe(false)
    expect(validarContato({ ...base, message: 'linha 1\n\tlinha 2' }).ok).toBe(true)
  })
  it('valor que não é texto (objeto, lista, número) é inválido', () => {
    for (const extra of [{ name: { a: 1 } }, { message: ['oi'] }, { phone: 41999 }, { subject: {} }, { page: [] }])
      expect(validarContato({ ...base, ...extra }).ok).toBe(false)
  })
})

describe('chaveIp (limite por IP da send-email)', () => {
  it('IPv6: mesma chave para o mesmo /64, outra para outro /64', () => {
    expect(chaveIp('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64')
    expect(chaveIp('2001:db8:1:2:ffff::9')).toBe('2001:db8:1:2::/64')
    expect(chaveIp('2001:0DB8:0001:0002:0:0:0:abcd')).toBe('2001:db8:1:2::/64')
    expect(chaveIp('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64')
    expect(chaveIp('2001:db8::1')).toBe('2001:db8:0:0::/64')
  })
  it('IPv4 igual a si mesmo; IPv4 dentro de IPv6 vira IPv4', () => {
    expect(chaveIp(' 203.0.113.9 ')).toBe('203.0.113.9')
    expect(chaveIp('::ffff:1.2.3.4')).toBe('1.2.3.4')
  })
  it('lixo não é IP', () => {
    for (const v of ['', 'abc', '1.2.3', '256.1.1.1', '1::2::3', '1:2:3:4:5:6:7:8:9', '1:2:3:4:5:6:7', 'g::1', '12345::1', '1:2:3:4:5:6:7:8::'])
      expect(chaveIp(v)).toBeNull()
  })
})
