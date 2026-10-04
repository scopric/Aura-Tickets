import { useState } from 'react'
import { Plus, Trash2, Loader2, Calendar, List, Columns3, Circle, CircleDot, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useProducerTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  type DbTask,
  type StatusTarefa,
  type PrioridadeTarefa,
} from '../../hooks/useProducerTools'
import { useProducerEvents } from '../../hooks/useEvents'
import { doEvento, useFiltroEvento } from '../../hooks/useEventoDaUrl'
import { atrasada, diaEmSP, prazoDoDia } from '../../lib/tarefas'
import FiltroEvento from '@/components/producer/FiltroEvento'
import { PageHeader, Stat, EmptyState, SectionTitle } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Status e prioridade são os valores do CHECK de producer_tasks; o português só existe na tela.
const STATUS: StatusTarefa[] = ['todo', 'in_progress', 'done']
const rotuloStatus: Record<StatusTarefa, string> = { todo: 'Pendente', in_progress: 'Em andamento', done: 'Concluída' }
const iconeStatus = { todo: Circle, in_progress: CircleDot, done: CheckCircle2 }
const proximo: Record<StatusTarefa, StatusTarefa> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
const rotuloPrioridade: Record<PrioridadeTarefa, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' }
const variantePrioridade = { low: 'outline', medium: 'secondary', high: 'destructive' } as const

const select = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'
const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const emptyForm = { title: '', description: '', priority: 'medium' as PrioridadeTarefa, dueDate: '', eventId: '' }

// O erro do Supabase é um objeto com `message`, não uma instância de Error
const causa = (e: unknown) => (e as { message?: string } | null)?.message || 'erro desconhecido'
const dataBr = (iso: string) => diaEmSP(iso).split('-').reverse().join('/')

