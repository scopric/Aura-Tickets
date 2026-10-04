import { getAppMode } from './appHost'

// Tema da interface: 'auto' segue o aparelho. Os valores antigos salvos ('dark' e 'light') continuam valendo.
export type Tema = 'auto' | 'light' | 'dark'

export const CHAVE_TEMA = 'evokaa-theme'

// Fonte única das regras abaixo: o script do index.html repete a lista e os prefixos à mão, e o
// test/tema.test.tsx executa o script e confere que ele dá o mesmo resultado destas funções.

// Rotas que seguem o tema escolhido, e o tema de quem nunca escolheu (decisão do Ricardo, 03/10/2026: a produtora e a
// compra, página do evento e checkout, seguem o aparelho, Decisão 142; a área do participante (/app) também, desde a V10b,
// com as telas refeitas nos dois temas, Decisão 144; o resto começa escuro). O resto das rotas
// (páginas públicas ainda não refeitas) fica forçado no escuro. O script do index.html repete esta lista à mão.
// '/event/' leva a barra final de propósito, para não casar com '/events' (Explorar, V11b: segue o tema, padrão escuro, Decisão 144).
export const ROTAS_COM_TEMA: { rota: string; padrao: Tema }[] = [
  { rota: '/producer', padrao: 'auto' },
  { rota: '/admin', padrao: 'dark' },
  { rota: '/app', padrao: 'auto' },
  { rota: '/checkout', padrao: 'auto' },
  { rota: '/auth', padrao: 'dark' },
  { rota: '/event/', padrao: 'auto' },
  { rota: '/events', padrao: 'dark' },
]

export function rotaForcadaEscuro(pathname: string, hostname = window.location.hostname) {
  // em app.* e alpha.* a raiz só redireciona: não é página pública
  if (pathname === '/' && getAppMode(hostname) !== 'site') return false
  return !ROTAS_COM_TEMA.some(r => pathname.startsWith(r.rota))
}

export function temaPadrao(pathname: string): Tema {
  return ROTAS_COM_TEMA.find(r => pathname.startsWith(r.rota))?.padrao ?? 'dark'
}

// O que a pessoa escolheu, ou null se nunca escolheu (ou se o valor salvo não é conhecido)
export function lerTema(): Tema | null {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA)
    return salvo === 'auto' || salvo === 'light' || salvo === 'dark' ? salvo : null
  } catch {
    return null
  }
}
