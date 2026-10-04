import { useSyncExternalStore } from 'react'
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_VERSION } from './tracking'
import { PRIVACY_VERSION } from './legal'
import { useAuthStore } from '../stores/authStore'

// Uma camada por vez no primeiro acesso (Decisão 157): cookies → aviso da Política → balão do Evo.
// Só LÊ o que o aviso de cookies e o aviso da Política já gravam; não grava consentimento, não toca no GA4.
export type Camada = 'cookies' | 'politica' | null

export const CHAVE_AVISO_POLITICA = `aviso-politica-${PRIVACY_VERSION}`
const EVENTO = 'evokaa:camada'
// Início da versão vigente da Política no horário de Brasília (a data é só AAAA-MM-DD)
const INICIO_VERSAO = new Date(`${PRIVACY_VERSION}T00:00:00-03:00`).getTime()
// Sem armazenamento (modo privado, cota) a dispensa não fica gravada: vale só nesta visita
let fechadaSemArmazenamento = false

// undefined = armazenamento indisponível; null = chave ausente
function ler(chave: string): string | null | undefined {
  try {
    return localStorage.getItem(chave)
  } catch {
    return undefined
  }
}

export function avisarCamada() {
  window.dispatchEvent(new Event(EVENTO))
}

export function fecharPolitica() {
  try {
    localStorage.setItem(CHAVE_AVISO_POLITICA, '1')
  } catch {
    fechadaSemArmazenamento = true
  }
  avisarCamada()
}

/**
 * Qual camada está aberta agora. `criadoEm` = created_at da conta logada (se houver).
 * Decisão 157.3: quem criou a conta no dia da versão vigente da Política (PRIVACY_VERSION) ou depois
 * acabou de aceitá-la no cadastro; não vê o aviso e ele não segura o Evo. Sem login, a regra não vale.
 */
export function camadaAberta(criadoEm?: string | null): Camada {
  const salvo = ler(COOKIE_CONSENT_KEY)
  if (salvo !== undefined) {
    // mesma regra do useCookieConsent: resposta válida só com a versão atual do formato
    let decidido = false
    try {
      decidido = salvo !== null && JSON.parse(salvo)?.version === COOKIE_CONSENT_VERSION
    } catch {
      // gravação corrompida: o aviso de cookies reaparece
    }
    if (!decidido) return 'cookies'
  }
  if (fechadaSemArmazenamento || ler(CHAVE_AVISO_POLITICA) === '1') return null
  if (criadoEm && Date.parse(criadoEm) >= INICIO_VERSAO) return null
  return 'politica'
}

function assinar(avisar: () => void) {
  window.addEventListener(EVENTO, avisar)
  window.addEventListener('storage', avisar)
  return () => {
    window.removeEventListener(EVENTO, avisar)
    window.removeEventListener('storage', avisar)
  }
}

export function useCamada(): Camada {
  const criadoEm = useAuthStore((s) => s.session?.user?.created_at as string | undefined)
  return useSyncExternalStore(assinar, () => camadaAberta(criadoEm))
}
