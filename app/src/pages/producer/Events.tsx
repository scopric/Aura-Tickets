import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { useProducerEvents, useDeleteEvent, useUpdateEvent, useVendidosPorEvento, type DbEvent } from '../../hooks/useEvents'
import { useDuplicarEvento } from '../../hooks/useDuplicarEvento'
import { situacaoEvento, erroAoExcluir, erroDeStatus, vendidosDe, confirmacaoDuplicar, confirmacaoCancelar, confirmacaoArquivar, dataPorVir, CANCELAR_COM_VENDA, SAIR_DO_AR_COM_VENDA, type Situacao } from '../../lib/eventoProdutor'
import { siteUrl } from '../../lib/appHost'
import { abreEvento, normaliza } from '../../lib/navegacaoProdutor'
import EventoCapa from '../../components/EventoCapa'
import { PageHeader, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const filtros: ('Todos' | Situacao)[] = ['Todos', 'Publicado', 'Em análise', 'Rascunho', 'Recusado', 'Encerrado', 'Cancelado']
const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const inteiro = (n: number) => n.toLocaleString('pt-BR')

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Sem data definida'
  // dia local: sem o T00:00:00 o navegador lê UTC e volta um dia
  const date = new Date(`${dateStr}T00:00:00`)
  return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ProducerEvents() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'Todos' | Situacao>('Todos')
  const [acao, setAcao] = useState<{ tipo: 'encerrar' | 'cancelar' | 'excluir'; event: DbEvent } | null>(null)

  const { data: events = [], isLoading, isError, refetch, isFetching } = useProducerEvents()
  const { data: vendidos } = useVendidosPorEvento()
  const deleteMutation = useDeleteEvent()
  const { duplicar, duplicando } = useDuplicarEvento()
  const updateEvent = useUpdateEvent()

  // undefined = não se sabe (contagem não carregou ou veio cortada)
  const vendidoDe = (id: string) => vendidosDe(vendidos, id)

  // Cancelar, encerrar e excluir passam pela mesma janela (acao); estas só abrem
  const cancelar = (event: DbEvent) => {
    if ((vendidoDe(event.id) ?? 0) > 0) { toast.error(CANCELAR_COM_VENDA); return } // Decisão 129
    setAcao({ tipo: 'cancelar', event })
  }

  const encerrar = (event: DbEvent) => {
    if ((vendidoDe(event.id) ?? 0) > 0 && dataPorVir(event)) { toast.error(SAIR_DO_AR_COM_VENDA); return } // Decisão 129
    setAcao({ tipo: 'encerrar', event })
  }

  const pedirExclusao = (event: DbEvent) => {
    const v = vendidoDe(event.id) ?? 0
    if (v > 0) { toast.error(`Este evento tem ${inteiro(v)} ${v === 1 ? 'ingresso vendido' : 'ingressos vendidos'} e não pode ser excluído. Fale com o suporte da Evokaa.`); return }
    setAcao({ tipo: 'excluir', event })
  }

  const mudarStatus = async (event: DbEvent, status: 'cancelled' | 'ended') => {
    try {
      await updateEvent.mutateAsync({ eventId: event.id, event: { status }, tickets: [] })
      toast.success(status === 'ended' ? 'Evento encerrado.' : 'Evento cancelado.')
    } catch (err) {
      toast.error(erroDeStatus(err, status === 'ended' ? 'Não foi possível encerrar o evento.' : 'Não foi possível cancelar o evento.'))
    }
  }

  const excluir = async (event: DbEvent) => {
    try {
      await deleteMutation.mutateAsync(event.id)
      toast.success('Evento excluído.')
    } catch (err) {
      const { mensagem, oferecerCancelar } = erroAoExcluir(err, vendidoDe(event.id))
      toast.error(mensagem, oferecerCancelar && event.status !== 'cancelled'
        ? { action: { label: 'Cancelar evento', onClick: () => cancelar(event) }, duration: 10000 }
        : undefined)
    }
  }

  const textoDaJanela = ({ tipo, event }: NonNullable<typeof acao>) => {
    const v = vendidoDe(event.id)
    if (tipo === 'encerrar') return { titulo: 'Encerrar evento', texto: confirmacaoArquivar(event.title, v, dataPorVir(event)), botao: 'Encerrar' }
    if (tipo === 'cancelar') return { titulo: 'Cancelar evento', texto: confirmacaoCancelar(event.title, v), botao: 'Cancelar evento' }
    return {
      titulo: 'Excluir evento',
      texto: `Excluir o evento "${event.title}"? Esta ação não pode ser desfeita.`,
      botao: 'Excluir',
    }
  }

  const confirmar = () => {
    if (!acao) return
    const { tipo, event } = acao
    if (tipo === 'excluir') void excluir(event)
    else void mudarStatus(event, tipo === 'encerrar' ? 'ended' : 'cancelled')
  }

  const handleDuplicate = (event: DbEvent) => {
    if (window.confirm(confirmacaoDuplicar(event.title))) void duplicar(event)
  }

  const termo = normaliza(search.trim())
  const filtered = events.filter(e =>
    normaliza(e.title).includes(termo) && (filter === 'Todos' || situacaoEvento(e) === filter))

  const header = (
    <PageHeader
      title="Meus eventos"
      description="Todos os seus eventos, do rascunho ao encerrado"
      actions={<Button asChild data-tour="eventos-criar"><Link to="/producer/events/new"><I.Criar aria-hidden="true" />Criar evento</Link></Button>}
    />
  )

  if (isLoading) {
    return (
      <div aria-busy="true">
        {header}
        <Skeleton className="h-10 w-full max-w-md rounded-md bg-muted" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-[72px] rounded-[10px] bg-muted" />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        {header}
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar seus eventos.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}>
            Tentar de novo
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div data-tour="eventos-busca" className="relative w-full lg:max-w-sm">
          <label htmlFor="busca-eventos" className="sr-only">Buscar eventos</label>
          <I.Buscar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="busca-eventos" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pelo nome" className="pl-9" />
        </div>
        <div data-tour="eventos-filtros" role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-1 lg:ml-auto">
          {filtros.map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'secondary' : 'ghost'} aria-pressed={filter === f} onClick={() => setFilter(f)} className={filter === f ? '' : icone}>{f}</Button>
          ))}
        </div>
      </div>

      <div data-tour="eventos-lista" className="mt-4">
        {filtered.length === 0 ? (
          events.length === 0 ? (
            <EmptyState
              title="Você ainda não tem eventos"
              description="Crie o primeiro e acompanhe tudo por aqui."
              action={<Button asChild><Link to="/producer/events/new"><I.Criar aria-hidden="true" />Criar evento</Link></Button>}
            />
          ) : (
            <EmptyState title="Nenhum evento com essa busca ou filtro" />
          )
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
            {filtered.map(event => {
              const st = situacaoEvento(event)
              const cap = (event.ticket_types || []).reduce((s, t) => s + (t.quantity_total || t.capacity || 0), 0) || event.capacity || 0
              const vend = vendidos?.porEvento[event.id] ?? 0
              return (
                <li key={event.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <EventoCapa evento={event} tamanho="mini" />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <Link to={abreEvento(event.id)} className="truncate rounded-ev-xs text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{event.title}</Link>
                        <Badge variant={st === 'Publicado' ? 'default' : 'secondary'}>{st}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(event.date)} · {event.venue_name || 'Sem local cadastrado'}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {vendidos ? (cap > 0 ? `${inteiro(vend)} de ${inteiro(cap)} vendidos` : `${inteiro(vend)} vendidos`) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    {st === 'Publicado' ? (
                      <Button asChild variant="ghost" size="icon-sm" className={icone}>
                        <a href={siteUrl(`/event/${event.id}`)} target="_blank" rel="noopener noreferrer" aria-label={`Ver a página pública de ${event.title} (abre em nova aba)`}>
                          <I.Olho aria-hidden="true" />
                        </a>
                      </Button>
                    ) : (
                      <Button asChild variant="ghost" size="icon-sm" className={icone}>
                        <Link to={abreEvento(event.id)} aria-label={`Ver ${event.title} (ainda não está no ar)`}>
                          <I.Olho aria-hidden="true" />
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="icon-sm" className={icone}>
                      <Link to={`/producer/events/${event.id}/edit`} title="Editar" aria-label={`Editar ${event.title}`}>
                        <I.Editar aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDuplicate(event)} disabled={duplicando} aria-label={`Duplicar ${event.title}`}>
                      <I.Copiar aria-hidden="true" />
                    </Button>
                    {st === 'Publicado' && (
                      <Button variant="ghost" size="sm" className={icone} onClick={() => encerrar(event)} disabled={updateEvent.isPending} aria-label={`Encerrar ${event.title}`}>Encerrar</Button>
                    )}
                    {event.status !== 'cancelled' && (
                      <Button variant="ghost" size="sm" className={icone} onClick={() => cancelar(event)} disabled={updateEvent.isPending} aria-label={`Cancelar ${event.title}`}>Cancelar</Button>
                    )}
                    <Button variant="ghost" size="icon-sm" className={icone} onClick={() => pedirExclusao(event)} disabled={deleteMutation.isPending} aria-label={`Excluir ${event.title}`}>
                      <I.Lixeira aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {vendidos?.cortado && (
          <p className="mt-3 text-xs text-muted-foreground">Contagem parcial: mais de 1.000 ingressos vendidos.</p>
        )}
      </div>

      <AlertDialog open={!!acao} onOpenChange={aberto => { if (!aberto) setAcao(null) }}>
        <AlertDialogContent>
          {acao && (() => { const j = textoDaJanela(acao); return (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{j.titulo}</AlertDialogTitle>
                <AlertDialogDescription className="whitespace-pre-line">{j.texto}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmar}>{j.botao}</AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
