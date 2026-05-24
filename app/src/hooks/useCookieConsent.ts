import { useState, useEffect, useCallback } from 'react'

export interface CookieConsent {
  necessary: boolean
  analytics: boolean
  marketing: boolean
  preferences: boolean
}

const STORAGE_KEY = 'aura-cookie-consent'
const VERSION = '1.0'

const defaultConsent: CookieConsent = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
}

export function useCookieConsent() {
  const [consent, setConsentState] = useState<CookieConsent>(defaultConsent)
  const [hasConsented, setHasConsented] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.version === VERSION) {
          setConsentState(parsed.consent)
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
    setConsentState(merged)
    setHasConsented(true)
    setShowBanner(false)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ consent: merged, version: VERSION, date: new Date().toISOString() }))
  }, [])

  const acceptAll = useCallback(() => {
    setConsent({
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    })
  }, [setConsent])

  const rejectAll = useCallback(() => {
    setConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    })
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
