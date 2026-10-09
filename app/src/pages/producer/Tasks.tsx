import { useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import {
  useProducerTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useQuadro,
  useMoverTarefa,
  ConflitoCartao,
  type ColunaQuadro,
  type DbTask,
  type StatusTarefa,
  type PrioridadeTarefa,
} from '../../hooks/useProducerTools'
import { useProducerEvents } from '../../hooks/useEvents'
import { doEvento, useFiltroEvento } from '../../hooks/useEventoDaUrl'
import { PRODUTORA, atrasada, prazoDoDia } from '../../lib/tarefas'
import { diaBR } from '../../lib/visaoEvento'
import FiltroEvento from '@/components/producer/FiltroEvento'
import Quadro from '@/components/producer/quadro/Quadro'
import { PageHeader, Stat, EmptyState, selectNativo, chipAviso, chipErro } from '@/components/producer/ui'
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
const rotuloStatus: Record<StatusTarefa, string> = { todo: 'Pendente', in_progress: 'Em andamento', done: 'Concluída' }
const proximo: Record<StatusTarefa, StatusTarefa> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
const rotuloPrioridade: Record<PrioridadeTarefa, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' }
// Só alta e média ganham cor; baixa fica neutra
const corPrioridade: Record<PrioridadeTarefa, string> = { low: '', medium: chipAviso, high: chipErro }
// Colunas do quadro por status ("Todos os eventos" e banco sem o SQL do quadro); mover grava só o status
const COLUNAS_STATUS: ColunaQuadro[] = [
  { id: 'todo', name: 'A fazer', kind: 'todo' },
  { id: 'in_progress', name: 'Em andamento', kind: 'doing' },
  { id: 'done', name: 'Feito', kind: 'done' },
]
const COLUNA_REVISAO: ColunaQuadro = { id: 'review', name: 'Em revisão', kind: 'doing', dica: 'Disponível após a atualização do banco' }

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const emptyForm = { title: '', description: '', priority: 'medium' as PrioridadeTarefa, dueDate: '', eventId: '' }

// O erro do Supabase é um objeto com `message`, não uma instância de Error
const causa = (e: unknown) => (e as { message?: string } | null)?.message || 'erro desconhecido'
const dataBr = (iso: string) => diaBR(iso).split('-').reverse().join('/')

// Bolinha de status: vazia (pendente), com ponto (em andamento), cheia com check (concluída)
const Bolinha = ({ status }: { status: StatusTarefa }) => (
  <span className={`flex size-5 items-center justify-center rounded-full border-2 ${status === 'done' ? 'border-[var(--ev-success)] bg-[var(--ev-success)] text-background' : status === 'in_progress' ? 'border-primary' : 'border-input'}`}>
    {status === 'done' && <I.Check size={12} className="size-3" aria-hidden="true" />}
    {status === 'in_progress' && <span className="size-2 rounded-full bg-primary" />}
  </span>
)

export default function ProducerTasks() {
  const { data: todas = [], isPending, isError, error, refetch, isFetching } = useProducerTasks()
  const { data: events = [] } = useProducerEvents()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [filtroEvento] = useFiltroEvento()
  const soProdutora = filtroEvento === PRODUTORA
  const tasks = soProdutora ? todas.filter(t => !t.event_id) : doEvento(todas, filtroEvento)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [viewMode, setViewMode] = useState<'list' | 'quadro'>('list')
  const moverTarefa = useMoverTarefa()
  // Quadro com colunas do banco só quando há um evento (ou a produtora) escolhido; em "Todos" o quadro é por status
  const quadro = useQuadro(filtroEvento && !soProdutora ? filtroEvento : null, viewMode === 'quadro' && !!filtroEvento)
  const modoNovo = !!filtroEvento && !!quadro.data
  const [apagar, setApagar] = useState<DbTask | null>(null)

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  const pendentes = total - done
  const hoje = diaBR(new Date())
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

  const mover = async (t: DbTask, colunaId: string, posicao?: number) => {
    try {
      await moverTarefa.mutateAsync({ tarefa: t, mudanca: modoNovo ? { column_id: colunaId, position: posicao } : { status: colunaId as StatusTarefa } })
    } catch (err) {
      toast.error(err instanceof ConflitoCartao ? 'Outra pessoa mexeu neste cartão. O quadro foi atualizado.' : `Não foi possível mover a tarefa: ${causa(err)}`)
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
              <I.Lista aria-hidden="true" />
            </Button>
            <Button variant={viewMode === 'quadro' ? 'secondary' : 'ghost'} size="icon" className={viewMode === 'quadro' ? '' : icone} aria-label="Ver em quadro" aria-pressed={viewMode === 'quadro'} onClick={() => setViewMode('quadro')}>
              <I.Colunas aria-hidden="true" />
            </Button>
          </div>
          <Button onClick={abrir}><I.Criar aria-hidden="true" />Nova tarefa</Button>
        </>
      }
    />
  )

  if (isPending) {
    return (
      <div aria-busy="true">
        {header}
        <p role="status" className="sr-only">Carregando tarefas…</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
        <div className="mt-6 grid gap-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-24 rounded-[10px] bg-muted" />)}
        </div>
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
          <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}>Tentar de novo</Button>
        </div>
      </div>
    )
  }

  const cartao = (task: DbTask) => {
    const evento = task.event_id ? events.find(ev => ev.id === task.event_id)?.title ?? 'Evento' : null
    const atrasou = atrasada(task, hoje)
    return (
      <div key={task.id} className={`rounded-[10px] border border-border p-4 ${task.status === 'done' ? 'bg-secondary' : 'bg-card'}`}>
        <div className="flex items-start gap-2">
          <Button
            variant="ghost" size="icon-sm" className={icone}
            onClick={() => mudarStatus(task)}
            aria-label={`${task.title}: ${rotuloStatus[task.status]}. Mudar para ${rotuloStatus[proximo[task.status]]}`}
          >
            <Bolinha status={task.status} />
          </Button>
          <div className="min-w-0 flex-1">
            <h3 className={`break-words text-sm font-medium ${task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.title}</h3>
            {task.description && <p className="mt-1 break-words text-sm text-muted-foreground">{task.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className={corPrioridade[task.priority]}>{rotuloPrioridade[task.priority]}</Badge>
              <span className={`flex items-center gap-1 ${atrasou ? 'font-medium text-destructive' : ''}`}>
                <I.Eventos size={16} aria-hidden="true" />
                {task.due_date ? `${dataBr(task.due_date)}${atrasou ? ' (atrasada)' : ''}` : 'Sem prazo'}
              </span>
              {evento && <span className="min-w-0 truncate">{evento}</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" className={icone} onClick={() => setApagar(task)} aria-label={`Excluir ${task.title}`}>
            <I.Lixeira aria-hidden="true" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <FiltroEvento comProdutora />

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
            action={<Button onClick={abrir}><I.Criar aria-hidden="true" />Criar tarefa</Button>}
          />
        ) : viewMode === 'list' ? (
          <div className="grid gap-3">{tasks.map(cartao)}</div>
        ) : quadro.isPending && viewMode === 'quadro' && !!filtroEvento ? (
          <Skeleton className="h-64 rounded-[10px] bg-muted" />
        ) : quadro.isError ? (
          <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">Não foi possível carregar o quadro. {causa(quadro.error)}</p>
            <Button variant="outline" size="sm" onClick={() => quadro.refetch()} loading={quadro.isFetching}>Tentar de novo</Button>
          </div>
        ) : (
          <Quadro
            tarefas={modoNovo ? tasks.filter(t => t.board_id === quadro.data!.boardId) : tasks}
            colunas={modoNovo ? quadro.data!.colunas : filtroEvento ? [...COLUNAS_STATUS.slice(0, 2), COLUNA_REVISAO, COLUNAS_STATUS[2]] : COLUNAS_STATUS}
            colunaDe={modoNovo ? t => t.column_id ?? '' : t => t.status}
            ordenavel={modoNovo}
            onMover={mover}
            extras={t => (
              <>
                <Badge variant="secondary" className={corPrioridade[t.priority]}>{rotuloPrioridade[t.priority]}</Badge>
                {t.event_id && <span className="min-w-0 truncate">{events.find(ev => ev.id === t.event_id)?.title ?? 'Evento'}</span>}
              </>
            )}
          />
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
                <select id="tarefa-prioridade" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as PrioridadeTarefa })} className={selectNativo}>
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
              <select id="tarefa-evento" value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} className={selectNativo}>
                <option value="">Sem evento</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" form="form-tarefa" loading={createTask.isPending}>Criar tarefa</Button>
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
