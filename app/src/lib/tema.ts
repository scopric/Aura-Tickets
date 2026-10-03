import { getAppMode } from './appHost'

// Tema da interface: 'auto' segue o aparelho. Os valores antigos salvos ('dark' e 'light') continuam valendo.
export type Tema = 'auto' | 'light' | 'dark'

export const CHAVE_TEMA = 'evokaa-theme'

// Fonte única das regras abaixo: o script do index.html repete a lista e os prefixos à mão, e o
// test/tema.test.tsx executa o script e confere que ele dá o mesmo resultado destas funções.

// Rotas que seguem o tema escolhido. O resto (páginas públicas ainda não refeitas) fica forçado no escuro.
export const ROTAS_COM_TEMA = ['/producer', '/admin', '/app', '/checkout', '/auth']

export function rotaForcadaEscuro(pathname: string, hostname = window.location.hostname) {
  // em app.* e alpha.* a raiz só redireciona: não é página pública
  if (pathname === '/' && getAppMode(hostname) !== 'site') return false
  return !ROTAS_COM_TEMA.some(r => pathname.startsWith(r))
}

// Sem nada salvo (decisão do Ricardo, 03/10/2026): a produtora segue o aparelho; o resto começa escuro
export function temaPadrao(pathname: string): Tema {
  return pathname.startsWith('/producer') ? 'auto' : 'dark'
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
