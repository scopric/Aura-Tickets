import { useState } from 'react'
import { Plus, Trash2, Copy, Check, Power, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useProducerCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  useDeleteCoupon,
  type DbCoupon,
} from '../../hooks/useProducerTools'
import { useProducerEvents } from '../../hooks/useEvents'
import { useFiltroEvento } from '../../hooks/useEventoDaUrl'
import FiltroEvento from '@/components/producer/FiltroEvento'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const statusOptions = ['Todos', 'Ativo', 'Agendado', 'Expirado', 'Esgotado', 'Desativado']
const typeOptions = ['Todos', 'Percentual', 'Valor fixo']

// status não é coluna: sai de is_active, valid_until e uses/max_uses
const couponStatus = (c: DbCoupon) =>
  !c.is_active ? 'desativado'
  : c.valid_until && new Date(c.valid_until) < new Date() ? 'expirado'
  : c.valid_from && new Date(c.valid_from) > new Date() ? 'agendado'
  : c.max_uses != null && c.uses >= c.max_uses ? 'esgotado'
  : 'ativo'

const rotulo = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const select = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'
const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

const emptyForm = { code: '', type: 'percent' as DbCoupon['discount_type'], value: '', minPurchase: '', maxUses: '999', eventId: '', startDate: '', endDate: '', description: '' }

