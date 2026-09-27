import { useMemo } from 'react'
import { passwordChecks } from '../lib/password'

export interface PasswordValidation {
  isValid: boolean
  strength: number // 0-5
  strengthLabel: string
  strengthColor: string
  checks: ReturnType<typeof passwordChecks>
}

export function usePasswordValidation(password: string): PasswordValidation {
  const checks = useMemo(() => passwordChecks(password), [password])

  const strength = useMemo(() => {
    if (!password) return 0
    return Object.values(checks).filter(Boolean).length
  }, [checks, password])

  const strengthLabel = useMemo(() => {
    if (strength === 0) return ''
    if (strength <= 2) return 'Fraca'
    if (strength === 3) return 'Média'
    if (strength === 4) return 'Forte'
    return 'Blindada 🔒'
  }, [strength])

  const strengthColor = useMemo(() => {
    if (strength <= 2) return 'bg-red-500'
    if (strength === 3) return 'bg-amber-500'
    if (strength === 4) return 'bg-emerald-500'
    return 'bg-plum'
  }, [strength])

  return {
    isValid: strength === 5,
    strength,
    strengthLabel,
    strengthColor,
    checks,
  }
}
