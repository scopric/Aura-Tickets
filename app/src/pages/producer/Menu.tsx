import { useState } from 'react'
import * as I from '@/components/icones/evokaa16'
import { useProducerMenuItems, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem } from '../../hooks/useMenuItems'
import { toast } from 'sonner'
import { useProducerEvents } from '../../hooks/useEvents'
import { doEvento, useFiltroEvento } from '../../hooks/useEventoDaUrl'
import FiltroEvento from '@/components/producer/FiltroEvento'
import { PageHeader, Stat, EmptyState, selectNativo, chipOk, chipAviso } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const categories = [
  { value: 'bebida', label: 'Bebidas', icon: I.Cardapio },
  { value: 'comida', label: 'Comidas', icon: I.Talheres },
  { value: 'combo', label: 'Combos', icon: I.Pacote },
  { value: 'merch', label: 'Merch', icon: I.Camiseta },
  { value: 'servico', label: 'Serviços', icon: I.ChaveInglesa },
] as const

type CategoryValue = typeof categories[number]['value']

interface MenuForm {
  name: string
  description: string
  price: number
  category: CategoryValue
  is_available: boolean
  image_url: string
  event_id: string
  stock: number | null
}

const emptyForm: MenuForm = {
  name: '', description: '', price: 0, category: 'bebida', is_available: true, image_url: '', event_id: '', stock: null,
}

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

