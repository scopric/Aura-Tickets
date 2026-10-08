// Contas do Borderô exportado (XLSX do servidor e conferência no front): só funções puras, sem rede, para o vitest.
// Dinheiro: o que o banco grava em orders (subtotal, discount, service_fee, processing_fee, total). Nada é inventado aqui:
// o que o banco ainda não grava (parcelas, repasse, reembolso por pedido, canal) fica de fora e é listado em AINDA_NAO.

export type Pedido = {
  id: string; status: string; created_at: string; payment_method: string | null; coupon_id: string | null
  subtotal: number | null; discount: number | null; service_fee: number | null; processing_fee: number | null; total: number | null
  customer_name?: string | null; customer_email?: string | null
}
export type Ingresso = {
  id: string; order_id: string; ticket_type_id: string; status: string; checked_in_at: string | null; created_at: string
  buyer_name?: string | null; buyer_email?: string | null
}
export type Tipo = { id: string; name: string; price: number | null; quantity_total: number | null; is_active: boolean }

const FORMA: Record<string, string> = { pix: 'Pix', credit_card: 'Cartão de crédito', boleto: 'Boleto' }
export const forma = (m: string | null) => (m && FORMA[m]) || 'Não informada'
export const n = (v: unknown) => Number(v) || 0
export const arred = (v: number) => Math.round(v * 100) / 100

/** Data e hora de São Paulo de um instante ISO. `dia` AAAA-MM-DD; `serial` = Date em UTC com o relógio de SP, para o Excel mostrar a hora certa. */
export function dataSP(iso: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map(x => [x.type, x.value]))
  return {
    dia: `${p.year}-${p.month}-${p.day}`,
    serial: new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)),
  }
}
export const diaBR = (dia: string) => dia.split('-').reverse().join('/')

export const AINDA_NAO = [
  'Parcelas do cartão (depende do gateway PagBank)',
  'Repasse ao produtor: data prevista, pago e retido (depende do gateway PagBank)',
  'Reembolso por pedido, com valor e data (depende de SQL)',
  'Meia-entrada contra o limite de 40% (depende do lote de meia)',
  'Canal de venda além do site: balcão, cortesia, afiliado (o pedido ainda não grava o canal)',
  'Despesas do orçamento e resultado do evento',
  'Valor por tipo de ingresso (tickets.price_paid ainda nasce 0)',
]

/** Pedidos pagos sem repetição (a paginação de 1.000 em 1.000 pode repetir linha se entrar pedido no meio). */
export const unicos = <T extends { id: string }>(l: T[]) => [...new Map(l.map(x => [x.id, x])).values()]

export function totais(pagos: Pedido[]) {
  const s = (f: (p: Pedido) => number) => arred(pagos.reduce((a, p) => a + f(p), 0))
  const r = {
    pedidos: pagos.length,
    ingressos: s(p => n(p.subtotal)), desconto: s(p => n(p.discount)),
    taxaServico: s(p => n(p.service_fee)), taxaPagamento: s(p => n(p.processing_fee)), total: s(p => n(p.total)),
  }
  // Se o checkout não gravou as taxas, a cascata não fecha: a aba avisa em vez de mostrar R$ 0,00 como se fosse verdade
  return { ...r, taxasGravadas: r.total === 0 || r.taxaServico > 0 || r.taxaPagamento > 0 }
}

function agrupa(pagos: Pedido[], chave: (p: Pedido) => string) {
  const m = new Map<string, { chave: string; pedidos: number; total: number }>()
  for (const p of pagos) {
    const a = m.get(chave(p)) ?? { chave: chave(p), pedidos: 0, total: 0 }
    a.pedidos += 1; a.total = arred(a.total + n(p.total)); m.set(a.chave, a)
  }
  return [...m.values()]
}
export const porForma = (pagos: Pedido[]) => agrupa(pagos, p => forma(p.payment_method)).sort((a, b) => b.total - a.total)
export const porDia = (pagos: Pedido[]) => agrupa(pagos, p => dataSP(p.created_at).dia).sort((a, b) => a.chave.localeCompare(b.chave))

export function porTipo(tipos: Tipo[], ingressos: Ingresso[]) {
  const vivos = ingressos.filter(t => t.status === 'active' || t.status === 'used')
  return tipos.map(t => {
    const meus = vivos.filter(i => i.ticket_type_id === t.id)
    const vendidos = meus.length
    const checkins = meus.filter(i => i.status === 'used' || i.checked_in_at).length
    const total = t.quantity_total == null ? null : n(t.quantity_total)
    return { nome: t.name, preco: n(t.price), total, vendidos, disponiveis: total == null ? null : Math.max(total - vendidos, 0), checkins, presenca: vendidos ? checkins / vendidos : 0 }
  })
}
