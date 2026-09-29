import { hasAnalyticsConsent } from './tracking'

// Rastreio do link do Afiliado Evokaa, Decisões 64 e 66.
// Chega por www.evokaa.com.br/p/CODIGO/nome-do-link (ou ?ref=CODIGO&link=nome).
// Só fica guardado no navegador (30 dias) com consentimento de cookies de análise; sem
// consentimento vale só enquanto a aba estiver aberta (memória), e o produtor ainda pode
// digitar o código no cadastro. Nenhum dado pessoal é guardado: só o código, o link e a data.

const KEY = 'evokaa-affiliate-ref'
const TTL_MS = 30 * 24 * 60 * 60 * 1000
const CODE_RE = /^[A-Z0-9_-]{3,30}$/
const LINK_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export interface AffiliateRef { code: string; link?: string; firstSeenAt: string }

let emMemoria: AffiliateRef | null = null

export function setAffiliateRef(codeBruto: string, linkBruto?: string | null, seenBruto?: string | null) {
  const code = codeBruto.trim().toUpperCase()
  if (!CODE_RE.test(code)) return
  const link = linkBruto?.trim().toLowerCase()
  const atual = getAffiliateRef()
  // mesmo código e link: mantém a data do primeiro clique. Diferente: vale o último link
  // aberto (mesma regra de último clique da Decisão 36)
  if (atual?.code === code && atual.link === (link && LINK_RE.test(link) ? link : undefined)) return
  // data do 1º clique vinda do site (www): só vale se for real (passado, dentro de 30 dias)
  const seen = seenBruto ? new Date(seenBruto) : null
  const seenOk = seen && !Number.isNaN(seen.getTime()) && seen.getTime() <= Date.now() && Date.now() - seen.getTime() <= TTL_MS
  const ref: AffiliateRef = { code, firstSeenAt: seenOk ? seen!.toISOString() : new Date().toISOString(), ...(link && LINK_RE.test(link) ? { link } : {}) }
  emMemoria = ref
  if (hasAnalyticsConsent()) {
    try { localStorage.setItem(KEY, JSON.stringify(ref)) } catch { /* modo privado: fica só na memória */ }
  }
}

export function captureAffiliateRef(search: string) {
  const q = new URLSearchParams(search)
  const code = q.get('ref')
  if (code) setAffiliateRef(code, q.get('link'), q.get('seen'))
}

export function getAffiliateRef(): AffiliateRef | null {
  if (emMemoria) return emMemoria
  try {
    const bruto = localStorage.getItem(KEY)
    if (!bruto) return null
    const ref = JSON.parse(bruto) as AffiliateRef
    if (!CODE_RE.test(ref.code) || Date.now() - new Date(ref.firstSeenAt).getTime() > TTL_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return ref
  } catch {
    return null
  }
}

// Para levar o código do site (www) ao cadastro (app): são endereços diferentes e o navegador
// não compartilha o que um guardou com o outro
export function affiliateRefQuery(): string {
  const ref = getAffiliateRef()
  if (!ref) return ''
  const q = new URLSearchParams({ ref: ref.code })
  if (ref.link) q.set('link', ref.link)
  q.set('seen', ref.firstSeenAt)
  return q.toString()
}

// Endereço do cadastro no app levando o código do afiliado, quando houver
export function registerUrl(appUrlFn: (path: string) => string): string {
  const q = affiliateRefQuery()
  return appUrlFn(`/auth/register${q ? `?${q}` : ''}`)
}

export function clearAffiliateRef() {
  emMemoria = null
  try { localStorage.removeItem(KEY) } catch { /* nada */ }
}
