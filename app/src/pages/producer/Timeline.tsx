import { useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { useProducerEvents } from '../../hooks/useEvents'
import { useEventoDaUrl } from '../../hooks/useEventoDaUrl'
import {
  useEventTimeline,
  useCreateTimelineItem,
  useUpdateTimelineItem,
  useDeleteTimelineItem,
  type DbTimelineItem,
} from '../../hooks/useProducerTools'
import { PageHeader, EmptyState, selectNativo, chipOk } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const typeIcons: Record<string, I.IconeEvokaa> = {
  soundcheck: I.Microfone,
  abertura: I.Pessoas,
  show: I.Musica,
  comida: I.Talheres,
  transporte: I.Caminhao,
  decoracao: I.Estrela,
  vip: I.Estrela,
  encerramento: I.Liberado,
}

const typeLabels: Record<string, string> = {
  soundcheck: 'Soundcheck',
  abertura: 'Abertura',
  show: 'Show',
  comida: 'Alimentação',
  transporte: 'Logística',
  decoracao: 'Decoração',
  vip: 'VIP',
  encerramento: 'Encerramento',
}

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

export default function ProducerTimeline() {
  const { data: events = [], isLoading: eventsLoading } = useProducerEvents()
  const [eventoEscolhido, setSelectedEventId] = useEventoDaUrl(events.map(e => e.id))
  const selectedEventId = eventoEscolhido ?? events[0]?.id ?? null

  const { data: items = [], isLoading: itemsLoading } = useEventTimeline(selectedEventId)
  const createItem = useCreateTimelineItem()
  const updateItem = useUpdateTimelineItem()
  const deleteItem = useDeleteTimelineItem()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ time: '', title: '', description: '', type: 'show' as DbTimelineItem['type'], responsible: '', duration: '', location: '' })

  const selectedEvent = events.find(e => e.id === selectedEventId)
  const isLoading = eventsLoading || itemsLoading

  const addItem = async () => {
    if (!form.time || !form.title || !selectedEventId) { toast.error('Hora, título e evento são obrigatórios'); return }
    try {
      await createItem.mutateAsync({
        event_id: selectedEventId,
        time: form.time,
        title: form.title,
        description: form.description || null,
        type: form.type,
        responsible: form.responsible || null,
        duration: form.duration || null,
        location: form.location || null,
        status: 'futuro',
      })
      setForm({ time: '', title: '', description: '', type: 'show', responsible: '', duration: '', location: '' })
      setShowForm(false)
      toast.success('Item adicionado!')
    } catch {
      toast.error('Erro ao adicionar item')
    }
  }

  const toggleStatus = async (item: DbTimelineItem) => {
    const flow: DbTimelineItem['status'][] = ['futuro', 'atual', 'concluido']
    const idx = flow.indexOf(item.status)
    const newStatus = flow[(idx + 1) % 3]
    try {
      await updateItem.mutateAsync({ id: item.id, event_id: item.event_id, status: newStatus })
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const handleDelete = async (item: DbTimelineItem) => {
    try {
      await deleteItem.mutateAsync({ id: item.id, event_id: item.event_id })
      toast.success('Removido')
    } catch {
      toast.error('Erro ao remover')
    }
  }

  const header = (
    <PageHeader
      title="Cronograma"
      description="Linha do tempo completa do evento"
      actions={<Button onClick={() => setShowForm(true)}><I.Criar aria-hidden="true" />Adicionar Item</Button>}
    />
  )

  if (isLoading) {
    return (
      <div aria-busy="true">
        {header}
        <p role="status" className="sr-only">Carregando cronograma...</p>
        <Skeleton className="mb-6 h-10 w-64 bg-muted" />
        <div className="grid max-w-4xl gap-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-24 rounded-[10px] bg-muted" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}

      {/* Event selector */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <I.Eventos size={16} aria-hidden="true" className="text-muted-foreground" />
        <select
          value={selectedEventId || ''}
          onChange={e => setSelectedEventId(e.target.value || null)}
          aria-label="Evento"
          className={cn(selectNativo, 'sm:w-auto sm:min-w-64')}
        >
          {!selectedEventId && <option value="">Selecione um evento</option>}
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        {selectedEvent?.date && (
          <span className="text-sm text-muted-foreground">
            {new Date(selectedEvent.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* Timeline */}
      {selectedEventId ? (
        items.length === 0 ? (
          <EmptyState
            title="Nenhum item no cronograma."
            description="Adicione o primeiro item da linha do tempo."
          />
        ) : (
          <div className="relative max-w-4xl">
            {/* Vertical line */}
            <div aria-hidden="true" className="absolute bottom-0 left-6 top-0 w-px bg-border" />
            <ol>
              {items.map((item) => {
                const Icon = typeIcons[item.type]
                const atual = item.status === 'atual'
                const concluido = item.status === 'concluido'
                return (
                  <li key={item.id} className="relative flex items-start gap-4 py-3">
                    {/* Dot */}
                    <button
                      type="button"
                      onClick={() => toggleStatus(item)}
                      aria-label={`Avançar o status de ${item.title}`}
                      className={`alvo-44 relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border outline-none focus-visible:shadow-ev-foco ${
                        concluido ? chipOk :
                        atual ? 'border-primary bg-primary text-primary-foreground' :
                        'border-border bg-secondary text-muted-foreground'
                      }`}
                    >
                      {concluido ? <I.Liberado size={20} aria-hidden="true" /> : <Icon size={20} aria-hidden="true" />}
                    </button>

                    {/* Card */}
                    <div className={`min-w-0 flex-1 rounded-[10px] border p-4 ${
                      atual ? 'border-primary bg-[var(--ev-brand-soft)]' :
                      concluido ? 'border-border bg-secondary' :
                      'border-border bg-card'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className={`font-display text-sm font-semibold tabular-nums ${atual ? 'text-primary' : 'text-muted-foreground'}`}>{item.time}</span>
                            <Badge variant="secondary">{typeLabels[item.type]}</Badge>
                            {atual && <Badge className="motion-safe:animate-pulse">AO VIVO</Badge>}
                          </div>
                          <h3 className={`text-sm font-medium ${concluido ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.title}</h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><I.Pessoas size={16} aria-hidden="true" />{item.responsible || 'Não definido'}</span>
                            <span className="flex items-center gap-1"><I.Horario size={16} aria-hidden="true" />{item.duration || '-'}</span>
                            <span className="flex items-center gap-1"><I.Local size={16} aria-hidden="true" />{item.location || '-'}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDelete(item)} aria-label={`Remover ${item.title}`}>
                          <I.Lixeira aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )
      ) : (
        <EmptyState title="Selecione um evento para ver o cronograma." />
      )}

      {/* Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Novo Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cron-hora">Hora</Label>
                <Input id="cron-hora" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cron-duracao">Duração</Label>
                <Input id="cron-duracao" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cron-titulo">Título *</Label>
              <Input id="cron-titulo" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cron-descricao">Descrição</Label>
              <Input id="cron-descricao" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cron-tipo">Tipo</Label>
              <select id="cron-tipo" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as DbTimelineItem['type'] })} className={selectNativo}>
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cron-responsavel">Responsável</Label>
                <Input id="cron-responsavel" value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cron-local">Local</Label>
                <Input id="cron-local" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={addItem} loading={createItem.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
