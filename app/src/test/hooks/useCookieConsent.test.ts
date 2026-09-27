import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../lib/tracking', () => ({ trackPageView: vi.fn(), hasAnalyticsConsent: () => false }))
vi.mock('../../lib/googleAnalytics', () => ({ gaRevokeConsent: vi.fn() }))

import { useCookieConsent } from '../../hooks/useCookieConsent'

const KEY = 'aura-cookie-consent'

describe('useCookieConsent', () => {
  beforeEach(() => localStorage.clear())

  it('resposta antiga com marketing/preferences continua válida e não reabre o banner', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: '1.0', consent: { necessary: true, analytics: true, marketing: true, preferences: false } }))
    const { result } = renderHook(() => useCookieConsent())
    expect(result.current.showBanner).toBe(false)
    expect(result.current.consent).toEqual({ necessary: true, analytics: true })
  })

  it('sem resposta mostra o banner; aceitar grava só as duas categorias', () => {
    const { result } = renderHook(() => useCookieConsent())
    expect(result.current.showBanner).toBe(true)
    act(() => result.current.acceptAll())
    expect(result.current.showBanner).toBe(false)
    expect(JSON.parse(localStorage.getItem(KEY)!).consent).toEqual({ necessary: true, analytics: true })
  })
})
