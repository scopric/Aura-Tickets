// Cópia dos ingressos da conta, para "Meus ingressos" abrir sem internet (Decisão 162, D4; service worker em public/sw.js).
// Uma chave por conta; apagada no logout (hooks/useAuth.ts) e nunca lida por outra conta.
const PREFIXO = 'evk.ingressos.'

export function guardarIngressos(userId: string, ingressos: unknown[]) {
  try { localStorage.setItem(PREFIXO + userId, JSON.stringify({ em: new Date().toISOString(), ingressos })) } catch { /* cheio ou bloqueado: só perde o offline */ }
}

export function lerIngressos<T>(userId: string): { em: string; ingressos: T[] } | null {
  try {
    const v = JSON.parse(localStorage.getItem(PREFIXO + userId) || 'null')
    return v && typeof v.em === 'string' && Array.isArray(v.ingressos) ? v : null
  } catch { return null }
}

// Falha de rede (fetch caiu, sem internet, timeout): o PostgREST sempre manda `code` nos erros dele; sem code é a rede
export const falhaDeRede = (error: { code?: string } | null) => !!error && !error.code

// "Cópia de DD/MM HH:MM" na tela de ingressos enquanto o que aparece vem da cópia (useSyncExternalStore)
let copiaEm: string | null = null
const ouvintes = new Set<() => void>()
export function definirCopia(em: string | null) { if (em !== copiaEm) { copiaEm = em; ouvintes.forEach(f => f()) } }
export const copiaAtual = () => copiaEm
export const ouvirCopia = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f) } }

// Sessão do supabase-js ainda guardada no aparelho. getSession devolve null com o token vencido e sem rede, mas o token
// só some do armazenamento quando o servidor recusa (logout, refresh inválido): guardado = falha passageira, não saída.
export function sessaoGuardadaNoAparelho() {
  try { return Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k) && !!localStorage.getItem(k)) } catch { return false }
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

// O supabase-js, com token vencido e sem rede, tenta renovar com espera crescente (até ~30 s) e segura getSession e as consultas.
// Com cópia guardada a tela não espera tudo isso: passados `ms`, segue como falha de rede.
export const comTempo = <T>(p: PromiseLike<T>, ms: number, aoVencer: () => T) =>
  Promise.race([p, new Promise<T>(r => setTimeout(() => r(aoVencer()), ms))])
