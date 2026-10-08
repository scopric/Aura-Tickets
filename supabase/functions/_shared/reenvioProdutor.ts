// Regra de quem pode pedir a ENTREGA do ingresso no lugar do comprador: só o produtor dono do evento do pedido
// (events.producer_id, lido do banco), só ticket_delivery e só com a mesma regra de 2FA do banco (mfaOk: conta sem fator verificado passa). Equipe não entra (limite conhecido).
export const TIPO_LOG_PRODUTOR = "ticket_delivery_producer";
export const LIMITE_PRODUTOR_POR_PEDIDO = 1; // por hora
export const LIMITE_PRODUTOR_POR_HORA = 30; // por produtor, em todos os pedidos

export function reenvioDoProdutor(o: { orderUserId: string | null; producerId: string | null | undefined; callerId: string; emailType: string; mfa: boolean }): boolean {
  return o.orderUserId !== o.callerId && o.emailType === "ticket_delivery" && !!o.producerId && o.producerId === o.callerId && o.mfa;
}
