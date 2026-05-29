import { useEffect } from 'react'
import { useCookieConsent } from '../hooks/useCookieConsent'
import { Cookie, X, Check, Settings } from 'lucide-react'

export default function CookieBanner() {
  const { consent, hasConsented, showBanner, setConsent, acceptAll, rejectAll, openBanner } = useCookieConsent()

  // Expõe função global para o footer poder abrir o banner
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__auraOpenCookieBanner = openBanner
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__auraOpenCookieBanner
      }
    }
  }, [openBanner])

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4">
      <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-xl border border-espresso/5 rounded-2xl shadow-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-plum/10 flex items-center justify-center flex-shrink-0">
            <Cookie className="w-5 h-5 text-plum" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-espresso mb-1">Sua privacidade importa</h3>
            <p className="text-xs text-espresso/60 leading-relaxed mb-4">
              Usamos cookies essenciais para autenticação e funcionamento da plataforma.
              Com seu consentimento, também usamos cookies analíticos e de marketing para melhorar sua experiência.
              Leia nossa{' '}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-plum hover:underline">
                Política de Privacidade
              </a>{' '}
              para mais detalhes.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={acceptAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                Aceitar todos
              </button>
              <button
                onClick={rejectAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-espresso/10 text-espresso text-xs font-medium rounded-full hover:bg-espresso/5 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                Rejeitar opcionais
              </button>
              <button
                onClick={() => {
                  const newConsent = {
                    necessary: true,
                    analytics: !consent.analytics,
                    marketing: !consent.marketing,
                    preferences: !consent.preferences,
                  }
                  setConsent(newConsent)
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-espresso/60 text-xs font-medium rounded-full hover:bg-espresso/5 transition-all"
              >
                <Settings className="w-3.5 h-3.5" />
                Personalizar
              </button>
            </div>

            {hasConsented && (
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-espresso/40">
                <span className={`px-2 py-0.5 rounded-full border ${consent.necessary ? 'bg-green-50 border-green-200 text-green-700' : 'border-espresso/10'}`}>
                  Necessários {consent.necessary ? '✓' : ''}
                </span>
                <span className={`px-2 py-0.5 rounded-full border ${consent.analytics ? 'bg-green-50 border-green-200 text-green-700' : 'border-espresso/10'}`}>
                  Analíticos {consent.analytics ? '✓' : ''}
                </span>
                <span className={`px-2 py-0.5 rounded-full border ${consent.marketing ? 'bg-green-50 border-green-200 text-green-700' : 'border-espresso/10'}`}>
                  Marketing {consent.marketing ? '✓' : ''}
                </span>
                <span className={`px-2 py-0.5 rounded-full border ${consent.preferences ? 'bg-green-50 border-green-200 text-green-700' : 'border-espresso/10'}`}>
                  Preferências {consent.preferences ? '✓' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
