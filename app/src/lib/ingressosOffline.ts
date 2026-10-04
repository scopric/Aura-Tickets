// Cópia dos ingressos da conta, para "Meus ingressos" abrir sem internet (Decisão 162, D4; service worker em public/sw.js).
// Uma chave por conta; apagada no logout (hooks/useAuth.ts) e nunca lida por outra conta.
const PREFIXO = 'evk.ingressos.'

export function guardarIngressos(userId: string, ingressos: unknown[]) {
  try { localStorage.setItem(PREFIXO + userId, JSON.stringify(ingressos)) } catch { /* cheio ou bloqueado: só perde o offline */ }
}

export function lerIngressos<T>(userId: string): T[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(PREFIXO + userId) || 'null')
    return Array.isArray(v) ? v : null
  } catch { return null }
}

export function apagarIngressosGuardados() {
  try { Object.keys(localStorage).filter(k => k.startsWith(PREFIXO)).forEach(k => localStorage.removeItem(k)) } catch { /* sem storage */ }
}

export function registrarServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(async () => {
      const reg = await navigator.serviceWorker.ready
      const urls = performance.getEntriesByType('resource').map(r => r.name).filter(n => new URL(n).pathname.startsWith('/assets/'))
      reg.active?.postMessage({ tipo: 'assets', urls })
    }).catch(() => { /* sem worker o app segue normal, só não abre offline */ })
  })
}
