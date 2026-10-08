import { describe, it, expect, vi, beforeEach } from 'vitest'

const COD = '3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f'
const alvo = vi.hoisted(() => ({ ga: vi.fn(), inserts: [] as Record<string, unknown>[] }))
vi.mock('../lib/googleAnalytics', () => ({ gaPageView: alvo.ga }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ insert: (v: Record<string, unknown>) => { alvo.inserts.push(v); return Promise.resolve({ error: null }) } }) },
}))
vi.mock('../stores/authStore', () => ({ useAuthStore: { getState: () => ({ user: null }) } }))

import { trackEvent, COOKIE_CONSENT_KEY, COOKIE_CONSENT_VERSION } from '../lib/tracking'

describe('trackEvent: o código do certificado não chega ao GA4 nem à tabela de atividades', () => {
  beforeEach(() => {
    alvo.ga.mockClear(); alvo.inserts.length = 0
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ version: COOKIE_CONSENT_VERSION, consent: { analytics: true } }))
  })
  it('caminho passado pelo chamador', async () => {
    await trackEvent('page_view', `/certificado/${COD}`)
    expect(alvo.ga).toHaveBeenCalledWith('/certificado/:codigo')
    expect(alvo.inserts[0].path).toBe('/certificado/:codigo')
    expect(JSON.stringify(alvo.inserts)).not.toContain(COD)
  })
  it('caminho padrão (sem argumento) vem da janela atual', async () => {
    window.history.pushState({}, '', `/certificado/${COD}`)
    await trackEvent('page_view')
    expect(alvo.ga).toHaveBeenCalledWith('/certificado/:codigo')
    expect(alvo.inserts[0].path).toBe('/certificado/:codigo')
  })
  it('outras páginas seguem iguais', async () => {
    await trackEvent('page_view', '/events')
    expect(alvo.inserts[0].path).toBe('/events')
  })
})
