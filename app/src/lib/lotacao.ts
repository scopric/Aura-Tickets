import type { DbTicketType } from '../hooks/useEvents'

// Esgotado só com a lotação real do banco (quantity_total; capacity é legado). Sem número, nunca se afirma esgotado
// (antes a página usava `capacity || 100`, uma lotação inventada).
export const lotacao = (t: DbTicketType) => ((t.quantity_total ?? 0) > 0 ? t.quantity_total! : (t.capacity ?? 0) > 0 ? t.capacity! : 0)
export const esgotado = (t: DbTicketType) => lotacao(t) > 0 && (t.sold || 0) >= lotacao(t)
// Máximo por pedido, igual ao gatilho order_items_estoque_guard: grátis (price = 0) sem máximo = 10; pago sem máximo = sem teto (null)
export const tetoPorPedido = (t: { price: number | string | null; max_per_order?: number | null }) =>
  t.max_per_order ?? (Number(t.price) === 0 ? 10 : null)
// Já pôs no carrinho tudo o que resta ou o máximo por pedido
export const noLimite = (t: DbTicketType, qtd: number) =>
  (lotacao(t) > 0 && qtd >= lotacao(t) - (t.sold || 0)) || (tetoPorPedido(t) !== null && qtd >= tetoPorPedido(t)!)
