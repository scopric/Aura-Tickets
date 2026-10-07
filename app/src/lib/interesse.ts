// "Avise-me quando abrir" (P4). Texto aprovado pelo Ricardo (jurídico) em 07/10/2026 (Decisão 172).
// Trocar o texto exige trocar a versão: ela é gravada com a inscrição (interest_lists.consentimento_versao).
export const CONSENTIMENTO_VERSAO = 'p4-v1-2026-10-07'
export const CONSENTIMENTO_TEXTO =
  'Quero ser avisado(a) quando as vendas deste evento abrirem. Autorizo a Evokaa a usar o nome, o e-mail e a cidade da minha conta ' +
  'para me avisar (no aplicativo e por e-mail) e a compartilhá-los com o produtor do evento, que poderá me incluir na lista de ' +
  'interessados e no CRM dele para falar sobre este evento. Posso deixar de receber o aviso a qualquer momento, em "Remover aviso" ' +
  'na página do evento. Os dados já compartilhados ficam com o produtor, que passa a ser responsável por eles: para pedir que ' +
  'sejam apagados, falo com o produtor do evento.'

/** "Vendas terminam em 3 dias" quando TODOS os ingressos à venda têm fim e o último fecha em até 7 dias; senão null.
 *  Estático (calculado a cada render, sem relógio correndo): ponytail, trocar por setInterval só se pedirem o segundo a segundo. */
export function fimDasVendas(fins: (string | null)[], agora = Date.now()) {
  if (!fins.length || fins.some(f => !f)) return null
  const ms = Math.max(...fins.map(f => Date.parse(f as string))) - agora
  if (!(ms > 0) || ms > 7 * 86_400_000) return null
  const dias = Math.floor(ms / 86_400_000)
  const horas = Math.floor(ms / 3_600_000)
  const minutos = Math.max(1, Math.floor(ms / 60_000))
  const pl = (n: number, u: string) => `${n} ${u}${n === 1 ? '' : 's'}`
  return `Vendas terminam em ${dias >= 1 ? pl(dias, 'dia') : horas >= 1 ? pl(horas, 'hora') : pl(minutos, 'minuto')}`
}
