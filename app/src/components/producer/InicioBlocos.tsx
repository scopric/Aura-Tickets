import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import { supabase } from '@/lib/supabase'
import EventoCapa from '@/components/EventoCapa'
import { Button } from '@/components/ui/button'
import { EmptyState, SectionTitle } from '@/components/producer/ui'
import * as I from '@/components/icones/evokaa16'
import { brl } from '@/lib/taxa'
import { corDoEvento, varsDoEvento } from '@/lib/corEvento'
import { situacaoEvento, vendidosDe, type Situacao } from '@/lib/eventoProdutor'
import { VENDIDO, brlMais, capacidadeDe, dataCurta, dataDoEvento, editarEvento, emQuantosDias, haQuanto, horaCurta, inteiro } from '@/lib/inicioProdutor'
import type { DbEvent } from '@/hooks/useEvents'

// Blocos do Início da produtora (V5, prancha Main). A página (Dashboard.tsx) busca e decide quais aparecem.

// Conta de 0 até o valor (só aqui, Decisão 112); sem animação com prefers-reduced-motion
export function Contagem({ valor, formato }: { valor: number; formato: (n: number) => string }) {
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

const PONTO: Record<Situacao, string> = {
  Publicado: 'bg-[var(--ev-success)]',
  'Em análise': 'bg-[var(--ev-warning)]',
  Rascunho: 'bg-muted-foreground',
  Encerrado: 'bg-muted-foreground',
  Cancelado: 'bg-destructive',
  Recusado: 'bg-destructive',
}
const Situ = ({ s }: { s: Situacao }) => (
  <span className="inline-flex items-center gap-1.5">
    <span aria-hidden="true" className={`size-1.5 rounded-full ${PONTO[s]}`} />{s}
  </span>
)

// Barra fina na cor do evento (o pai tem .evento-cor + varsDoEvento)
const Barra = ({ pct, className = 'h-1 w-16' }: { pct: number; className?: string }) => (
  <span aria-hidden="true" className={`inline-block overflow-hidden rounded-full bg-secondary align-middle ${className}`}>
    <span className="block h-full rounded-full bg-[var(--evento-grafico)]" style={{ width: `${pct}%` }} />
  </span>
)

export function ProximoEvento({ evento: e, agora }: { evento: DbEvent; agora: number }) {
  // contagem exata só deste evento (a lista da tela é cortada em 1.000 linhas e aqui o número aparece grande)
  const { data: vendidos } = useQuery({
    queryKey: ['producer-inicio-proximo', e.id],
    retry: 1,
    staleTime: 60000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { count, error } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', e.id).in('status', VENDIDO)
      if (error) throw error
      return count ?? 0
    },
  })
  const d = dataDoEvento(e)
  const cap = capacidadeDe(e)
  const st = situacaoEvento(e)
  const hora = horaCurta(e.time)
  const local = [e.venue_name, e.venue_city].filter(Boolean).join(', ') || e.location
  const pct = vendidos !== undefined && cap > 0 ? Math.min(100, Math.round((vendidos / cap) * 100)) : 0
  return (
    <section aria-labelledby="t-prox" className="evento-cor flex flex-col gap-4 xl:pt-1" style={varsDoEvento(corDoEvento(e), false, e.accent_intensity ?? 100)}>
      <SectionTitle id="t-prox">Próximo evento</SectionTitle>
      <div className="flex gap-4">
        <div className="w-40 shrink-0"><EventoCapa evento={e} tamanho="cartao" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="wide break-words font-display text-lg font-extrabold leading-[22px] tracking-[-0.01em] text-foreground">{e.title}</h3>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{dataCurta(d)}{hora && ` · ${hora}`}</p>
          {local && <p className="text-[13px] leading-5 text-muted-foreground">{local}</p>}
          <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{emQuantosDias(d, agora)}</p>
          {st !== 'Publicado' && <p className="mt-1 text-[13px] leading-5 text-foreground"><Situ s={st} /></p>}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span>
            <span className="font-display text-[22px] font-semibold leading-7 tabular-nums text-foreground">
              {vendidos === undefined ? '—' : <Contagem valor={vendidos} formato={inteiro} />}
            </span>
            {cap > 0 && <span className="text-muted-foreground"> de {inteiro(cap)}</span>}
          </span>
          {cap > 0 && vendidos !== undefined && <span className="font-display text-[13px] font-semibold tabular-nums text-muted-foreground">{pct}%</span>}
        </div>
        {cap > 0 && (
          <div role="progressbar" aria-label="Ingressos vendidos" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={vendidos ?? 0}>
            <Barra pct={pct} className="h-2 w-full" />
          </div>
        )}
      </div>
      {/* ponytail: leva à edição; troca para a Pasta do Evento (/producer/event/:id) quando a V7 sair do "em breve" */}
      <Button asChild size="sm" variant="outline" className="self-start"><Link to={editarEvento(e)}>Abrir evento</Link></Button>
    </section>
  )
}

