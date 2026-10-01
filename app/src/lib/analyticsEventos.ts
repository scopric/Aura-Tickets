// Cruza as visitas às páginas de evento (Vercel, todos os visitantes) com os eventos e os pedidos
// do banco, para a tabela "Eventos" e o funil do Admin → Analytics.
// A página do evento é /event/<id ou slug> (useEvents.ts, usePublicEvent): as duas formas do
// mesmo evento são somadas.

export type VisitaEvento = { caminho: string; visitantes: number; paginas: number }
export type EventoDb = { id: string; slug: string | null; title: string }
export type PedidoDb = { event_id: string; status: string; total: number | string | null }

export type LinhaEvento = {
  id: string | null // null = endereço que não bate com nenhum evento (apagado ou inválido)
  titulo: string
  visitantes: number
  paginas: number
  pedidos: number
  pagos: number
  receita: number
  conversao: number | null // pagos ÷ visitantes; null quando não dá para calcular ou passa de 100%
}

// "/event/abc" → "abc" (sem barra final nem query)
export const chaveDoCaminho = (caminho: string) => {
  const k = caminho.replace(/^\/event\//, '').split(/[/?#]/)[0] ?? ''
  try {
    return decodeURIComponent(k)
  } catch {
    return k // "%" solto no endereço
  }
}

export function montarEventos(visitas: VisitaEvento[], eventos: EventoDb[], pedidos: PedidoDb[]): LinhaEvento[] {
  const porId = new Map(eventos.map(e => [e.id.toLowerCase(), e]))
  const porSlug = new Map(eventos.filter(e => e.slug).map(e => [e.slug as string, e]))
  const linhas = new Map<string, LinhaEvento>()
  const linha = (id: string | null, titulo: string, chave: string) => {
    let l = linhas.get(chave)
    if (!l) linhas.set(chave, (l = { id, titulo, visitantes: 0, paginas: 0, pedidos: 0, pagos: 0, receita: 0, conversao: null }))
    return l
  }

  for (const v of visitas) {
    const k = chaveDoCaminho(v.caminho)
    const ev = porId.get(k.toLowerCase()) ?? porSlug.get(k)
    // ponytail: visitantes somados entre /event/<id> e /event/<slug> podem contar a mesma pessoa duas vezes
    const l = ev ? linha(ev.id, ev.title, ev.id) : linha(null, v.caminho, `?${v.caminho}`)
    l.visitantes += v.visitantes
    l.paginas += v.paginas
  }

  for (const p of pedidos) {
    const ev = porId.get(p.event_id.toLowerCase())
    const l = linha(p.event_id, ev?.title ?? 'Evento sem nome', p.event_id)
    l.pedidos += 1
    if (p.status === 'paid') {
      l.pagos += 1
      l.receita += Number(p.total ?? 0)
    }
  }

  return [...linhas.values()]
    .map(l => ({ ...l, conversao: l.visitantes > 0 && l.pagos <= l.visitantes ? l.pagos / l.visitantes : null }))
    .sort((a, b) => b.visitantes - a.visitantes || b.pedidos - a.pedidos)
}
