import { useEffect, useRef } from 'react'
import { useCookieConsent } from '../hooks/useCookieConsent'
import { Cookie, X, Check } from 'lucide-react'

export default function CookieBanner() {
  const { consent, hasConsented, showBanner, acceptAll, rejectAll, openBanner } = useCookieConsent()

  // Publica a altura do aviso em --cookie-banner-h no <body> para o que fica fixo no rodapé
  // (ex.: barra do carrinho na página do evento) subir e não ficar coberto
  const bannerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bannerRef.current
    if (!showBanner || !el) return
    const apply = () => document.body.style.setProperty('--cookie-banner-h', `${el.offsetHeight}px`)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => { ro.disconnect(); document.body.style.removeProperty('--cookie-banner-h') }
  }, [showBanner])

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
    <div ref={bannerRef} className="fixed bottom-[calc(var(--barra-cel,0px)+env(safe-area-inset-bottom))] left-0 right-0 z-[100] p-4 md:p-6 animate-in slide-in-from-bottom duration-500 pointer-events-none">
      <div className="max-w-4xl mx-auto bg-popover text-popover-foreground border border-border rounded-2xl shadow-ev-2 p-5 relative overflow-hidden pointer-events-auto">
        {/* Glow de fundo sutil */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-[#8f33f5]/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-[#1d68c4]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1d68c4]/15 to-[#8f33f5]/15 border border-[#8f33f5]/20 flex items-center justify-center flex-shrink-0">
            <Cookie className="w-5 h-5 text-[#8f33f5] animate-pulse motion-reduce:animate-none" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold font-serif mb-1">Sua privacidade importa</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Usamos cookies essenciais para autenticação e funcionamento da plataforma.
              Com seu consentimento, também usamos os cookies do Google Analytics (Google LLC, EUA) para entender como
              o site é usado, o que envia esses dados de navegação para fora do Brasil.
              Leia nossa{' '}
              <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                Política de Privacidade
              </a>{' '}
              para mais detalhes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0 flex-shrink-0">
            <button
              onClick={acceptAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-transparent bg-primary text-primary-foreground text-xs font-semibold rounded-full hover:bg-[var(--ev-brand-hover)] active:scale-95 transition-[background-color,transform] duration-rapido motion-reduce:transition-none focus-visible:outline-none focus-visible:shadow-ev-foco"
            >
              <Check className="w-3.5 h-3.5" />
              Aceitar todos
            </button>
            <button
              onClick={rejectAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-border bg-secondary text-secondary-foreground text-xs font-semibold rounded-full hover:bg-[var(--ev-tint-press)] active:scale-95 transition-[background-color,transform] duration-rapido motion-reduce:transition-none focus-visible:outline-none focus-visible:shadow-ev-foco"
            >
              <X className="w-3.5 h-3.5" />
              Rejeitar opcionais
            </button>
          </div>
        </div>

        {hasConsented && (
          <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2 text-[10px] text-muted-foreground relative z-10">
            <span className={`px-2 py-0.5 rounded-full border ${consent.necessary ? 'border-border text-[var(--ev-success)]' : 'border-border text-muted-foreground'}`}>
              Necessários {consent.necessary ? '✓' : ''}
            </span>
            <span className={`px-2 py-0.5 rounded-full border ${consent.analytics ? 'border-border text-[var(--ev-success)]' : 'border-border text-muted-foreground'}`}>
              Analíticos {consent.analytics ? '✓' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
