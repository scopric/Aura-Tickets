import { describe, it, expect } from 'vitest'
import { passwordError, PASSWORD_MIN } from '../lib/password'

describe('passwordError (ASVS 5.0: mínimo de 8, sem regra de composição, máximo de 72 bytes)', () => {
  it('aceita qualquer senha com o mínimo de caracteres, sem exigir maiúscula, número ou símbolo', () => {
    for (const p of ['evokaaevokaa', 'EVOKAAEVOKAA', '12345678', 'Evokaa2026ç', 'frase com espaço', 'Evokaa2026!']) {
      expect(passwordError(p), p).toBeNull()
    }
  })
  it('recusa vazia, curta e longa demais', () => {
    expect(passwordError('')).toBe('Senha obrigatória')
    expect(passwordError('a'.repeat(PASSWORD_MIN - 1))).toContain(String(PASSWORD_MIN))
    expect(passwordError('a'.repeat(72))).toBeNull()
    expect(passwordError('a'.repeat(73))).toContain('longa')
    expect(passwordError('ç'.repeat(37))).toContain('longa') // 74 bytes em UTF-8
  })
})
