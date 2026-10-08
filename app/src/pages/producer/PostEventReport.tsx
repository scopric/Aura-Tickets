import { Link } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { brl } from '../../lib/taxa'
import { vendasPagas, faltaSegundoFator } from '../../lib/vendasPagas'
import { toCsv, downloadCsv, csvFilename, slugArquivo } from '../../lib/exportCsv'
import { useProducerEvents } from '../../hooks/useEvents'
import { useEventoDaUrl } from '../../hooks/useEventoDaUrl'
import { useEventSurveys } from '../../hooks/useProducerTools'
import { PageHeader, Stat, EmptyState, SectionTitle, selectNativo } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

function Alerta({ texto, onRetry, carregando }: { texto: string; onRetry: () => void; carregando: boolean }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-foreground">{texto}</p>
      <Button variant="outline" size="sm" onClick={onRetry} loading={carregando}>Tentar de novo</Button>
    </div>
  )
}

export default function PostEventReport() {
  const eventosQ = useProducerEvents()
  const events = eventosQ.data ?? []
  const [picked, setPicked] = useEventoDaUrl(events.map(e => e.id))
  // valor derivado (padrão do B0): a lista chega depois do 1º render e vale o primeiro evento até o produtor escolher
  const selectedEventId = picked ?? events[0]?.id ?? null
  const selectedEvent = events.find(e => e.id === selectedEventId)

  const surveysQ = useEventSurveys(selectedEventId)

  const statsQ = useQuery({
    queryKey: ['pos-evento-numeros', selectedEventId],
    enabled: !!selectedEventId,
    queryFn: async () => {
      const [ingressos, vendas] = await Promise.all([
        // participantes = ingressos válidos (ativo ou usado); cancelado, reembolsado e transferido não contam
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', selectedEventId!).in('status', ['active', 'used']),
        // soma exata no banco (RPC produtor_vendas_pagas), sem o corte de 1.000 pedidos
        vendasPagas({ eventId: selectedEventId }),
      ])
      if (ingressos.error) throw ingressos.error
      return { participants: ingressos.count ?? 0, revenue: Number(vendas.total) || 0, pedidos: Number(vendas.pedidos) || 0,
        // zero pedidos pode ser sessão sem 2FA concluído: o banco devolve zero sem erro
        faltaFator: Number(vendas.pedidos) === 0 && (await faltaSegundoFator()) }
    },
  })

  const header = (
    <PageHeader
      title="Relatório pós-evento"
      description={selectedEvent ? selectedEvent.title : 'Resultado de cada evento'}
      actions={selectedEventId && <Button disabled title="Ainda não existe envio de pesquisa">Enviar NPS (em breve)</Button>}
    />
  )

  if (eventosQ.isLoading) {
    return (
      <div aria-busy="true">
        {header}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
        <Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" />
      </div>
    )
  }

  if (eventosQ.isError) {
    return <div>{header}<Alerta texto="Não foi possível carregar seus eventos." onRetry={() => eventosQ.refetch()} carregando={eventosQ.isFetching} /></div>
  }

  if (events.length === 0) {
    return (
      <div>
        {header}
        <EmptyState
          title="Você ainda não tem eventos"
          description="O relatório aparece aqui depois do evento."
          action={<Button asChild><Link to="/producer/events/new"><I.Criar aria-hidden="true" />Criar evento</Link></Button>}
        />
      </div>
    )
  }

  const surveys = surveysQ.data ?? []
  const total = surveys.length
  const promoters = surveys.filter(r => r.score >= 9).length
  const passives = surveys.filter(r => r.score >= 7 && r.score <= 8).length
  const detractors = surveys.filter(r => r.score <= 6).length
  const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0
  const avgRating = total > 0 ? (surveys.reduce((s, r) => s + r.score, 0) / total).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'

  const semDados = !!statsQ.data?.faltaFator || statsQ.data?.pedidos === 0

  function exportar() {
    const linhas = [
      { Indicador: 'Evento', Valor: selectedEvent?.title ?? '' },
      { Indicador: 'NPS', Valor: total > 0 ? nps : '' },
      { Indicador: 'Respostas da pesquisa', Valor: total },
      { Indicador: 'Promotores (9–10)', Valor: promoters },
      { Indicador: 'Neutros (7–8)', Valor: passives },
      { Indicador: 'Detratores (0–6)', Valor: detractors },
      { Indicador: 'Nota média', Valor: avgRating === '—' ? '' : avgRating },
      { Indicador: 'Participantes (ingressos ativos ou usados)', Valor: statsQ.data?.participants ?? 0 },
      { Indicador: 'Pedidos pagos', Valor: statsQ.data?.pedidos ?? 0 },
      { Indicador: 'Vendas bruto (R$)', Valor: (statsQ.data?.revenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    ]
    downloadCsv(csvFilename(`pos-evento-${slugArquivo(selectedEvent?.title, selectedEventId!)}`), toCsv(linhas, ['Indicador', 'Valor']))
  }

  const carregando = surveysQ.isLoading || statsQ.isLoading
  const erro = surveysQ.isError || statsQ.isError

  return (
    <div>
      {header}

      <div className="grid gap-1.5 sm:max-w-sm">
        <Label htmlFor="pos-evento">Evento</Label>
        <select id="pos-evento" value={selectedEventId ?? ''} onChange={e => setPicked(e.target.value || null)} className={selectNativo}>
          {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      <div className="mt-6">
        {carregando ? (
          <div aria-busy="true" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
          </div>
        ) : erro ? (
          <Alerta
            texto="Não foi possível carregar o relatório deste evento."
            onRetry={() => { surveysQ.refetch(); statsQ.refetch() }}
            carregando={surveysQ.isFetching || statsQ.isFetching}
          />
        ) : (
          <>
            {statsQ.data?.faltaFator ? (
              <div role="alert" className="mb-3 rounded-[10px] border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground">Confirme o 2FA para ver as vendas</p>
                <p className="mt-1 text-sm text-muted-foreground">Saia e entre de novo, informando o código do 2FA. Sem isso o banco não mostra os pedidos, e o zero seria falso.</p>
              </div>
            ) : statsQ.data?.pedidos === 0 && (
              <p role="status" className="mb-3 text-sm text-muted-foreground">Nenhum pedido pago apareceu para esta conta neste evento. Se você esperava vendas, confirme o 2FA ou entre com a conta dona do evento; as vendas aparecem zeradas.</p>
            )}
            <div className="mb-3 flex justify-end">
              <Button
                variant="outline" size="sm" onClick={exportar}
                disabled={semDados}
                title={semDados ? 'Não há pedidos pagos visíveis para exportar.' : undefined}
                aria-label={semDados ? 'Exportar CSV (indisponível: não há pedidos pagos visíveis para exportar)' : undefined}
              >Exportar CSV</Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="NPS" value={total > 0 ? (nps > 0 ? `+${nps}` : nps) : '—'} hint={total > 0 ? `${total} resposta(s)` : 'Sem respostas'} />
              <Stat label="Nota média" value={avgRating} />
              <Stat label="Participantes" value={(statsQ.data?.participants ?? 0).toLocaleString('pt-BR')} hint="Ingressos ativos ou usados" />
              <Stat label="Vendas (bruto)" value={brl(statsQ.data?.revenue ?? 0)} hint="Pedidos pagos, com a taxa do comprador" />
            </div>

            <section aria-labelledby="nps" className="mt-6 rounded-[10px] border border-border bg-card p-4">
              <SectionTitle id="nps">NPS</SectionTitle>
              {total === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma resposta de pesquisa ainda. O envio da pesquisa pela Evokaa ainda não existe.</p>
              ) : (
                <>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Promotores (9–10)', n: promoters },
                      { label: 'Neutros (7–8)', n: passives },
                      { label: 'Detratores (0–6)', n: detractors },
                    ].map(g => (
                      <div key={g.label}>
                        <dt className="text-xs text-muted-foreground">{g.label}</dt>
                        <dd className="text-lg font-semibold tabular-nums text-foreground">{g.n} <span className="text-xs font-normal text-muted-foreground">({pct(g.n, total)}%)</span></dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full bg-primary" style={{ width: `${pct(promoters, total)}%` }} />
                    <div className="h-full bg-muted-foreground/40" style={{ width: `${pct(passives, total)}%` }} />
                    <div className="h-full bg-destructive" style={{ width: `${pct(detractors, total)}%` }} />
                  </div>
                </>
              )}
            </section>

            <section aria-labelledby="comentarios" className="mt-6 rounded-[10px] border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <SectionTitle id="comentarios">Comentários dos participantes</SectionTitle>
                <span className="text-sm tabular-nums text-muted-foreground">{total} resposta(s)</span>
              </div>
              {total === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nenhum comentário ainda.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {surveys.map(r => (
                    <li key={r.id} className="flex items-start gap-3 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-xs font-medium tabular-nums text-foreground">{r.score}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{r.comment || 'Sem comentário'}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.participant_email} · {new Date(r.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
