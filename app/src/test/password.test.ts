import { describe, it, expect } from 'vitest'
import { passwordError, PASSWORD_MIN } from '../lib/password'
import { passwordError as passwordErrorFuncao } from '../../../supabase/functions/_shared/password'

describe('passwordError (regra do Supabase: minúscula, maiúscula, número e símbolo do teclado)', () => {
  it('aceita senha completa', () => {
    expect(passwordError('Evokaa2026!')).toBeNull()
    expect(passwordError('Evokaa2026~')).toBeNull()
  })
  it('recusa cada falta com mensagem própria', () => {
    expect(passwordError('')).toBe('Senha obrigatória')
    expect(passwordError('Ab1!')).toContain(String(PASSWORD_MIN))
    expect(passwordError('EVOKAA2026!')).toBe('Inclua uma letra minúscula')
    expect(passwordError('evokaa2026!')).toBe('Inclua uma letra maiúscula')
    expect(passwordError('Evokaaaaaa!')).toBe('Inclua um número')
    expect(passwordError('Evokaa20266')).toContain('símbolo')
  })
  it('acento, espaço e emoji não valem como símbolo (o servidor recusa)', () => {
    for (const p of ['Evokaa2026ç', 'Evokaa2026ã', 'Evokaa 2026', 'Evokaa2026😀']) {
      expect(passwordError(p), p).toContain('símbolo')
    }
    expect(passwordError('Evokaa2026\\')).toContain('símbolo') // barra invertida fica fora do conjunto do servidor
    expect(passwordError('Evokaa2026:')).toBeNull() // dois-pontos entra
    expect(passwordError('Ab1!' + 'x'.repeat(70))).toContain('longa')
  })
})

// A Edge Function admin-invite (criar-conta) usa a cópia de supabase/functions/_shared/password.ts: as duas não podem divergir
it('a cópia das Edge Functions dá a mesma resposta', () => {
  for (const p of ['', 'Ab1!', 'EVOKAA2026!', 'evokaa2026!', 'Evokaaaaaa!', 'Evokaa20266', 'Evokaa2026ç', 'Evokaa 2026',
    'Evokaa2026😀', 'Evokaa2026\\', 'Evokaa2026:', 'Evokaa2026!', 'Evokaa2026~', 'Ab1!' + 'x'.repeat(70), 'Ab1!' + 'ã'.repeat(34)]) {
    expect(passwordErrorFuncao(p), p).toBe(passwordError(p))
  }
})
