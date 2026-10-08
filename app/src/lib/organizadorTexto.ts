// Mesmas regras dos CHECKs de producer_public (docs/sql/20261007_organizador_reforco.sql). O banco é a trava real; aqui é aviso cedo.
// Limite conhecido (igual ao banco): homóglifos gregos/cirílicos não são tratados.
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '@': 'a', $: 's' }
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** NFKC, minúsculas, sem acento, leetspeak, só letras. */
export const normalizaMarca = (t: string) =>
  semAcento(t.normalize('NFKC').toLowerCase()).replace(/[01345@$]/g, (c) => LEET[c]).replace(/[^a-z]/g, '')

/** false se lembrar Evokaa ou Aura Tickets. */
export const marcaOk = (t: string) => !/evokaa|auratickets/.test(normalizaMarca(t))

/** Rótulo de rede: marca + palavras inteiras pix/pagamento ('Pixel Art', 'Pixabay' passam). */
export const rotuloOk = (t: string) => marcaOk(t) && !/\b(pix|pagamento)\b/.test(semAcento(t.toLowerCase()))

/** Host de URL https: sem label xn-- e sem a marca. */
export const hostOk = (url: string) => {
  const h = url.match(/^https:\/\/([^/]+)/)?.[1] ?? ''
  return !/(^|\.)xn--/i.test(h) && marcaOk(h)
}

/** Endereço digitado -> https://. Outros esquemas (javascript:, ftp:...) ficam como estão para a validação recusar. */
export const normalizaUrl = (s: string) => {
  const t = s.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t.replace(/^https?:\/\//i, 'https://')
  return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
}

export const emailSemProibidos = (e: string) => !/[?&#%,;<>"]/.test(e)

const MENSAGEM_CHECK: Record<string, string> = {
  producer_public_nome_check: 'O nome não pode lembrar a marca Evokaa ou Aura Tickets.',
  producer_public_site_check: 'O endereço do site não é aceito (precisa ser https e não pode lembrar a marca).',
  producer_public_email_check: 'O e-mail contém caracteres não aceitos (? & # % , ; < > ").',
  producer_public_redes_check: 'Alguma rede tem rótulo ou endereço não aceito (rótulos sem Pix/Pagamento/marca).',
  producer_public_whatsapp_check: 'WhatsApp inválido. Informe o DDD e o número.',
  producer_public_instagram_check: 'Instagram inválido. Use só letras, números, ponto e sublinhado (até 30).',
}
/** Mensagem do erro 23514 da RPC pelo nome da constraint. */
export const mensagemCheck = (message?: string) =>
  MENSAGEM_CHECK[message?.match(/constraint "([^"]+)"/)?.[1] ?? ''] ?? 'Algum campo está em formato inválido. Confira e tente de novo.'
