import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import gsap from 'gsap'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { brl } from '../../lib/taxa'
import { PageHeader, Stat, EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// Tipos locais: o types/database.ts está desatualizado (sem approval_status/checked_in_at; orders e producer_profiles viram never)
type Evento = {
  id: string
  title: string
  status: 'draft' | 'published' | 'cancelled' | 'ended'
  approval_status: 'pending' | 'approved' | 'rejected' | null
  date: string | null
  start_date: string
  capacity: number | null
  ticket_types: { quantity_total: number | null; capacity: number | null }[]
}
type Ingresso = { event_id: string; checked_in_at: string | null }

const inteiro = (n: number) => Math.round(n).toLocaleString('pt-BR')

// Conta de 0 até o valor (só aqui, Decisão 112); sem animação com prefers-reduced-motion
function Contagem({ valor, formato }: { valor: number; formato: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || valor === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const obj = { n: 0 }
    const tween = gsap.to(obj, { n: valor, duration: 0.8, ease: 'power2.out', onUpdate: () => { el.textContent = formato(obj.n) } })
    return () => { tween.kill(); el.textContent = formato(valor) }
  }, [valor, formato])
  return <span ref={ref}>{formato(valor)}</span>
}

function situacao(e: Evento): string {
  if (e.status === 'draft') return 'Rascunho'
  if (e.status === 'ended') return 'Encerrado'
  if (e.status === 'cancelled') return 'Cancelado'
  if (e.approval_status === 'approved') return 'Publicado'
  if (e.approval_status === 'rejected') return 'Recusado'
  return 'Em análise'
}

const dataDo = (e: Evento) => (e.date ? new Date(`${e.date}T00:00:00`) : new Date(e.start_date))

