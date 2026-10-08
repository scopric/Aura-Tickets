// Lugar marcado no checkout. A chave é a mesma que o banco usa (docs/sql/20261008_assento_reserva.sql): ambiente:assento.
// O banco confere tudo de novo ao reservar (mapa ativo, lugar livre, setor com ingresso, preço); aqui é só para mostrar e somar.
export type Assento = {
  id: string; type?: string; label?: string; status?: string; sectionId?: string; seatsCount?: number; capacity?: number
}
export type Ambiente = { id: string; seats?: Assento[]; sections?: { id: string; ticketTypeId?: string }[] }
export type Estado = 'vendido' | 'reservado'

export const chaveDoLugar = (amb: { id: string }, a: { id: string }) => `${amb.id}:${a.id}`

// Quantos ingressos o lugar vale: assento 1; mesa, todas as cadeiras (seatsCount, senão capacity, senão 6)
export const ingressosDoLugar = (a: Assento) => (a.type === 'table' ? Math.max(Number(a.seatsCount) || Number(a.capacity) || 6, 1) : 1)

// Tipo de ingresso do lugar, ou null se o lugar não é vendável (não é assento/mesa, não está livre ou o setor não vende)
export function tipoDoLugar(amb: Ambiente, a: Assento): string | null {
  if ((a.type !== 'seat' && a.type !== 'table') || (a.status ?? 'free') !== 'free') return null
  return amb.sections?.find(s => s.id === a.sectionId)?.ticketTypeId ?? null
}

// Itens do pedido (tipo e quantidade) dos lugares escolhidos, somando por tipo
export function itensDosLugares(amb: Ambiente, escolhidos: string[], preco: (tipo: string) => { name: string; price: number } | undefined) {
  const por = new Map<string, number>()
  for (const a of amb.seats ?? []) {
    const tt = escolhidos.includes(chaveDoLugar(amb, a)) ? tipoDoLugar(amb, a) : null
    if (tt) por.set(tt, (por.get(tt) ?? 0) + ingressosDoLugar(a))
  }
  return [...por].flatMap(([tt, quantity]) => {
    const t = preco(tt)
    return t ? [{ ticket_type_id: tt, quantity, name: t.name, price: t.price }] : []
  })
}