// Faixa "Evo sugere" (V9d), sem caixa e sem fio, uma sugestão por vez. A ação é link (`to`) ou botão (`onClick`).
export function FaixaAviso({ children, acao, onDispensar }: {
  children: ReactNode
  acao: { texto: string; to?: string; onClick?: () => void }
  onDispensar: () => void
}) {
  return (
    <div role="region" aria-labelledby="evo-sugere" className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 xl:col-span-12">
      <img src="/evo/evo-avatar.webp" alt="" aria-hidden="true" width={32} height={32} className="size-8 shrink-0 rounded-full" />
      <p className="min-w-0 flex-1 text-sm leading-5 text-foreground max-sm:basis-[calc(100%-2.75rem)]">
        <span id="evo-sugere" className="mr-2 font-display text-xs font-semibold text-muted-foreground">Evo sugere</span>{' '}
        {children}
      </p>
      {acao.to
        ? <Button asChild size="sm" variant="outline"><Link to={acao.to}>{acao.texto}</Link></Button>
        : <Button size="sm" variant="outline" onClick={acao.onClick}>{acao.texto}</Button>}
      <Button size="icon-sm" variant="ghost" aria-label="Dispensar sugestão" onClick={onDispensar}><I.Fechar size={16} /></Button>
    </div>
  )
}

// Últimos 7 dias do evento: polyline 80x28, sem Recharts
function Spark({ v, titulo }: { v: number[]; titulo: string }) {
  const max = Math.max(...v, 1)
  const pts = v.map((y, i) => `${((i * 80) / Math.max(v.length - 1, 1)).toFixed(1)},${(26 - (y / max) * 24).toFixed(1)}`).join(' ')
  return (
    <svg width="80" height="28" viewBox="0 0 80 28" role="img" aria-label={titulo}>
      <polyline points={pts} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" className={v.some(Boolean) ? 'stroke-[color:var(--evento-grafico)]' : 'stroke-border'} />
    </svg>
  )
}

const TH = 'h-9 whitespace-nowrap px-3 text-left text-xs font-semibold text-muted-foreground'

