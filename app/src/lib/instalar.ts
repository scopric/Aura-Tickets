// Instalar o app (PWA). O Chrome dispara `beforeinstallprompt` uma vez, cedo; quem chega depois à página
// "Instale o app" já o perdeu. Por isso o main.tsx chama ouvirInstalacao() e a página lê o evento guardado.
// Sem service worker não se sabe se o Chrome chega a disparar o evento (plano V11c: não verificado).
export interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const MUDOU = 'evokaa:instalar'
let guardado: EventoInstalar | null = null

const avisar = () => window.dispatchEvent(new Event(MUDOU))

export function ouvirInstalacao() {
  window.addEventListener('beforeinstallprompt', e => {
    guardado = e as EventoInstalar // guarda sempre: o Chrome só dispara uma vez e a página pode ser aberta depois
    // preventDefault() só na página de instalar: nas outras rotas o Chrome segue com o próprio mini-aviso
    if (window.location.pathname.replace(/\/+$/, '') === '/app/download') e.preventDefault()
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    guardado = null
    avisar()
  })
}

export const eventoGuardado = () => guardado

export function assinarInstalacao(f: () => void) {
  window.addEventListener(MUDOU, f)
  return () => window.removeEventListener(MUDOU, f)
}

// O evento só serve uma vez: depois de escolher, descarta
export function esquecerEvento() {
  guardado = null
  avisar()
}

export type Sistema = 'ios' | 'android' | 'outro'

// ponytail: detecção por user agent; iPadOS 13+ se diz Mac, por isso o teste de toque. Nome do navegador não entra.
export function detectarSistema(ua: string, toques = 0): Sistema {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && toques > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'outro'
}

export function jaInstalado() {
  return !!window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}
