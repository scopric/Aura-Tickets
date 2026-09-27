import { describe, it, expect } from 'vitest'
import { isDemoAccount, DEMO_USER_IDS } from '../lib/demo'

describe('isDemoAccount (dados de exemplo só para conta demo em desenvolvimento)', () => {
  it('reconhece só os ids de demonstração', () => {
    for (const id of DEMO_USER_IDS) expect(isDemoAccount(id)).toBe(true) // o Vitest roda com DEV=true
    expect(isDemoAccount('661f12ab-58c4-4089-aed8-1055b12a0d29')).toBe(false)
    expect(isDemoAccount(undefined)).toBe(false)
    expect(isDemoAccount(null)).toBe(false)
  })
})
