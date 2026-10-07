import type { Environment, SeatNode } from './modelo'
import { caixaDosElementos, ORIGEM_SALA } from './geometria'

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

const MARGEM = 0.5

// Traz tudo para dentro da sala com a mesma translação (posições relativas intactas).
// Se o conjunto não cabe, amplia a sala (metros inteiros). Com lugar vendido/reservado não mexe em nada.
// ponytail: só sala retangular (ignora roomRotation e L), como `limites`
export function encaixarNaSala(env: Environment): { env: Environment; motivo?: string } {
  const c = caixaDosElementos(env)
  if (!c) return { env }
  const W = env.roomWidth || 40, H = env.roomHeight || 40
  const e = 1e-6
  if (c.x >= ORIGEM_SALA - e && c.y >= ORIGEM_SALA - e && c.x + c.w <= ORIGEM_SALA + W + e && c.y + c.h <= ORIGEM_SALA + H + e) return { env }
  if ((env.seats || []).some(vendido)) {
    return { env, motivo: 'Há lugares vendidos ou reservados neste mapa. Movê-los desalinharia os ingressos já vendidos.' }
  }
  const w = Math.max(W, Math.ceil(c.w + 2 * MARGEM - e)), h = Math.max(H, Math.ceil(c.h + 2 * MARGEM - e))
  const alvo = (ini: number, tam: number, sala: number) =>
    ini < ORIGEM_SALA + MARGEM ? ORIGEM_SALA + MARGEM - ini : ini + tam > ORIGEM_SALA + sala - MARGEM ? ORIGEM_SALA + sala - MARGEM - (ini + tam) : 0
  if ((env.walls || []).length && (w !== W || h !== H)) {
    return { env, motivo: 'As paredes ocupam a sala inteira; ajuste a sala ou mova o que está fora à mão.' }
  }
  const dx = alvo(c.x, c.w, w), dy = alvo(c.y, c.h, h)
  return {
    env: {
      ...env, roomWidth: w, roomHeight: h,
      seats: (env.seats || []).map(n => ({ ...n, x: n.x + dx, y: n.y + dy })),
      walls: (env.walls || []).map(p => ({ ...p, x1: p.x1 + dx, y1: p.y1 + dy, x2: p.x2 + dx, y2: p.y2 + dy })),
    },
  }
}
