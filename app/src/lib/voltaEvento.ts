// Volta ao evento depois do login (VF): o coração do visitante leva a /auth/login?volta=/event/<id>.
// O Google e o cadastro perdem a URL; por isso a volta também fica no sessionStorage (padrão do aura_pending_checkout).
export const VOLTA = 'aura_volta'
export const SALVAR = 'aura_salvar_pendente'
const CAMINHO = /^\/event\/([\w-]+)$/ // só página de evento, nunca endereço de fora

export const voltaValida = (v: string | null | undefined) => (v && CAMINHO.test(v) ? v : null)

export const guardarVolta = (v: string | null) => { if (v) sessionStorage.setItem(VOLTA, v) }

/** Chegada já logada: lê a volta (da URL ou guardada) e limpa. Só o papel `user` volta, e leva o evento para salvar. */
export function consumirVolta(role: string, daUrl: string | null) {
  const guardada = voltaValida(sessionStorage.getItem(VOLTA))
  sessionStorage.removeItem(VOLTA)
  const volta = voltaValida(daUrl) ?? guardada
  if (!volta || role !== 'user') return null
  sessionStorage.setItem(SALVAR, volta.slice('/event/'.length))
  return volta
}

/** Na página do evento: true uma única vez se este evento é o que a pessoa tocou antes do login. */
export function pegarSalvarPendente(eventId: string) {
  if (sessionStorage.getItem(SALVAR) !== eventId) return false
  sessionStorage.removeItem(SALVAR)
  return true
}

export const limparSalvarPendente = () => sessionStorage.removeItem(SALVAR)
