import { describe, it, expect, vi, afterEach } from 'vitest'
import { semHash, trackPageView } from '../lib/tracking'
import { supabase } from '../lib/supabase'

const evento = { type: 'pageview' as const, url: 'https://app.evokaa.com.br/producer#access_token=x' }
const chrome = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0 Safari/537.36'
const navegador = (webdriver: boolean, userAgent: string) => vi.stubGlobal('navigator', { webdriver, userAgent })

describe('semHash (beforeSend do Vercel Analytics)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('navegador comum: envia sem o #hash', () => {
    navegador(false, chrome)
    expect(semHash(evento)).toEqual({ type: 'pageview', url: 'https://app.evokaa.com.br/producer' })
  })

  it('Playwright/Selenium/Puppeteer (navigator.webdriver): descarta', () => {
    navegador(true, chrome)
    expect(semHash(evento)).toBeNull()
  })

  it('navegador integrado do app Claude (user agent "Claude/"): descarta', () => {
    navegador(false, chrome.replace('Chrome/', 'Claude/2.16120.0 Chrome/'))
    expect(semHash(evento)).toBeNull()
  })
})

describe('trackEvent (GA4 e user_activities)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(supabase.from).mockClear()
  })
  const comConsentimento = () =>
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ version: '1.0', consent: { analytics: true } }) })

  it('navegador comum com consentimento: grava', () => {
    comConsentimento()
    navegador(false, chrome)
    trackPageView('/producer')
    expect(supabase.from).toHaveBeenCalledWith('user_activities')
  })

  it('consentimento de outra versão do aviso: não grava (o aviso de cookies reabre)', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ version: '0.9', consent: { analytics: true } }) })
    navegador(false, chrome)
    trackPageView('/producer')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('automação com consentimento: não grava', () => {
    comConsentimento()
    navegador(true, chrome)
    trackPageView('/producer')
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
