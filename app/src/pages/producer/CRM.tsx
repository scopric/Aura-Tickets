import { useState } from 'react'
import { Phone, Mail, MessageSquare, Search, Calendar, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { iniciais } from '../../hooks/useConversas'

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

const leadVazio = { name: '', email: '', phone: '', source: 'Instagram', value: '', interest: '', notes: '' }

export default function ProducerCRM() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
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
  const recarregar = () => queryClient.invalidateQueries({ queryKey })

  // Lead sem etapa (ou com etapa apagada) aparece numa coluna própria, só quando existe
  const colunaDe = (l: Lead) => (l.stage_id && etapas.some(e => e.id === l.stage_id) ? l.stage_id : SEM_ETAPA)
  const colunas = [
    ...(leads.some(l => colunaDe(l) === SEM_ETAPA) ? [{ id: SEM_ETAPA, name: 'Sem etapa' }] : []),
    ...etapas,
  ]
  const nomeEtapa = (id: string | null) => etapas.find(e => e.id === id)?.name ?? 'Sem etapa'

  const filtered = leads.filter(l => !search || l.full_name.toLowerCase().includes(search.toLowerCase()))

  // ponytail: sem score (antes era Math.random); o cartão mostra o nº de interações. Pontuação de verdade
  // (abertura de e-mail, compra) quando houver dado para isso.
  const stats = {
    total: leads.length,
    semContato: leads.filter(l => l.crm_interactions.length === 0).length,
    pipeline: leads.reduce((s, l) => s + l.potential_value, 0),
  }

  const criarEtapas = async () => {
    setCriandoEtapas(true)
    const { error } = await supabase.rpc('crm_criar_etapas_padrao' as never)
    setCriandoEtapas(false)
    if (error) { toast.error(error.code === '42501' ? 'Confirme o código do 2FA: saia e entre de novo.' : 'Não foi possível criar as etapas.'); return }
    toast.success('Etapas criadas.')
    recarregar()
  }

  // Grava interação e confere a linha devolvida (RLS que barra devolve 0 linhas sem erro: erro 11)
  const gravarInteracao = async (leadId: string, type: TipoInteracao, content: string) => {
    const { data: r, error } = await supabase.from('crm_interactions')
      .insert({ lead_id: leadId, type, content } as never) // ponytail: never do types desatualizado
      .select('id')
    if (error || !r?.length) throw error ?? new Error('Interação não gravada')
  }

  const moverLead = async (leadId: string, stageId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || stageId === SEM_ETAPA || lead.stage_id === stageId) return
    const anterior = queryClient.getQueryData(queryKey)
    queryClient.setQueryData(queryKey, { etapas, leads: leads.map(l => l.id === leadId ? { ...l, stage_id: stageId } : l) })
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

  const handleDrop = (col: string) => {
    if (draggedId) moverLead(draggedId, col)
    setDraggedId(null)
    setDragOverCol(null)
  }

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novo.name.trim() || !user?.id) { toast.error('Preencha o nome do lead'); return }
    setIsSubmittingLead(true)
    try {
      const { data: r, error } = await supabase.from('crm_leads')
        .insert({
          producer_id: user.id,
          full_name: novo.name.trim(),
          email: novo.email.trim() || null,
          phone: novo.phone.trim() || null,
          source: novo.source,
          potential_value: Number(novo.value) || 0,
          event_interest: novo.interest.trim() || null,
          notes: novo.notes.trim() || null,
          stage_id: etapas[0]?.id ?? null, // primeira etapa do produtor (uuid real)
        } as never)
        .select('id')
      if (error || !r?.length) throw error ?? new Error('Lead não gravado')
      toast.success('Lead adicionado.')
      setIsAddModalOpen(false)
      setNovo(leadVazio)
      recarregar()
    } catch {
      toast.error('Não foi possível adicionar o lead.')
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

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">CRM</h1>
          <p className="text-sm text-espresso/70 mt-1">Funil de leads e histórico de contatos</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative max-w-xs w-full flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar leads" aria-label="Buscar leads" className="w-full pl-9 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso" />
          </div>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-plum text-cream text-sm font-medium rounded-full whitespace-nowrap">
            <Plus className="w-4 h-4" /> Novo lead
          </button>
        </div>
      </div>

      {isError ? (
        <div role="alert" className="p-4 rounded-2xl bg-white/60 border border-white/60 text-sm text-espresso">
          Não foi possível carregar o CRM. <button onClick={() => refetch()} className="underline">Tentar de novo</button>
        </div>
      ) : isPending ? (
        <p className="text-sm text-espresso/70">Carregando…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Leads', value: stats.total },
              { label: 'Sem contato', value: stats.semContato },
              { label: 'Valor estimado no funil', value: dinheiro(stats.pipeline) },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 text-center">
                <div className="font-serif text-lg text-espresso">{s.value}</div>
                <div className="text-[10px] text-espresso/70 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {etapas.length === 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-white/60 border border-white/60">
              <p className="text-sm text-espresso">Seu funil ainda não tem etapas.</p>
              <p className="text-xs text-espresso/70 mt-1">Crie as etapas padrão: Novo, Contato feito, Interessado, Negociando e Fechado.</p>
              <button onClick={criarEtapas} disabled={criandoEtapas} className="mt-3 px-4 py-2 bg-plum text-cream text-sm rounded-full disabled:opacity-50">{criandoEtapas ? 'Criando…' : 'Criar etapas padrão'}</button>
            </div>
          )}

          <div className="flex gap-4 overflow-x-auto pb-4">
            {colunas.map(col => {
              const colLeads = filtered.filter(l => colunaDe(l) === col.id)
              return (
                <div
                  key={col.id}
                  className={`flex-shrink-0 w-72 rounded-2xl bg-white/30 border border-white/60 ${dragOverCol === col.id ? 'ring-2 ring-plum/30' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(col.id) }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={() => handleDrop(col.id)}
                >
                  <div className="p-3 flex items-center gap-2">
                    <span className="text-xs font-medium text-espresso">{col.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-canvas text-espresso/70">{colLeads.length}</span>
                  </div>
                  <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
                    {colLeads.map(l => (
                      <div key={l.id} draggable onDragStart={() => setDraggedId(l.id)} className="p-3 rounded-xl bg-white/60 border border-white/60 relative">
                        <button onClick={() => handleDeleteLead(l.id, l.full_name)} aria-label={`Excluir lead ${l.full_name}`} className="absolute top-2 right-2 p-1 rounded-md text-espresso/50"><Trash2 className="w-3 h-3" /></button>
                        <button onClick={() => setSelectedId(l.id)} className="flex items-center gap-2 mb-2 pr-4 text-left w-full">
                          <span aria-hidden="true" className="w-7 h-7 rounded-full bg-canvas flex items-center justify-center text-[10px]">{iniciais(l.full_name)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-medium text-espresso truncate">{l.full_name}</span>
                            <span className="block text-[9px] text-espresso/70">{l.source}</span>
                          </span>
                        </button>
                        <div className="flex items-center justify-between text-[10px] text-espresso/70">
                          <span>{l.crm_interactions.length} interações</span>
                          <span>{dinheiro(l.potential_value)}</span>
                        </div>
                        <div className="text-[9px] text-espresso/70 mt-1">{l.crm_interactions[0] ? quandoFoi(l.crm_interactions[0].created_at) : 'Sem contato'}</div>
                      </div>
                    ))}
                    {colLeads.length === 0 && <div className="py-8 text-center text-[10px] text-espresso/70">Arraste leads para cá</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setIsAddModalOpen(false)} />
          <div className="glass-panel relative w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">Novo lead</h3>
              <button onClick={() => setIsAddModalOpen(false)} aria-label="Fechar" className="p-1 rounded-lg text-espresso/70"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddLead} className="space-y-4">
              <input required value={novo.name} onChange={e => setNovo({ ...novo, name: e.target.value })} aria-label="Nome completo" placeholder="Nome completo" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso" />
              <input type="email" value={novo.email} onChange={e => setNovo({ ...novo, email: e.target.value })} aria-label="E-mail" placeholder="E-mail" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso" />
              <input value={novo.phone} onChange={e => setNovo({ ...novo, phone: e.target.value })} aria-label="Telefone" placeholder="Telefone" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso" />
              <select value={novo.source} onChange={e => setNovo({ ...novo, source: e.target.value })} aria-label="Origem do lead" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso">
                <option value="Instagram">Instagram</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Facebook">Facebook</option>
                <option value="Indicação">Indicação</option>
                <option value="Afiliado">Afiliado</option>
                <option value="Orgânico">Orgânico</option>
              </select>
              <input type="number" min="0" step="0.01" value={novo.value} onChange={e => setNovo({ ...novo, value: e.target.value })} aria-label="Valor estimado (R$)" placeholder="Valor estimado (R$)" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso" />
              <input value={novo.interest} onChange={e => setNovo({ ...novo, interest: e.target.value })} aria-label="Evento de interesse" placeholder="Evento de interesse" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso" />
              <textarea value={novo.notes} onChange={e => setNovo({ ...novo, notes: e.target.value })} rows={3} aria-label="Notas iniciais" placeholder="Notas iniciais" className="w-full px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso resize-none" />
              <button type="submit" disabled={isSubmittingLead} className="w-full py-3 bg-plum text-cream font-medium rounded-full disabled:opacity-50">{isSubmittingLead ? 'Adicionando…' : 'Adicionar lead'}</button>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setSelectedId(null)} />
          <div className="glass-panel relative w-full max-w-md h-full overflow-y-auto p-6 rounded-r-none">
            <div className="flex items-start justify-between mb-6">
              <h3 className="font-serif text-xl text-espresso">{selected.full_name}</h3>
              <button onClick={() => setSelectedId(null)} aria-label="Fechar detalhes" className="p-2 rounded-full text-espresso/70"><X className="w-4 h-4" /></button>
            </div>
            {etapas.length > 0 && (
              <select value={selected.stage_id && etapas.some(e => e.id === selected.stage_id) ? selected.stage_id : ''} onChange={e => moverLead(selected.id, e.target.value)} aria-label="Etapa do lead" className="w-full mb-4 px-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso">
                {!etapas.some(e => e.id === selected.stage_id) && <option value="" disabled>Sem etapa</option>}
                {etapas.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            )}
            <div className="space-y-2.5 mb-6 text-sm text-espresso/70">
              <div className="flex items-center gap-2"><Mail className="w-4 h-4" />{selected.email || 'Sem e-mail'}</div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4" />{selected.phone || 'Sem telefone'}</div>
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4" />Último contato: {selected.crm_interactions[0] ? quandoFoi(selected.crm_interactions[0].created_at) : 'nenhum'}</div>
              <div>Valor estimado: {dinheiro(selected.potential_value)}</div>
              {selected.notes && <p className="whitespace-pre-wrap">{selected.notes}</p>}
            </div>
            <div className="flex items-center gap-2 mb-6">
              <button type="button" disabled={!selected.email} onClick={() => { navigator.clipboard.writeText(selected.email ?? ''); toast.success('E-mail copiado.') }} className="flex-1 py-2 border rounded-full text-xs disabled:opacity-50">Copiar e-mail</button>
              <button type="button" disabled={!selected.phone} onClick={() => window.open(`https://wa.me/55${(selected.phone ?? '').replace(/\D/g, '')}`, '_blank', 'noopener')} className="flex-1 py-2 border rounded-full text-xs disabled:opacity-50">WhatsApp</button>
            </div>
            <form onSubmit={handleAddInteraction} className="space-y-3 mb-6">
              <div role="group" aria-label="Tipo de interação" className="flex flex-wrap gap-2">
                {(Object.keys(TIPOS) as TipoInteracao[]).map(t => (
                  <button key={t} type="button" aria-pressed={newIntType === t} onClick={() => setNewIntType(t)} className={`px-3 py-1 rounded-lg text-[10px] font-medium border ${newIntType === t ? 'bg-plum text-cream' : 'text-espresso/70'}`}>{TIPOS[t]}</button>
                ))}
              </div>
              <textarea required value={newIntContent} onChange={e => setNewIntContent(e.target.value)} rows={2} aria-label="Conteúdo da interação" placeholder="O que foi conversado" className="w-full px-3 py-2 border border-white/60 rounded-lg text-xs text-espresso resize-none" />
              <button type="submit" disabled={isSubmittingInt} className="w-full py-2 bg-plum text-cream text-xs font-medium rounded-full disabled:opacity-50">{isSubmittingInt ? 'Registrando…' : 'Registrar interação'}</button>
            </form>
            <div className="space-y-2">
              {selected.crm_interactions.map(int => (
                <div key={int.id} className="flex items-start gap-3 p-3 rounded-xl border border-white/20">
                  <MessageSquare aria-hidden="true" className="w-3.5 h-3.5 text-espresso/70 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-espresso">{TIPOS[int.type] ?? int.type}</span>
                      <span className="text-[9px] text-espresso/70">{quandoFoi(int.created_at)}</span>
                    </div>
                    <p className="text-xs text-espresso/70 mt-0.5 break-words">{int.content}</p>
                  </div>
                </div>
              ))}
              {selected.crm_interactions.length === 0 && <p className="text-center py-6 text-xs text-espresso/70">Nenhum contato registrado ainda.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
