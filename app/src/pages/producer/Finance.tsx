import * as I from '@/components/icones/evokaa16'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useFiltroEvento } from '../../hooks/useEventoDaUrl'
import FiltroEvento from '@/components/producer/FiltroEvento'
import { brl } from '../../lib/taxa'
import { forma } from '../../lib/bordero'
import { toCsv, downloadCsv, csvFilename, fetchAllRows, slugArquivo } from '../../lib/exportCsv'
import { PageHeader, Stat, EmptyState, SectionTitle } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Segmented } from '@/components/ui/toggle-group'
import { PERIODOS, ehPeriodo, type Periodo } from '../../lib/inicioProdutor'
import { vendasPagas, faltaSegundoFator, janelaDoPeriodo } from '../../lib/vendasPagas'

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
const diaBr = (aaaammdd: string) => aaaammdd.split('-').reverse().join('/')
const num = (v: unknown) => Number(v) || 0
const POR_PAGINA = 20
const COLUNAS = 'id, event_id, total, payment_method, created_at, events!inner(title, producer_id)'

export default function ProducerFinance() {
  const { user } = useAuth()
  const [busca, setBusca] = useSearchParams()
  const p = busca.get('periodo')
  const periodo: Periodo = ehPeriodo(p) ? p : 'tudo'
  const mudaPeriodo = (v: string) => setBusca((prev: URLSearchParams) => { const n = new URLSearchParams(prev); n.set('periodo', v); return n }, { replace: true })

  const [filtroEvento] = useFiltroEvento()
  const { de, ate } = janelaDoPeriodo(periodo)
  // soma e quebras vêm do banco (sem teto de 1.000 linhas); a lista na tela traz 20 por vez ("Ver mais"), o CSV traz todas
  const somaQ = useQuery({
    queryKey: ['producer-financeiro', user?.id, periodo, filtroEvento],
    enabled: !!user?.id,
    queryFn: () => vendasPagas({ de, ate, eventId: filtroEvento }),
  })
  const nPedidos = num(somaQ.data?.pedidos)
  const pedidosQ = useInfiniteQuery({
    queryKey: ['producer-fin-pedidos', user?.id, periodo, filtroEvento],
    enabled: !!user?.id,
    initialPageParam: 0,
    // ponytail: paginação por posição; pedido reembolsado entre dois "Ver mais" pode deixar um pedido de fora (CSV traz todos)
    queryFn: async ({ pageParam }) => {
      let q = supabase.from('orders').select(COLUNAS).eq('events.producer_id', user!.id).eq('status', 'paid')
      if (de) q = q.gte('created_at', de)
      if (filtroEvento) q = q.eq('event_id', filtroEvento)
      const r = await (q.order('created_at', { ascending: false }).order('id').range(pageParam, pageParam + POR_PAGINA - 1) as unknown as PromiseLike<{ data: Pedido[] | null; error: unknown }>)
      if (r.error) throw r.error
      return r.data ?? []
    },
    // para quando a página vem curta ou a soma das linhas chega ao total do banco
    getNextPageParam: (ultima, todas) => {
      const carregadas = todas.reduce((a, p) => a + p.length, 0)
      return ultima.length < POR_PAGINA || carregadas >= nPedidos ? undefined : carregadas
    },
  })
  const isPending = somaQ.isPending || pedidosQ.isPending
  const isError = somaQ.isError || (pedidosQ.isError && !pedidosQ.data)
  const isFetching = somaQ.isFetching || pedidosQ.isFetching
  const refetch = () => { somaQ.refetch(); pedidosQ.refetch() }
  // pedido pago no meio da paginação desloca as páginas e repetiria uma linha: um por id
  const recentes = [...new Map((pedidosQ.data?.pages.flat() ?? []).map(x => [x.id, x])).values()]
  const verMais = async () => {
    const r = await pedidosQ.fetchNextPage()
    if (r.isError) toast.error('Não foi possível carregar mais pedidos. Tente de novo.')
  }
  const soma = somaQ.data
  const vazio = !!soma && soma.pedidos === 0
  // zero vendas com 2FA pendente é zero do banco, não falta de venda
  const doisFatoresQ = useQuery({ queryKey: ['producer-2fa-pendente', user?.id], enabled: vazio, queryFn: faltaSegundoFator })

  // "bruto" = orders.total: inclui a taxa de serviço paga pelo comprador (Decisões 88 e 111)
  const bruto = num(soma?.total)

  const exportar = async () => {
    try {
      const linhas = await fetchAllRows<Pedido>((a, z) => {
        let q = supabase.from('orders').select(COLUNAS).eq('events.producer_id', user!.id).eq('status', 'paid')
        if (de) q = q.gte('created_at', de)
        if (filtroEvento) q = q.eq('event_id', filtroEvento)
        return q.order('created_at', { ascending: false }).order('id').range(a, z) as unknown as PromiseLike<{ data: Pedido[] | null; error: unknown }>
      })
      // pedido pago no meio da paginação desloca as páginas e repetiria uma linha: um por id
      const unicos = [...new Map(linhas.map(x => [x.id, x])).values()]
      downloadCsv(csvFilename(filtroEvento ? `pedidos-pagos-${slugArquivo(unicos[0]?.events?.title, filtroEvento)}` : 'pedidos-pagos'), toCsv(
        unicos.map(x => ({ pedido: x.id, data: data(x.created_at), evento: x.events?.title ?? '', forma: forma(x.payment_method), valor_bruto: num(x.total).toFixed(2).replace('.', ',') })),
        ['pedido', 'data', 'evento', 'forma', 'valor_bruto'],
      ))
    } catch { toast.error('Não foi possível exportar agora. Tente de novo.') }
  }

  const header = (
    <PageHeader
      title="Financeiro"
      description="Vendas pagas dos seus eventos, em valor bruto"
      actions={
        <>
          <Segmented label="Período" size="sm" value={periodo} onValueChange={mudaPeriodo} items={PERIODOS} className="w-full sm:w-72" />
          <Button variant="outline" onClick={exportar} disabled={nPedidos === 0} title={nPedidos === 0 ? 'Sem pedidos pagos para exportar' : undefined}>
          <I.Baixar aria-hidden="true" />Exportar CSV
          </Button>
        </>
      }
    />
  )

  const aviso = (
    <div className="mb-6 rounded-[10px] border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">Os valores do repasse aparecem quando o pagamento estiver ligado.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Até lá, esta tela mostra só o valor bruto dos pedidos pagos: o que o comprador pagou, com a taxa de serviço incluída. Taxas, repasse e saque ainda não são descontados aqui. Pedido reembolsado sai da soma e da lista, no período em que o pedido foi feito, não no do reembolso.
      </p>
    </div>
  )

  if (isPending) {
    return (
      <div aria-busy="true">
        {header}
        <FiltroEvento />
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
        <FiltroEvento />
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar o resumo financeiro.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}>Tentar de novo</Button>
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
        <Stat label="Pedidos pagos" value={nPedidos.toLocaleString('pt-BR')} />
        <Stat label="Ticket médio por pedido (bruto)" value={nPedidos ? brl(bruto / nPedidos) : '—'} />
      </div>
      {num(soma?.reembolsados.pedidos) > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {num(soma?.reembolsados.pedidos).toLocaleString('pt-BR')} {num(soma?.reembolsados.pedidos) === 1 ? 'pedido reembolsado' : 'pedidos reembolsados'} ({brl(num(soma?.reembolsados.total))}) não {num(soma?.reembolsados.pedidos) === 1 ? 'entra' : 'entram'} na soma (contados pela data do pedido).
        </p>
      )}

      {vazio ? (
        <div className="mt-6">
          {doisFatoresQ.data ? (
            <EmptyState title="Confirme o 2FA para ver as vendas" description="Saia e entre de novo, informando o código do 2FA. Sem isso o banco não mostra os pedidos." />
          ) : (
            <EmptyState
              title={filtroEvento ? 'Nenhum pedido pago neste evento' : 'Nenhum pedido pago ainda'}
              description={periodo === 'tudo' ? 'Quando alguém comprar ingresso de um evento seu, a venda aparece aqui.' : 'Nenhum pedido pago neste período. Tente um período maior.'}
            />
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section aria-labelledby="fin-por-evento" className="rounded-[10px] border border-border bg-card">
            <div className="border-b border-border px-4 py-3"><SectionTitle id="fin-por-evento">Por evento</SectionTitle></div>
            <ul className="divide-y divide-border">
              {soma!.por_evento.map(e => (
                <li key={e.event_id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{e.titulo || 'Sem título'}</p>
                    <p className="text-xs text-muted-foreground">{e.pedidos} {e.pedidos === 1 ? 'pedido' : 'pedidos'}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">{brl(num(e.total))}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="fin-por-forma" className="rounded-[10px] border border-border bg-card">
            <div className="border-b border-border px-4 py-3"><SectionTitle id="fin-por-forma">Por forma de pagamento</SectionTitle></div>
            <ul className="divide-y divide-border">
              {soma!.por_forma.map(f => (
                <li key={f.forma} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{forma(f.forma || null)}</p>
                    <p className="text-xs text-muted-foreground">{f.pedidos} {f.pedidos === 1 ? 'pedido' : 'pedidos'}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">{brl(num(f.total))}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="fin-por-dia" className="rounded-[10px] border border-border bg-card">
            <div className="border-b border-border px-4 py-3"><SectionTitle id="fin-por-dia">Por dia</SectionTitle></div>
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {[...soma!.por_dia].reverse().map(d => (
                <li key={d.dia} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{diaBr(d.dia)}</p>
                    <p className="text-xs text-muted-foreground">{d.pedidos} {d.pedidos === 1 ? 'pedido' : 'pedidos'}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">{brl(num(d.total))}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="fin-pedidos" className="rounded-[10px] border border-border bg-card">
            <div className="border-b border-border px-4 py-3"><SectionTitle id="fin-pedidos">Últimos pedidos pagos</SectionTitle></div>
            <ul className="divide-y divide-border">
              {recentes.map(x => (
                <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{x.events?.title || 'Sem título'}</p>
                    <p className="text-xs text-muted-foreground">{data(x.created_at)} · {forma(x.payment_method)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">{brl(num(x.total))}</p>
                </li>
              ))}
            </ul>
            {nPedidos > recentes.length && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                <p aria-live="polite" className="text-xs text-muted-foreground">
                  Mostrando {recentes.length.toLocaleString('pt-BR')} de {nPedidos.toLocaleString('pt-BR')}. O CSV traz todos.
                </p>
                {pedidosQ.hasNextPage && (
                  <Button variant="outline" size="sm" onClick={verMais} loading={pedidosQ.isFetchingNextPage}>Ver mais</Button>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
