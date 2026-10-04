import { useState } from 'react'
import { UserPlus, Search, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useProducerEvents } from '../../hooks/useEvents'
import { doEvento, useFiltroEvento } from '../../hooks/useEventoDaUrl'
import FiltroEvento from '@/components/producer/FiltroEvento'
import { mensagemVinculo } from '../../lib/afiliados'
import { brl } from '../../lib/taxa'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Colunas da listar_afiliados (B3): sem nome nem uuid do afiliado até existir o aceite dele (DECISÕES 13)
interface Afiliado {
  id: string
  email_mascarado: string
  commission_percent: number
  status: 'active' | 'inactive'
  event_id: string | null
  evento: string | null
  sales: number
  total_earned: number
  created_at: string
}

const formVazio = { email: '', eventId: '', comissao: '' }
const select = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'
const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const filtros = [['all', 'Todos'], ['active', 'Ativos'], ['inactive', 'Inativos']] as const

export default function ProducerAffiliates() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: eventos = [] } = useProducerEvents()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [editando, setEditando] = useState<Afiliado | null>(null)
  const [comissaoNova, setComissaoNova] = useState('')
  const [filtroEvento] = useFiltroEvento()

  const queryKey = ['producer-afiliados', user?.id]
  const { data: todos = [], isPending, isError, refetch } = useQuery({
    queryKey,
    enabled: !!user?.id,
    queryFn: async () => {
      // listar só pela função: "select *" em affiliates dá 42501 (grant por coluna, B3)
      // ponytail: `as never` aqui e nas outras chamadas é remendo temporário (types/database.ts desatualizado)
      const { data, error } = await supabase.rpc('listar_afiliados' as never)
      if (error) throw error
      return ((data ?? []) as Afiliado[]).map(a => ({
        ...a,
        commission_percent: Number(a.commission_percent) || 0,
        sales: Number(a.sales) || 0,
        total_earned: Number(a.total_earned) || 0,
      }))
    },
  })

  const affiliates = doEvento(todos, filtroEvento)
  const filtered = affiliates
    .filter(a => !search || a.email_mascarado.toLowerCase().includes(search.toLowerCase()) || (a.evento ?? '').toLowerCase().includes(search.toLowerCase()))
    .filter(a => filterStatus === 'all' || a.status === filterStatus)

  const stats = {
    active: affiliates.filter(a => a.status === 'active').length,
    sales: affiliates.reduce((s, a) => s + a.sales, 0),
    earned: affiliates.reduce((s, a) => s + a.total_earned, 0),
  }

  // Vincular só pela vincular_afiliado: trava de 18 anos, limite de tentativas e 2FA ficam no banco (B3)
  const vincular = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.eventId) { toast.error('Escolha o evento'); return }
    setSalvando(true)
    // ponytail: `as never` é remendo temporário (types/database.ts desatualizado)
    const { data, error } = await supabase.rpc('vincular_afiliado' as never, {
      p_email: form.email.trim(),
      p_evento: form.eventId,
      p_comissao: Number(form.comissao),
    } as never)
    setSalvando(false)
    const msg = mensagemVinculo(data, error)
    if (!error && data === 'ok') {
      toast.success(msg)
      setForm(formVazio)
      setShowForm(false)
      queryClient.invalidateQueries({ queryKey })
    } else {
      toast.error(msg)
    }
  }

  // Só status e commission_percent mudam pela API; .select com colunas listadas (select vazio/* dá 42501) e
  // conferência do retorno: RLS que barra devolve sucesso com 0 linhas (erro 11)
  const atualizar = async (a: Afiliado, campos: { status?: Afiliado['status']; commission_percent?: number }) => {
    const { data, error } = await supabase
      .from('affiliates')
      .update(campos as never) // ponytail: remendo temporário, types/database.ts desatualizado (affiliates vira never); some com o gen types
      .eq('id', a.id)
      .select('id,status')
    if (error || !data?.length) {
      toast.error(error?.code === '42501' ? 'Confirme o código do 2FA: saia e entre de novo.' : 'Não foi possível salvar a alteração.')
      return false
    }
    queryClient.invalidateQueries({ queryKey })
    return true
  }

  const toggleStatus = async (a: Afiliado) => {
    const ativo = a.status === 'active'
    if (await atualizar(a, { status: ativo ? 'inactive' : 'active' })) toast.success(ativo ? 'Afiliado desativado.' : 'Afiliado ativado.')
  }

  const salvarComissao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editando) return
    const v = Number(comissaoNova)
    if (!(v >= 0.01 && v <= 100)) { toast.error(mensagemVinculo('comissao_invalida')); return }
    if (await atualizar(editando, { commission_percent: Math.round(v * 100) / 100 })) {
      toast.success('Comissão atualizada.')
      setEditando(null)
    }
  }

  const abrirNovo = () => { setForm({ ...formVazio, eventId: eventos.some(e => e.id === filtroEvento) ? filtroEvento! : '' }); setShowForm(true) }

  return (
    <div>
      <PageHeader
        title="Afiliados"
        description="Pessoas com conta na Evokaa que divulgam seus eventos por comissão"
        actions={<Button onClick={abrirNovo}><UserPlus aria-hidden="true" />Vincular afiliado</Button>}
      />

      <FiltroEvento />

      <p className="mb-6 rounded-[10px] border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        O link de venda do afiliado chega com o módulo de Promoters.
      </p>

      {isError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar os afiliados.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      ) : isPending ? (
        <div aria-busy="true">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
          </div>
          <Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Afiliados ativos" value={stats.active} />
            <Stat label="Vendas" value={stats.sales} />
            <Stat label="Comissão acumulada" value={brl(stats.earned)} />
          </div>

          {affiliates.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title={filtroEvento ? 'Nenhum afiliado neste evento' : 'Nenhum afiliado vinculado'}
                description="Vincule pelo e-mail da conta Evokaa da pessoa e escolha o evento."
                action={<Button onClick={abrirNovo}><UserPlus aria-hidden="true" />Vincular afiliado</Button>}
              />
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por e-mail ou evento" aria-label="Buscar afiliado" className="pl-9" />
                </div>
                <div role="group" aria-label="Filtrar por status" className="flex flex-wrap gap-1">
                  {filtros.map(([v, t]) => (
                    <Button key={v} size="sm" variant={filterStatus === v ? 'secondary' : 'ghost'} aria-pressed={filterStatus === v} onClick={() => setFilterStatus(v)} className={filterStatus === v ? '' : icone}>{t}</Button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Nenhum afiliado com esse filtro.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
                  {filtered.map(a => (
                    <li key={a.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{a.email_mascarado}</span>
                          <Badge variant={a.status === 'active' ? 'default' : 'secondary'}>{a.status === 'active' ? 'Ativo' : 'Inativo'}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.evento ?? 'Sem evento'}</p>
                      </div>
                      <dl className="flex gap-4 text-xs tabular-nums text-muted-foreground">
                        <div><dt className="sr-only">Comissão</dt><dd>{a.commission_percent.toLocaleString('pt-BR')}%</dd></div>
                        <div><dt className="sr-only">Vendas</dt><dd>{a.sales} vendas</dd></div>
                        <div><dt className="sr-only">Comissão acumulada</dt><dd>{brl(a.total_earned)}</dd></div>
                      </dl>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-sm" className={icone} onClick={() => { setEditando(a); setComissaoNova(String(a.commission_percent)) }} aria-label={`Editar comissão de ${a.email_mascarado}`}>
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleStatus(a)} aria-label={a.status === 'active' ? `Desativar ${a.email_mascarado}` : `Ativar ${a.email_mascarado}`}>
                          {a.status === 'active' ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular afiliado</DialogTitle>
            <DialogDescription>A pessoa precisa ter conta na Evokaa, ser maior de 18 anos e ter a data de nascimento no perfil.</DialogDescription>
          </DialogHeader>
          <form id="form-afiliado" onSubmit={vincular} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="afiliado-evento">Evento</Label>
              <select id="afiliado-evento" required value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })} className={select}>
                <option value="">Escolha o evento</option>
                {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="afiliado-email">E-mail da conta Evokaa</Label>
              <Input id="afiliado-email" required type="email" autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="afiliado-comissao">Comissão (%)</Label>
              <Input id="afiliado-comissao" required type="number" inputMode="decimal" min="0.01" max="100" step="0.01" value={form.comissao} onChange={e => setForm({ ...form, comissao: e.target.value })} />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" form="form-afiliado" disabled={salvando}>{salvando ? 'Vinculando…' : 'Vincular'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editando} onOpenChange={aberto => { if (!aberto) setEditando(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Comissão</DialogTitle>
            <DialogDescription>{editando?.email_mascarado} · {editando?.evento ?? 'Sem evento'}</DialogDescription>
          </DialogHeader>
          <form id="form-comissao" onSubmit={salvarComissao} className="grid gap-1.5">
            <Label htmlFor="comissao-nova">Comissão (%)</Label>
            <Input id="comissao-nova" required type="number" inputMode="decimal" min="0.01" max="100" step="0.01" value={comissaoNova} onChange={e => setComissaoNova(e.target.value)} />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button type="submit" form="form-comissao">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