export default function ProducerTasks() {
  const { data: todas = [], isPending, isError, error, refetch, isFetching } = useProducerTasks()
  const { data: events = [] } = useProducerEvents()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [filtroEvento] = useFiltroEvento()
  const tasks = doEvento(todas, filtroEvento)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [apagar, setApagar] = useState<DbTask | null>(null)

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  const pendentes = total - done
  const hoje = diaEmSP(new Date())
  const atrasadas = tasks.filter(t => atrasada(t, hoje)).length

  const abrir = () => { setForm({ ...emptyForm, eventId: events.some(e => e.id === filtroEvento) ? filtroEvento! : '' }); setShowForm(true) }

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Informe o título da tarefa'); return }
    try {
      await createTask.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: 'todo',
        due_date: form.dueDate ? prazoDoDia(form.dueDate) : null,
        event_id: form.eventId || null,
      })
      setShowForm(false)
      toast.success('Tarefa criada.')
    } catch (err) {
      toast.error(`Não foi possível criar a tarefa: ${causa(err)}`)
    }
  }

  const mudarStatus = async (task: DbTask) => {
    try {
      await updateTask.mutateAsync({ id: task.id, status: proximo[task.status] })
    } catch (err) {
      toast.error(`Não foi possível mudar o status: ${causa(err)}`)
    }
  }

  const confirmarApagar = async () => {
    if (!apagar) return
    try {
      await deleteTask.mutateAsync(apagar.id)
      toast.success('Tarefa removida.')
    } catch (err) {
      toast.error(`Não foi possível remover a tarefa: ${causa(err)}`)
    } finally {
      setApagar(null)
    }
  }

  const header = (
    <PageHeader
      title="Tarefas"
      description="Organize o que falta fazer, com prazo e evento"
      actions={
        <>
          <div role="group" aria-label="Modo de exibição" className="flex gap-1">
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className={viewMode === 'list' ? '' : icone} aria-label="Ver em lista" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>
              <List aria-hidden="true" />
            </Button>
            <Button variant={viewMode === 'kanban' ? 'secondary' : 'ghost'} size="icon" className={viewMode === 'kanban' ? '' : icone} aria-label="Ver em colunas por status" aria-pressed={viewMode === 'kanban'} onClick={() => setViewMode('kanban')}>
              <Columns3 aria-hidden="true" />
            </Button>
          </div>
          <Button onClick={abrir}><Plus aria-hidden="true" />Nova tarefa</Button>
        </>
      }
    />
  )

  if (isPending) {
    return (
      <div aria-busy="true">
        {header}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
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
          <div>
            <p className="text-sm text-foreground">Não foi possível carregar as tarefas.</p>
            <p className="mt-1 text-xs text-muted-foreground">{causa(error)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Carregando…' : 'Tentar de novo'}
          </Button>
        </div>
      </div>
    )
  }

  const cartao = (task: DbTask) => {
    const Icone = iconeStatus[task.status]
    const evento = task.event_id ? events.find(ev => ev.id === task.event_id)?.title ?? 'Evento' : null
    const atrasou = atrasada(task, hoje)
    return (
      <div key={task.id} className="rounded-[10px] border border-border bg-card p-4">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost" size="icon-sm" className={icone}
            onClick={() => mudarStatus(task)}
            aria-label={`${task.title}: ${rotuloStatus[task.status]}. Mudar para ${rotuloStatus[proximo[task.status]]}`}
          >
            <Icone aria-hidden="true" className={task.status === 'done' ? 'text-primary' : undefined} />
          </Button>
          <div className="min-w-0 flex-1">
            <h3 className={`break-words text-sm font-medium ${task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.title}</h3>
            {task.description && <p className="mt-1 break-words text-sm text-muted-foreground">{task.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={variantePrioridade[task.priority]}>{rotuloPrioridade[task.priority]}</Badge>
              <span className={`flex items-center gap-1 ${atrasou ? 'font-medium text-destructive' : ''}`}>
                <Calendar className="size-3" aria-hidden="true" />
                {task.due_date ? `${dataBr(task.due_date)}${atrasou ? ' (atrasada)' : ''}` : 'Sem prazo'}
              </span>
              {evento && <span className="min-w-0 truncate">{evento}</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" className={icone} onClick={() => setApagar(task)} aria-label={`Excluir ${task.title}`}>
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <FiltroEvento />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={total} />
        <Stat label="Concluídas" value={done} />
        <Stat label="Pendentes" value={pendentes} />
        <Stat label="Atrasadas" value={atrasadas} />
      </div>

      <div className="mt-6">
        {total === 0 ? (
          <EmptyState
            title={filtroEvento ? 'Nenhuma tarefa neste evento' : 'Nenhuma tarefa ainda'}
            description={filtroEvento ? 'Tarefas sem evento aparecem em Todos os eventos.' : 'Crie a primeira tarefa e acompanhe o que falta fazer.'}
            action={<Button onClick={abrir}><Plus aria-hidden="true" />Criar tarefa</Button>}
          />
        ) : viewMode === 'list' ? (
          <div className="grid gap-3">{tasks.map(cartao)}</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STATUS.map(col => {
              const doStatus = tasks.filter(t => t.status === col)
              return (
                <section key={col} aria-label={rotuloStatus[col]} className="grid content-start gap-3">
                  <SectionTitle>{rotuloStatus[col]} ({doStatus.length})</SectionTitle>
                  {doStatus.map(cartao)}
                </section>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
            <DialogDescription>Prazo e evento são opcionais.</DialogDescription>
          </DialogHeader>
          <form id="form-tarefa" onSubmit={addTask} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tarefa-titulo">Título</Label>
              <Input id="tarefa-titulo" maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Contratar o DJ" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tarefa-descricao">Descrição (opcional)</Label>
              <Textarea id="tarefa-descricao" maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="tarefa-prioridade">Prioridade</Label>
                <select id="tarefa-prioridade" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as PrioridadeTarefa })} className={select}>
                  {(Object.keys(rotuloPrioridade) as PrioridadeTarefa[]).map(p => <option key={p} value={p}>{rotuloPrioridade[p]}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tarefa-prazo">Prazo (opcional)</Label>
                <Input id="tarefa-prazo" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tarefa-evento">Evento</Label>
              <select id="tarefa-evento" value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} className={select}>
                <option value="">Sem evento</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" form="form-tarefa" disabled={createTask.isPending}>
              {createTask.isPending ? <><Loader2 className="animate-spin" aria-hidden="true" />Criando…</> : 'Criar tarefa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!apagar} onOpenChange={aberto => { if (!aberto) setApagar(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{apagar?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>Não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarApagar} disabled={deleteTask.isPending}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
