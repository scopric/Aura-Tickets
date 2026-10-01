import { useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useBudgetBoxes,
  useCreateBudgetBox,
  useDeleteBudgetBox,
  useCreatePiggyTransaction,
  type DbBudgetBox,
} from '../../hooks/useProducerTools'
import { useProducerEvents } from '../../hooks/useEvents'
import { mensagemMovimento } from '../../lib/orcamento'
import { brl } from '../../lib/taxa'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
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

// "Orçamento do evento" (Decisão 120); a rota e as tabelas seguem com o nome antigo (caixinha, event_budget_boxes)
const categories = [
  { id: 'marketing', label: 'Marketing' },
  { id: 'infra', label: 'Infraestrutura' },
  { id: 'decoracao', label: 'Decoração' },
  { id: 'equipamento', label: 'Equipamento' },
  { id: 'emergencia', label: 'Emergência' },
  { id: 'lucro', label: 'Lucro' },
]

const select = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'
const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const emptyForm = { eventId: '', name: '', target: '', category: 'marketing', notes: '' }

export default function ProducerPiggyBank() {
  const { data: boxes = [], isPending, isError, refetch, isFetching } = useBudgetBoxes()
  const { data: events = [] } = useProducerEvents()
  const createBox = useCreateBudgetBox()
  const deleteBox = useDeleteBudgetBox()
  const createTransaction = useCreatePiggyTransaction()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [movBox, setMovBox] = useState<DbBudgetBox | null>(null)
  const [movValor, setMovValor] = useState('')
  const [movTipo, setMovTipo] = useState<'deposit' | 'withdraw'>('deposit')
  const [apagar, setApagar] = useState<DbBudgetBox | null>(null)

  const previsto = boxes.reduce((s, b) => s + (b.target || 0), 0)
  const realizado = boxes.reduce((s, b) => s + (b.saved || 0), 0)
  const completos = boxes.filter(b => (b.target || 0) > 0 && (b.saved || 0) >= (b.target || 0)).length

  const addBox = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Informe o nome do item'); return }
    const target = Number(form.target)
    if (!(target >= 0.01 && target < 1e9)) { toast.error('O previsto precisa ficar entre R$ 0,01 e R$ 999.999.999,99'); return }
    try {
      await createBox.mutateAsync({
        event_id: form.eventId || null,
        name: form.name.trim(),
        target,
        saved: 0,
        category: form.category,
        notes: form.notes.trim() || null,
      })
      setForm(emptyForm)
      setShowForm(false)
      toast.success('Item criado.')
    } catch {
      toast.error('Não foi possível criar o item.')
    }
  }

  const movimentar = async (type: 'deposit' | 'withdraw') => {
    if (!movBox) return
    const amount = Number(movValor)
    // a função também confere (22023); aqui só evita a ida ao banco com campo vazio
    if (!(amount > 0)) { toast.error('Informe um valor maior que zero'); return }
    try {
      await createTransaction.mutateAsync({ box_id: movBox.id, type, amount })
      setMovBox(null)
      setMovValor('')
      toast.success(type === 'deposit' ? `${brl(amount)} lançado.` : `${brl(amount)} estornado.`)
    } catch (e) {
      toast.error(mensagemMovimento(e))
    }
  }

  const confirmarApagar = async () => {
    if (!apagar) return
    try {
      await deleteBox.mutateAsync(apagar.id)
      toast.success('Item removido.')
    } catch {
      toast.error('Não foi possível remover o item.')
    } finally {
      setApagar(null)
    }
  }

  const header = (
    <PageHeader
      title="Orçamento do evento"
      description="Previsto x realizado, por evento e categoria"
      actions={<Button onClick={() => setShowForm(true)}><Plus aria-hidden="true" />Novo item</Button>}
    />
  )

  if (isPending) {
    return (
      <div aria-busy="true">
        {header}
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
          <p className="text-sm text-foreground">Não foi possível carregar o orçamento.</p>
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
        <Stat label="Previsto" value={brl(previsto)} />
        <Stat label="Realizado" value={brl(realizado)} hint={previsto > 0 ? `${Math.round((realizado / previsto) * 100)}% do previsto` : undefined} />
        <Stat label="Itens completos" value={`${completos}/${boxes.length}`} />
      </div>

      <div className="mt-6">
        {boxes.length === 0 ? (
          <EmptyState
            title="Nenhum item no orçamento ainda"
            description="Crie um item para cada gasto previsto (som, decoração, divulgação) e acompanhe quanto já foi separado."
            action={<Button onClick={() => setShowForm(true)}><Plus aria-hidden="true" />Novo item</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {boxes.map(box => {
              const pct = (box.target || 0) > 0 ? Math.min(((box.saved || 0) / (box.target || 0)) * 100, 100) : 0
              const completo = (box.target || 0) > 0 && (box.saved || 0) >= (box.target || 0)
              const evento = box.event_id ? events.find(ev => ev.id === box.event_id)?.title ?? 'Evento' : 'Sem evento'
              return (
                <div key={box.id} className="rounded-[10px] border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-foreground">{box.name}</h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {evento} · {categories.find(c => c.id === box.category)?.label ?? box.category}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {completo && <Badge variant="secondary">Completo</Badge>}
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => setApagar(box)} aria-label={`Remover ${box.name}`}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {box.notes && <p className="mt-2 text-sm text-muted-foreground">{box.notes}</p>}

                  <p className="mt-3 text-xs tabular-nums text-muted-foreground">
                    {brl(box.saved || 0)} realizado de {brl(box.target || 0)} previsto
                  </p>
                  <div
                    role="progressbar"
                    aria-label={`Realizado em ${box.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(pct)}
                    className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
                  </div>

                  <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => { setMovBox(box); setMovValor(''); setMovTipo('deposit') }}>
                    Lançar valor
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo item do orçamento</DialogTitle>
            <DialogDescription>O previsto é quanto você espera gastar; o realizado começa em zero.</DialogDescription>
          </DialogHeader>
          <form id="form-orcamento" onSubmit={addBox} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="orc-evento">Evento</Label>
              <select id="orc-evento" value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} className={select}>
                <option value="">Sem evento</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="orc-nome">Nome</Label>
              <Input id="orc-nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Som e luz" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="orc-previsto">Previsto (R$)</Label>
                <Input id="orc-previsto" type="number" inputMode="decimal" min="0.01" step="0.01" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="orc-categoria">Categoria</Label>
                <select id="orc-categoria" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={select}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="orc-nota">Anotação (opcional)</Label>
              <Textarea id="orc-nota" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" form="form-orcamento" disabled={createBox.isPending}>
              {createBox.isPending ? <><Loader2 className="animate-spin" aria-hidden="true" />Criando…</> : 'Criar item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!movBox} onOpenChange={aberto => { if (!aberto) setMovBox(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{movBox?.name}</DialogTitle>
            <DialogDescription>
              {brl(movBox?.saved || 0)} realizado de {brl(movBox?.target || 0)} previsto.
            </DialogDescription>
          </DialogHeader>
          {/* Enter envia o tipo escolhido (nunca lança quando a pessoa escolheu estornar) */}
          <form id="form-movimento" onSubmit={e => { e.preventDefault(); movimentar(movTipo) }} className="grid gap-3">
            <div role="group" aria-label="Tipo de lançamento" className="grid grid-cols-2 gap-1">
              {([['deposit', 'Lançar'], ['withdraw', 'Estornar']] as const).map(([tipo, rotulo]) => (
                <Button key={tipo} type="button" size="sm" variant={movTipo === tipo ? 'secondary' : 'ghost'} aria-pressed={movTipo === tipo} onClick={() => setMovTipo(tipo)}>
                  {rotulo}
                </Button>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="orc-valor">Valor (R$)</Label>
              <Input id="orc-valor" type="number" inputMode="decimal" min="0.01" step="0.01" value={movValor} onChange={e => setMovValor(e.target.value)} autoFocus />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovBox(null)}>Cancelar</Button>
            <Button type="submit" form="form-movimento" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? <><Loader2 className="animate-spin" aria-hidden="true" />Salvando…</> : movTipo === 'deposit' ? 'Lançar' : 'Estornar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!apagar} onOpenChange={aberto => { if (!aberto) setApagar(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover “{apagar?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>O item e o histórico de movimentos dele serão apagados. Não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarApagar} disabled={deleteBox.isPending}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
