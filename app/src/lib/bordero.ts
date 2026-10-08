import { diaBR } from './visaoEvento'

// Contas do Borderô (E5): só o que o banco já grava. Valor por tipo de ingresso fica de fora (tickets.price_paid nasce 0
// e order_items.unit_price é média com taxa): aqui os tipos só têm contagem.
export type PedidoPago = { id: string; total: number; payment_method: string | null; created_at: string; subtotal?: number | null; discount?: number | null; service_fee?: number | null; processing_fee?: number | null }
export type IngressoDoTipo = { id: string; ticket_type_id: string; status: string; checked_in_at: string | null; ticket_types: { name: string } | null }

const FORMA: Record<string, string> = { pix: 'Pix', credit_card: 'Cartão de crédito', boleto: 'Boleto' }
export const forma = (m: string | null) => (m && FORMA[m]) || 'Não informada'

/** AAAA-MM-DD → DD/MM/AAAA */
export const dataBR = (dia: string) => dia.split('-').reverse().join('/')

const valor = (p: PedidoPago) => Number(p.total) || 0

export function resumoBordero(pedidos: PedidoPago[], ingressos: IngressoDoTipo[]) {
  const soma = (chave: (p: PedidoPago) => string) => {
    const acc = new Map<string, { chave: string; pedidos: number; total: number }>()
    for (const p of pedidos) {
      const a = acc.get(chave(p)) ?? { chave: chave(p), pedidos: 0, total: 0 }
      a.pedidos += 1
      a.total += valor(p)
      acc.set(a.chave, a)
    }
    return [...acc.values()]
  }
  const tipos = new Map<string, { id: string; nome: string; validos: number; checkins: number }>()
  for (const t of ingressos) {
    if (t.status !== 'active' && t.status !== 'used') continue
    const a = tipos.get(t.ticket_type_id) ?? { id: t.ticket_type_id, nome: t.ticket_types?.name || 'Sem nome', validos: 0, checkins: 0 }
    a.validos += 1
    if (t.status === 'used' || t.checked_in_at) a.checkins += 1
    tipos.set(t.ticket_type_id, a)
  }
  return {
    total: pedidos.reduce((s, p) => s + valor(p), 0),
    nPedidos: pedidos.length,
    porForma: soma(p => forma(p.payment_method)).sort((a, b) => b.total - a.total),
    porDia: soma(p => diaBR(p.created_at)).sort((a, b) => a.chave.localeCompare(b.chave)),
    porTipo: [...tipos.values()].sort((a, b) => b.validos - a.validos),
  }
}
