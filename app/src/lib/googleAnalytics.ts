// Google Analytics 4 (gtag.js), carregado só depois do consentimento de cookies analíticos
// (Decisões, 13): quem chama é trackEvent('page_view') em tracking.ts, que já faz essa checagem.
// Sem VITE_GA_MEASUREMENT_ID (ex.: local e prévias) nada é carregado — e a variável precisa
// existir na hora do build, porque o Vite grava o valor no pacote.
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    [key: `ga-disable-${string}`]: boolean | undefined
  }
}

let loaded = false

function loadGoogleAnalytics() {
  if (loaded || !MEASUREMENT_ID || typeof window === 'undefined') return
  loaded = true
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  // send_page_view: false — a página é enviada por gaPageView em cada mudança de rota (SPA).
  // Na medição aprimorada do GA4, deixar DESLIGADA a opção "alterações de página com base
  // em eventos do histórico do navegador", senão cada rota conta duas vezes.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)
}

/** Envia uma visualização de página ao GA4 (carrega o script na primeira chamada). */
export function gaPageView(path: string) {
  loadGoogleAnalytics()
  if (!loaded) return
  // Reabilita depois de uma retirada de consentimento (ver gaRevokeConsent)
  window[`ga-disable-${MEASUREMENT_ID}`] = false
  window.gtag!('event', 'page_view', {
    page_path: path,
    page_location: window.location.origin + path + window.location.search, // a query guarda os utm_*
    page_title: document.title,
  })
}

/**
 * O visitante retirou o consentimento: opt-out oficial do Google (o gtag deixa de gravar cookie
 * e de enviar qualquer dado para este ID) e os cookies _ga* já gravados são apagados.
 */
export function gaRevokeConsent() {
  if (!loaded) return
  window[`ga-disable-${MEASUREMENT_ID}`] = true
  // O gtag grava o cookie no domínio mais alto que consegue (ex.: .evokaa.com.br): tenta todos
  const partes = window.location.hostname.split('.')
  const dominios = ['', ...partes.map((_, i) => partes.slice(i).join('.'))]
  document.cookie
    .split(';')
    .map((c) => c.trim().split('=')[0])
    .filter((nome) => nome.startsWith('_ga'))
    .forEach((nome) => {
      for (const d of dominios) {
        document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ''}`
      }
    })
}