function saudacao(): string {
  const h = new Date().getHours()
  return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function ProducerDashboard() {
  const { user } = useAuth()

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['producer-inicio', user?.id],
    enabled: !!user?.id,
    retry: 1,
    queryFn: async () => {
      const id = user!.id
      // ponytail: limite único de 10 s para as consultas da tela; estourou, vira erro com "Tentar de novo"
      const sinal = AbortSignal.timeout(10000)
      const [ev, perfil] = await Promise.all([
        supabase.from('events')
          .select('id, title, status, approval_status, date, start_date, capacity, ticket_types(quantity_total, capacity)')
          .eq('producer_id', id).abortSignal(sinal),
        // sem permissão ou sem linha: o passo "perfil da empresa" fica como não feito
        supabase.from('producer_profiles').select('company_name').eq('id', id).abortSignal(sinal).maybeSingle(),
      ])
      if (ev.error) throw ev.error
      const eventos = (ev.data ?? []) as unknown as Evento[]

      let vendas = 0
      let pedidos = 0
      let ingressos: Ingresso[] = []
      if (eventos.length > 0) {
        const ids = eventos.map(e => e.id)
        const [o, t] = await Promise.all([
          supabase.from('orders').select('total').in('event_id', ids).eq('status', 'paid').abortSignal(sinal),
          // vendido = ativo, usado ou transferido; cancelado e reembolsado não contam
          supabase.from('tickets').select('event_id, checked_in_at').in('event_id', ids)
            .in('status', ['active', 'used', 'transferred']).abortSignal(sinal),
        ])
        if (o.error) throw o.error
        if (t.error) throw t.error
        pedidos = o.data.length
        // ponytail: "bruto" = orders.total dos pagos; o checkout ainda não grava service_fee/processing_fee
        // e o total inclui a taxa do comprador (Decisões 88 e 111). Receita líquida quando a F2 gravar as taxas.
        vendas = (o.data as { total: number }[]).reduce((s, x) => s + (Number(x.total) || 0), 0)
        ingressos = t.data as unknown as Ingresso[]
      }
      return { eventos, vendas, pedidos, ingressos, empresa: !perfil.error && !!(perfil.data as { company_name: string | null } | null)?.company_name?.trim() }
    },
  })

  const primeiroNome = user?.name?.trim().split(/\s+/)[0]

  const header = (
    <PageHeader
      title="Início"
      description={primeiroNome ? `${saudacao()}, ${primeiroNome}` : saudacao()}
      actions={
        <Button asChild>
          <Link to="/producer/planner"><Plus aria-hidden="true" />Criar evento</Link>
        </Button>
      }
    />
  )

  // isPending (não isLoading): sem usuário ainda a consulta fica parada e a tela segue no esqueleto
  if (isPending) {
    return (
      <div aria-busy="true">
        {header}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-[92px] rounded-[10px] bg-muted" />)}
        </div>
        <Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" />
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        {header}
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar seus números agora.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Carregando…' : 'Tentar de novo'}
          </Button>
        </div>
      </div>
    )
  }

  const { eventos, vendas, pedidos, ingressos, empresa } = data
  const vendidos = ingressos.length
  const publicados = eventos.filter(e => e.status === 'published').length

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const proximos = eventos
    .filter(e => (e.status === 'draft' || e.status === 'published') && dataDo(e) >= hoje)
    .sort((a, b) => dataDo(a).getTime() - dataDo(b).getTime())
    .slice(0, 5)

  const passos = [
    { feito: eventos.length > 0, texto: 'Criar o primeiro evento', to: '/producer/planner' },
    {
      feito: eventos.some(e => e.approval_status === 'approved' || (e.status === 'published' && e.approval_status !== 'rejected')),
      texto: 'Enviar um evento para análise',
      to: '/producer/events',
    },
    { feito: eventos.some(e => e.ticket_types.length > 0), texto: 'Configurar os ingressos', to: '/producer/events' },
    { feito: empresa, texto: 'Preencher o perfil da empresa', to: '/producer/settings' },
    { feito: ingressos.some(i => i.checked_in_at), texto: 'Testar o check-in', to: '/producer/checkin' },
  ]
  const feitos = passos.filter(p => p.feito).length

  return (
    <div>
      {header}

      <section aria-labelledby="numeros">
        <h2 id="numeros" className="sr-only">Números</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Vendas (bruto)" value={<Contagem valor={vendas} formato={brl} />} hint="Pedidos pagos, com a taxa do comprador" />
          <Stat label="Ingressos vendidos" value={<Contagem valor={vendidos} formato={inteiro} />} />
          <Stat label="Ticket médio" value={<Contagem valor={vendidos ? vendas / vendidos : 0} formato={brl} />} />
          <Stat label="Eventos publicados" value={<Contagem valor={publicados} formato={inteiro} />} />
        </div>
        {pedidos === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">As vendas aparecem aqui quando o pagamento estiver ligado.</p>
        )}
      </section>

      {feitos < passos.length && (
        <section aria-labelledby="primeiros-passos" className="mt-6 rounded-[10px] border border-border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="primeiros-passos" className="text-base font-semibold text-foreground">Primeiros passos</h2>
            <span className="text-sm tabular-nums text-muted-foreground">{feitos} de {passos.length}</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full bg-primary" style={{ width: `${(feitos / passos.length) * 100}%` }} />
          </div>
          <ul className="mt-3 divide-y divide-border">
            {passos.map(p => (
              <li key={p.texto} className="flex items-center gap-3 py-2.5 text-sm">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${p.feito ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                  aria-hidden="true"
                >
                  {p.feito && <Check className="size-3" />}
                </span>
                {p.feito ? (
                  <span className="text-muted-foreground line-through">{p.texto}<span className="sr-only"> (feito)</span></span>
                ) : (
                  <Link to={p.to} className="text-foreground hover:text-primary hover:underline underline-offset-4">{p.texto}</Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="proximos" className="mt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="proximos" className="text-base font-semibold text-foreground">Próximos eventos</h2>
          {eventos.length > 0 && (
            <Link to="/producer/events" className="text-sm text-primary hover:underline underline-offset-4">Ver todos</Link>
          )}
        </div>
        {eventos.length === 0 ? (
          <EmptyState
            title="Você ainda não tem eventos"
            description="Crie o primeiro e acompanhe as vendas por aqui."
            action={<Button asChild><Link to="/producer/planner"><Plus aria-hidden="true" />Criar evento</Link></Button>}
          />
        ) : proximos.length === 0 ? (
          <EmptyState
            title="Nenhum evento com data pela frente"
            action={<Button asChild variant="outline"><Link to="/producer/events">Ver meus eventos</Link></Button>}
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[10px] border border-border bg-card">
            {proximos.map(e => {
              const vendidosEv = ingressos.filter(i => i.event_id === e.id).length
              const cap = e.ticket_types.reduce((s, t) => s + (t.quantity_total || t.capacity || 0), 0) || e.capacity || 0
              const st = situacao(e)
              return (
                <li key={e.id}>
                  <Link
                    to={`/producer/events/${e.id}/edit`}
                    className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 p-3 transition-colors hover:bg-foreground/5 sm:grid-cols-[3.5rem_minmax(0,1fr)_10rem]"
                  >
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {dataDo(e).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{e.title}</span>
                      <Badge variant={st === 'Publicado' ? 'default' : 'secondary'}>{st}</Badge>
                    </span>
                    <span className="col-start-2 sm:col-start-auto">
                      <span className="block text-xs tabular-nums text-muted-foreground">
                        {cap > 0 ? `${inteiro(vendidosEv)} de ${inteiro(cap)} vendidos` : `${inteiro(vendidosEv)} vendidos`}
                      </span>
                      {cap > 0 && (
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <span className="block h-full bg-primary" style={{ width: `${Math.min(100, (vendidosEv / cap) * 100)}%` }} />
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
