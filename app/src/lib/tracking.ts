import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'

const COOKIE_CONSENT_KEY = 'aura-cookie-consent'
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
    return !!parsed?.consent?.analytics
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
  // Eventos analíticos (como page_view) exigem o consentimento explícito do usuário sob LGPD
  if (eventType === 'page_view' && !hasAnalyticsConsent()) {
    return
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
