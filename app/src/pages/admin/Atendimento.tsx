import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertTriangle, ArrowLeft, Bot, CheckCircle2, ChevronDown, Inbox, Info, Loader2, MessageSquare, RotateCcw, Scale, Search, User, UserCheck, UserX, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { atualizarConversa, depois, iniciais, marcarLida, mensagemDeErro, quando } from '../../hooks/useConversas'
import ChatThread, { BotaoSom } from '../../components/chat/ChatThread'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu'

// Caixa de entrada do atendimento (etapa 1a do chat estilo Intercom), em 3 colunas:
// lista (chat_inbox, com filtros em menu e busca) · conversa (ChatThread com nota interna) · contato e ações.
// Tudo passa pelo RLS e pelas funções chat_* do banco; nada é gravado direto nas tabelas.

// Abertas, Minhas, Sem dono e Urgentes são só as conversas com a equipe; "Com o assistente" são as
// abertas que o assistente ainda atende (20261003_chat_bot.sql)
type Filtro = 'abertas' | 'minhas' | 'sem_dono' | 'urgentes' | 'mediacao' | 'assistente' | 'resolvidas'
const FILTROS: { id: Filtro; rotulo: string; icone: typeof Inbox }[] = [
  { id: 'abertas', rotulo: 'Abertas', icone: Inbox },
  { id: 'minhas', rotulo: 'Minhas', icone: User },
  { id: 'sem_dono', rotulo: 'Sem dono', icone: UserX },
  { id: 'urgentes', rotulo: 'Urgentes', icone: AlertTriangle },
  { id: 'mediacao', rotulo: 'Mediação', icone: Scale },
  { id: 'assistente', rotulo: 'Com o assistente', icone: Bot },
  { id: 'resolvidas', rotulo: 'Resolvidas', icone: CheckCircle2 },
]

interface LinhaInbox {
  id: string
  user_id: string | null
  status: 'open' | 'resolved'
  priority: 'normal' | 'urgent'
  assignee_id: string | null
  department_name: string | null
  topic_label: string | null
  mediation: boolean
  contact_name: string | null
  last_message_at: string
  last_message_preview: string | null
  last_customer_message_at: string | null
  last_reply_at: string | null
  nao_lida: boolean
  bot_state: 'bot' | 'humano'
}

interface ConversaAdmin {
  id: string
  user_id: string | null
  status: 'open' | 'resolved'
  priority: 'normal' | 'urgent'
  assignee_id: string | null
  assignee_name: string | null
  department_id: string | null
  customer_last_read_at: string | null
  agent_last_read_at: string | null
  last_customer_message_at: string | null
  created_at: string
  rating: number | null
  bot_state: 'bot' | 'humano'
  chat_topics: { label: string; mediation: boolean } | null
  chat_contacts: { name: string; email: string | null; phone: string | null; origin: string; marketing_opt_in: boolean } | null
}

interface Extra {
  anteriores: { id: string; status: string; created_at: string; last_message_preview: string | null; chat_topics: { label: string } | null }[]
  ingressos: { id: string; status: string; created_at: string; ticket_types: { name: string; events: { title: string } | null } | null }[]
  pedidos: { id: string; total: number; status: string; created_at: string; events: { title: string } | null }[]
  papel: string | null
  plano: { plan: string; is_active: boolean; expires_at: string | null } | null
}

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
const selectCls = `w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground disabled:opacity-50 ${foco}`
const ORIGEM: Record<string, string> = { site: 'Site', app: 'App', migracao: 'Chat antigo' }
const ROTULO_NOTA = ['', '😞 Ruim', '😐 Regular', '😊 Ótimo']
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
const primeiroNome = (a?: { full_name: string | null; email: string }) => (a ? (a.full_name?.trim().split(/\s+/)[0] || a.email) : undefined)
const telefone = (d: string | null) => (d && /^55\d{10,11}$/.test(d) ? `+55 (${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}` : d ?? '—')

