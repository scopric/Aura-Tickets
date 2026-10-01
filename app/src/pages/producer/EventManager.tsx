import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Copy, Archive, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useProducerEvents, useDeleteEvent, useCreateEvent, useUpdateEvent, useVendidosPorEvento, type DbEvent } from '../../hooks/useEvents'
import { situacaoEvento, erroAoExcluir, erroDeStatus, vendidosDe, dataPorVir, copiaDoEvento, confirmacaoCancelar, confirmacaoArquivar, SAIR_DO_AR_COM_VENDA, type Situacao } from '../../lib/eventoProdutor'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const filtros: ('Todos' | Situacao)[] = ['Todos', 'Rascunho', 'Em análise', 'Publicado', 'Recusado', 'Encerrado', 'Cancelado']
const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const inteiro = (n: number) => n.toLocaleString('pt-BR')

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Data a definir'
  const d = new Date(`${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function eventLocation(event: DbEvent): string {
  const parts = [event.venue_name, event.venue_city, event.venue_state].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Local a definir'
}

const capacidade = (e: DbEvent) =>
  e.capacity || (e.ticket_types || []).reduce((s, t) => s + (t.quantity_total || t.capacity || 0), 0)

export default function EventManager() {
  const [filter, setFilter] = useState<'Todos' | Situacao>('Todos')
  const [search, setSearch] = useState('')

  const { data: events = [], isLoading, isError, refetch, isFetching } = useProducerEvents()
  const { data: vendidos } = useVendidosPorEvento()
  const deleteEvent = useDeleteEvent()
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()

  const termo = search.trim().toLowerCase()
  const filtered = events.filter(e =>
    (filter === 'Todos' || situacaoEvento(e) === filter) &&
    (e.title.toLowerCase().includes(termo) || eventLocation(e).toLowerCase().includes(termo)))

  const vendidoDe = (id: string) => vendidos?.porEvento[id] ?? 0
  const totalSold = events.reduce((s, e) => s + vendidoDe(e.id), 0)
  const totalCapacity = events.reduce((s, e) => s + capacidade(e), 0)

  const handleDuplicate = async (event: DbEvent) => {
    if (!window.confirm(`Duplicar "${event.title}"? A cópia nasce como rascunho, com os mesmos ingressos.`)) return
    try {
      await createEvent.mutateAsync(copiaDoEvento(event))
      toast.success('Evento duplicado como rascunho.')
    } catch {
      toast.error('Não foi possível duplicar o evento.')
    }
  }

  const mudarStatus = async (event: DbEvent, status: 'ended' | 'cancelled', pergunta: string, ok: string) => {
    if (!window.confirm(pergunta)) return
    try {
      await updateEvent.mutateAsync({ eventId: event.id, event: { status }, tickets: [] })
      toast.success(ok)
    } catch (err) {
      toast.error(erroDeStatus(err, 'Não foi possível atualizar o evento.'))
    }
  }

  // Decisão 129: com venda e data por vir, arquivar (= encerrar) tira do ar; não oferece, mostra o suporte
  const handleArchive = (event: DbEvent) => {
    const v = vendidosDe(vendidos, event.id)
    const porVir = dataPorVir(event)
    if ((v ?? 0) > 0 && porVir) { toast.error(SAIR_DO_AR_COM_VENDA); return }
    mudarStatus(event, 'ended', confirmacaoArquivar(event.title, v, porVir), 'Evento arquivado.')
  }

  const handleDelete = async (event: DbEvent) => {
    if (!window.confirm(`Excluir o evento "${event.title}"? Esta ação não pode ser desfeita.`)) return
    try {
      await deleteEvent.mutateAsync(event.id)
      toast.success('Evento excluído.')
    } catch (err) {
      const { mensagem, oferecerCancelar } = erroAoExcluir(err, vendidosDe(vendidos, event.id)) // Decisão 129
      toast.error(mensagem, oferecerCancelar && event.status !== 'cancelled'
        ? {
            action: {
              label: 'Cancelar evento',
              onClick: () => mudarStatus(event, 'cancelled', confirmacaoCancelar(event.title, vendidosDe(vendidos, event.id)), 'Evento cancelado.'),
            },
            duration: 10000,
          }
        : undefined)
    }
  }

  const header = (
    <PageHeader
      title="Pasta do evento"
      description="Cada evento com vendas, ocupação e atalhos"
      actions={<Button asChild><Link to="/producer/planner"><Plus aria-hidden="true" />Criar evento</Link></Button>}
    />
  )

  if (isLoading) {
    return (
      <div aria-busy="true">
        {header}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-40 rounded-[10px] bg-muted" />)}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Eventos" value={inteiro(events.length)} />
        <Stat
          label="Ingressos vendidos"
          value={vendidos ? inteiro(totalSold) : '—'}
          hint={vendidos?.cortado ? 'Contagem parcial: mais de 1.000 ingressos' : totalCapacity > 0 ? `de ${inteiro(totalCapacity)} lugares` : undefined}
        />
        <Stat label="Ocupação" value={vendidos && totalCapacity > 0 ? `${Math.round((totalSold / totalCapacity) * 100)}%` : '—'} />
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <label htmlFor="busca-pasta" className="sr-only">Buscar por nome ou local</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="busca-pasta" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou local" className="pl-9" />
        </div>
        <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-1 lg:ml-auto">
          {filtros.map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'secondary' : 'ghost'} aria-pressed={filter === f} onClick={() => setFilter(f)} className={filter === f ? '' : icone}>{f}</Button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {filtered.length === 0 ? (
          events.length === 0 ? (
            <EmptyState
              title="Você ainda não tem eventos"
              description="Crie o primeiro e ele aparece aqui."
              action={<Button asChild><Link to="/producer/planner"><Plus aria-hidden="true" />Criar evento</Link></Button>}
            />
          ) : (
            <EmptyState title="Nenhum evento com essa busca ou filtro" />
          )
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {filtered.map(event => {
              const st = situacaoEvento(event)
              const cap = capacidade(event)
              const sold = vendidoDe(event.id)
              return (
                <li key={event.id} className="flex flex-col rounded-[10px] border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{event.category || 'Evento'} · {formatDate(event.date)}</p>
                    </div>
                    <Badge variant={st === 'Publicado' ? 'default' : 'secondary'}>{st}</Badge>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Vendidos</span>
                      <span className="tabular-nums">{vendidos ? (cap > 0 ? `${inteiro(sold)} de ${inteiro(cap)}` : inteiro(sold)) : '—'}</span>
                    </div>
                    {cap > 0 && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (sold / cap) * 100)}%` }} />
                      </div>
                    )}
                  </div>

                  <p className="mt-3 truncate text-xs text-muted-foreground">{eventLocation(event)}</p>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/producer/events/${event.id}/edit`}>Abrir</Link>
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button asChild variant="ghost" size="icon-sm" className={icone}>
                        <Link to={`/producer/events/${event.id}/edit`} aria-label={`Editar ${event.title}`}><Pencil aria-hidden="true" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDuplicate(event)} disabled={createEvent.isPending} aria-label={`Duplicar ${event.title}`}>
                        <Copy aria-hidden="true" />
                      </Button>
                      {event.status !== 'ended' && (
                        <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleArchive(event)} disabled={updateEvent.isPending} aria-label={`Arquivar ${event.title}`}>
                          <Archive aria-hidden="true" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDelete(event)} disabled={deleteEvent.isPending} aria-label={`Excluir ${event.title}`}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
