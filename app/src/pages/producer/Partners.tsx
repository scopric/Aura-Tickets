import { useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import {
  useProducerPartners,
  useCreatePartner,
  useUpdatePartner,
  useDeletePartner,
  type DbPartner,
} from '../../hooks/useProducerTools'
import { PageHeader, Stat, EmptyState, selectNativo, chipOk, chipAviso, chipErro } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const partnerTypes = ['Todos', 'Patrocinador', 'Fornecedor']
const statusOptions = ['Todos', 'Confirmado', 'Pendente', 'Cancelado']
const categories = ['Alimentacao', 'Bebidas', 'Audio/Som', 'Iluminacao', 'Decoracao', 'Seguranca', 'Fotografia', 'Marketing', 'Transporte', 'Outros']

const categoryLabels: Record<string, string> = {
  Alimentacao: 'Alimentação', 'Audio/Som': 'Áudio/Som', Iluminacao: 'Iluminação', Decoracao: 'Decoração', Seguranca: 'Segurança',
}
const categoryLabel = (c: string | null) => (c && categoryLabels[c]) || c

const statusColors = {
  confirmado: chipOk,
  pendente: chipAviso,
  cancelado: chipErro,
}

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'

export default function ProducerPartners() {
  const { data: partners = [], isLoading } = useProducerPartners()
  const createPartner = useCreatePartner()
  const updatePartner = useUpdatePartner()
  const deletePartner = useDeletePartner()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'patrocinador' as DbPartner['type'], category: 'Alimentacao', contact: '', email: '', phone: '', value: '', eventName: '', notes: '', deliverables: '' })
  const [activeTab, setActiveTab] = useState('Todos')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const filtered = partners
    .filter(p => activeTab === 'Todos' || p.type === activeTab.toLowerCase())
    .filter(p => statusFilter === 'Todos' || p.status === statusFilter.toLowerCase())
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  const totalValue = filtered.reduce((s, p) => s + Number(p.value || 0), 0)
  const confirmedValue = filtered.filter(p => p.status === 'confirmado').reduce((s, p) => s + Number(p.value || 0), 0)

  const addPartner = async () => {
    if (!form.name) return
    try {
      await createPartner.mutateAsync({
        name: form.name,
        type: form.type,
        category: form.category,
        contact: form.contact || null,
        email: form.email || null,
        phone: form.phone || null,
        value: Number(form.value) || 0,
        event_name: form.eventName || null,
        notes: form.notes || null,
        deliverables: form.deliverables || null,
        status: 'pendente',
      })
      setForm({ name: '', type: 'patrocinador', category: 'Alimentacao', contact: '', email: '', phone: '', value: '', eventName: '', notes: '', deliverables: '' })
      setShowForm(false)
      toast.success('Parceiro adicionado!')
    } catch {
      toast.error('Erro ao adicionar parceiro')
    }
  }

  const updateStatus = async (id: string, status: DbPartner['status']) => {
    try {
      await updatePartner.mutateAsync({ id, status })
      toast.success('Status atualizado!')
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deletePartner.mutateAsync(id)
      setSelected(null)
      toast.success('Parceiro removido!')
    } catch {
      toast.error('Erro ao remover parceiro')
    }
  }

  const header = (
    <PageHeader
      title="Parceiros & Patrocínios"
      description="Gerencie fornecedores e patrocinadores"
      actions={<Button onClick={() => setShowForm(true)}><I.Criar aria-hidden="true" />Novo Parceiro</Button>}
    />
  )

  if (isLoading) {
    return (
      <div aria-busy="true">
        {header}
        <p role="status" className="sr-only">Carregando parceiros...</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[1, 2].map(n => <Skeleton key={n} className="h-48 rounded-[10px] bg-muted" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total de Parceiros" value={partners.length} />
        <Stat label="Valor Total" value={`R$ ${totalValue.toLocaleString('pt-BR')}`} />
        <Stat label="Confirmado" value={`R$ ${confirmedValue.toLocaleString('pt-BR')}`} />
      </div>

      {/* Tabs + Search */}
      <div className="mb-4 mt-6 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1">
          {partnerTypes.map(type => (
            <Button key={type} size="sm" variant={activeTab === type ? 'secondary' : 'ghost'} aria-pressed={activeTab === type} onClick={() => setActiveTab(type)} className={activeTab === type ? '' : icone}>{type}</Button>
          ))}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtrar por status" className={cn(selectNativo, 'w-auto')}>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="relative w-full sm:ml-auto sm:max-w-xs">
          <I.Buscar size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." aria-label="Buscar parceiros" className="pl-9" />
        </div>
      </div>

      {/* Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Novo Parceiro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="parc-nome">Nome da empresa</Label>
              <Input id="parc-nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="parc-tipo">Tipo</Label>
                <select id="parc-tipo" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as DbPartner['type'] })} className={selectNativo}>
                  <option value="patrocinador">Patrocinador</option>
                  <option value="fornecedor">Fornecedor</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="parc-categoria">Categoria</Label>
                <select id="parc-categoria" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={selectNativo}>
                  {categories.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="parc-contato">Nome do contato</Label>
              <Input id="parc-contato" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="parc-email">Email</Label>
                <Input id="parc-email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="parc-telefone">Telefone</Label>
                <Input id="parc-telefone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="parc-valor">Valor (R$)</Label>
                <Input id="parc-valor" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} type="number" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="parc-evento">Evento</Label>
                <Input id="parc-evento" value={form.eventName} onChange={e => setForm({ ...form, eventName: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="parc-entregaveis">Entregáveis</Label>
              <Textarea id="parc-entregaveis" value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })} rows={2} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="parc-observacoes">Observações</Label>
              <Textarea id="parc-observacoes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addPartner} loading={createPartner.isPending}>Adicionar Parceiro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Partner Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum parceiro encontrado."
          description="Adicione seu primeiro fornecedor ou patrocinador."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map(partner => (
            <div key={partner.id} className={`rounded-[10px] border bg-card p-4 ${selected === partner.id ? 'border-primary' : 'border-border'}`}>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">{partner.name}</h3>
                  <Badge variant="secondary" className={`mt-1 ${statusColors[partner.status] || statusColors.pendente}`}>{partner.status}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" className={icone} onClick={() => updateStatus(partner.id, partner.status === 'confirmado' ? 'pendente' : 'confirmado')} aria-label={`${partner.status === 'confirmado' ? 'Marcar como pendente' : 'Confirmar'}: ${partner.name}`}>
                    <I.Parceiros aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className={icone} onClick={() => handleDelete(partner.id)} aria-label={`Remover ${partner.name}`}>
                    <I.Lixeira aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="mb-3 grid gap-1.5">
                {partner.contact && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <I.Conta size={16} aria-hidden="true" />
                    <span>{partner.contact}</span>
                  </div>
                )}
                {partner.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <I.Email size={16} aria-hidden="true" />
                    <span>{partner.email}</span>
                  </div>
                )}
                {partner.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <I.Telefone size={16} aria-hidden="true" />
                    <span>{partner.phone}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <div className="text-xs">
                  <span className="text-muted-foreground">Valor</span>
                  <div className="font-medium tabular-nums text-foreground">R$ {Number(partner.value || 0).toLocaleString('pt-BR')}</div>
                </div>
                <div className="text-right text-xs">
                  <span className="text-muted-foreground">Categoria</span>
                  <div className="font-medium text-foreground">{categoryLabel(partner.category)}</div>
                </div>
              </div>

              {partner.notes && (
                <div className="mt-2 rounded-md bg-secondary p-2">
                  <p className="flex items-start gap-1 text-xs text-muted-foreground"><I.Documento size={16} aria-hidden="true" className="shrink-0" />{partner.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
