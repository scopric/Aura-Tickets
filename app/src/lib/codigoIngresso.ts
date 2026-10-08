// QR dinâmico do ingresso (Decisão 211): o servidor (função ingresso-codigo) entrega a LISTA de códigos das próximas 12 h e o relógio dele.
// Aqui só se escolhe o código da vez e se guarda a lista no aparelho (sem segredo: quem a copia só ganha o que ganharia compartilhando a conta, por 12 h).
// Funções puras, testadas em test/codigoIngresso.test.ts. O servidor é quem valida (janela atual ±1); o relógio do aparelho só escolhe qual código mostrar.
export const PASSO_MS = 30_000
const PREFIXO = 'evk.qr.'
const PREFIXO_QR = /^E1\.[0-9a-f]{32}\.$/
const CODIGO = /^[A-Z2-7]{8}$/

export interface ListaDeCodigos {
  offset: number // relógio do servidor menos o do aparelho, no instante da resposta
  primeiraJanela: number
  prefixo: string // "E1.<id sem hífens>."
  codigos: string[]
}

export const janelaAgora = (l: ListaDeCodigos, agora: number) => Math.floor((agora + l.offset) / PASSO_MS)

/** QR a mostrar agora e quanto falta para trocar; null se a lista já venceu (ou ainda não começou). */
export function codigoAgora(l: ListaDeCodigos, agora: number): { qr: string; restanteMs: number } | null {
  const i = janelaAgora(l, agora) - l.primeiraJanela
  if (i < 0 || i >= l.codigos.length) return null
  return { qr: l.prefixo + l.codigos[i], restanteMs: PASSO_MS - ((agora + l.offset) % PASSO_MS) }
}

/** Horas que a lista ainda cobre. */
export const horasRestantes = (l: ListaDeCodigos, agora: number) =>
  Math.max(0, ((l.primeiraJanela + l.codigos.length - janelaAgora(l, agora)) * PASSO_MS) / 3_600_000)

/** A resposta da função, conferida (nada de confiar no formato) e já com o `offset` do relógio. */
export function listaDaResposta(r: unknown, agoraDoAparelho: number): ListaDeCodigos | null {
  const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>
  const { servidorAgora, passo, primeiraJanela, prefixo, codigos } = o
  if (typeof servidorAgora !== 'number' || !Number.isFinite(servidorAgora) || passo !== 30) return null
  if (typeof primeiraJanela !== 'number' || !Number.isInteger(primeiraJanela)) return null
  if (typeof prefixo !== 'string' || !PREFIXO_QR.test(prefixo)) return null
  if (!Array.isArray(codigos) || codigos.length < 1 || codigos.length > 2000 || !codigos.every(c => typeof c === 'string' && CODIGO.test(c))) return null
  return { offset: servidorAgora - agoraDoAparelho, primeiraJanela, prefixo, codigos: codigos as string[] }
}

const chave = (donoId: string, ingressoId: string) => `${PREFIXO}${donoId}.${ingressoId}`

// Também em memória: com o armazenamento bloqueado (aba anônima, cheio) o QR continua aparecendo nesta visita; só perde o offline.
const memoria = new Map<string, ListaDeCodigos>()

export function guardarLista(donoId: string, ingressoId: string, l: ListaDeCodigos) {
  memoria.set(chave(donoId, ingressoId), l)
  try { localStorage.setItem(chave(donoId, ingressoId), JSON.stringify(l)) } catch { /* cheio ou bloqueado: só perde o offline */ }
}

export function lerLista(donoId: string, ingressoId: string): ListaDeCodigos | null {
  try {
    const v = JSON.parse(localStorage.getItem(chave(donoId, ingressoId)) || 'null')
    // volta pelo mesmo crivo da resposta: cópia adulterada ou de outra versão não passa
    const l = v ? listaDaResposta({ servidorAgora: v.offset, passo: 30, primeiraJanela: v.primeiraJanela, prefixo: v.prefixo, codigos: v.codigos }, 0) : null
    if (l) return l
  } catch { /* sem storage ou JSON ruim: cai na memória */ }
  return memoria.get(chave(donoId, ingressoId)) ?? null
}

export function apagarLista(donoId: string, ingressoId: string) {
  memoria.delete(chave(donoId, ingressoId))
  try { localStorage.removeItem(chave(donoId, ingressoId)) } catch { /* sem storage */ }
}

/** Logout: apaga as listas de todas as contas deste aparelho. */
export function apagarListas() {
  memoria.clear()
  try { Object.keys(localStorage).filter(k => k.startsWith(PREFIXO)).forEach(k => localStorage.removeItem(k)) } catch { /* sem storage */ }
}
