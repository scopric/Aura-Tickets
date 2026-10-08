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

type PrecoTipo = { name: string; price: number; preco_meia?: number | null; taxa_meia?: number | null }
// Meia por lugar: só assento (mesa não tem meia) de tipo com meia na vitrine; devolve a categoria ou null
const meiaDoLugar = (amb: Ambiente, a: Assento, meias: Record<string, string>, preco: (tipo: string) => PrecoTipo | undefined) => {
  const tt = tipoDoLugar(amb, a)
  return tt && a.type === 'seat' && preco(tt)?.preco_meia != null ? meias[chaveDoLugar(amb, a)] ?? null : null
}

// Itens do pedido (tipo e quantidade) dos lugares escolhidos, somando por tipo (e por categoria, na meia)
export function itensDosLugares(amb: Ambiente, escolhidos: string[], preco: (tipo: string) => PrecoTipo | undefined, meias: Record<string, string> = {}) {
  const por = new Map<string, { tt: string; meia: string | null; quantity: number }>()
  for (const a of amb.seats ?? []) {
    const tt = escolhidos.includes(chaveDoLugar(amb, a)) ? tipoDoLugar(amb, a) : null
    if (!tt) continue
    const meia = meiaDoLugar(amb, a, meias, preco)
    const k = `${tt}|${meia ?? ''}`
    por.set(k, { tt, meia, quantity: (por.get(k)?.quantity ?? 0) + ingressosDoLugar(a) })
  }
  return [...por.values()].flatMap(({ tt, meia, quantity }) => {
    const t = preco(tt)
    if (!t) return []
    return [meia
      ? { ticket_type_id: tt, quantity, name: `${t.name} (meia-entrada)`, price: t.preco_meia!, taxa_unit: t.taxa_meia ?? null, beneficio: 'meia' as const, meia_tipo: meia }
      : { ticket_type_id: tt, quantity, name: t.name, price: t.price }]
  })
}

// p_meias de reservar_assentos: só os lugares de meia, sem valor nulo (o banco recusa nulo com 'Meia inválida')
export const meiasDosLugares = (amb: Ambiente, escolhidos: string[], meias: Record<string, string>, preco: (tipo: string) => PrecoTipo | undefined) =>
  (amb.seats ?? []).flatMap(a => {
    const meia = escolhidos.includes(chaveDoLugar(amb, a)) ? meiaDoLugar(amb, a, meias, preco) : null
    return meia ? [{ seat_key: chaveDoLugar(amb, a), meia_tipo: meia }] : []
  })
