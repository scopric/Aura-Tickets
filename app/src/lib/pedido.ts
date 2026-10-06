import { resumoCarrinho } from './taxa'

type Item = { ticket_type_id: string; quantity: number }
export type Pendente = { id: string; payment_method: string; order_items: Item[] | null }

// Itens do pedido com o preço de cada tipo (vindo do banco) e os totais; a taxa vem de taxa.ts.
// ponytail: preço único por tipo de ingresso (lotes e meia-entrada, M5, ainda não existem no main); com M5, o preço sai do lote/meia de cada item.
export function itensDoPedido(items: Item[], precos: Record<string, number>) {
  const linhas = items.map(i => {
    const preco = precos[i.ticket_type_id]
    if (preco === undefined) throw new Error(`Ingresso sem preço no banco: ${i.ticket_type_id}`)
    return { ticket_type_id: i.ticket_type_id, quantity: i.quantity, unit_price: preco }
  })
  const r = resumoCarrinho(linhas.map(l => ({ preco: l.unit_price, qtd: l.quantity })))
  return {
    subtotal: r.subtotal, service_fee: r.taxa, total: r.total,
    linhas: linhas.map(l => ({ ...l, subtotal: Math.round(l.unit_price * l.quantity * 100) / 100 })),
  }
}

// Pedido pendente do mesmo usuário/evento com a mesma forma de pagamento e os mesmos itens: reaproveita em vez de criar outro.
export function pedidoReaproveitavel(pendentes: Pendente[], items: Item[], metodo: string): Pendente | undefined {
  const chave = (l: Item[]) => l.map(i => `${i.ticket_type_id}:${i.quantity}`).sort().join('|')
  return pendentes.find(p => p.payment_method === metodo && chave(p.order_items ?? []) === chave(items))
}