function useInbox(filtro: Filtro, busca: string) {
  return useQuery<LinhaInbox[]>({
    queryKey: ['chat-inbox', filtro, busca],
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc('chat_inbox' as never, { p_filtro: filtro, p_busca: busca, p_limite: 100 } as never)
      if (error) throw error
      return (d ?? []) as unknown as LinhaInbox[]
    },
  })
}

function useConversaAdmin(id: string | null) {
  return useQuery<ConversaAdmin | null>({
    queryKey: ['chat-conversa', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: d, error } = await supabase
        .from('conversations' as never)
        .select('id, user_id, status, priority, assignee_id, assignee_name, department_id, customer_last_read_at, agent_last_read_at, last_customer_message_at, created_at, rating, bot_state, chat_topics(label, mediation), chat_contacts(name, email, phone, origin, marketing_opt_in)')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return d as unknown as ConversaAdmin | null
    },
  })
}

/** Histórico da mesma CONTA (nunca pelo e-mail digitado): conversas anteriores, ingressos, pedidos e plano. */
function useExtra(userId: string | null, conversaId: string | null) {
  return useQuery<Extra>({
    queryKey: ['chat-extra', userId, conversaId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = userId!
      const [anteriores, ingressos, pedidos, perfil, plano] = await Promise.all([
        supabase.from('conversations' as never).select('id, status, created_at, last_message_preview, chat_topics(label)').eq('user_id', uid).neq('id', conversaId!).order('created_at', { ascending: false }).limit(8),
        supabase.from('tickets').select('id, status, created_at, ticket_types(name, events(title))').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select('id, total, status, created_at, events(title)').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
        supabase.from('profiles').select('role').eq('id', uid).maybeSingle(),
        supabase.from('producer_subscriptions').select('plan, is_active, expires_at').eq('producer_id', uid).maybeSingle(),
      ])
      const erro = anteriores.error || ingressos.error || pedidos.error || perfil.error || plano.error
      if (erro) throw erro
      return {
        anteriores: (anteriores.data ?? []) as unknown as Extra['anteriores'],
        ingressos: (ingressos.data ?? []) as unknown as Extra['ingressos'],
        pedidos: (pedidos.data ?? []) as unknown as Extra['pedidos'],
        papel: (perfil.data as { role?: string } | null)?.role ?? null,
        plano: plano.data as unknown as Extra['plano'],
      }
    },
  })
}

function useOpcoes() {
  const setores = useQuery({
    queryKey: ['chat-setores'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data: d, error } = await supabase.from('chat_departments' as never).select('id, name').order('position')
      if (error) throw error
      return (d ?? []) as unknown as { id: string; name: string }[]
    },
  })
  const atendentes = useQuery({
    queryKey: ['chat-atendentes'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      // mesma regra do chat_update: admin com manage_support ou super_admin
      const { data: d, error } = await supabase
        .from('profiles' as never)
        .select('id, full_name, email')
        .eq('role', 'admin')
        .overlaps('admin_permissions', ['super_admin', 'manage_support'])
        .order('full_name')
      if (error) throw error
      return (d ?? []) as unknown as { id: string; full_name: string | null; email: string }[]
    },
  })
  return { setores: setores.data ?? [], atendentes: atendentes.data ?? [], erroAtendentes: atendentes.error }
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  )
}

