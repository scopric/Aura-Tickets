import { useRef, useState } from 'react'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { iniciais } from '../../hooks/useConversas'
import { useArrastar } from '../../hooks/useArrastar'
import { PageHeader, Stat, EmptyState, selectNativo } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

// Tipos locais: types/database.ts está desatualizado (crm_* viram never)
interface Etapa { id: string; name: string; position: number }
interface Interacao { id: string; type: TipoInteracao; content: string | null; created_at: string }
interface Lead {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  source: string
  potential_value: number
  event_interest: string | null
  notes: string | null
  stage_id: string | null
  created_at: string
  crm_interactions: Interacao[]
}

// crm_interactions_type_check: só estes 5 valores
type TipoInteracao = 'message' | 'call' | 'email' | 'note' | 'meeting'
const TIPOS: Record<TipoInteracao, string> = {
  message: 'Mensagem',
  call: 'Ligação',
  email: 'E-mail',
  note: 'Nota',
  meeting: 'Reunião',
}

const SEM_ETAPA = 'sem-etapa'

function quandoFoi(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'Agora mesmo'
  if (min < 60) return `Há ${min} min`
  if (min < 60 * 24) return `Há ${Math.floor(min / 60)} h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
}

const dinheiro = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const icone = 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
const ORIGENS = ['Instagram', 'LinkedIn', 'Google Ads', 'Facebook', 'Indicação', 'Afiliado', 'Orgânico']

const leadVazio = { name: '', email: '', phone: '', source: 'Instagram', value: '', interest: '', notes: '' }

// Decide pelo tamanho, não pelo prefixo (DDD 55 existe): 10 ou 11 dígitos = sem DDI, sempre ganha 55
export function numeroWhatsApp(phone: string | null) {
  const t = (phone ?? '').trim()
  const d = t.replace(/\D/g, '')
  if (t.startsWith('+')) return d
  const n = d.replace(/^0+/, '')
  return n.length === 10 || n.length === 11 ? `55${n}` : n
}

// Formato brasileiro ("1.500,50") ou ponto decimal ("15.5"); vazio = 0; inválido = null (não grava)
export function valorEmReais(texto: string) {
  const bruto = texto.trim()
  // com vírgula: vírgula = decimal, pontos = milhar; sem vírgula: ponto só é milhar se for "1.500", "1.500.000"
  const t = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(bruto) ? bruto.replace(/\./g, '') : bruto
  if (!t) return 0
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null
}

export default function ProducerCRM() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const origemNovoLead = useRef<HTMLElement | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [erroValor, setErroValor] = useState('')
  const [novo, setNovo] = useState(leadVazio)
  const [isSubmittingLead, setIsSubmittingLead] = useState(false)
  const [criandoEtapas, setCriandoEtapas] = useState(false)
  const [newIntType, setNewIntType] = useState<TipoInteracao>('note')
  const [newIntContent, setNewIntContent] = useState('')
  const [isSubmittingInt, setIsSubmittingInt] = useState(false)

  const queryKey = ['producer-crm', user?.id]
  const { data, isPending, isError, refetch } = useQuery({
    queryKey,
    enabled: !!user?.id,
    queryFn: async () => {
      const [et, ld] = await Promise.all([
        supabase.from('pipeline_stages').select('id, name, position').eq('producer_id', user!.id).order('position'),
        supabase.from('crm_leads')
          .select('id, full_name, email, phone, source, potential_value, event_interest, notes, stage_id, created_at, crm_interactions(id, type, content, created_at)')
          .eq('producer_id', user!.id)
          .order('created_at', { ascending: false }),
      ])
      if (et.error) throw et.error
      if (ld.error) throw ld.error
      const leads = ((ld.data ?? []) as unknown as Lead[]).map(l => ({
        ...l,
        potential_value: Number(l.potential_value) || 0,
        crm_interactions: [...(l.crm_interactions ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }))
      return { etapas: (et.data ?? []) as unknown as Etapa[], leads }
    },
  })
  const etapas = data?.etapas ?? []
  const leads = data?.leads ?? []
  const selected = leads.find(l => l.id === selectedId) ?? null
  // a Lista de interesse lê a mesma crm_leads com outra chave
  const recarregar = () => Promise.all([
    queryClient.invalidateQueries({ queryKey }),
    queryClient.invalidateQueries({ queryKey: ['producer-leads', user?.id] }),
  ])
  // contato = mensagem, ligação, e-mail ou reunião; nota (inclusive "Movido para") não conta
  const ultimoContato = (l: Lead) => l.crm_interactions.find(i => i.type !== 'note')

  // Lead sem etapa (ou com etapa apagada) aparece numa coluna própria, só quando existe
  const colunaDe = (l: Lead) => (l.stage_id && etapas.some(e => e.id === l.stage_id) ? l.stage_id : SEM_ETAPA)
  const colunas = [
    ...(leads.some(l => colunaDe(l) === SEM_ETAPA) ? [{ id: SEM_ETAPA, name: 'Sem etapa' }] : []),
    ...etapas,
  ]
  const nomeEtapa = (id: string | null) => etapas.find(e => e.id === id)?.name ?? 'Sem etapa'

  const filtered = leads.filter(l => !search || l.full_name.toLowerCase().includes(search.toLowerCase()))

  // ponytail: sem score (antes era sorteado ao criar o lead); o cartão mostra o nº de interações. Pontuação de verdade
  // (abertura de e-mail, compra) quando houver dado para isso.
  const stats = {
    total: leads.length,
    semContato: leads.filter(l => !ultimoContato(l)).length,
    pipeline: leads.reduce((s, l) => s + l.potential_value, 0),
  }

  const criarEtapas = async () => {
    setCriandoEtapas(true)
    // ponytail: `as never` é remendo temporário (types/database.ts desatualizado); some com o gen types
    const { error } = await supabase.rpc('crm_criar_etapas_padrao' as never)
    setCriandoEtapas(false)
    if (error) { toast.error(error.code === '42501' ? 'Confirme o código do 2FA: saia e entre de novo.' : 'Não foi possível criar as etapas.'); return }
    toast.success('Etapas criadas.')
    recarregar()
  }

  // Grava interação e confere a linha devolvida (RLS que barra devolve 0 linhas sem erro: erro 11)
  const gravarInteracao = async (leadId: string, type: TipoInteracao, content: string) => {
    const { data: r, error } = await supabase.from('crm_interactions')
      .insert({ lead_id: leadId, type, content } as never) // ponytail: remendo temporário, types/database.ts desatualizado
      .select('id')
    if (error || !r?.length) throw error ?? new Error('Interação não gravada')
  }

  const moverLead = async (leadId: string, stageId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || stageId === SEM_ETAPA || lead.stage_id === stageId) return
    const anterior = queryClient.getQueryData(queryKey)
    queryClient.setQueryData(queryKey, { etapas, leads: leads.map(l => l.id === leadId ? { ...l, stage_id: stageId } : l) })
    // ponytail: `as never` é remendo temporário (types/database.ts desatualizado)
    const { data: r, error } = await supabase.from('crm_leads')
      .update({ stage_id: stageId, updated_at: new Date().toISOString() } as never)
      .eq('id', leadId)
      .select('id')
    if (error || !r?.length) {
      queryClient.setQueryData(queryKey, anterior)
      toast.error('Não foi possível mover o lead.')
      return
    }
    try {
      await gravarInteracao(leadId, 'note', `Movido para ${nomeEtapa(stageId)}`)
      toast.success(`${lead.full_name} movido para ${nomeEtapa(stageId)}`)
    } catch {
      toast.warning('Lead movido, mas o histórico não registrou a mudança.')
    }
    recarregar()
  }

  const arrastar = useArrastar(colunas.map(c => c.id), moverLead, nomeEtapa)

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novo.name.trim() || !user?.id) { toast.error('Preencha o nome do lead'); return }
    const valor = valorEmReais(novo.value)
    if (valor === null) { setErroValor('Valor inválido. Use números, como 1.500,50.'); return }
    setErroValor('')
    setIsSubmittingLead(true)
    try {
      const campos = {
        full_name: novo.name.trim(),
        email: novo.email.trim() || null,
        phone: novo.phone.trim() || null,
        source: novo.source,
        potential_value: valor,
        event_interest: novo.interest.trim() || null,
        notes: novo.notes.trim() || null,
      }
      // ponytail: `as never` é remendo temporário (types/database.ts desatualizado)
      const { data: r, error } = editandoId
        ? await supabase.from('crm_leads').update({ ...campos, updated_at: new Date().toISOString() } as never).eq('id', editandoId).eq('producer_id', user.id).select('id')
        : await supabase.from('crm_leads').insert({ ...campos, producer_id: user.id, stage_id: etapas[0]?.id ?? null } as never).select('id') // primeira etapa do produtor (uuid real)
      if (error?.code === '23505') { toast.error('Já existe um lead com este e-mail.'); return }
      if (error || !r?.length) throw error ?? new Error('Lead não gravado')
      toast.success(editandoId ? 'Lead atualizado.' : 'Lead adicionado.')
      setIsAddModalOpen(false)
      setEditandoId(null)
      setNovo(leadVazio)
      recarregar()
    } catch {
      toast.error(editandoId ? 'Não foi possível salvar o lead.' : 'Não foi possível adicionar o lead.')
    } finally {
      setIsSubmittingLead(false)
    }
  }

  const handleDeleteLead = async (id: string, name: string) => {
    if (!window.confirm(`Excluir o lead "${name}"? O histórico de interações também será apagado.`)) return
    const { data: r, error } = await supabase.from('crm_leads').delete().eq('id', id).select('id')
    if (error || !r?.length) { toast.error('Não foi possível excluir o lead.'); return }
    toast.success(`Lead ${name} excluído.`)
    if (selectedId === id) setSelectedId(null)
    recarregar()
  }

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newIntContent.trim() || !selected) { toast.error('Escreva o conteúdo da interação'); return }
    setIsSubmittingInt(true)
    try {
      await gravarInteracao(selected.id, newIntType, newIntContent.trim())
      toast.success('Interação registrada.')
      setNewIntContent('')
      recarregar()
    } catch {
      toast.error('Não foi possível registrar a interação.')
    } finally {
      setIsSubmittingInt(false)
    }
  }

  const header = (
    <PageHeader
      title="CRM"
      description="Funil de leads e histórico de contatos"
      actions={<Button onClick={() => { origemNovoLead.current = document.activeElement as HTMLElement | null; setEditandoId(null); setErroValor(''); setNovo(leadVazio); setIsAddModalOpen(true) }}><I.Criar aria-hidden="true" />Novo lead</Button>}
    />
  )

  if (isPending) {
    return (
      <div aria-busy="true">
        {header}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
        <div className="mt-6 flex gap-3 overflow-hidden">
          {[1, 2, 3].map(n => <Skeleton key={n} className="h-64 w-72 shrink-0 rounded-[10px] bg-muted" />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        {header}
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar o CRM.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Leads" value={stats.total} />
        <Stat label="Sem contato" value={stats.semContato} hint="Nenhuma interação registrada" />
        <Stat label="Valor estimado no funil" value={dinheiro(stats.pipeline)} />
      </div>

      {etapas.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="Seu funil ainda não tem etapas"
            description="Crie as etapas padrão: Novo, Contato feito, Interessado, Negociando e Fechado."
            action={<Button onClick={criarEtapas} disabled={criandoEtapas}>{criandoEtapas ? 'Criando…' : 'Criar etapas padrão'}</Button>}
          />
        </div>
      )}

      {colunas.length > 0 && (
        <>
          <div className="relative mt-6 w-full sm:max-w-xs">
            <I.Buscar size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar leads" aria-label="Buscar leads" className="pl-9" />
          </div>

          {/* rolagem lateral contida no quadro: a página não rola de lado a 375 px */}
          <p role="status" className="sr-only">{arrastar.aviso}</p>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {colunas.map(col => {
              const colLeads = filtered.filter(l => colunaDe(l) === col.id)
              return (
                <section
                  key={col.id}
                  aria-label={col.name}
                  className={`flex w-72 shrink-0 flex-col rounded-[10px] border bg-card ${arrastar.alvo === col.id ? 'border-primary' : 'border-border'}`}
                  {...arrastar.propsColuna(col.id)}
                >
                  <h2 className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-sm font-medium text-foreground">
                    <span className="truncate">{col.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{colLeads.length}</span>
                  </h2>
                  <ul className="max-h-[500px] space-y-2 overflow-y-auto p-2">
                    {colLeads.map(l => {
                      const cartao = arrastar.propsCartao(l.id, col.id)
                      return (
                      // abrir o lead não tem dois alvos de Tab: o li (Espaço arrasta, Enter abre); o botão de abrir fica para o mouse. Excluir continua com Tab próprio
                      <li key={l.id} {...cartao} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) setSelectedId(l.id); else cartao.onKeyDown(e) }}
                        className="group relative rounded-md border border-border bg-background outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring">
                        <button type="button" tabIndex={-1} onClick={() => setSelectedId(l.id)} className="flex w-full items-start gap-2 p-3 pr-10 text-left">
                          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">{iniciais(l.full_name)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{l.full_name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{l.source}</span>
                            <span className="mt-2 flex items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground">
                              <span>{l.crm_interactions.length} {l.crm_interactions.length === 1 ? 'interação' : 'interações'}</span>
                              <span>{dinheiro(l.potential_value)}</span>
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{ultimoContato(l) ? quandoFoi(ultimoContato(l)!.created_at) : 'Sem contato'}</span>
                          </span>
                        </button>
                        <Button variant="ghost" size="icon-sm" className={`absolute right-1.5 top-1.5 ${icone}`} onClick={() => handleDeleteLead(l.id, l.full_name)} aria-label={`Excluir lead ${l.full_name}`}>
                          <I.Lixeira aria-hidden="true" />
                        </Button>
                      </li>
                      )
                    })}
                    {colLeads.length === 0 && <li className="py-8 text-center text-xs text-muted-foreground">Arraste leads para cá</li>}
                  </ul>
                </section>
              )
            })}
          </div>
        </>
      )}

      {leads.length === 0 && etapas.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Nenhum lead ainda. Use "Novo lead" para começar.</p>
      )}

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" onCloseAutoFocus={e => { e.preventDefault(); const o = origemNovoLead.current; setTimeout(() => o?.focus()) }}>
          <DialogHeader>
            <DialogTitle>{editandoId ? 'Editar lead' : 'Novo lead'}</DialogTitle>
            <DialogDescription>{editandoId ? 'Altere os dados do lead. A etapa muda no painel do lead.' : etapas[0] ? `Entra na etapa "${etapas[0].name}".` : 'Entra sem etapa até você criar as etapas do funil.'}</DialogDescription>
          </DialogHeader>
          <form id="form-lead" onSubmit={handleAddLead} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="lead-nome">Nome completo</Label>
              <Input id="lead-nome" required value={novo.name} onChange={e => setNovo({ ...novo, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="lead-email">E-mail</Label>
                <Input id="lead-email" type="email" value={novo.email} onChange={e => setNovo({ ...novo, email: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lead-telefone">Telefone</Label>
                <Input id="lead-telefone" type="tel" value={novo.phone} onChange={e => setNovo({ ...novo, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="lead-origem">Origem</Label>
                <select id="lead-origem" value={novo.source} onChange={e => setNovo({ ...novo, source: e.target.value })} className={selectNativo}>
                  {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lead-valor">Valor estimado (R$)</Label>
                <Input id="lead-valor" inputMode="decimal" aria-invalid={!!erroValor} aria-describedby={erroValor ? 'lead-valor-erro' : undefined} value={novo.value} onChange={e => setNovo({ ...novo, value: e.target.value })} />
                {erroValor && <p id="lead-valor-erro" role="alert" className="text-xs text-destructive">{erroValor}</p>}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lead-interesse">Evento de interesse</Label>
              <Input id="lead-interesse" value={novo.interest} onChange={e => setNovo({ ...novo, interest: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lead-notas">{editandoId ? 'Notas' : 'Notas iniciais'}</Label>
              <Textarea id="lead-notas" rows={3} value={novo.notes} onChange={e => setNovo({ ...novo, notes: e.target.value })} />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
            <Button type="submit" form="form-lead" disabled={isSubmittingLead}>{isSubmittingLead ? (editandoId ? 'Salvando…' : 'Adicionando…') : (editandoId ? 'Salvar alterações' : 'Adicionar lead')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selected} onOpenChange={aberto => { if (!aberto) setSelectedId(null) }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg leading-none tracking-normal">{selected.full_name}</SheetTitle>
                <SheetDescription>{selected.source} · desde {new Date(selected.created_at).toLocaleDateString('pt-BR')}</SheetDescription>
              </SheetHeader>
              <div className="grid gap-5 px-4 pb-6">
                {etapas.length > 0 && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="lead-etapa">Etapa</Label>
                    <select id="lead-etapa" value={etapas.some(e => e.id === selected.stage_id) ? selected.stage_id ?? '' : ''} onChange={e => moverLead(selected.id, e.target.value)} className={selectNativo}>
                      {!etapas.some(e => e.id === selected.stage_id) && <option value="" disabled>Sem etapa</option>}
                      {etapas.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                )}

                <dl className="grid gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><I.Email size={16} aria-hidden="true" /><dt className="sr-only">E-mail</dt><dd className="min-w-0 truncate text-foreground">{selected.email || 'Sem e-mail'}</dd></div>
                  <div className="flex items-center gap-2 text-muted-foreground"><I.Telefone size={16} aria-hidden="true" /><dt className="sr-only">Telefone</dt><dd className="text-foreground">{selected.phone || 'Sem telefone'}</dd></div>
                  <div className="flex items-center gap-2 text-muted-foreground"><I.Eventos size={16} aria-hidden="true" /><dt>Último contato:</dt><dd className="text-foreground">{ultimoContato(selected) ? quandoFoi(ultimoContato(selected)!.created_at) : 'nenhum'}</dd></div>
                  <div className="flex items-center gap-2 text-muted-foreground"><dt>Valor estimado:</dt><dd className="tabular-nums text-foreground">{dinheiro(selected.potential_value)}</dd></div>
                  {selected.event_interest && <div className="flex items-center gap-2 text-muted-foreground"><dt>Evento de interesse:</dt><dd className="min-w-0 truncate text-foreground">{selected.event_interest}</dd></div>}
                </dl>

                {selected.notes && (
                  <div className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">Notas</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{selected.notes}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                    origemNovoLead.current = document.activeElement as HTMLElement | null
                    setEditandoId(selected.id)
                    setErroValor('')
                    setNovo({ name: selected.full_name, email: selected.email ?? '', phone: selected.phone ?? '', source: selected.source ?? 'Instagram', value: selected.potential_value ? String(selected.potential_value).replace('.', ',') : '', interest: selected.event_interest ?? '', notes: selected.notes ?? '' })
                    setIsAddModalOpen(true)
                  }}>Editar</Button>
                  <Button variant="outline" size="sm" className="flex-1" disabled={!selected.email} onClick={() => { navigator.clipboard.writeText(selected.email ?? ''); toast.success('E-mail copiado.') }}>
                    <I.Copiar aria-hidden="true" />Copiar e-mail
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" disabled={!selected.phone} onClick={() => window.open(`https://wa.me/${numeroWhatsApp(selected.phone)}`, '_blank', 'noopener')}>
                    <I.Conversa aria-hidden="true" />WhatsApp
                  </Button>
                </div>

                <form onSubmit={handleAddInteraction} className="grid gap-3 rounded-md border border-border p-3">
                  <h3 className="text-sm font-medium text-foreground">Registrar contato</h3>
                  <div role="group" aria-label="Tipo de interação" className="flex flex-wrap gap-1">
                    {(Object.keys(TIPOS) as TipoInteracao[]).map(t => (
                      <Button key={t} type="button" size="sm" variant={newIntType === t ? 'secondary' : 'ghost'} aria-pressed={newIntType === t} onClick={() => setNewIntType(t)} className={newIntType === t ? '' : icone}>{TIPOS[t]}</Button>
                    ))}
                  </div>
                  <Textarea required rows={2} value={newIntContent} onChange={e => setNewIntContent(e.target.value)} aria-label="Conteúdo da interação" placeholder="O que foi conversado" />
                  <Button type="submit" size="sm" disabled={isSubmittingInt}>{isSubmittingInt ? 'Registrando…' : 'Registrar interação'}</Button>
                </form>

                <section aria-labelledby="historico">
                  <h3 id="historico" className="mb-2 text-sm font-medium text-foreground">Histórico</h3>
                  {selected.crm_interactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum contato registrado ainda.</p>
                  ) : (
                    <ol className="divide-y divide-border rounded-md border border-border">
                      {selected.crm_interactions.map(int => (
                        <li key={int.id} className="p-3">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-foreground">{TIPOS[int.type] ?? int.type}</span>
                            <span className="text-muted-foreground">{quandoFoi(int.created_at)}</span>
                          </div>
                          {int.content && <p className="mt-1 break-words text-sm text-muted-foreground">{int.content}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
