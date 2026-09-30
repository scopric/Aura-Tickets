import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Calendar, Clock, CheckCircle, Mail, MessageCircle, Inbox, RefreshCw, DollarSign, ArrowUpRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Res<T> = { data: T | null; error: string | null }

// Cada consulta falha sozinha: tabela sem regra de acesso vira "—" com o erro no title, não derruba a tela.
async function tenta<T>(
  q: PromiseLike<{ data: any; error: { message: string } | null; count?: number | null }>,
  pick: (r: { data: any; count?: number | null }) => T,
): Promise<Res<T>> {
  try {
    const r = await q
    if (r.error) throw r.error
    return { data: pick(r), error: null }
  } catch (e: any) {
    return { data: null, error: e?.message || String(e) }
  }
}

interface FilaItem { id: string; title: string; date: string | null; created_at: string; profiles: { full_name: string | null } | null }
interface Conta { id: string; full_name: string | null; email: string; role: string; created_at: string }
interface EventoRecente { id: string; title: string; created_at: string }

interface Dados {
  roles: Res<string[]>
  eventos: Res<(string | null)[]> // approval_status de cada evento
  newsletter: Res<number>
  suporte: Res<number>
  contato: Res<number>
  fila: Res<FilaItem[]>
  eventosRecentes: Res<EventoRecente[]>
  contasRecentes: Res<Conta[]>
}

