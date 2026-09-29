import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Star, Bug, Lightbulb, HelpCircle, ThumbsUp, Search,
  CheckCircle2, Mail, Trash2, Eye, MessageSquare,
  Clock, X, Loader2, Inbox
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'

type FeedbackType = 'melhoria' | 'bug' | 'duvida' | 'sugestao' | 'elogio'
type FeedbackStatus = 'novo' | 'lido' | 'respondido' | 'resolvido'

// A tabela `feedback` é a fonte real (colunas `status` e `admin_notes` criadas em
// docs/sql/20260928_admin_policies.sql). A coluna `type` é texto livre no banco: quem grava é
// o botão flutuante, que só envia os 5 valores abaixo, mas o getTypeConfig protege a tela.
interface FeedbackItem {
  id: string
  type: string
  message: string
  rating: number | null
  email: string | null
  page: string | null
  status: FeedbackStatus
  createdAt: string
}

interface ContactMessage {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string | null
  message: string
  page: string | null
  createdAt: string
}

const typeConfig: Record<FeedbackType, { icon: typeof Star; label: string; color: string; bg: string }> = {
  melhoria: { icon: Lightbulb, label: 'Melhoria', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  bug: { icon: Bug, label: 'Bug', color: 'text-red-500', bg: 'bg-red-50 border-red-100' },
  duvida: { icon: HelpCircle, label: 'Dúvida', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
  sugestao: { icon: Star, label: 'Sugestão', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100' },
  elogio: { icon: ThumbsUp, label: 'Elogio', color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
}

const statusConfig: Record<FeedbackStatus, { label: string; color: string; bg: string }> = {
  novo: { label: 'Novo', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
  lido: { label: 'Lido', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  respondido: { label: 'Respondido', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100' },
  resolvido: { label: 'Resolvido', color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
}

const getStatusConfig = (status: string) =>
  (status in statusConfig ? statusConfig[status as FeedbackStatus] : statusConfig.novo)
const getTypeConfig = (type: string) =>
  (type in typeConfig ? typeConfig[type as FeedbackType] : typeConfig.sugestao)

const dataBr = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const erroDe = (e: unknown) => (e as { message?: string } | null)?.message || 'erro desconhecido'

export default function AdminFeedback() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selected, setSelected] = useState<FeedbackItem | null>(null)

  const { data, isLoading, isError, error } = useQuery<{ feedback: FeedbackItem[]; contatos: ContactMessage[]; contatosErro: string | null }>({
    queryKey: ['admin-feedback'],
    queryFn: async () => {
      const [fb, cm] = await Promise.all([
        supabase
          .from('feedback')
          .select('id, type, message, rating, email, page, status, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('contact_messages')
          .select('id, name, email, phone, subject, message, page, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
      ])

      // O erro de `feedback` é sempre falha real. O de `contact_messages` costuma ser a regra de
      // admin ainda não aplicada (docs/sql/20260929_admin_ler_contato.sql): mostrar o aviso e seguir.
      if (fb.error) throw fb.error
      if (cm.error) console.warn('[admin/feedback] contact_messages legível?', cm.error.message)

      // as linhas chegam como `never[]` enquanto o cliente do Supabase não tiver os tipos do banco
      // (pendência conhecida: `supabase gen types typescript`), por isso o cast
      const linhasFb = (fb.data || []) as { id: string; type: string; message: string; rating: number | null; email: string | null; page: string | null; status: FeedbackStatus; created_at: string }[]
      const linhasCm = (cm.data || []) as { id: string; name: string; email: string; phone: string | null; subject: string | null; message: string; page: string | null; created_at: string }[]

      return {
        feedback: linhasFb.map(f => ({
          id: f.id,
          type: f.type,
          message: f.message,
          rating: f.rating,
          email: f.email,
          page: f.page,
          status: f.status,
          createdAt: f.created_at,
        })),
        contatos: linhasCm.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          subject: c.subject,
          message: c.message,
          page: c.page,
          createdAt: c.created_at,
        })),
        contatosErro: cm.error ? cm.error.message : null,
      }
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FeedbackStatus }) => {
      // O `.select('id')` é o que faz o RLS aparecer: sem ele o UPDATE filtrado pela política
      // devolve sucesso com zero linhas e a tela mente que gravou.
      // `feedback` ainda não está nos tipos gerados do banco (pendência `supabase gen types
      // typescript`), então o payload do update é `never` até lá.
      const { data, error: e } = await supabase
        .from('feedback')
        .update({ status } as never)
        .eq('id', id)
        .select('id')
      if (e) throw e
      if (!data || data.length === 0) throw new Error('nenhuma linha foi alterada (regra de acesso ou registro inexistente)')
    },
    onSuccess: (_, { id, status }) => {
      queryClient.setQueryData<{ feedback: FeedbackItem[]; contatos: ContactMessage[] }>(['admin-feedback'], old =>
        old ? { ...old, feedback: old.feedback.map(f => f.id === id ? { ...f, status } : f) } : old
      )
      toast.success(`Status atualizado: ${statusConfig[status].label}`)
      if (selected?.id === id) setSelected({ ...selected, status })
    },
    onError: e => toast.error('Não foi possível mudar o status: ' + erroDe(e)),
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { data, error: e } = await supabase.from('feedback').delete().eq('id', id).select('id')
      if (e) throw e
      if (!data?.length) throw new Error('Nenhuma linha excluída — verifique a permissão.')
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<{ feedback: FeedbackItem[]; contatos: ContactMessage[] }>(['admin-feedback'], old =>
        old ? { ...old, feedback: old.feedback.filter(f => f.id !== id) } : old
      )
      if (selected?.id === id) setSelected(null)
      toast.success('Feedback excluído.')
    },
    onError: e => toast.error('Não foi possível excluir: ' + erroDe(e)),
  })

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { data, error: e } = await supabase.from('contact_messages').delete().eq('id', id).select('id')
      if (e) throw e
      if (!data?.length) throw new Error('Nenhuma linha excluída — verifique a permissão.')
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<{ feedback: FeedbackItem[]; contatos: ContactMessage[] }>(['admin-feedback'], old =>
        old ? { ...old, contatos: old.contatos.filter(c => c.id !== id) } : old
      )
      toast.success('Mensagem excluída.')
    },
    onError: e => toast.error('Não foi possível excluir: ' + erroDe(e)),
  })

  const items = data?.feedback ?? []
  const contatos = data?.contatos ?? []

  const filtered = items
    .filter(i => !search || i.message.toLowerCase().includes(search.toLowerCase()) || (i.email || '').toLowerCase().includes(search.toLowerCase()))
    .filter(i => filterType === 'all' || i.type === filterType)
    .filter(i => filterStatus === 'all' || i.status === filterStatus)

  const notas = items.filter(i => (i.rating || 0) > 0)
  const stats = {
    total: items.length,
    novo: items.filter(i => i.status === 'novo').length,
    bug: items.filter(i => i.type === 'bug').length,
    resolvido: items.filter(i => i.status === 'resolvido').length,
    avgRating: notas.length > 0 ? (notas.reduce((s, i) => s + (i.rating || 0), 0) / notas.length).toFixed(1) : '—',
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-espresso">Feedback</h1>
          <p className="text-sm text-espresso/70 mt-1">Sugestões, bugs e mensagens de contato recebidos pelo site</p>
        </div>
      </div>

      {isError && (
        <div role="alert" className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-sm text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300">
          Não foi possível carregar o feedback: {(error as Error)?.message || 'erro desconhecido'}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Feedback', value: stats.total.toString(), icon: MessageSquare, color: 'text-plum' },
          { label: 'Novos', value: stats.novo.toString(), icon: Clock, color: 'text-blue-600' },
          { label: 'Bugs', value: stats.bug.toString(), icon: Bug, color: 'text-red-500' },
          { label: 'Resolvidos', value: stats.resolvido.toString(), icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Nota Média', value: stats.avgRating, icon: Star, color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="p-4 rounded-2xl bg-white/60 border border-white/60 backdrop-blur-sm text-center">
            <k.icon className={`w-4 h-4 ${k.color} mx-auto mb-2`} />
            <div className={`font-serif text-xl ${k.color}`}>{k.value}</div>
            <div className="text-[10px] text-espresso/70 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Mensagens de contato */}
      <div className="mb-8 p-6 rounded-2xl bg-white/60 border border-white/60">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-medium text-espresso flex items-center gap-2">
              <Inbox className="w-4 h-4 text-plum" /> Mensagens de contato
            </h3>
            <p className="text-[10px] text-espresso/70 mt-0.5">
              Tabela <span className="font-mono">contact_messages</span> — o que chegou pelo formulário <span className="font-mono">/contato</span> e pelo rodapé.
            </p>
          </div>
          <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-espresso/10 text-espresso/70">{contatos.length}</span>
        </div>

        {data?.contatosErro && (
          <div role="alert" className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-700">
            Não foi possível ler as mensagens de contato ({data.contatosErro}). Provavelmente falta aplicar <span className="font-mono">docs/sql/20260929_admin_ler_contato.sql</span> no Supabase.
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-plum animate-spin" /></div>
        ) : contatos.length === 0 ? (
          <p className="py-8 text-center text-xs text-espresso/70 italic">
            Nenhuma mensagem de contato registrada.
          </p>
        ) : (
          <div className="space-y-3">
            {contatos.map(c => (
              <div key={c.id} className="p-4 rounded-xl bg-white/40 border border-white/60">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                  <div>
                    <span className="text-xs font-bold text-espresso">{c.name}</span>
                    <a href={`mailto:${c.email}`} className="text-[11px] text-plum hover:underline ml-2">{c.email}</a>
                    {c.phone && <span className="text-[11px] text-espresso/70 ml-2">{c.phone}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-espresso/70">{dataBr(c.createdAt)}</span>
                    <button
                      onClick={() => {
                        if (!window.confirm(`Excluir a mensagem de ${c.name}? Esta ação não pode ser desfeita.`)) return
                        deleteContact.mutate(c.id)
                      }}
                      disabled={deleteContact.isPending}
                      aria-label={`Excluir mensagem de ${c.name}`}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/70 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {c.subject && <div className="text-[11px] font-semibold text-espresso/70 mb-1">{c.subject}</div>}
                <p className="text-xs text-espresso/70 leading-relaxed whitespace-pre-line">{c.message}</p>
                {c.page && <div className="text-[10px] text-espresso/70 mt-1.5 font-mono">{c.page}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* By Type / By Rating */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4">Por Tipo</h3>
          <div className="space-y-3">
            {(Object.entries(typeConfig) as [FeedbackType, typeof typeConfig['melhoria']][]).map(([key, cfg]) => {
              const count = items.filter(i => i.type === key).length
              const max = Math.max(...Object.keys(typeConfig).map(k => items.filter(i => i.type === k).length), 1)
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-espresso/70 w-24 flex items-center gap-1.5"><cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} /> {cfg.label}</span>
                  <div className="flex-1 h-5 bg-canvas rounded-lg overflow-hidden">
                    <div className={`h-full ${cfg.bg.split(' ')[0]} rounded-lg flex items-center px-2 transition-all`} style={{ width: `${(count / max) * 100}%` }}>
                      <span className="text-[10px] font-medium text-espresso/70">{count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white/60 border border-white/60">
          <h3 className="text-sm font-medium text-espresso mb-4">Por Nota</h3>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map(n => {
              const count = notas.filter(i => i.rating === n).length
              const max = Math.max(...[5, 4, 3, 2, 1].map(k => notas.filter(i => i.rating === k).length), 1)
              return (
                <div key={n} className="flex items-center gap-3">
                  <span className="text-xs text-espresso/70 w-24 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> {n} {n === 1 ? 'estrela' : 'estrelas'}
                  </span>
                  <div className="flex-1 h-5 bg-canvas rounded-lg overflow-hidden">
                    <div className="h-full bg-amber-400/70 rounded-lg flex items-center px-2 transition-all" style={{ width: `${(count / max) * 100}%` }}>
                      <span className="text-[10px] font-medium text-espresso/70">{count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {notas.length === 0 && <p className="text-[10px] text-espresso/70 italic pt-1">Ninguém avaliou ainda.</p>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-espresso/20" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por mensagem ou e-mail..." aria-label="Buscar feedback" className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-xl text-sm text-espresso placeholder:text-espresso/70 focus:outline-none focus:border-plum/30" />
        </div>
        <div className="flex items-center gap-2">
          <select value={filterType} aria-label="Filtrar por tipo" onChange={e => setFilterType(e.target.value)} className="px-3 py-2 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso/70 focus:outline-none">
            <option value="all">Todos tipos</option>
            {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} aria-label="Filtrar por status" onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 bg-white/60 border border-white/60 rounded-xl text-xs text-espresso/70 focus:outline-none">
            <option value="all">Todos status</option>
            {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="bg-white/60 border border-white/60 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-espresso/5">
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/70 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/70 uppercase">Mensagem</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/70 uppercase hidden md:table-cell">Contato</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/70 uppercase hidden lg:table-cell">Página</th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-espresso/70 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-espresso/70 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center"><Loader2 className="w-6 h-6 text-plum animate-spin mx-auto" /></td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-xs text-espresso/70 italic">
                    {items.length === 0
                      ? 'Nenhum feedback recebido ainda.'
                      : 'Nenhum feedback encontrado para os filtros selecionados.'}
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const tc = getTypeConfig(item.type)
                  const sc = getStatusConfig(item.status)
                  const TIcon = tc.icon
                  return (
                    <tr key={item.id} className="border-b border-espresso/5 last:border-0 hover:bg-white/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${tc.bg} ${tc.color}`}>
                          <TIcon className="w-3 h-3" /> {tc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-espresso line-clamp-2 max-w-xs">{item.message}</div>
                        {item.rating ? (
                          <div className="flex items-center gap-0.5 mt-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < item.rating! ? 'text-amber-400 fill-amber-400' : 'text-espresso/50'}`} />
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-xs text-espresso font-medium">{item.email || 'Anônimo'}</div>
                        <div className="text-[10px] text-espresso/70">{dataBr(item.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-[10px] text-espresso/70 bg-canvas px-2 py-0.5 rounded-md font-mono">{item.page || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${sc.bg} ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setSelected(item)} aria-label="Visualizar feedback" className="p-1.5 rounded-lg hover:bg-canvas text-espresso/70 hover:text-espresso transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                          <button
                            onClick={() => {
                              if (!window.confirm('Excluir este feedback? Esta ação não pode ser desfeita.')) return
                              deleteItem.mutate(item.id)
                            }}
                            disabled={deleteItem.isPending}
                            aria-label="Excluir feedback"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-espresso/70 hover:text-red-500 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setSelected(null)} />
          <div className="glass-panel relative w-full max-w-md h-full overflow-y-auto rounded-r-none border-y-0 border-r-0">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                {(() => {
                  const tc = getTypeConfig(selected.type)
                  const I = tc.icon
                  return (
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.bg}`}>
                        <I className={`w-5 h-5 ${tc.color}`} />
                      </div>
                      <div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${tc.bg} ${tc.color}`}>{tc.label}</span>
                        <p className="text-[10px] text-espresso/70 mt-0.5">{dataBr(selected.createdAt)}</p>
                      </div>
                    </div>
                  )
                })()}
                <button onClick={() => setSelected(null)} aria-label="Fechar modal" className="p-2 rounded-full bg-canvas text-espresso/70 hover:text-espresso transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="mb-6">
                <h4 className="text-xs font-medium text-espresso/70 uppercase tracking-wider mb-2">Mensagem</h4>
                <p className="text-sm text-espresso/70 leading-relaxed p-4 bg-white/60 border border-white/60 rounded-xl whitespace-pre-line">{selected.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 bg-white/60 border border-white/60 rounded-xl">
                  <div className="text-[10px] text-espresso/70 mb-0.5">Contato</div>
                  <div className="text-xs text-espresso font-medium break-all">{selected.email || 'Anônimo'}</div>
                </div>
                <div className="p-3 bg-white/60 border border-white/60 rounded-xl">
                  <div className="text-[10px] text-espresso/70 mb-0.5">Origem</div>
                  <div className="text-xs text-espresso font-medium font-mono break-all">{selected.page || '—'}</div>
                </div>
              </div>

              {selected.rating ? (
                <div className="mb-6 p-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                  <div className="text-[10px] text-amber-600/60 mb-1">Avaliação</div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < selected.rating! ? 'text-amber-400 fill-amber-400' : 'text-amber-200'}`} />
                    ))}
                    <span className="text-xs text-amber-600 ml-2">{selected.rating}/5</span>
                  </div>
                </div>
              ) : null}

              <div className="mb-6">
                <h4 className="text-xs font-medium text-espresso/70 uppercase tracking-wider mb-2">Alterar Status</h4>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(statusConfig) as [FeedbackStatus, typeof statusConfig['novo']][]).map(([key, cfg]) => {
                    const busy = updateStatus.isPending && updateStatus.variables?.status === key
                    return (
                      <button
                        key={key}
                        onClick={() => updateStatus.mutate({ id: selected.id, status: key })}
                        disabled={updateStatus.isPending}
                        className={`px-2 py-2 rounded-xl text-[10px] font-medium border transition-all disabled:opacity-40 ${selected.status === key ? cfg.bg + ' ' + cfg.color : 'bg-white/40 border-white/60 text-espresso/70 hover:text-espresso'}`}
                      >
                        <span className="flex items-center justify-center gap-1">
                          {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                          {cfg.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                disabled={!selected.email}
                onClick={() => { navigator.clipboard.writeText(selected.email!); toast.success('E-mail copiado!') }}
                className="w-full py-2.5 bg-plum text-cream text-xs font-medium rounded-full hover:shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="w-3.5 h-3.5" /> Responder por E-mail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