export default function ProducerMenu() {
  const { data: todos = [], isLoading } = useProducerMenuItems()
  const [filtroEvento] = useFiltroEvento()
  const { data: events = [], isPending: carregandoEventos } = useProducerEvents()
  const items = doEvento(todos, filtroEvento)
  const createItem = useCreateMenuItem()
  const updateItem = useUpdateMenuItem()
  const deleteItem = useDeleteMenuItem()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [menuEnabled, setMenuEnabled] = useState(true)
  const [form, setForm] = useState<MenuForm>(emptyForm)

  const filtered = activeCategory === 'all'
    ? items
    : items.filter(i => i.category === activeCategory)

  const handleSubmit = async () => {
    try {
      if (!form.name.trim()) {
        toast.error('Nome do item é obrigatório')
        return
      }
      if (editingId) {
        await updateItem.mutateAsync({ id: editingId, ...form })
        toast.success('Item atualizado!')
      } else {
        await createItem.mutateAsync(form)
        toast.success('Item cadastrado!')
      }
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar item')
    }
  }

  const toggleAvailable = async (item: any) => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        is_available: !item.is_available,
      })
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar disponibilidade')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return
    try {
      await deleteItem.mutateAsync(id)
      toast.success('Item excluído!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir item')
    }
  }

  const startEdit = (item: any) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      description: item.description || '',
      price: Number(item.price) || 0,
      category: item.category as CategoryValue,
      is_available: item.is_available,
      image_url: item.image_url || '',
      event_id: item.event_id || '',
      stock: item.stock,
    })
    setShowForm(true)
  }

  const stats = {
    total: items.length,
    totalValue: items.reduce((s, i) => s + Number(i.price), 0),
    byCategory: categories.map(c => ({
      ...c,
      count: items.filter(i => i.category === c.value).length,
      // (não sobrescrever `value`: é o id da categoria e serve de key)
    }))
  }

  const isMutating = createItem.isPending || updateItem.isPending || deleteItem.isPending

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Cardápio & Comandas"
        description="Cadastre bebidas, comidas, combos e serviços para seu evento"
        actions={
          <>
            <Button variant="outline" onClick={() => setMenuEnabled(!menuEnabled)}>
              {menuEnabled
                ? <I.InterruptorLigado aria-hidden="true" className="text-[var(--ev-success)]" />
                : <I.InterruptorDesligado aria-hidden="true" className="text-destructive" />}
              Comandas {menuEnabled ? 'Ativas' : 'Desativadas'}
            </Button>
            <Button
              onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...emptyForm, event_id: events.some(e => e.id === filtroEvento) ? filtroEvento! : '' }) }}
              disabled={isMutating || (!!filtroEvento && carregandoEventos)}
            >
              <I.Criar aria-hidden="true" />
              Novo Item
            </Button>
          </>
        }
      />

      <FiltroEvento />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Itens no cardápio" value={stats.total} />
        {stats.byCategory.map(c => (
          <Stat key={c.value} label={<span className="inline-flex items-center gap-1.5"><c.icon size={16} aria-hidden="true" />{c.label}</span>} value={c.count} />
        ))}
      </div>

      {/* Filters */}
      <div role="group" aria-label="Filtrar por categoria" className="mb-4 mt-6 flex items-center gap-1 overflow-x-auto pb-1">
        <Button size="sm" variant={activeCategory === 'all' ? 'secondary' : 'ghost'} aria-pressed={activeCategory === 'all'} onClick={() => setActiveCategory('all')} className={activeCategory === 'all' ? '' : icone}>
          Todos
        </Button>
        {categories.map(c => (
          <Button
            key={c.value}
            size="sm"
            variant={activeCategory === c.value ? 'secondary' : 'ghost'}
            aria-pressed={activeCategory === c.value}
            onClick={() => setActiveCategory(c.value)}
            className={activeCategory === c.value ? '' : icone}
          >
            <c.icon aria-hidden="true" />
            {c.label}
          </Button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div aria-busy="true" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-40 rounded-[10px] bg-muted" />)}
        </div>
      )}

      {/* Items Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => {
            const cat = categories.find(c => c.value === item.category)
            return (
              <div key={item.id} className={`rounded-[10px] border border-border p-4 ${item.is_available ? 'bg-card' : 'bg-secondary'}`}>
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                    {cat && <cat.icon size={20} aria-hidden="true" />}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" className={item.is_available ? 'text-[var(--ev-success)] hover:bg-foreground/5' : icone} aria-pressed={item.is_available} onClick={() => toggleAvailable(item)} aria-label={`Disponível: ${item.name}`}>
                      {item.is_available ? <I.InterruptorLigado aria-hidden="true" /> : <I.InterruptorDesligado aria-hidden="true" />}
                    </Button>
                    <Button variant="ghost" size="icon-sm" className={icone} onClick={() => startEdit(item)} aria-label={`Editar ${item.name}`}>
                      <I.Editar aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDelete(item.id)} aria-label={`Excluir ${item.name}`}>
                      <I.Lixeira aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <h3 className="mb-1 text-sm font-medium text-foreground">{item.name}</h3>
                <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl font-semibold tabular-nums text-foreground">R$ {Number(item.price).toFixed(2)}</span>
                  <Badge variant="secondary" className={item.is_available ? chipOk : chipAviso}>
                    {item.is_available ? 'Ativo' : 'Pausado'}
                  </Badge>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <EmptyState
          title="Nenhum item encontrado"
          description={filtroEvento ? 'Itens sem evento aparecem em Todos os eventos.' : 'Cadastre seu primeiro item no cardápio'}
        />
      )}

      {/* Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Item' : 'Novo Item'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="item-nome">Nome</Label>
              <Input id="item-nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Gin Tonica" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="item-descricao">Descrição</Label>
              <Textarea id="item-descricao" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Descrição do item" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="item-preco">Preço (R$)</Label>
                <Input id="item-preco" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="item-categoria">Categoria</Label>
                <select id="item-categoria" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as CategoryValue })} className={selectNativo}>
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="item-estoque">Estoque (opcional)</Label>
              <Input id="item-estoque" type="number" value={form.stock ?? ''} onChange={e => setForm({ ...form, stock: e.target.value ? Number(e.target.value) : null })} placeholder="Sem limite" />
            </div>
            <div className="rounded-[10px] border-2 border-dashed border-border p-6 text-center">
              <I.Carregar size={20} aria-hidden="true" className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Arraste uma imagem ou clique para selecionar</p>
              <p className="mt-1 text-xs text-muted-foreground">PNG, JPG até 2MB · 800x600px recomendado</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} loading={isMutating}>
              {editingId ? 'Salvar Alterações' : 'Cadastrar Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
