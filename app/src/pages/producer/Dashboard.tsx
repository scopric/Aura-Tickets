import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import gsap from 'gsap'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useTourLog } from '../../hooks/useTourLog'
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
  created_at: string
  capacity: number | null
  ticket_types: { quantity_total: number | null; capacity: number | null }[]
}

const inteiro = (n: number) => Math.round(n).toLocaleString('pt-BR')
const brlMais = (n: number) => `${brl(n)}+`
// Vendido = ativo ou usado. Cancelado e reembolsado não contam; transferido também não, porque quem recebe
// fica com um ingresso ativo e o antigo (transferido) contaria a mesma venda duas vezes.
const VENDIDO = ['active', 'used']

// Conta de 0 até o valor (só aqui, Decisão 112); sem animação com prefers-reduced-motion
function Contagem({ valor, formato }: { valor: number; formato: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  // O texto é só do efeito (o React não renderiza filho aqui): se o gsap e o React mexessem no mesmo nó,
  // a troca 7 → 0 deixava o 7 na tela
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (valor === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = formato(valor)
      return
    }
    const obj = { n: 0 }
    el.textContent = formato(0)
    const tween = gsap.to(obj, { n: valor, duration: 0.8, ease: 'power2.out', onUpdate: () => { el.textContent = formato(obj.n) } })
    return () => { tween.kill() }
  }, [valor, formato])
  return <span ref={ref} />
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
  const { feitos: registrados, registrar, carregou } = useTourLog()
  const [agora] = useState(() => Date.now()) // fixo na montagem: as dicas usam datas relativas a ele

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['producer-inicio', user?.id],
    enabled: !!user?.id,
    retry: 1,
    queryFn: async () => {
      const id = user!.id
      // ponytail: limite único de 10 s para as consultas da tela; estourou, vira erro com "Tentar de novo".
      // AbortController + setTimeout em vez de AbortSignal.timeout (não existe no Safari < 16)
      const ctl = new AbortController()
      const relogio = setTimeout(() => ctl.abort(), 10000)
      const sinal = ctl.signal
      try {
        const [ev, perfil, pagos, vendidosQ, checkin] = await Promise.all([
          supabase.from('events')
            .select('id, title, status, approval_status, date, start_date, created_at, capacity, ticket_types(quantity_total, capacity)')
            .eq('producer_id', id).abortSignal(sinal),
          supabase.from('producer_profiles').select('company_name').eq('id', id).abortSignal(sinal).maybeSingle(),
          // ponytail: soma no navegador, cortada no max_rows (1.000) do PostgREST; o count diz se cortou e aí a tela
          // mostra "R$ X+" e esconde o ticket médio. Soma exata quando houver RPC/view de vendas (F2).
          supabase.from('orders').select('total, events!inner(producer_id)', { count: 'exact' })
            .eq('events.producer_id', id).eq('status', 'paid').abortSignal(sinal),
          supabase.from('tickets').select('id, events!inner(producer_id)', { count: 'exact', head: true })
            .eq('events.producer_id', id).in('status', VENDIDO).abortSignal(sinal),
          supabase.from('tickets').select('id, events!inner(producer_id)')
            .eq('events.producer_id', id).not('checked_in_at', 'is', null).limit(1).abortSignal(sinal),
        ])
        if (ev.error) throw ev.error
        // sem permissão (42501) = perfil não preenchido; outro erro (rede, tempo) não pode virar "não preenchido"
        if (perfil.error && perfil.error.code !== '42501') throw perfil.error
        if (pagos.error) throw pagos.error
        if (vendidosQ.error) throw vendidosQ.error
        if (checkin.error) throw checkin.error
        const eventos = (ev.data ?? []) as unknown as Evento[]
        const linhas = (pagos.data ?? []) as unknown as { total: number }[]

        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        const proximos = eventos
          .filter(e => (e.status === 'draft' || e.status === 'published') && dataDo(e) >= hoje)
          .sort((a, b) => dataDo(a).getTime() - dataDo(b).getTime())
          .slice(0, 5)
        // vendidos por evento só dos 5 da lista, com count (sem trazer linhas)
        const porEvento = await Promise.all(proximos.map(e =>
          supabase.from('tickets').select('id', { count: 'exact', head: true })
            .eq('event_id', e.id).in('status', VENDIDO).abortSignal(sinal)))
        const vendidosPorEvento: Record<string, number> = {}
        porEvento.forEach((r, i) => {
          if (r.error) throw r.error
          vendidosPorEvento[proximos[i].id] = r.count ?? 0
        })

        const pedidos = pagos.count ?? linhas.length
        return {
          eventos,
          proximos,
          vendidosPorEvento,
          // ponytail: "bruto" = orders.total dos pagos; o checkout ainda não grava service_fee/processing_fee
          // e o total inclui a taxa do comprador (Decisões 88 e 111). Receita líquida quando a F2 gravar as taxas.
          vendas: linhas.reduce((s, x) => s + (Number(x.total) || 0), 0),
          vendasCortadas: pedidos > linhas.length,
          pedidos,
          vendidos: vendidosQ.count ?? 0,
          checkinFeito: (checkin.data ?? []).length > 0,
          empresa: !!(perfil.data as { company_name: string | null } | null)?.company_name?.trim(),
        }
      } finally {
        clearTimeout(relogio)
      }
    },
  })

  const primeiroNome = user?.name?.trim().split(/\s+/)[0]

  const header = (
    <PageHeader
      title="Início"
      description={primeiroNome ? `${saudacao()}, ${primeiroNome}` : saudacao()}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link to="/producer/dashboard?tour=inicio">Ver tour desta tela</Link></Button>
          <Button asChild>
            <Link to="/producer/planner"><Plus aria-hidden="true" />Criar evento</Link>
          </Button>
        </div>
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

  const { eventos, proximos, vendidosPorEvento, vendas, vendasCortadas, pedidos, vendidos, checkinFeito, empresa } = data
  // publicado = no ar para o público: publicado E aprovado (F0a)
  const publicados = eventos.filter(e => e.status === 'published' && e.approval_status === 'approved').length

  const passos = [
    { feito: eventos.length > 0, texto: 'Criar o primeiro evento', to: '/producer/planner?tour=criar-evento' },
    {
      // publicado (em análise, aprovado ou recusado) ou já encerrado: foi enviado
      feito: eventos.some(e => e.status === 'published' || e.status === 'ended'),
      texto: 'Enviar um evento para análise',
      to: '/producer/events?tour=eventos',
    },
    { feito: eventos.some(e => e.ticket_types.length > 0), texto: 'Configurar os ingressos', to: '/producer/events?tour=eventos' },
    { feito: empresa, texto: 'Preencher o perfil da empresa', to: '/producer/settings?tour=configuracoes' },
    { feito: publicados > 0, texto: 'Evento aprovado e no ar', to: '/producer/events?tour=eventos' },
    { feito: checkinFeito, texto: 'Testar o check-in', to: '/producer/checkin?tour=checkin' },
  ]
  const feitos = passos.filter(p => p.feito).length
  // esconde só depois de ler o registro: evita piscar o cartão de quem já dispensou
  const mostrarChecklist = carregou && feitos < passos.length && !registrados.has('checklist:dispensado')

  // no máximo uma dica, na ordem das regras; só eventos aprovados e no ar
  const noAr = proximos.filter(e => e.status === 'published' && e.approval_status === 'approved')
  const limite = agora + 7 * 86400000
  const dica = [
    ...noAr.filter(e => !checkinFeito && dataDo(e).getTime() <= limite).map(e => ({
      id: `dica:checkin:${e.id}`,
      texto: 'Teste o check-in antes do dia',
      links: [{ to: '/producer/checkin?tour=checkin', rotulo: 'Abrir check-in' }],
    })),
    ...noAr.filter(e => agora - new Date(e.created_at).getTime() > 48 * 3600000 && (vendidosPorEvento[e.id] ?? 0) === 0).map(e => ({
      id: `dica:sem-venda:${e.id}`,
      texto: 'Ainda sem vendas? Crie um cupom ou chame afiliados',
      links: [{ to: '/producer/cupons', rotulo: 'Criar cupom' }, { to: '/producer/afiliados', rotulo: 'Chamar afiliados' }],
    })),
  ].find(d => !registrados.has(d.id))

  return (
    <div>
      {header}

      <section aria-labelledby="numeros" data-tour="inicio-numeros">
        <h2 id="numeros" className="sr-only">Números</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Vendas (bruto)"
            value={<Contagem valor={vendas} formato={vendasCortadas ? brlMais : brl} />}
            hint={vendasCortadas ? 'Soma parcial: mais de 1.000 pedidos pagos' : 'Pedidos pagos, com a taxa do comprador'}
          />
          <Stat label="Ingressos vendidos" value={<Contagem valor={vendidos} formato={inteiro} />} />
          <Stat label="Ticket médio" value={vendasCortadas ? '—' : <Contagem valor={vendidos ? vendas / vendidos : 0} formato={brl} />} />
          <Stat label="Eventos publicados" value={<Contagem valor={publicados} formato={inteiro} />} />
        </div>
        {pedidos === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma venda paga ainda.</p>
        )}
      </section>

      {carregou && dica && (
        <section aria-label="Dica" className="mt-6 flex flex-col gap-2 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-foreground sm:mr-auto">{dica.texto}</p>
          <div className="flex flex-wrap items-center gap-2">
            {dica.links.map(l => <Button key={l.to} asChild size="sm" variant="outline"><Link to={l.to}>{l.rotulo}</Link></Button>)}
            <Button size="sm" variant="ghost" onClick={() => registrar(dica.id)}>Não mostrar de novo</Button>
          </div>
        </section>
      )}

      {mostrarChecklist && (
        <section aria-labelledby="primeiros-passos" data-tour="inicio-checklist" className="mt-6 rounded-[10px] border border-border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="primeiros-passos" className="text-base font-semibold text-foreground">Primeiro evento no ar</h2>
            <span className="flex items-baseline gap-3">
              <span className="text-sm tabular-nums text-muted-foreground">{feitos} de {passos.length}</span>
              <Button size="sm" variant="ghost" onClick={() => registrar('checklist:dispensado')}>Dispensar</Button>
            </span>
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

      <section aria-labelledby="proximos" data-tour="inicio-proximos" className="mt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="proximos" className="text-base font-semibold text-foreground">Próximos eventos</h2>
          {eventos.length > 0 && (
            <Link to="/producer/events" className="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground">Ver todos</Link>
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
              const vendidosEv = vendidosPorEvento[e.id] ?? 0
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
