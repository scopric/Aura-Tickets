import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState, PageHeader, SectionTitle, Stat, selectNativo, chipAviso, chipErro, chipInfo, chipNeutro, chipOk } from '@/components/producer/ui'
import { Tabela, alertaAviso, alertaErro, painel, th } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
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

// chip = cor do significado (bug é erro, melhoria é aviso...); o rótulo sempre vai escrito junto
const typeConfig: Record<FeedbackType, { icon: I.IconeEvokaa; label: string; chip: string }> = {
  melhoria: { icon: I.Ideia, label: 'Melhoria', chip: chipAviso },
  bug: { icon: I.Bug, label: 'Bug', chip: chipErro },
  duvida: { icon: I.Ajuda, label: 'Dúvida', chip: chipInfo },
  sugestao: { icon: I.Estrela, label: 'Sugestão', chip: chipNeutro },
  elogio: { icon: I.Curtir, label: 'Elogio', chip: chipOk },
}

const statusConfig: Record<FeedbackStatus, { label: string; chip: string }> = {
  novo: { label: 'Novo', chip: chipInfo },
  lido: { label: 'Lido', chip: chipAviso },
  respondido: { label: 'Respondido', chip: chipNeutro },
  resolvido: { label: 'Resolvido', chip: chipOk },
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

  const { data, isLoading, isError, error } = useQuery<{ feedback: FeedbackItem[]; contatos: ContactMessage[]; contatosErro: string | null; feedbackErro: string | null }>({
    queryKey: ['admin-feedback'],
    queryFn: async () => {
      const [fb, cm] = await Promise.all([
        supabase
          .from('feedback')
          .select('id, type, message, rating, page, status, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('contact_messages')
          .select('id, name, email, phone, subject, message, page, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
      ])

      // Nenhum dos dois erros derruba a tela: o outro bloco continua carregando e cada erro vira aviso.
      // O de `contact_messages` costuma ser a regra de admin ainda não aplicada (docs/sql/20260929_admin_ler_contato.sql).
      if (cm.error) console.warn('[admin/feedback] contact_messages legível?', cm.error.message)

      // as linhas chegam como `never[]` enquanto o cliente do Supabase não tiver os tipos do banco
      // (pendência conhecida: `supabase gen types typescript`), por isso o cast
      const linhasFb = (fb.data || []) as { id: string; type: string; message: string; rating: number | null; page: string | null; status: FeedbackStatus; created_at: string }[]
      const linhasCm = (cm.data || []) as { id: string; name: string; email: string; phone: string | null; subject: string | null; message: string; page: string | null; created_at: string }[]

      return {
        feedback: linhasFb.map(f => ({
          id: f.id,
          type: f.type,
          message: f.message,
          rating: f.rating,
          email: null,
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
        feedbackErro: fb.error ? fb.error.message : null,
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
  const indisponivel = !!data?.feedbackErro
  const stats = {
    total: items.length,
    novo: items.filter(i => i.status === 'novo').length,
    bug: items.filter(i => i.type === 'bug').length,
    resolvido: items.filter(i => i.status === 'resolvido').length,
    avgRating: notas.length > 0 ? (notas.reduce((s, i) => s + (i.rating || 0), 0) / notas.length).toFixed(1) : '—',
  }

  // Barra de distribuição: uma cor só (azul), o número fica ao lado, em tabular
  const barra = (key: string | number, rotulo: React.ReactNode, count: number, max: number) => (
    <div key={key} className="flex items-center gap-3">
      <span className="flex w-28 items-center gap-1.5 text-xs text-muted-foreground">{rotulo}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(count / max) * 100}%` }} />
      </div>
      <span className="w-6 text-right text-xs font-medium tabular-nums text-foreground">{count}</span>
    </div>
  )

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <PageHeader title="Feedback" description="Sugestões, bugs e mensagens de contato recebidos pelo site" />

      {(isError || data?.feedbackErro) && (
        <div role="alert" className={cn(alertaErro, 'mb-6')}>
          Não foi possível carregar o feedback: {(error as Error)?.message || data?.feedbackErro || 'erro desconhecido'}
        </div>
      )}

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Feedback" value={indisponivel ? '—' : stats.total.toString()} />
        <Stat label="Novos" value={indisponivel ? '—' : stats.novo.toString()} />
        <Stat label="Bugs" value={indisponivel ? '—' : stats.bug.toString()} />
        <Stat label="Resolvidos" value={indisponivel ? '—' : stats.resolvido.toString()} />
        <Stat label="Nota Média" value={indisponivel ? '—' : stats.avgRating} />
      </div>

      {/* Mensagens de contato */}
      <section aria-labelledby="contato-titulo" className={`${painel} mb-8 p-6`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <SectionTitle id="contato-titulo">Mensagens de contato</SectionTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tabela <span className="font-mono">contact_messages</span> — o que chegou pelo formulário <span className="font-mono">/contato</span> e pelo rodapé.
            </p>
          </div>
          <Badge variant="secondary" className={cn(chipNeutro, 'shrink-0 tabular-nums')}>{contatos.length}</Badge>
        </div>

        {data?.contatosErro && (
          <div role="alert" className={cn(alertaAviso, 'mb-4')}>
            <I.Alerta size={16} className="text-[var(--ev-warning)]" aria-hidden="true" />
            <span>Não foi possível ler as mensagens de contato ({data.contatosErro}). Provavelmente falta aplicar <span className="font-mono">docs/sql/20260929_admin_ler_contato.sql</span> no Supabase.</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner className="size-6 text-primary" /></div>
        ) : contatos.length === 0 ? (
          <EmptyState title="Nenhuma mensagem de contato registrada." />
        ) : (
          <ul className="divide-y divide-border">
            {contatos.map(c => (
              <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-semibold text-foreground">{c.name}</span>
                    <a href={`mailto:${c.email}`} className="text-xs text-primary hover:underline">{c.email}</a>
                    {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{dataBr(c.createdAt)}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (!window.confirm(`Excluir a mensagem de ${c.name}? Esta ação não pode ser desfeita.`)) return
                        deleteContact.mutate(c.id)
                      }}
                      disabled={deleteContact.isPending}
                      aria-label={`Excluir mensagem de ${c.name}`}
                      className="hover:text-destructive"
                    >
                      <I.Lixeira />
                    </Button>
                  </div>
                </div>
                {c.subject && <div className="mb-1 text-xs font-semibold text-foreground">{c.subject}</div>}
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{c.message}</p>
                {c.page && <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">{c.page}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* By Type / By Rating */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-labelledby="por-tipo-titulo" className={`${painel} p-6`}>
          <div className="mb-4"><SectionTitle id="por-tipo-titulo">Por Tipo</SectionTitle></div>
          <div className="space-y-3">
            {(Object.entries(typeConfig) as [FeedbackType, typeof typeConfig['melhoria']][]).map(([key, cfg]) => {
              const count = items.filter(i => i.type === key).length
              const max = Math.max(...Object.keys(typeConfig).map(k => items.filter(i => i.type === k).length), 1)
              return barra(key, <><cfg.icon size={14} aria-hidden="true" /> {cfg.label}</>, count, max)
            })}
          </div>
        </section>

        <section aria-labelledby="por-nota-titulo" className={`${painel} p-6`}>
          <div className="mb-4"><SectionTitle id="por-nota-titulo">Por Nota</SectionTitle></div>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map(n => {
              const count = notas.filter(i => i.rating === n).length
              const max = Math.max(...[5, 4, 3, 2, 1].map(k => notas.filter(i => i.rating === k).length), 1)
              return barra(n, <><I.Estrela size={14} ativo aria-hidden="true" /> {n} {n === 1 ? 'estrela' : 'estrelas'}</>, count, max)
            })}
            {notas.length === 0 && !indisponivel && <p className="pt-1 text-xs text-muted-foreground">Ninguém avaliou ainda.</p>}
          </div>
        </section>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <I.Buscar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por mensagem..." aria-label="Buscar feedback" className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <select value={filterType} aria-label="Filtrar por tipo" onChange={e => setFilterType(e.target.value)} className={cn(selectNativo, 'sm:w-auto')}>
            <option value="all">Todos tipos</option>
            {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} aria-label="Filtrar por status" onChange={e => setFilterStatus(e.target.value)} className={cn(selectNativo, 'sm:w-auto')}>
            <option value="all">Todos status</option>
            {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="size-6 text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={indisponivel ? 'Feedback indisponível (erro acima).' : items.length === 0 ? 'Nenhum feedback recebido ainda.' : 'Nenhum feedback encontrado para os filtros selecionados.'}
        />
      ) : (
        <div className={`${painel} overflow-hidden`}>
          <Tabela label="Lista de feedback">
            <thead>
              <tr className="border-b border-border">
                <th className={th}>Tipo</th>
                <th className={th}>Mensagem</th>
                <th className={cn(th, 'hidden md:table-cell')}>Contato</th>
                <th className={cn(th, 'hidden lg:table-cell')}>Página</th>
                <th className={th}>Status</th>
                <th className={th}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const tc = getTypeConfig(item.type)
                const sc = getStatusConfig(item.status)
                const TIcon = tc.icon
                return (
                  <tr key={item.id} className="border-b border-border last:border-0 hover:bg-[var(--ev-tint-hover)]">
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={tc.chip}><TIcon aria-hidden="true" /> {tc.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="line-clamp-2 max-w-xs text-[13px] text-foreground">{item.message}</div>
                      {item.rating ? (
                        <div className="mt-1 flex items-center gap-0.5 text-foreground">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <I.Estrela key={i} size={12} ativo={i < item.rating!} aria-hidden="true" className={i < item.rating! ? undefined : 'text-muted-foreground'} />
                          ))}
                          <span className="sr-only">Nota {item.rating} de 5</span>
                        </div>
                      ) : null}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="text-xs font-medium text-foreground">{item.email || 'Anônimo'}</div>
                      <div className="text-xs tabular-nums text-muted-foreground">{dataBr(item.createdAt)}</div>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className="rounded-ev-xs bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{item.page || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={sc.chip}>{sc.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setSelected(item)} aria-label="Visualizar feedback"><I.Olho /></Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            if (!window.confirm('Excluir este feedback? Esta ação não pode ser desfeita.')) return
                            deleteItem.mutate(item.id)
                          }}
                          disabled={deleteItem.isPending}
                          aria-label="Excluir feedback"
                          className="hover:text-destructive"
                        >
                          <I.Lixeira />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 glass-backdrop" onClick={() => setSelected(null)} />
          <div className="glass-panel relative w-full max-w-md h-full overflow-y-auto rounded-r-none border-y-0 border-r-0">
            <div className="p-6">
              <div className="mb-6 flex items-start justify-between">
                {(() => {
                  const tc = getTypeConfig(selected.type)
                  return (
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant="secondary" className={tc.chip}><tc.icon aria-hidden="true" /> {tc.label}</Badge>
                      <p className="text-xs tabular-nums text-muted-foreground">{dataBr(selected.createdAt)}</p>
                    </div>
                  )
                })()}
                <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Fechar modal"><I.Fechar /></Button>
              </div>

              <div className="mb-6">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Mensagem</h4>
                <p className="whitespace-pre-line rounded-[10px] border border-border bg-secondary p-4 text-sm leading-relaxed text-foreground">{selected.message}</p>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3">
                <div className="rounded-[10px] border border-border bg-secondary p-3">
                  <div className="mb-0.5 text-xs text-muted-foreground">Contato</div>
                  <div className="break-all text-xs font-medium text-foreground">{selected.email || 'Anônimo'}</div>
                </div>
                <div className="rounded-[10px] border border-border bg-secondary p-3">
                  <div className="mb-0.5 text-xs text-muted-foreground">Origem</div>
                  <div className="break-all font-mono text-xs font-medium text-foreground">{selected.page || '—'}</div>
                </div>
              </div>

              {selected.rating ? (
                <div className="mb-6 rounded-[10px] border border-border bg-secondary p-3">
                  <div className="mb-1 text-xs text-muted-foreground">Avaliação</div>
                  <div className="flex items-center gap-0.5 text-foreground">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <I.Estrela key={i} size={16} ativo={i < selected.rating!} aria-hidden="true" className={i < selected.rating! ? undefined : 'text-muted-foreground'} />
                    ))}
                    <span className="ml-2 text-xs tabular-nums text-foreground">{selected.rating}/5</span>
                  </div>
                </div>
              ) : null}

              <div className="mb-6">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Alterar Status</h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.entries(statusConfig) as [FeedbackStatus, typeof statusConfig['novo']][]).map(([key, cfg]) => {
                    const busy = updateStatus.isPending && updateStatus.variables?.status === key
                    return (
                      <Button
                        key={key}
                        size="sm"
                        variant={selected.status === key ? 'default' : 'outline'}
                        aria-pressed={selected.status === key}
                        onClick={() => updateStatus.mutate({ id: selected.id, status: key })}
                        disabled={updateStatus.isPending && !busy}
                        loading={busy}
                      >
                        {cfg.label}
                      </Button>
                    )
                  })}
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!selected.email}
                onClick={() => { navigator.clipboard.writeText(selected.email!); toast.success('E-mail copiado!') }}
              >
                <I.Email /> Responder por E-mail
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