export default function Atendimento() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [filtro, setFiltro] = useState<Filtro>('abertas')
  const [textoBusca, setTextoBusca] = useState('')
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [detalhes, setDetalhes] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const botaoDetalhes = useRef<HTMLButtonElement>(null)
  const botaoFechar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // a partir de 2 caracteres (1 letra casaria quase tudo e a busca no texto é cara)
    const t = setTimeout(() => setBusca(textoBusca.trim().length >= 2 ? textoBusca.trim() : ''), 300)
    return () => clearTimeout(t)
  }, [textoBusca])

  // Um canal só, criado ao montar (não recria ao trocar de conversa): INSERT/UPDATE de conversas e
  // INSERT de mensagens. O Realtime respeita o RLS; aqui só se invalida o cache.
  useEffect(() => {
    // o som fica no AdminLayout (toca em qualquer página do alpha); aqui só se renova o cache
    const aoMudarConversa = ({ new: c }: { new: { id?: string } }) => {
      qc.invalidateQueries({ queryKey: ['chat-inbox'] })
      if (c.id) {
        qc.invalidateQueries({ queryKey: ['chat-conversa', c.id] })
        qc.invalidateQueries({ queryKey: ['chat-mensagens', c.id] })
      }
    }
    const canal = supabase
      .channel(`atendimento-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, aoMudarConversa)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, aoMudarConversa)
      .on<{ conversation_id: string }>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages' }, ({ new: m }) => {
        qc.invalidateQueries({ queryKey: ['chat-mensagens', m.conversation_id] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [qc])

  const inbox = useInbox(filtro, busca)
  const conversa = useConversaAdmin(sel)
  const c = conversa.data
  const extra = useExtra(c?.user_id ?? null, sel)
  const { setores, atendentes, erroAtendentes } = useOpcoes()
  const atual = FILTROS.find((f) => f.id === filtro)!
  const naoLida = !!c && depois(c.last_customer_message_at, c.agent_last_read_at)

  useEffect(() => {
    if (!sel || !naoLida) return
    marcarLida(sel).then(() => {
      qc.invalidateQueries({ queryKey: ['chat-conversa', sel] })
      qc.invalidateQueries({ queryKey: ['chat-inbox'] })
    }, () => {})
  }, [sel, naoLida, qc])

  const mudar = async (patch: Record<string, string | null>, sucesso?: string) => {
    if (!sel) return
    setSalvando(true)
    try {
      await atualizarConversa(sel, patch)
      if (sucesso) toast.success(sucesso)
      qc.invalidateQueries({ queryKey: ['chat-conversa', sel] })
      qc.invalidateQueries({ queryKey: ['chat-inbox'] })
    } catch (e) {
      toast.error(mensagemDeErro(e))
    } finally {
      setSalvando(false)
    }
  }

  const fecharDetalhes = () => {
    setDetalhes(false)
    botaoDetalhes.current?.focus()
  }

  // Abaixo de xl o painel cobre a conversa: Esc fecha e devolve o foco ao botão Detalhes
  useEffect(() => {
    if (!detalhes) return
    botaoFechar.current?.focus()
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        setDetalhes(false)
        botaoDetalhes.current?.focus()
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [detalhes])

  const abrir = (id: string) => {
    setSel(id)
    setDetalhes(false)
  }

  return (
    <div className="relative flex h-[calc(100dvh-4rem)] overflow-hidden border-t border-border bg-background text-foreground">
      {/* 1. Lista: título, som, filtros (menu) e busca */}
      <div className={`${sel ? 'hidden lg:flex' : 'flex'} w-full shrink-0 flex-col border-r border-border lg:w-80`}>
        <div className="space-y-2 border-b border-border p-3">
          <div className="flex items-center gap-1 px-1">
            <h1 className="flex items-center gap-2 text-base font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" /> Atendimento
            </h1>
            <BotaoSom className="ml-auto text-muted-foreground hover:bg-muted hover:text-foreground" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className={`flex w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-sm font-medium ${foco}`} aria-label={`Filtro: ${atual.rotulo}`}>
              <atual.icone className="h-4 w-4 shrink-0" aria-hidden="true" /> {atual.rotulo}
              <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuRadioGroup value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
                {FILTROS.map((f) => (
                  <DropdownMenuRadioItem key={f.id} value={f.id}>
                    <f.icone className="h-4 w-4 shrink-0" aria-hidden="true" /> {f.rotulo}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <label htmlFor="atendimento-busca" className="sr-only">Buscar por nome, e-mail, telefone ou texto</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="atendimento-busca"
              type="search"
              value={textoBusca}
              onChange={(e) => setTextoBusca(e.target.value)}
              placeholder="Nome, e-mail, telefone ou texto"
              className={`w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm ${foco}`}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={inbox.isFetching}>
          {inbox.isLoading ? (
            <div className="space-y-2 p-3" aria-label="Carregando conversas">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : inbox.isError ? (
            <div role="alert" className="p-4 text-sm text-muted-foreground">
              Não foi possível carregar as conversas: {mensagemDeErro(inbox.error)}{' '}
              <button type="button" onClick={() => inbox.refetch()} className={`font-semibold text-foreground underline ${foco}`}>Tentar de novo</button>
            </div>
          ) : !inbox.data?.length ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-50" aria-hidden="true" />
              {busca ? 'Nenhuma conversa encontrada para essa busca.' : 'Nenhuma conversa neste filtro.'}
            </div>
          ) : (
            <>
            {inbox.data.length >= 100 && (
              <p role="status" className="border-b border-border px-3 py-2 text-xs text-muted-foreground">Mostrando as 100 mais recentes. Use a busca para achar as outras.</p>
            )}
            <ul className="divide-y divide-border">
              {inbox.data.map((l) => {
                const aguardando = l.status === 'open' && depois(l.last_customer_message_at, l.last_reply_at)
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => abrir(l.id)}
                      aria-current={sel === l.id ? 'true' : undefined}
                      className={`flex w-full gap-3 px-3 py-3 text-left ${foco} ${sel === l.id ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">{iniciais(l.contact_name ?? '?')}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`truncate text-sm ${l.nao_lida ? 'font-bold' : 'font-medium'}`}>{l.contact_name ?? 'Sem nome'}</span>
                          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                            {aguardando && l.last_customer_message_at ? `aguarda ${quando(l.last_customer_message_at)}` : quando(l.last_message_at)}
                          </span>
                        </span>
                        <span className={`block truncate text-xs ${l.nao_lida ? 'text-foreground' : 'text-muted-foreground'}`}>{l.last_message_preview ?? ''}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          {l.nao_lida && <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">Não lida</span>}
                          {l.priority === 'urgent' && <span className="rounded-full bg-red-600/10 px-1.5 py-px text-[10px] font-semibold text-red-700 dark:text-red-300">Urgente</span>}
                          {l.mediation && <span className="rounded-full bg-amber-500/15 px-1.5 py-px text-[10px] font-semibold text-amber-800 dark:text-amber-200">Mediação</span>}
                          {l.bot_state === 'bot' && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/15 px-1.5 py-px text-[10px] font-semibold text-sky-800 dark:text-sky-200">
                              <Bot className="h-3 w-3" aria-hidden="true" />{l.status === 'resolved' ? 'Resolvida pelo assistente' : 'Assistente'}
                            </span>
                          )}
                          {l.department_name && <span className="rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground">{l.department_name}</span>}
                          {!l.assignee_id && l.status === 'open' && l.bot_state === 'humano' && <span className="rounded-full border border-border px-1.5 py-px text-[10px] text-muted-foreground">Sem dono</span>}
                          {l.assignee_id && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-px text-[10px] text-foreground">
                              <UserCheck className="h-3 w-3" aria-hidden="true" />{l.assignee_id === user?.id ? 'Você' : primeiroNome(atendentes.find((a) => a.id === l.assignee_id)) ?? 'Com dono'}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            </>
          )}
        </div>
      </div>

      {/* 2. Conversa */}
      <div className={`${sel ? 'flex' : 'hidden lg:flex'} relative min-w-0 flex-1 flex-col`}>
        {!sel ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <MessageSquare className="h-7 w-7" aria-hidden="true" />
            </span>
            <p className="text-base font-semibold">Escolha uma conversa</p>
            <p className="max-w-xs text-sm text-muted-foreground">As novas chegam em tempo real. Notas internas ficam em amarelo e o cliente não vê.</p>
          </div>
        ) : conversa.isLoading ? (
          <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Carregando conversa" /></div>
        ) : !c ? (
          <div role="alert" className="p-6 text-sm text-muted-foreground">
            {conversa.isError ? `Não foi possível abrir a conversa: ${mensagemDeErro(conversa.error)}` : 'Conversa não encontrada ou sem acesso.'}
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <button type="button" onClick={() => setSel(null)} aria-label="Voltar para a lista" className={`rounded-lg p-1.5 hover:bg-muted lg:hidden ${foco}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold">{c.chat_contacts?.name ?? 'Sem nome'}</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {c.chat_topics?.label ?? 'Sem assunto'} · {c.status === 'open' ? 'Aberta' : 'Resolvida'}
                  {c.bot_state === 'bot' ? (c.status === 'open' ? ' · com o assistente' : ' pelo assistente') : ''}
                  {c.priority === 'urgent' ? ' · Urgente' : ''}
                  {c.assignee_name ? ` · com ${c.assignee_id === user?.id ? 'você' : c.assignee_name}` : c.assignee_id ? '' : ' · sem dono'}
                </p>
              </div>
              {c.assignee_id !== user?.id && c.status === 'open' && (
                <button type="button" disabled={salvando} onClick={() => mudar({ assignee_id: user!.id }, 'Você assumiu a conversa')} className={`hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50 sm:flex ${foco}`}>
                  <UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> Assumir
                </button>
              )}
              {c.status === 'open' ? (
                <button type="button" disabled={salvando} onClick={() => mudar({ status: 'resolved' }, 'Conversa resolvida')} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50 ${foco}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Resolver
                </button>
              ) : (
                <button type="button" disabled={salvando} onClick={() => mudar({ status: 'open' }, 'Conversa reaberta')} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50 ${foco}`}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reabrir
                </button>
              )}
              <button ref={botaoDetalhes} type="button" onClick={() => setDetalhes((d) => !d)} aria-expanded={detalhes} aria-controls="atendimento-contato" aria-label="Detalhes do contato" className={`shrink-0 rounded-lg p-1.5 hover:bg-muted xl:hidden ${foco}`}>
                <Info className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <ChatThread
              key={c.id}
              conversaId={c.id}
              souEquipe
              podeNota
              podeAnexar={c.status === 'open'}
              lidoAte={c.customer_last_read_at}
              aoEnviar={() => {
                qc.invalidateQueries({ queryKey: ['chat-inbox'] })
                qc.invalidateQueries({ queryKey: ['chat-conversa', c.id] })
              }}
              rotuloCampo={`Resposta para ${c.chat_contacts?.name ?? 'o cliente'}`}
            />
          </>
        )}
        {c && detalhes && <div onClick={fecharDetalhes} aria-hidden="true" className="absolute inset-0 z-10 bg-black/50 xl:hidden" />}
      </div>

      {/* 3. Contato e ações: fixo a partir de xl; abaixo, painel sobre a conversa com fundo escurecido */}
      {c && (
        <aside
          id="atendimento-contato"
          aria-label="Contato e ações"
          className={`${detalhes ? 'absolute inset-y-0 right-0 z-20 flex shadow-xl' : 'hidden'} w-72 max-w-full shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-background p-4 xl:static xl:flex xl:bg-card xl:shadow-none`}
        >
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{iniciais(c.chat_contacts?.name ?? '?')}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.chat_contacts?.name ?? 'Sem nome'}</p>
              <p className="text-xs text-muted-foreground">Desde {data(c.created_at)}</p>
            </div>
            <button ref={botaoFechar} type="button" onClick={fecharDetalhes} aria-label="Fechar detalhes" className={`rounded-lg p-1 hover:bg-muted xl:hidden ${foco}`}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <Secao titulo="Contato">
            <dl className="space-y-1.5 text-sm">
              <div><dt className="text-xs text-muted-foreground">E-mail</dt><dd className="break-all">{c.chat_contacts?.email ?? '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Telefone</dt><dd>{telefone(c.chat_contacts?.phone ?? null)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Origem</dt><dd>{ORIGEM[c.chat_contacts?.origin ?? ''] ?? '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Novidades por e-mail</dt><dd>{c.chat_contacts?.marketing_opt_in ? 'Aceitou' : 'Não aceitou'}</dd></div>
              {c.rating && <div><dt className="text-xs text-muted-foreground">Avaliação</dt><dd>{ROTULO_NOTA[c.rating]}</dd></div>}
            </dl>
          </Secao>

          <Secao titulo="Atendimento">
            <div className="space-y-2">
              <div>
                <label htmlFor="atendimento-dono" className="text-xs text-muted-foreground">Responsável</label>
                <select id="atendimento-dono" value={c.assignee_id ?? ''} disabled={salvando} onChange={(e) => mudar({ assignee_id: e.target.value || null })} className={selectCls}>
                  <option value="">Sem dono</option>
                  {/* dono atual fora da lista (perdeu a permissão, lista carregando ou com erro): o seletor não pode mentir */}
                  {c.assignee_id && !atendentes.some((a) => a.id === c.assignee_id) && (
                    <option value={c.assignee_id}>{c.assignee_id === user?.id ? 'Você' : 'Responsável atual'}</option>
                  )}
                  {atendentes.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}{a.id === user?.id ? ' (você)' : ''}</option>)}
                </select>
                {erroAtendentes && <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-300">Não foi possível carregar a lista de atendentes: {mensagemDeErro(erroAtendentes)}</p>}
              </div>
              <div>
                <label htmlFor="atendimento-setor" className="text-xs text-muted-foreground">Setor</label>
                <select id="atendimento-setor" value={c.department_id ?? ''} disabled={salvando} onChange={(e) => e.target.value && mudar({ department_id: e.target.value })} className={selectCls}>
                  {!c.department_id && <option value="">Sem setor</option>}
                  {setores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="atendimento-prioridade" className="text-xs text-muted-foreground">Prioridade</label>
                <select id="atendimento-prioridade" value={c.priority} disabled={salvando} onChange={(e) => mudar({ priority: e.target.value })} className={selectCls}>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
          </Secao>

          {!c.user_id ? (
            <p className="text-xs text-muted-foreground">Conversa sem conta vinculada (migrada do chat antigo): sem histórico.</p>
          ) : extra.isLoading ? (
            <div className="space-y-2" aria-label="Carregando histórico">{[0, 1].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : extra.isError ? (
            <p role="alert" className="text-xs text-muted-foreground">Não foi possível carregar o histórico da conta: {mensagemDeErro(extra.error)}</p>
          ) : extra.data && (
            <>
              <Secao titulo="Conversas anteriores">
                {extra.data.anteriores.length ? (
                  <ul className="space-y-1">
                    {extra.data.anteriores.map((a) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => abrir(a.id)} className={`w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted ${foco}`}>
                          <span className="block truncate font-medium">{a.chat_topics?.label ?? 'Conversa'}</span>
                          <span className="block truncate text-muted-foreground">{data(a.created_at)} · {a.status === 'open' ? 'aberta' : 'resolvida'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground">Nenhuma outra conversa.</p>}
              </Secao>
              <Secao titulo="Ingressos">
                {extra.data.ingressos.length ? (
                  <ul className="space-y-1 text-xs">
                    {extra.data.ingressos.map((t) => (
                      <li key={t.id} className="flex justify-between gap-2">
                        <span className="truncate">{t.ticket_types?.events?.title ?? t.ticket_types?.name ?? 'Ingresso'}</span>
                        <span className="shrink-0 text-muted-foreground">{t.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground">Nenhum ingresso.</p>}
              </Secao>
              <Secao titulo="Pedidos">
                {extra.data.pedidos.length ? (
                  <ul className="space-y-1 text-xs">
                    {extra.data.pedidos.map((p) => (
                      <li key={p.id} className="flex justify-between gap-2">
                        <span className="truncate">{p.events?.title ?? 'Pedido'} · {data(p.created_at)}</span>
                        <span className="shrink-0 text-muted-foreground">{brl(Number(p.total))} · {p.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground">Nenhum pedido.</p>}
              </Secao>
              {(extra.data.papel === 'producer' || extra.data.papel === 'editor') && (
                <Secao titulo="Plano">
                  <p className="text-sm">
                    {extra.data.plano ? `${extra.data.plano.plan}${extra.data.plano.is_active ? '' : ' (inativo)'}${extra.data.plano.expires_at ? ` · até ${data(extra.data.plano.expires_at)}` : ''}` : 'Sem assinatura'}
                  </p>
                </Secao>
              )}
            </>
          )}
        </aside>
      )}
    </div>
  )
}
