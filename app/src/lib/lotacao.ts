import type { DbTicketType } from '../hooks/useEvents'

// Esgotado só com a lotação real do banco (quantity_total; capacity é legado). Sem número, nunca se afirma esgotado
// (antes a página usava `capacity || 100`, uma lotação inventada).
export const lotacao = (t: DbTicketType) => ((t.quantity_total ?? 0) > 0 ? t.quantity_total! : (t.capacity ?? 0) > 0 ? t.capacity! : 0)
export const esgotado = (t: DbTicketType) => lotacao(t) > 0 && (t.sold || 0) >= lotacao(t)
// Máximo por pedido: o do lote ou 10 (grátis e pago). // ponytail: o banco só trava o pago sem máximo na fatia 2 (meia-entrada); até lá é só a tela
export const tetoPorPedido = (t: { max_per_order?: number | null }) => t.max_per_order ?? 10
// Já pôs no carrinho tudo o que resta ou o máximo por pedido
export const noLimite = (t: DbTicketType, qtd: number) =>
  (lotacao(t) > 0 && qtd >= lotacao(t) - (t.sold || 0)) || qtd >= tetoPorPedido(t)
