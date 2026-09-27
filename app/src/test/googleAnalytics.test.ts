import { describe, it, expect, vi, beforeEach } from 'vitest'

// O ID vem de import.meta.env, lido na carga do módulo: cada cenário importa o módulo do zero.
async function load(id: string | undefined) {
  vi.resetModules()
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', id)
  return await import('../lib/googleAnalytics')
}

const calls = () => (window.dataLayer as IArguments[]).map((a) => Array.from(a))

describe('googleAnalytics', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    delete window.dataLayer
    delete window.gtag
    delete window['ga-disable-G-TESTE123']
    document.head.querySelectorAll('script').forEach((s) => s.remove())
    document.cookie = '_ga=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  it('sem VITE_GA_MEASUREMENT_ID não carrega nada', async () => {
    const ga = await load(undefined)
    ga.gaPageView('/events')
    ga.gaRevokeConsent()
    expect(window.dataLayer).toBeUndefined()
    expect(document.head.querySelector('script')).toBeNull()
  })

  it('com ID: carrega o script uma vez, configura sem page_view automático e envia a rota com a query', async () => {
    const ga = await load('G-TESTE123')
    window.history.replaceState(null, '', '/events?utm_source=insta')
    ga.gaPageView('/events')
    ga.gaPageView('/event/abc')
    const scripts = document.head.querySelectorAll('script')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TESTE123')
    expect(calls()[0][0]).toBe('js')
    expect(calls()[1]).toEqual(['config', 'G-TESTE123', { send_page_view: false }])
    expect(calls()[2][0]).toBe('event')
    expect(calls()[2][2]).toMatchObject({ page_path: '/events', page_location: 'http://localhost:3000/events?utm_source=insta' })
    expect(calls()[3][2]).toMatchObject({ page_path: '/event/abc' })
    expect(window['ga-disable-G-TESTE123']).toBe(false)
  })

  it('retirar o consentimento liga o opt-out do Google e apaga os cookies _ga*; consentir de novo religa', async () => {
    const ga = await load('G-TESTE123')
    ga.gaRevokeConsent() // antes de carregar: inofensivo
    expect(window['ga-disable-G-TESTE123']).toBeUndefined()
    ga.gaPageView('/')
    document.cookie = '_ga=GA1.1.1; path=/'
    document.cookie = '_ga_TESTE123=GS1.1.1; path=/'
    ga.gaRevokeConsent()
    expect(window['ga-disable-G-TESTE123']).toBe(true)
    expect(document.cookie).not.toContain('_ga')
    const n = calls().length
    ga.gaPageView('/events')
    expect(window['ga-disable-G-TESTE123']).toBe(false)
    expect(calls()).toHaveLength(n + 1)
  })
})
