import { Download } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { doEvento, useFiltroEvento } from '../../hooks/useEventoDaUrl'
import FiltroEvento from '@/components/producer/FiltroEvento'
import { brl } from '../../lib/taxa'
import { forma } from '../../lib/bordero'
import { toCsv, downloadCsv, csvFilename, fetchAllRows, slugArquivo } from '../../lib/exportCsv'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Repasse e saque (transactions, withdrawals) ficam sem acesso do produtor até o gateway (Decisão 113).
// Aqui só o que o banco já mostra: pedidos pagos dos eventos do produtor, em valor bruto.
type Pedido = {
  id: string
  event_id: string
  total: number
  payment_method: string | null
  created_at: string
  events: { title: string }
}

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export default function ProducerFinance() {
  const { user } = useAuth()

  const [filtroEvento] = useFiltroEvento()
  const { data: todos = [], isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['producer-financeiro', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // ponytail: soma no navegador, de 1.000 em 1.000 linhas; vira RPC de vendas quando a F2 gravar as taxas
      const linhas = await fetchAllRows<Pedido>((de, ate) =>
        supabase.from('orders')
          .select('id, event_id, total, payment_method, created_at, events!inner(title, producer_id)')
          .eq('events.producer_id', user!.id)
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .order('id')
          .range(de, ate) as unknown as PromiseLike<{ data: Pedido[] | null; error: unknown }>)
      // pedido pago no meio da paginação desloca as páginas e repetiria uma linha: um por id
      return [...new Map(linhas.map(p => [p.id, p])).values()]
    },
  })

  const pedidos = doEvento(todos, filtroEvento)

  // "bruto" = orders.total: inclui a taxa de serviço paga pelo comprador (Decisões 88 e 111)
  const bruto = pedidos.reduce((s, p) => s + (Number(p.total) || 0), 0)
  const porEvento = Object.values(pedidos.reduce<Record<string, { id: string; titulo: string; pedidos: number; bruto: number }>>((acc, p) => {
    acc[p.event_id] ??= { id: p.event_id, titulo: p.events?.title || 'Sem título', pedidos: 0, bruto: 0 }
    acc[p.event_id].pedidos += 1
    acc[p.event_id].bruto += Number(p.total) || 0
    return acc
  }, {})).sort((a, b) => b.bruto - a.bruto)

  const exportar = () => downloadCsv(csvFilename(filtroEvento ? `pedidos-pagos-${slugArquivo(pedidos[0]?.events?.title, filtroEvento)}` : 'pedidos-pagos'), toCsv(
    pedidos.map(p => ({ pedido: p.id, data: data(p.created_at), evento: p.events?.title ?? '', forma: forma(p.payment_method), valor_bruto: (Number(p.total) || 0).toFixed(2).replace('.', ',') })),
    ['pedido', 'data', 'evento', 'forma', 'valor_bruto'],
  ))

  const header = (
    <PageHeader
      title="Financeiro"
      description="Vendas pagas dos seus eventos, em valor bruto"
      actions={
        <Button variant="outline" onClick={exportar} disabled={pedidos.length === 0}>
          <Download aria-hidden="true" />Exportar CSV
        </Button>
      }
    />
  )

  const aviso = (
    <div className="mb-6 rounded-[10px] border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">Os valores do repasse aparecem quando o pagamento estiver ligado.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Até lá, esta tela mostra só o valor bruto dos pedidos pagos: o que o comprador pagou, com a taxa de serviço incluída. Taxas, repasse e saque ainda não são descontados aqui.
      </p>
    </div>
  )

  if (isPending) {
    return (
      <div aria-busy="true">
        {header}
        {aviso}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
        <Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" />
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        {header}
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar as vendas.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Carregando…' : 'Tentar de novo'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <FiltroEvento />
      {aviso}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Vendas pagas (bruto)" value={brl(bruto)} />
        <Stat label="Pedidos pagos" value={pedidos.length.toLocaleString('pt-BR')} />
        <Stat label="Ticket médio (bruto)" value={pedidos.length ? brl(bruto / pedidos.length) : '—'} />
      </div>

      {pedidos.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={filtroEvento ? 'Nenhum pedido pago neste evento' : 'Nenhum pedido pago ainda'} description="Quando alguém comprar ingresso de um evento seu, a venda aparece aqui." />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section aria-labelledby="fin-por-evento" className="rounded-[10px] border border-border bg-card">
            <h2 id="fin-por-evento" className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">Por evento</h2>
            <ul className="divide-y divide-border">
              {porEvento.map(e => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{e.titulo}</p>
                    <p className="text-xs text-muted-foreground">{e.pedidos} {e.pedidos === 1 ? 'pedido' : 'pedidos'}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">{brl(e.bruto)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="fin-pedidos" className="rounded-[10px] border border-border bg-card">
            <h2 id="fin-pedidos" className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
              Últimos pedidos pagos
            </h2>
            <ul className="divide-y divide-border">
              {pedidos.slice(0, 20).map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{p.events?.title || 'Sem título'}</p>
                    <p className="text-xs text-muted-foreground">{data(p.created_at)} · {forma(p.payment_method)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">{brl(Number(p.total) || 0)}</p>
                </li>
              ))}
            </ul>
            {pedidos.length > 20 && (
              <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                Mostrando os 20 mais recentes de {pedidos.length.toLocaleString('pt-BR')}. O CSV traz todos.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