export default function ProducerCoupons() {
  const { data: coupons = [], isLoading, isError, refetch, isFetching } = useProducerCoupons()
  const { data: events = [] } = useProducerEvents()
  const createCoupon = useCreateCoupon()
  const updateCoupon = useUpdateCoupon()
  const deleteCoupon = useDeleteCoupon()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [filterStatus, setFilterStatus] = useState('Todos')
  const [filterType, setFilterType] = useState('Todos')
  const [copied, setCopied] = useState<string | null>(null)
  const [filtroEvento] = useFiltroEvento()

  // cupom de "todos os eventos" (event_id nulo) vale no evento também, mas só se o id é de um evento do produtor
  const lista = filtroEvento ? coupons.filter(c => c.event_id === filtroEvento || (c.event_id === null && events.some(e => e.id === filtroEvento))) : coupons
  const filtered = lista
    .filter(c => filterStatus === 'Todos' || couponStatus(c) === filterStatus.toLowerCase())
    .filter(c => filterType === 'Todos' || (c.discount_type === 'percent' ? 'Percentual' : 'Valor fixo') === filterType)

  const total = lista.length
  const active = lista.filter(c => couponStatus(c) === 'ativo').length
  // no evento, os usos do cupom global não entram: parte deles foi em outros eventos
  const totalUses = lista.reduce((s, c) => s + (filtroEvento && c.event_id === null ? 0 : c.uses || 0), 0)

  const abrir = () => { setForm({ ...emptyForm, eventId: events.some(e => e.id === filtroEvento) ? filtroEvento! : '' }); setShowForm(true) }

  const addCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = form.code.trim().toUpperCase()
    if (!code) { toast.error('Informe o código'); return }
    const value = Number(form.value)
    // discount_value é numeric(10,2)
    if (!(value >= 0.01 && value <= 99999999.99)) { toast.error('O desconto precisa ficar entre 0,01 e 99.999.999,99'); return }
    if (form.type === 'percent' && value > 100) { toast.error('Percentual não pode passar de 100'); return }
    const maxUses = form.maxUses ? Number(form.maxUses) : null
    if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses >= 1)) { toast.error('Limite de usos precisa ser 1 ou mais'); return }
    const minOrder = form.minPurchase ? Number(form.minPurchase) : null
    if (minOrder !== null && !(minOrder >= 0)) { toast.error('Compra mínima inválida'); return }
    // data do campo é dia local: início às 00:00, fim às 23:59:59
    const validFrom = form.startDate ? new Date(`${form.startDate}T00:00:00`).toISOString() : null
    const validUntil = form.endDate ? new Date(`${form.endDate}T23:59:59`).toISOString() : null
    if (validFrom && validUntil && validUntil <= validFrom) { toast.error('A data final precisa ser depois da inicial'); return }
    if (validUntil && validUntil <= new Date().toISOString()) { toast.error('A data final já passou'); return }
    try {
      await createCoupon.mutateAsync({
        code,
        discount_type: form.type,
        discount_value: value,
        min_order_value: minOrder,
        max_uses: maxUses,
        event_id: form.eventId || null,
        valid_from: validFrom,
        valid_until: validUntil,
        description: form.description || null,
        is_active: true,
      })
      setForm(emptyForm)
      setShowForm(false)
      toast.success('Cupom criado.')
    } catch (e) {
      toast.error((e as { code?: string })?.code === '23505' ? 'Esse código já existe' : 'Não foi possível criar o cupom.')
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Código copiado.')
  }

  const toggleStatus = async (coupon: DbCoupon) => {
    const isActive = !coupon.is_active
    try {
      await updateCoupon.mutateAsync({ id: coupon.id, is_active: isActive })
      toast.success(`Cupom ${isActive ? 'ativado' : 'desativado'}.`)
    } catch {
      toast.error('Não foi possível atualizar o status.')
    }
  }

  const handleDelete = async (coupon: DbCoupon) => {
    if (!window.confirm(`Excluir o cupom ${coupon.code}?`)) return
    try {
      await deleteCoupon.mutateAsync(coupon.id)
      toast.success('Cupom removido.')
    } catch (e) {
      // 23503: o cupom está ligado a um pedido (como em admin/Coupons.tsx)
      toast.error((e as { code?: string })?.code === '23503' ? 'Este cupom já foi usado. Desative em vez de excluir.' : 'Não foi possível remover o cupom.')
    }
  }

  const header = (
    <PageHeader
      title="Cupons"
      description="Descontos e promoções dos seus eventos"
      actions={<Button onClick={abrir}><Plus aria-hidden="true" />Novo cupom</Button>}
    />
  )

  if (isLoading) {
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
          <p className="text-sm text-foreground">Não foi possível carregar os cupons.</p>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Cupons" value={total} />
        <Stat label="Ativos" value={active} />
        <Stat label="Utilizações" value={totalUses} hint={filtroEvento ? 'Sem os cupons de todos os eventos' : undefined} />
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div role="group" aria-label="Filtrar por status" className="flex flex-wrap gap-1">
          {statusOptions.map(s => (
            <Button key={s} size="sm" variant={filterStatus === s ? 'secondary' : 'ghost'} aria-pressed={filterStatus === s} onClick={() => setFilterStatus(s)} className={filterStatus === s ? '' : icone}>{s}</Button>
          ))}
        </div>
        <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1 sm:ml-auto">
          {typeOptions.map(t => (
            <Button key={t} size="sm" variant={filterType === t ? 'secondary' : 'ghost'} aria-pressed={filterType === t} onClick={() => setFilterType(t)} className={filterType === t ? '' : icone}>{t}</Button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {filtered.length === 0 ? (
          <EmptyState
            title={total === 0 ? (filtroEvento ? 'Nenhum cupom neste evento' : 'Nenhum cupom ainda') : 'Nenhum cupom com esse filtro'}
            description={total === 0 ? (filtroEvento ? 'Crie um cupom para este evento ou para todos os eventos.' : 'Crie o primeiro cupom de desconto.') : undefined}
            action={total === 0 ? <Button onClick={abrir}><Plus aria-hidden="true" />Novo cupom</Button> : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(coupon => {
              const status = couponStatus(coupon)
              return (
                <div key={coupon.id} className="rounded-[10px] border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={status === 'ativo' ? 'default' : 'secondary'}>{rotulo(status)}</Badge>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => copyCode(coupon.code)} aria-label={`Copiar código ${coupon.code}`}>
                        {copied === coupon.code ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                      </Button>
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => toggleStatus(coupon)} aria-label={coupon.is_active ? `Desativar ${coupon.code}` : `Ativar ${coupon.code}`}>
                        <Power aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDelete(coupon)} aria-label={`Remover ${coupon.code}`}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <p className="mt-3 break-all font-mono text-lg font-semibold tracking-wider text-foreground">{coupon.code}</p>
                  <p className="text-sm text-muted-foreground">{coupon.description || 'Sem descrição'}</p>

                  <dl className="mt-3 grid grid-cols-3 gap-2 border-y border-border py-3 text-center">
                    <div>
                      <dt className="text-xs text-muted-foreground">Desconto</dt>
                      <dd className="text-sm font-medium tabular-nums text-foreground">
                        {coupon.discount_type === 'percent' ? `${coupon.discount_value}%` : `R$ ${Number(coupon.discount_value || 0).toLocaleString('pt-BR')}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Usado</dt>
                      <dd className="text-sm font-medium tabular-nums text-foreground">{coupon.uses || 0}/{coupon.max_uses || '–'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Mínimo</dt>
                      <dd className="text-sm font-medium tabular-nums text-foreground">R$ {Number(coupon.min_order_value || 0).toLocaleString('pt-BR')}</dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-xs text-muted-foreground">
                    Válido: {coupon.valid_from ? new Date(coupon.valid_from).toLocaleDateString('pt-BR') : 'sempre'}{coupon.valid_until ? ` até ${new Date(coupon.valid_until).toLocaleDateString('pt-BR')}` : ''}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo cupom</DialogTitle>
            <DialogDescription>O código vale para o evento escolhido ou para todos os seus eventos.</DialogDescription>
          </DialogHeader>
          <form id="form-cupom" onSubmit={addCoupon} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cupom-codigo">Código</Label>
              <Input id="cupom-codigo" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ex.: AURA20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cupom-tipo">Tipo</Label>
                <select id="cupom-tipo" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as DbCoupon['discount_type'] })} className={select}>
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cupom-valor">{form.type === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}</Label>
                <Input id="cupom-valor" type="number" inputMode="decimal" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cupom-minimo">Compra mínima (R$)</Label>
                <Input id="cupom-minimo" type="number" inputMode="decimal" value={form.minPurchase} onChange={e => setForm({ ...form, minPurchase: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cupom-usos">Limite de usos</Label>
                <Input id="cupom-usos" type="number" inputMode="numeric" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cupom-evento">Evento</Label>
              <select id="cupom-evento" value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} className={select}>
                <option value="">Todos os eventos</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cupom-inicio">Início</Label>
                <Input id="cupom-inicio" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cupom-fim">Fim</Label>
                <Input id="cupom-fim" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cupom-descricao">Descrição (opcional)</Label>
              <Textarea id="cupom-descricao" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" form="form-cupom" disabled={createCoupon.isPending}>
              {createCoupon.isPending ? <><Loader2 className="animate-spin" aria-hidden="true" />Criando…</> : 'Criar cupom'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
