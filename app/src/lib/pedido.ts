import { calcularTaxa } from './taxa'
import { fimDe } from './eventoProdutor'
import type { DbEvent } from '../hooks/useEvents'

// Chave do carrinho: `${tipo}|${beneficio}|${meia_tipo}` -> quantidade. Chave sem '|' (carrinho da página do evento ou sessionStorage antigo) = inteira.
export const chaveItem = (ticket_type_id: string, beneficio: 'inteira' | 'meia' = 'inteira', meia_tipo: string | null = null) => `${ticket_type_id}|${beneficio}|${meia_tipo ?? ''}`
export function lerChave(chave: string) {
  const [ticket_type_id, b, m] = chave.split('|')
  return b === 'meia' && m ? { ticket_type_id, beneficio: 'meia' as const, meia_tipo: m } : { ticket_type_id, beneficio: 'inteira' as const, meia_tipo: null }
}

// Prévia dos totais na tela (em centavos, sem desconto de cupom): a taxa da meia vem do servidor (taxa_unit, vitrine_ingressos); sem ela, a regra de taxa.ts.
// Quem decide o valor cobrado é o retorno de reservar_ingressos.
export function totaisItens(itens: { price: number; quantity: number; taxa_unit?: number | null }[]) {
  let sub = 0, taxa = 0
  for (const i of itens) {
    sub += Math.round(i.price * 100) * i.quantity
    taxa += Math.round((i.taxa_unit ?? calcularTaxa(i.price).taxa) * 100) * i.quantity
  }
  return { subtotal: sub / 100, taxa: taxa / 100, total: (sub + taxa) / 100 }
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