const roleLabels: Record<string, string> = { user: 'Participante', customer: 'Cliente', producer: 'Produtor', admin: 'Administrador', editor: 'Editor' }
const fmt = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function AdminDashboard() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [loading, setLoading] = useState(true)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const [roles, eventos, newsletter, suporte, contato, fila, eventosRecentes, contasRecentes] = await Promise.all([
      // ponytail: o PostgREST corta em 1.000 linhas; trocar por count head por papel quando passar de centenas de contas
      tenta(supabase.from('profiles').select('role'), r => (r.data || []).map((p: any) => String(p.role))),
      // rascunho não foi enviado à moderação (o padrão de approval_status é 'pending')
      tenta(supabase.from('events').select('id, approval_status').neq('status', 'draft'), r => (r.data || []).map((e: any) => e.approval_status ?? null)),
      tenta(supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).is('unsubscribed_at', null), r => r.count ?? 0),
      tenta(supabase.from('support_sessions').select('id', { count: 'exact', head: true }).neq('status', 'closed'), r => r.count ?? 0),
      tenta(supabase.from('contact_messages').select('id', { count: 'exact', head: true }), r => r.count ?? 0),
      // events tem duas FKs para profiles: sem o !producer_id o PostgREST devolve PGRST201
      tenta(supabase.from('events').select('id, title, date, created_at, profiles!producer_id(full_name)').or('approval_status.eq.pending,approval_status.is.null').neq('status', 'draft').order('created_at', { ascending: false }).limit(5), r => (r.data || []) as FilaItem[]),
      tenta(supabase.from('events').select('id, title, created_at').order('created_at', { ascending: false }).limit(5), r => (r.data || []) as EventoRecente[]),
      tenta(supabase.from('profiles').select('id, full_name, email, role, created_at').order('created_at', { ascending: false }).limit(5), r => (r.data || []) as Conta[]),
    ])
    setDados({ roles, eventos, newsletter, suporte, contato, fila, eventosRecentes, contasRecentes })
    setAtualizadoEm(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const roles = dados?.roles.data
  const contas = roles ? {
    total: roles.length,
    participantes: roles.filter(r => r === 'user' || r === 'customer').length,
    produtores: roles.filter(r => r === 'producer').length,
    admins: roles.filter(r => r === 'admin').length,
  } : null
  const ev = dados?.eventos.data
  const kpis: { label: string; value: number | null | undefined; sub?: string | null; error?: string | null; icon: typeof Users }[] = [
    { label: 'Contas', value: contas?.total, sub: contas ? `${contas.participantes} participantes · ${contas.produtores} produtores · ${contas.admins} admins` : null, error: dados?.roles.error, icon: Users },
    { label: 'Eventos pendentes', value: ev ? ev.filter(s => !s || s === 'pending').length : null, error: dados?.eventos.error, icon: Clock },
    { label: 'Eventos aprovados', value: ev ? ev.filter(s => s === 'approved').length : null, error: dados?.eventos.error, icon: CheckCircle },
    { label: 'Inscritos na newsletter', value: dados?.newsletter.data, error: dados?.newsletter.error, icon: Mail },
    { label: 'Conversas de suporte abertas', value: dados?.suporte.data, error: dados?.suporte.error, icon: MessageCircle },
    { label: 'Mensagens de contato', value: dados?.contato.data, error: dados?.contato.error, icon: Inbox },
  ]

  const atividade = [
    ...(dados?.eventosRecentes.data || []).map(e => ({ key: 'e' + e.id, tipo: 'Evento criado', texto: e.title, quando: e.created_at, to: '/admin/events', icon: Calendar })),
    ...(dados?.contasRecentes.data || []).map(c => ({ key: 'c' + c.id, tipo: `Conta criada · ${roleLabels[c.role] || c.role}`, texto: c.full_name || c.email, quando: c.created_at, to: '/admin/users', icon: Users })),
  ].sort((a, b) => b.quando.localeCompare(a.quando))
  const erroAtividade = dados?.eventosRecentes.error || dados?.contasRecentes.error

  const alerta = (msg: string) => (
    <p role="alert" className="text-xs text-red-700 dark:text-red-300">Não foi possível carregar: {msg}</p>
  )

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Painel</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma com os dados do banco</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{atualizadoEm ? `Atualizado em ${fmt(atualizadoEm.toISOString())}` : 'Carregando…'}</span>
          <button
            onClick={carregar}
            disabled={loading}
            aria-label="Atualizar dados do painel"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpis.map(k => (
          <div key={k.label} className="p-5 rounded-2xl bg-card border border-border">
            <k.icon className="w-4 h-4 text-primary mb-3" />
            <div className="font-serif text-2xl text-foreground" title={k.error || undefined}>
              {loading && !dados ? '…' : k.value ?? '—'}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">{k.label}</div>
            {k.sub && <div className="text-[11px] text-muted-foreground mt-1">{k.sub}</div>}
            {k.error && <div className="text-[11px] text-red-700 dark:text-red-300 mt-1">{k.error}</div>}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-foreground flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Fila de moderação</h2>
            <Link to="/admin/events" className="text-xs text-primary hover:underline flex items-center gap-1">Ver todos <ArrowUpRight className="w-3 h-3" /></Link>
          </div>
          {dados?.fila.error ? alerta(dados.fila.error) : !dados?.fila.data?.length ? (
            <p className="text-xs text-muted-foreground italic">{dados ? 'Nenhum evento aguardando moderação.' : 'Carregando…'}</p>
          ) : (
            <ul className="divide-y divide-border">
              {dados.fila.data.map(e => (
                <li key={e.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-foreground">{e.title}</div>
                    <div className="text-[11px] text-muted-foreground">{e.profiles?.full_name || 'Produtor sem nome'}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {e.date ? new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data a definir'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-6 rounded-2xl bg-card border border-border">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4"><DollarSign className="w-4 h-4 text-primary" /> Receita e planos</h2>
          <p className="text-xs text-muted-foreground">Pagamentos em modo de teste: ainda não há receita nem assinaturas reais.</p>
          <Link to="/admin/finance" className="inline-flex items-center gap-1 mt-4 text-xs text-primary hover:underline">Abrir financeiro <ArrowUpRight className="w-3 h-3" /></Link>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-card border border-border">
        <h2 className="text-sm font-medium text-foreground mb-4">Atividade recente</h2>
        {erroAtividade && alerta(erroAtividade)}
        {!erroAtividade && atividade.length === 0 && (
          <p className="text-xs text-muted-foreground italic">{dados ? 'Nenhuma atividade registrada.' : 'Carregando…'}</p>
        )}
        {atividade.length > 0 && (
          <ul className="divide-y divide-border">
            {atividade.map(a => (
              <li key={a.key} className="py-3 flex items-center gap-3">
                <a.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <Link to={a.to} className="text-sm text-foreground hover:text-primary truncate block">{a.texto}</Link>
                  <div className="text-[11px] text-muted-foreground">{a.tipo}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">{fmt(a.quando)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
