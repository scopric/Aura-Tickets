import { supabase } from './supabase'
import { getAppMode } from './appHost'
import { useAuthStore } from '../stores/authStore'
import { gaPageView } from './googleAnalytics'
import type { BeforeSend } from '@vercel/analytics/react'

/**
 * Navegador dirigido por programa: Playwright, Selenium e Puppeteer marcam navigator.webdriver;
 * o navegador integrado do app Claude não marca, mas traz "Claude/" no user agent.
 * Não conta nas métricas (pico de 01/10/2026: 297 visitas a /producer/__reset numa hora).
 * Limite: quem abrir o site num app que ponha "Claude/" no user agent também some das métricas.
 */
export function ehAutomacao(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.webdriver === true || /\bClaude\//.test(navigator.userAgent)
}

// Vercel Web Analytics envia a URL inteira; o Supabase devolve o token no #hash
// (login social e redefinição de senha), então o hash nunca sai daqui. Fora do componente
// para não re-registrar o script a cada render. null descarta o evento.
export const semHash: BeforeSend = (event) =>
  ehAutomacao() ? null : { ...event, url: event.url.split('#')[0] }

export const COOKIE_CONSENT_KEY = 'aura-cookie-consent'
// versão do formato salvo; useCookieConsent e camadas.ts leem daqui
export const COOKIE_CONSENT_VERSION = '1.0'
const SESSION_ID_KEY = 'aura_session_id'

/**
 * Retorna ou gera o ID da sessão atual no sessionStorage (uma por aba/janela)
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server-side'
  
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY)
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    sessionStorage.setItem(SESSION_ID_KEY, sessionId)
  }
  return sessionId
}

/**
 * Verifica se o usuário concedeu cookies analíticos (LGPD)
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!stored) return false
    const parsed = JSON.parse(stored)
    // versão diferente = o aviso de cookies reabre (useCookieConsent): sem decisão válida, sem rastreio
    return parsed?.version === COOKIE_CONSENT_VERSION && !!parsed?.consent?.analytics
  } catch {
    return false
  }
}

/**
 * Envia um log de atividade para o Supabase
 */
export async function trackEvent(
  eventType: 'session_start' | 'page_view' | 'login' | 'logout' | 'add_to_cart' | 'purchase' | 'session_end',
  path?: string,
  metadata: Record<string, any> = {}
) {
  if (getAppMode() === 'admin') return // painel de administração não é rastreado (Decisão 46 do cofre)
  if (ehAutomacao()) return
  // LGPD: nenhum evento é gravado sem o consentimento de cookies analíticos (banner do site)
  if (!hasAnalyticsConsent()) {
    return
  }

  // Google Analytics 4 recebe só as visualizações de página (mesma regra de consentimento)
  if (eventType === 'page_view') {
    gaPageView(path || (typeof window !== 'undefined' ? window.location.pathname : '/'))
  }

  try {
    const sessionId = getSessionId()
    const user = useAuthStore.getState().user
    const userId = user?.id || null

    // Informações básicas de dispositivo coletadas de forma genérica
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : ''
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : null
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : null
    
    const extendedMetadata = {
      ...metadata,
      userAgent: userAgent.slice(0, 150),
      screen: screenWidth && screenHeight ? `${screenWidth}x${screenHeight}` : null,
      device: screenWidth && screenWidth < 768 ? 'Mobile' : screenWidth && screenWidth < 1024 ? 'Tablet' : 'Desktop'
    }

    // Inserção em segundo plano sem travar a navegação do usuário
    supabase
      .from('user_activities')
      .insert({
        user_id: userId,
        session_id: sessionId,
        event_type: eventType,
        path: path || (typeof window !== 'undefined' ? window.location.pathname : null),
        metadata: extendedMetadata
      })
      .then(({ error }) => {
        if (error) {
          console.warn('[Tracking] Falha ao gravar log no Supabase:', error.message)
        }
      })
  } catch (err) {
    console.warn('[Tracking] Erro no sistema de telemetria:', err)
  }
}

/**
 * Atalho para registrar visualizações de página (Page Views)
 */
export function trackPageView(path: string, metadata: Record<string, any> = {}) {
  trackEvent('page_view', path, metadata)
}
