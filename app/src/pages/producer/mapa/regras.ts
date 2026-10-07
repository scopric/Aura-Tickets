import type { SeatNode } from './modelo'

const vendido = (n: SeatNode) => n.sold > 0 || n.status === 'sold' || n.status === 'reserved'

// Próximo rótulo livre: maior número já usado com o mesmo prefixo + 1 ("Mesa 3" -> "Mesa 4"; base '' -> "7")
export function proximoRotulo(nos: Pick<SeatNode, 'label'>[], base: string): string {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s?(\\d+)$`)
  const max = nos.reduce((m, n) => Math.max(m, Number(re.exec(n.label)?.[1] ?? 0)), 0)
  return base ? `${base} ${max + 1}` : String(max + 1)
}

// Rótulo da cópia: troca o número final pelo próximo livre; sem número, só muda se o nó vende lugar
export function rotuloDaCopia(nos: Pick<SeatNode, 'label'>[], no: Pick<SeatNode, 'label' | 'capacity'>): string {
  const m = /^(.*?)\s*\d+$/.exec(no.label)
  if (m) return proximoRotulo(nos, m[1])
  return no.capacity > 0 ? proximoRotulo(nos, no.label) : no.label
}

// Apagar: vendido/reservado nunca; bloqueado só com confirmação
export function decidirApagar(no: Pick<SeatNode, 'sold' | 'status' | 'label'>): { acao: 'ok' | 'confirmar' | 'recusar'; msg?: string } {
  if (vendido(no as SeatNode)) return { acao: 'recusar', msg: `"${no.label}" tem venda ou reserva e não pode ser apagado.` }
  if (no.status !== 'free') return { acao: 'confirmar', msg: `"${no.label}" está bloqueado. Apagar mesmo assim?` }
  return { acao: 'ok' }
}

// Aplicar template: impedido se algum elemento tem venda ou reserva
export function decidirTemplate(nos: SeatNode[]): { permitido: boolean; vendidos: number; bloqueados: number } {
  return { permitido: !nos.some(vendido), vendidos: nos.filter(vendido).length, bloqueados: nos.filter(n => n.status === 'blocked').length }
}
