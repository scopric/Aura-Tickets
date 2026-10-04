import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { Button } from '@/components/ui/button'
import { PageHeader, SectionTitle, Stat } from '@/components/producer/ui'
import { painel } from '@/components/admin/ui'
import { naFilaDeModeracao, noAr } from '../../lib/eventoProdutor'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

type Res<T> = { data: T | null; error: string | null }

// Cada consulta falha sozinha: tabela sem regra de acesso vira "—" com o erro no title, não derruba a tela.
async function tentaConsulta<T>(
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

const SEM_ACESSO = 'Sem acesso a esta área'

interface FilaItem { id: string; title: string; date: string | null; created_at: string; profiles: { full_name: string | null } | null }
interface Conta { id: string; full_name: string | null; email: string; role: string; created_at: string }
interface EventoRecente { id: string; title: string; created_at: string }

interface Dados {
  roles: Res<string[]>
  eventos: Res<{ status: string; approval_status: string | null; start_date: string; end_date: string | null; date: string | null; time: string | null }[]> // situação de cada evento
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
  const { user } = useAuth()
  // mesmo padrão do AdminLayout: super_admin vale para tudo
  const pode = useCallback((p: string) => !!user?.admin_permissions?.some(x => x === p || x === 'super_admin'), [user])

  const carregar = useCallback(async () => {
    setLoading(true)
    // sem permissão a consulta nem é feita (vira "sem dado", não erro)
    const tenta = <T,>(p: string, q: () => PromiseLike<any>, pick: (r: { data: any; count?: number | null }) => T): Promise<Res<T>> =>
      pode(p) ? tentaConsulta(q(), pick) : Promise.resolve({ data: null, error: null })
    const [roles, eventos, newsletter, suporte, contato, fila, eventosRecentes, contasRecentes] = await Promise.all([
      // ponytail: o PostgREST corta em 1.000 linhas; trocar por count head por papel quando passar de centenas de contas
      tenta('manage_users', () => supabase.from('profiles').select('role'), r => (r.data || []).map((p: any) => String(p.role))),
      tenta('manage_events', () => supabase.from('events').select('id, status, approval_status, start_date, end_date, date, time'), r => (r.data || []).map((e: any) => ({ status: String(e.status), approval_status: e.approval_status ?? null, start_date: String(e.start_date), end_date: e.end_date ?? null, date: e.date ?? null, time: e.time ?? null }))),
      tenta('manage_newsletter', () => supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).is('unsubscribed_at', null), r => r.count ?? 0),
      tenta('manage_support', () => supabase.from('conversations' as never).select('id', { count: 'exact', head: true }).eq('status', 'open').eq('bot_state', 'humano'), r => r.count ?? 0),
      tenta('manage_feedback', () => supabase.from('contact_messages').select('id', { count: 'exact', head: true }), r => r.count ?? 0),
      // events tem duas FKs para profiles: sem o !producer_id o PostgREST devolve PGRST201
      tenta('manage_events', () => supabase.from('events').select('id, title, date, created_at, profiles!producer_id(full_name)').eq('status', 'published').or('approval_status.eq.pending,approval_status.is.null').order('created_at', { ascending: false }).limit(5), r => (r.data || []) as FilaItem[]),
      tenta('manage_events', () => supabase.from('events').select('id, title, created_at').order('created_at', { ascending: false }).limit(5), r => (r.data || []) as EventoRecente[]),
      tenta('manage_users', () => supabase.from('profiles').select('id, full_name, email, role, created_at').order('created_at', { ascending: false }).limit(5), r => (r.data || []) as Conta[]),
    ])
    setDados({ roles, eventos, newsletter, suporte, contato, fila, eventosRecentes, contasRecentes })
    setAtualizadoEm(new Date())
    setLoading(false)
  }, [pode])

  useEffect(() => { carregar() }, [carregar])

  const roles = dados?.roles.data
  const contas = roles ? {
    total: roles.length,
    participantes: roles.filter(r => r === 'user' || r === 'customer').length,
    produtores: roles.filter(r => r === 'producer').length,
    admins: roles.filter(r => r === 'admin').length,
  } : null
  const ev = dados?.eventos.data
  const kpis: { label: string; perm: string; value: number | null | undefined; sub?: string | null; error?: string | null }[] = [
    { label: 'Contas', perm: 'manage_users', value: contas?.total, sub: contas ? `${contas.participantes} participantes · ${contas.produtores} produtores · ${contas.admins} admins` : null, error: dados?.roles.error },
    { label: 'Eventos pendentes', perm: 'manage_events', value: ev ? ev.filter(naFilaDeModeracao).length : null, error: dados?.eventos.error },
    { label: 'Eventos no ar', perm: 'manage_events', value: ev ? ev.filter(noAr).length : null, sub: ev ? `${ev.filter(e => e.approval_status === 'approved').length} aprovados no total` : null, error: dados?.eventos.error },
    { label: 'Inscritos na newsletter', perm: 'manage_newsletter', value: dados?.newsletter.data, error: dados?.newsletter.error },
    { label: 'Conversas abertas com a equipe', perm: 'manage_support', value: dados?.suporte.data, error: dados?.suporte.error },
    { label: 'Mensagens de contato', perm: 'manage_feedback', value: dados?.contato.data, error: dados?.contato.error },
  ]

  const atividade = [
    ...(dados?.eventosRecentes.data || []).map(e => ({ key: 'e' + e.id, tipo: 'Evento criado', texto: e.title, quando: e.created_at, to: '/admin/events', icon: I.Eventos })),
    ...(dados?.contasRecentes.data || []).map(c => ({ key: 'c' + c.id, tipo: `Conta criada · ${roleLabels[c.role] || c.role}`, texto: c.full_name || c.email, quando: c.created_at, to: '/admin/users', icon: I.Pessoas })),
  ].sort((a, b) => b.quando.localeCompare(a.quando))
  const erroAtividade = dados?.eventosRecentes.error || dados?.contasRecentes.error

  const alerta = (msg: string) => (
    <p role="alert" className="text-xs text-destructive">Não foi possível carregar: {msg}</p>
  )

  return (
    <div className="p-6 lg:p-10 max-w-7xl">
      <PageHeader
        title="Painel"
        description="Visão geral da plataforma com os dados do banco"
        actions={
          <>
            <span className="text-xs text-muted-foreground">{atualizadoEm ? `Atualizado em ${fmt(atualizadoEm.toISOString())}` : 'Carregando…'}</span>
            <Button variant="outline" size="sm" onClick={carregar} loading={loading} aria-label="Atualizar dados do painel">
              <I.Atualizar /> Atualizar
            </Button>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {kpis.map(k => (
          <Stat
            key={k.label}
            label={k.label}
            value={<span title={k.error || undefined}>{loading && !dados ? '…' : k.value ?? '—'}</span>}
            hint={k.error ? <span className="text-destructive">{k.error}</span> : pode(k.perm) ? k.sub : SEM_ACESSO}
          />
        ))}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="fila-titulo" className={`${painel} p-5 lg:col-span-2`}>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle id="fila-titulo">Fila de moderação</SectionTitle>
            {pode('manage_events') && <Link to="/admin/events" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Ver todos <I.SetaDiagonalCima size={12} aria-hidden="true" /></Link>}
          </div>
          {dados?.fila.error ? alerta(dados.fila.error) : !dados?.fila.data?.length ? (
            <p className="text-sm text-muted-foreground">{!pode('manage_events') ? SEM_ACESSO : dados ? 'Nenhum evento aguardando moderação.' : 'Carregando…'}</p>
          ) : (
            <ul className="divide-y divide-border">
              {dados.fila.data.map(e => (
                <li key={e.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-foreground">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{e.profiles?.full_name || 'Produtor sem nome'}</div>
                  </div>
                  <div className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {e.date ? new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Data a definir'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="receita-titulo" className={`${painel} p-5`}>
          <SectionTitle id="receita-titulo">Receita e planos</SectionTitle>
          <p className="mt-3 text-sm text-muted-foreground">Pagamentos em modo de teste: ainda não há receita nem assinaturas reais.</p>
          {pode('manage_finance') && <Link to="/admin/finance" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Abrir financeiro <I.SetaDiagonalCima size={12} aria-hidden="true" /></Link>}
        </section>
      </div>

      <section aria-labelledby="atividade-titulo" className={`${painel} p-5`}>
        <div className="mb-4"><SectionTitle id="atividade-titulo">Atividade recente</SectionTitle></div>
        {erroAtividade && alerta(erroAtividade)}
        {!erroAtividade && atividade.length === 0 && (
          <p className="text-sm text-muted-foreground">{!pode('manage_events') && !pode('manage_users') ? SEM_ACESSO : dados ? 'Nenhuma atividade registrada.' : 'Carregando…'}</p>
        )}
        {atividade.length > 0 && (
          <ul className="divide-y divide-border">
            {atividade.map(a => (
              <li key={a.key} className="flex items-center gap-3 py-3">
                <a.icon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <Link to={a.to} className="block truncate text-sm text-foreground hover:text-primary">{a.texto}</Link>
                  <div className="text-xs text-muted-foreground">{a.tipo}</div>
                </div>
                <div className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{fmt(a.quando)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