export function TabelaEventos({ eventos, linhas, vendidos, receita, receitaCortada, spark, total }: {
  eventos: DbEvent[] // todos, só para o Total
  linhas: DbEvent[] // os que aparecem
  vendidos: { porEvento: Record<string, number>; cortado: boolean } | undefined // sem vendas carregadas: "—"
  receita: Record<string, number> | undefined
  receitaCortada: boolean
  spark: Record<string, number[]>
  total: number | undefined
}) {
  const navegar = useNavigate()
  const rec = (n: number | undefined) => (n === undefined ? '—' : receitaCortada ? brlMais(n) : brl(n))
  // lista cortada em 1.000 ingressos: o que se conta é piso, e vai com "+"
  const mais = vendidos?.cortado ? '+' : ''
  const somaVend = vendidos && eventos.reduce((s, e) => s + (vendidos.porEvento[e.id] ?? 0), 0)
  const somaCap = eventos.reduce((s, e) => s + capacidadeDe(e), 0)
  if (eventos.length === 0) {
    return (
      <section aria-labelledby="t-ev" data-tour="inicio-proximos" className="xl:col-span-12">
        <div className="mb-3"><SectionTitle id="t-ev">Eventos</SectionTitle></div>
        <EmptyState
          title="Você ainda não tem eventos"
          description="Crie o primeiro e acompanhe as vendas por aqui."
          action={<Button asChild><Link to="/producer/events/new"><I.Criar aria-hidden="true" />Criar evento</Link></Button>}
        />
      </section>
    )
  }
  return (
    <section aria-labelledby="t-ev" data-tour="inicio-proximos" className="rounded-[10px] border border-border bg-card xl:col-span-12">
      <div className="flex items-center gap-3 px-5 pb-2 pt-4">
        <SectionTitle id="t-ev">Eventos</SectionTitle>
        <span className="ml-auto text-xs text-muted-foreground">Ordenados por data. Vendidos e receita desde o início.</span>
        <Link to="/producer/events" className="rounded-sm text-[13px] font-semibold leading-5 text-primary underline-offset-4 hover:underline focus-visible:shadow-ev-foco focus-visible:outline-none">Ver todos</Link>
      </div>
      <div className="relative overflow-x-auto" role="region" aria-label="Tabela de eventos, role para ver todas as colunas" tabIndex={0}>
        <table className="w-full min-w-[760px] border-collapse text-[13px] leading-5">
          <thead>
            <tr className="border-t border-border">
              <th scope="col" className={`${TH} w-16`}><span className="sr-only">Capa</span></th>
              <th scope="col" className={TH}>Evento</th>
              <th scope="col" className={TH}>Situação</th>
              <th scope="col" className={`${TH} text-right`}>Vendidos</th>
              <th scope="col" className={`${TH} text-right`} title="Inclui a taxa do comprador">Receita bruta<span className="sr-only"> (inclui a taxa do comprador)</span></th>
              <th scope="col" className={TH}>Últimos 7 dias</th>
            </tr>
          </thead>
          <tbody>
            <tr className="h-11 border-t border-border bg-secondary font-semibold">
              <td />
              <th scope="row" className="px-3 text-left font-semibold">{eventos.length > linhas.length ? `Total (${eventos.length} eventos)` : 'Total'}</th>
              <td />
              <td className="px-3 text-right font-display tabular-nums">{somaVend === undefined ? '—' : `${inteiro(somaVend)}${mais}`}{somaCap > 0 && `/${inteiro(somaCap)}`}</td>
              <td className="px-3 text-right font-display tabular-nums">{rec(total)}</td>
              <td />
            </tr>
            {linhas.map(e => {
              const n = vendidosDe(vendidos, e.id)
              const cap = capacidadeDe(e)
              const st = situacaoEvento(e)
              const v7 = spark[e.id] ?? []
              return (
                <tr
                  key={e.id}
                  className="evento-cor h-14 cursor-pointer border-t border-border hover:bg-[var(--ev-tint-hover)]"
                  style={varsDoEvento(corDoEvento(e), false, e.accent_intensity ?? 100)}
                  onClick={ev => { if (!(ev.target as HTMLElement).closest('a')) navegar(editarEvento(e)) }}
                >
                  <td className="px-3 py-[3px]"><EventoCapa evento={e} tamanho="mini" /></td>
                  <td className="min-w-0 px-3">
                    <Link to={editarEvento(e)} className="block max-w-[28ch] truncate rounded-sm font-medium text-foreground no-underline focus-visible:shadow-ev-foco focus-visible:outline-none">{e.title}</Link>
                    <span className="block text-xs leading-4 text-muted-foreground">{[dataCurta(dataDoEvento(e)), e.venue_city].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className="whitespace-nowrap px-3"><Situ s={st} /></td>
                  <td className="whitespace-nowrap px-3 text-right">
                    <span className="font-display font-semibold tabular-nums">{n === undefined ? '—' : `${inteiro(n)}${mais}`}{cap > 0 && `/${inteiro(cap)}`}</span>
                    {cap > 0 && <span className="ml-2"><Barra pct={n === undefined ? 0 : Math.min(100, (n / cap) * 100)} /></span>}
                  </td>
                  <td className="whitespace-nowrap px-3 text-right font-display font-semibold tabular-nums">{rec(receita && (receita[e.id] ?? 0))}</td>
                  <td className="px-3"><Spark v={v7} titulo={`${v7.reduce((s, x) => s + x, 0)} ingressos vendidos nos últimos 7 dias`} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export type VendaRecente = { chave: string; qtd: number; tipo: string; evento: string; t: number }

export function VendasRecentes({ vendas, agora }: { vendas: VendaRecente[]; agora: number }) {
  return (
    <section aria-labelledby="t-vr" className="rounded-[10px] border border-border bg-card xl:col-span-12">
      <div className="px-5 pb-2 pt-4"><SectionTitle id="t-vr">Vendas recentes</SectionTitle></div>
      <ul className="px-5 pb-2">
        {vendas.map(v => (
          <li key={v.chave} className="flex gap-2 border-t border-border py-2 text-[13px] leading-5 first:border-t-0">
            <span className="min-w-0 flex-1">
              <strong className="font-semibold">{v.qtd} × {v.tipo}</strong>
              <span className="text-muted-foreground"> · {v.evento}</span>
            </span>
            <span className="whitespace-nowrap text-muted-foreground">{haQuanto(v.t, agora)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
