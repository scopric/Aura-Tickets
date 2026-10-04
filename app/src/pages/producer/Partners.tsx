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
import { PageHeader, Stat, EmptyState, selectNativo, chipNeutro } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Grava só as colunas de public.partners (name, type, contact, notes). Valor, status, categoria,
// e-mail, telefone, evento e entregáveis não existem no banco: voltam com o módulo M2 (Decisão 20).
const tipos = [
  { valor: 'patrocinador', rotulo: 'Patrocinador' },
  { valor: 'fornecedor', rotulo: 'Fornecedor' },
]
const filtros = [{ valor: 'todos', rotulo: 'Todos' }, ...tipos]
const rotuloTipo = (t: string | null) => tipos.find(x => x.valor === t)?.rotulo ?? 'Sem tipo'

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const vazio = { name: '', type: 'patrocinador', contact: '', notes: '' }

// O erro do Supabase é um objeto com `message`, não uma instância de Error
const causa = (e: unknown) => (e as { message?: string } | null)?.message || 'erro desconhecido'

export default function ProducerPartners() {
  const { data: partners = [], isPending, isError, error, refetch, isFetching } = useProducerPartners()
  const createPartner = useCreatePartner()
  const updatePartner = useUpdatePartner()
  const deletePartner = useDeletePartner()

  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<DbPartner | null>(null)
  const [apagar, setApagar] = useState<DbPartner | null>(null)
  const [form, setForm] = useState(vazio)
  const [filtro, setFiltro] = useState('todos')
  const [search, setSearch] = useState('')

  const filtered = partners
    .filter(p => filtro === 'todos' || p.type === filtro)
    .filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const salvando = createPartner.isPending || updatePartner.isPending

  const abrir = (p: DbPartner | null) => {
    setEditando(p)
    setForm(p ? { name: p.name, type: p.type ?? '', contact: p.contact ?? '', notes: p.notes ?? '' } : vazio)
    setShowForm(true)
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) { toast.error('Informe o nome do parceiro'); return }
    const dados = { name, type: form.type || null, contact: form.contact.trim() || null, notes: form.notes.trim() || null }
    try {
      if (editando) await updatePartner.mutateAsync({ id: editando.id, ...dados })
      else await createPartner.mutateAsync(dados)
      setShowForm(false)
      toast.success(editando ? 'Parceiro atualizado!' : 'Parceiro adicionado!')
    } catch (err) {
      toast.error(`Não foi possível ${editando ? 'salvar' : 'adicionar'} o parceiro: ${causa(err)}`)
    }
  }

  const confirmarApagar = async () => {
    if (!apagar) return
    try {
      await deletePartner.mutateAsync(apagar.id)
      setApagar(null)
      toast.success('Parceiro removido!')
    } catch (err) {
      setApagar(null)
      toast.error(`Não foi possível remover o parceiro: ${causa(err)}`)
    }
  }

  const header = (
    <PageHeader
      title="Parceiros & Patrocínios"
      description="Gerencie fornecedores e patrocinadores"
      actions={<Button onClick={() => abrir(null)}><I.Criar aria-hidden="true" />Novo parceiro</Button>}
    />
  )

  if (isPending) {
    return (
      <div aria-busy="true">
        {header}
        <p role="status" className="sr-only">Carregando parceiros…</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[1, 2].map(n => <Skeleton key={n} className="h-32 rounded-[10px] bg-muted" />)}
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
            <p className="text-sm text-foreground">Não foi possível carregar os parceiros.</p>
            <p className="mt-1 text-xs text-muted-foreground">{causa(error)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}>Tentar de novo</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}

      {/* Os três cartões contam todos os parceiros, não só a lista filtrada */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total de parceiros" value={partners.length} />
        <Stat label="Patrocinadores" value={partners.filter(p => p.type === 'patrocinador').length} />
        <Stat label="Fornecedores" value={partners.filter(p => p.type === 'fornecedor').length} />
      </div>

      <div className="mb-4 mt-6 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1">
          {filtros.map(f => (
            <Button key={f.valor} size="sm" variant={filtro === f.valor ? 'secondary' : 'ghost'} aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)} className={filtro === f.valor ? '' : icone}>{f.rotulo}</Button>
          ))}
        </div>
        <div className="relative w-full sm:ml-auto sm:max-w-xs">
          <I.Buscar size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" aria-label="Buscar parceiros" className="pl-9" />
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar parceiro' : 'Novo parceiro'}</DialogTitle>
            <DialogDescription>Só o nome é obrigatório.</DialogDescription>
          </DialogHeader>
          <form id="form-parceiro" onSubmit={salvar} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="parc-nome">Nome da empresa</Label>
              <Input id="parc-nome" maxLength={200} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="parc-tipo">Tipo</Label>
              <select id="parc-tipo" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={selectNativo}>
                <option value="">Sem tipo</option>
                {tipos.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="parc-contato">Contato</Label>
              <Input id="parc-contato" maxLength={200} value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="Nome, e-mail ou telefone" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="parc-observacoes">Observações</Label>
              <Textarea id="parc-observacoes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" form="form-parceiro" loading={salvando}>{editando ? 'Salvar' : 'Adicionar parceiro'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!apagar} onOpenChange={aberto => { if (!aberto) setApagar(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover “{apagar?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); confirmarApagar() }} disabled={deletePartner.isPending}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum parceiro encontrado."
          description={partners.length === 0 ? 'Adicione seu primeiro fornecedor ou patrocinador.' : 'Nenhum parceiro bate com o filtro ou a busca.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map(partner => (
            <div key={partner.id} className="rounded-[10px] border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">{partner.name}</h3>
                  <Badge variant="secondary" className={`mt-1 ${chipNeutro}`}>{rotuloTipo(partner.type)}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" className={icone} onClick={() => abrir(partner)} aria-label={`Editar ${partner.name}`}>
                    <I.Editar aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className={icone} onClick={() => setApagar(partner)} aria-label={`Remover ${partner.name}`}>
                    <I.Lixeira aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {partner.contact && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <I.Conta size={16} aria-hidden="true" />
                  <span>{partner.contact}</span>
                </div>
              )}

              {partner.notes && (
                <div className="mt-3 rounded-md bg-secondary p-2">
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
