// Detalhe do evento na moderação (admin S8, Decisão 163 item 15).

// Link da transmissão de evento_privado.online_url: o admin vê SÓ o domínio, em texto (nunca um link clicável).
export function dominioDaTransmissao(u: string): string {
  try {
    return new URL(u).hostname || 'link inválido'
  } catch {
    return 'link inválido'
  }
}

// O texto que o produtor aceitou ainda bate com o hash gravado? null = o navegador não calcula SHA-256 aqui.
export async function hashConfere(texto: string, hash: string): Promise<boolean | null> {
  try {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') === hash
  } catch {
    return null
  }
}

// Imagem que o admin pode carregar: o mesmo critério do CHECK de events.cover_image (https do Storage do próprio projeto
// ou caminho do site). Outro site viraria pixel de rastreio do admin.
export const imagemSegura = (u: unknown): u is string =>
  typeof u === 'string' && (u.startsWith('https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/') || /^\/(?!\/)/.test(u))

// "Ingressos alterados em 05/10 14:30 (depois da aprovação)": só em evento aprovado que tem a marca
export function seloIngressosAlterados(e: { approval_status?: string | null; ingressos_alterados_em?: string | null }): string | null {
  if (e.approval_status !== 'approved' || !e.ingressos_alterados_em) return null
  const d = new Date(e.ingressos_alterados_em)
  if (isNaN(d.getTime())) return null
  const dm = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `Ingressos alterados em ${dm} ${hm} (depois da aprovação)`
}
