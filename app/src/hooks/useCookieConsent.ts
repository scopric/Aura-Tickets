import { useState, useEffect, useCallback } from 'react'
import { trackPageView, hasAnalyticsConsent, COOKIE_CONSENT_KEY, COOKIE_CONSENT_VERSION } from '../lib/tracking'
import { gaRevokeConsent } from '../lib/googleAnalytics'
import { avisarCamada, cookiesDecididosEmMemoria } from '../lib/camadas'

// Só duas categorias: o site não usa cookie de marketing nem de preferências
// (tema e id do chat de suporte são funcionais). Formato salvo continua o mesmo
// (VERSION 1.0): respostas antigas com campos a mais seguem válidas.
export interface CookieConsent {
  necessary: boolean
  analytics: boolean
}


const defaultConsent: CookieConsent = {
  necessary: true,
  analytics: false,
}

export function useCookieConsent() {
  const [consent, setConsentState] = useState<CookieConsent>(defaultConsent)
  const [hasConsented, setHasConsented] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.version === COOKIE_CONSENT_VERSION) {
          setConsentState({ necessary: true, analytics: !!parsed.consent?.analytics })
          setHasConsented(true)
        } else {
          setShowBanner(true)
        }
      } else {
        setShowBanner(true)
      }
    } catch {
      setShowBanner(true)
    }
  }, [])

  const setConsent = useCallback((newConsent: CookieConsent) => {
    const merged = { ...newConsent, necessary: true }
    const tinhaAnalytics = hasAnalyticsConsent()
    setConsentState(merged)
    setHasConsented(true)
    setShowBanner(false)
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ consent: merged, version: COOKIE_CONSENT_VERSION, date: new Date().toISOString() }))
    } catch {
      cookiesDecididosEmMemoria() // sem armazenamento: a decisão vale só nesta visita (o aviso reaparece na próxima)
    }
    // Só quando o consentimento analítico muda de fato (regravar o mesmo não repete a página):
    // passou a consentir → registra a página atual (Supabase e GA4); retirou → GA4 desligado
    if (merged.analytics && !tinhaAnalytics) trackPageView(window.location.pathname)
    else if (!merged.analytics && tinhaAnalytics) gaRevokeConsent()
    avisarCamada() // a Política (e depois o Evo) só abrem depois desta decisão
  }, [])

  const acceptAll = useCallback(() => {
    setConsent({ necessary: true, analytics: true })
  }, [setConsent])

  const rejectAll = useCallback(() => {
    setConsent({ necessary: true, analytics: false })
  }, [setConsent])

  const openBanner = useCallback(() => {
    setShowBanner(true)
  }, [])

  return {
    consent,
    hasConsented,
    showBanner,
    setConsent,
    acceptAll,
    rejectAll,
    openBanner,
  }
}
