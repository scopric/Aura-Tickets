import { useSyncExternalStore } from 'react'
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_VERSION } from './tracking'
import { PRIVACY_VERSION } from './legal'
import { useAuthStore } from '../stores/authStore'

// Uma camada por vez no primeiro acesso (Decisão 157): cookies → aviso da Política → balão do Evo.
// Só LÊ o que o aviso de cookies e o aviso da Política já gravam; não grava consentimento, não toca no GA4.
export type Camada = 'cookies' | 'politica' | null

export const CHAVE_AVISO_POLITICA = `aviso-politica-${PRIVACY_VERSION}`
const EVENTO = 'evokaa:camada'
// Sem armazenamento (modo privado, cota) nada fica gravado: a decisão vale só nesta visita
let cookiesEmMemoria = false
let politicaEmMemoria = false

/** Só para teste: o estado de módulo vaza entre casos */
export function _resetCamadasParaTeste() {
  cookiesEmMemoria = false
  politicaEmMemoria = false
}

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

export function cookiesDecididosEmMemoria() {
  cookiesEmMemoria = true
}

export function fecharPolitica() {
  try {
    localStorage.setItem(CHAVE_AVISO_POLITICA, '1')
  } catch {
    politicaEmMemoria = true
  }
  avisarCamada()
}

/**
 * Qual camada está aberta agora. `versaoAceita` = a conta logada aceitou a PRIVACY_VERSION vigente.
 * Decisão 157.3: quem aceitou a versão vigente no cadastro (user_metadata.privacy_version) acabou de ler
 * a Política: não vê o aviso e ele não segura o Evo. Sem login ou sem esse metadado (ex.: entrada pelo
 * Google), a regra não vale e a pessoa vê o aviso uma vez.
 */
export function camadaAberta(versaoAceita = false): Camada {
  // decidido nesta visita sem conseguir gravar (sem armazenamento ou cota cheia): vale a decisão em memória
  if (!cookiesEmMemoria) {
    // mesma regra do useCookieConsent: resposta válida só com a versão atual do formato
    let decidido = false
    try {
      const salvo = ler(COOKIE_CONSENT_KEY)
      decidido = !!salvo && JSON.parse(salvo)?.version === COOKIE_CONSENT_VERSION
    } catch {
      // gravação corrompida: o aviso de cookies reaparece
    }
    if (!decidido) return 'cookies'
  }
  if (politicaEmMemoria || ler(CHAVE_AVISO_POLITICA) === '1' || versaoAceita) return null
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
  const versaoAceita = useAuthStore((s) => s.session?.user?.user_metadata?.privacy_version === PRIVACY_VERSION)
  return useSyncExternalStore(assinar, () => camadaAberta(versaoAceita))
}
