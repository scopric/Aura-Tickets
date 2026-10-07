import { resumoCarrinho } from './taxa'
import { fimDe } from './eventoProdutor'
import type { DbEvent } from '../hooks/useEvents'

type Item = { ticket_type_id: string; quantity: number }
export type Pendente = { id: string; payment_method: string | null; order_items: Item[] | null; total?: number; gateway_payment_id?: string; created_at?: string }

// Itens do pedido com o preço de cada tipo (vindo do banco) e os totais; a taxa vem de taxa.ts.
// ponytail: preço único por tipo de ingresso (lotes e meia-entrada, M5, ainda não existem no main); com M5, o preço sai do lote/meia de cada item.
export function itensDoPedido(items: Item[], precos: Record<string, number | null>) {
  const linhas = items.map(i => {
    const preco = precos[i.ticket_type_id]
    if (typeof preco !== 'number' || !Number.isFinite(preco) || preco < 0) throw new Error(`Ingresso sem preço no banco: ${i.ticket_type_id}`)
    return { ticket_type_id: i.ticket_type_id, quantity: i.quantity, unit_price: preco }
  })
  const r = resumoCarrinho(linhas.map(l => ({ preco: l.unit_price, qtd: l.quantity })))
  return {
    subtotal: r.subtotal, service_fee: r.taxa, total: r.total,
    linhas: linhas.map(l => ({ ...l, subtotal: Math.round(l.unit_price * l.quantity * 100) / 100 })),
  }
}

// Pedido pendente do mesmo usuário/evento com a mesma forma de pagamento e os mesmos itens: reaproveita em vez de criar outro.
// Só pedido com menos de 20 min: o cron cancela aos 30, então não devolve um pedido prestes a vencer.
export function pedidoReaproveitavel<P extends Pendente>(pendentes: P[], items: Item[], metodo: string | null, agora = Date.now()): P | undefined {
  const chave = (l: Item[]) => l.map(i => `${i.ticket_type_id}:${i.quantity}`).sort().join('|')
  const recente = (p: Pendente) => !!p.created_at && agora - new Date(p.created_at).getTime() < 20 * 60_000
  return pendentes.find(p => recente(p) && p.payment_method === metodo && chave(p.order_items ?? []) === chave(items))
}

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')

// Por que o tipo de ingresso não pode ser comprado agora (null = pode): evento já terminou ou fora da janela sale_start/sale_end.
// O banco confere a mesma regra (venda_bloqueada em 20261022); aqui é só para avisar antes de gravar.
export function vendaBloqueada(evento: Pick<DbEvent, 'start_date' | 'end_date' | 'date' | 'time'>, tipo: { sale_start?: string | null; sale_end?: string | null }, agora = Date.now()): string | null {
  if (fimDe(evento as DbEvent) <= agora) return 'Este evento já terminou'
  if (tipo.sale_start && new Date(tipo.sale_start).getTime() > agora) return `Vendas abrem em ${quando(tipo.sale_start)}`
  if (tipo.sale_end && new Date(tipo.sale_end).getTime() <= agora) return 'Vendas encerradas'
  return null
}
