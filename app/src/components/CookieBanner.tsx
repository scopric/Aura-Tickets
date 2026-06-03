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
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 animate-in slide-in-from-bottom duration-500">
      <div className="max-w-4xl mx-auto bg-slate-950/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-5 relative overflow-hidden">
        {/* Glow de fundo sutil */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-[#8f33f5]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-[#1d68c4]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1d68c4]/15 to-[#8f33f5]/15 border border-[#8f33f5]/20 flex items-center justify-center flex-shrink-0">
            <Cookie className="w-5 h-5 text-[#8f33f5] animate-pulse" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold font-serif text-white mb-1">Sua privacidade importa</h3>
            <p className="text-xs text-white/50 leading-relaxed font-light">
              Usamos cookies essenciais para autenticação e funcionamento da plataforma.
              Com seu consentimento, também usamos cookies analíticos e de marketing para melhorar sua experiência.
              Leia nossa{' '}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-[#1d68c4] hover:text-[#8f33f5] hover:underline transition-colors">
                Política de Privacidade
              </a>{' '}
              para mais detalhes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0 flex-shrink-0">
            <button
              onClick={acceptAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#1d68c4] to-[#8f33f5] text-white text-xs font-bold rounded-full hover:shadow-[0_0_15px_rgba(143,51,245,0.4)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
            >
              <Check className="w-3.5 h-3.5" />
              Aceitar todos
            </button>
            <button
              onClick={rejectAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-white/10 bg-white/5 text-white/80 text-xs font-medium rounded-full hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 duration-300"
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-white/40 hover:text-white/80 text-xs font-medium rounded-full hover:bg-white/5 transition-all duration-300"
            >
              <Settings className="w-3.5 h-3.5 animate-spin-slow" />
              Personalizar
            </button>
          </div>
        </div>

        {hasConsented && (
          <div className="mt-4 pt-3 border-t border-white/[0.04] flex flex-wrap gap-2 text-[10px] text-white/40 font-light relative z-10">
            <span className={`px-2 py-0.5 rounded-full border ${consent.necessary ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'border-white/10 text-white/30'}`}>
              Necessários {consent.necessary ? '✓' : ''}
            </span>
            <span className={`px-2 py-0.5 rounded-full border ${consent.analytics ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'border-white/10 text-white/30'}`}>
              Analíticos {consent.analytics ? '✓' : ''}
            </span>
            <span className={`px-2 py-0.5 rounded-full border ${consent.marketing ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'border-white/10 text-white/30'}`}>
              Marketing {consent.marketing ? '✓' : ''}
            </span>
            <span className={`px-2 py-0.5 rounded-full border ${consent.preferences ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'border-white/10 text-white/30'}`}>
              Preferências {consent.preferences ? '✓' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
