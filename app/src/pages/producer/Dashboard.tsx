import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useTourLog } from '../../hooks/useTourLog'
import { useProducerEvents } from '../../hooks/useEvents'
import { brl } from '../../lib/taxa'
import { vendasPagas, type VendasPagas } from '../../lib/vendasPagas'
import { siteUrl } from '../../lib/appHost'
import { refDoEvento, situacaoEvento } from '../../lib/eventoProdutor'
import { soltarConfete } from '../../lib/confete'
import { corDoEvento, derivarCor } from '../../lib/corEvento'
import {
  PERIODOS, VENDIDO, ehPeriodo, janelas, resumoDe, serie, rotuloDoBalde, dataPorExtenso, dataDoEvento,
  inteiro, inteiroMais, brlMais, sugestaoDoEvo, type Linha, type Periodo,
} from '../../lib/inicioProdutor'
import { PageHeader, SectionTitle } from '@/components/producer/ui'
import GraficoLinha from '@/components/producer/GraficoLinha'
import { Contagem, ProximoEvento, FaixaAviso, TabelaEventos, VendasRecentes, type VendaRecente } from '@/components/producer/InicioBlocos'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/toggle-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import * as I from '@/components/icones/evokaa16'

const eixoBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })

type Metrica = 'receita' | 'ingressos'
type Pedido = Linha & { evento: string }
type Ingresso = Linha & { evento: string; tipo: string; pedido: string }
// Linhas da mais nova para a mais velha. Cortadas no max_rows (1.000) do PostgREST: `cortado` diz que as mais velhas ficaram de fora.
// exato: soma de todos os pedidos pagos feita no banco (L6); nulo se a função ainda não existe ou falhou (a tela cai na soma parcial)
type Vendas = { pedidos: Pedido[]; ingressos: Ingresso[]; pedidosCortado: boolean; ingressosCortado: boolean; exato: VendasPagas | null }

const TEXTO_PERIODO: Record<Periodo, string> = { hoje: 'hoje', '7d': 'nos últimos 7 dias', '30d': 'nos últimos 30 dias', tudo: 'até agora' }
const LEGENDA: Record<Periodo, [string, string]> = {
  hoje: ['Hoje', 'Ontem'], '7d': ['7 dias', '7 dias anteriores'], '30d': ['30 dias', '30 dias anteriores'], tudo: ['Todo o período', ''],
}

// ponytail: limite único de 10 s para as consultas da tela; estourou, vira erro com "Tentar de novo".
// AbortController + setTimeout em vez de AbortSignal.timeout (não existe no Safari < 16)
async function comLimite<T>(f: (sinal: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController()
  const relogio = setTimeout(() => ctl.abort(), 10000)
  try { return await f(ctl.signal) } finally { clearTimeout(relogio) }
}

function Variacao({ v }: { v: number | null }) {
  if (v == null) return null
  const pct = Math.round(Math.abs(v) * 100)
  if (pct === 0) return <span className="font-display text-xs font-semibold tabular-nums text-muted-foreground">0%<span className="sr-only"> sem variação sobre o período anterior</span></span>
  const sobe = v > 0
  return (
    <span className={`inline-flex items-center gap-0.5 font-display text-xs font-semibold leading-4 tabular-nums ${sobe ? 'text-[var(--ev-success)]' : 'text-destructive'}`}>
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">{sobe ? <I.Sobe size={10} /> : <I.Desce size={10} />}{pct}%</span>
      <span className="sr-only">{sobe ? 'aumento' : 'queda'} de {pct}% sobre o período anterior</span>
    </span>
  )
}

export default function ProducerDashboard() {
  const { user } = useAuth()
  const { feitos: registrados, registrar, carregou, erro: erroRegistro } = useTourLog()
  const [montagem] = useState(() => Date.now())
  const [busca, setBusca] = useSearchParams()
  const [metrica, setMetrica] = useState<Metrica>('receita')

  const p = busca.get('periodo')
  const periodo: Periodo = ehPeriodo(p) ? p : '7d'
  const mudaPeriodo = (v: string) => setBusca((prev: URLSearchParams) => { const n = new URLSearchParams(prev); n.set('periodo', v); return n }, { replace: true })

  const eventosQ = useProducerEvents()

  // Decisão 157.1: confete no 1º evento aprovado, uma vez por conta (registro no banco; o ref cobre StrictMode e re-render
  // enquanto o registro otimista não chega). Com "reduzir movimento" não desenha, mas o registro é gravado igual.
  // Só é o "1º" se todos os aprovados são recentes (7 dias): conta antiga sem registro não ganha festa fora de hora.
  // E só com o registro lido sem erro (leitura falha viria como "nada registrado" e repetiria a festa).
  const celebrou = useRef(false)
  const aprovados = eventosQ.data?.filter(e => e.approval_status === 'approved') ?? []
  const aprovado = aprovados.length && aprovados.every(e => montagem - Date.parse(e.approved_at ?? '') < 7 * 86400000) ? aprovados[0] : undefined
  useEffect(() => {
    if (!aprovado || !carregou || erroRegistro || celebrou.current || registrados.has('celebracao:primeiro-evento')) return
    celebrou.current = true
    const d = derivarCor(corDoEvento(aprovado), aprovado.accent_intensity ?? 100)
    soltarConfete([d.cor, d.duoLuz, '#f2994a'])
    registrar('celebracao:primeiro-evento', { silencioso: true })
  }, [aprovado, carregou, erroRegistro, registrados, registrar])

  const vendasQ = useQuery({
    queryKey: ['producer-inicio-vendas', user?.id],
    enabled: !!user?.id,
    retry: 1,
    // o "Hoje" e o título seguem o relógio: volta a buscar ao voltar para a aba (e o relógio da tela vem desta busca)
    staleTime: 60000,
    refetchOnWindowFocus: true,
    queryFn: (): Promise<Vendas> => comLimite(async sinal => {
      const id = user!.id
      // ponytail: soma no navegador, cortada no max_rows (1.000) do PostgREST; o count diz se cortou e a tela avisa
      // "soma parcial". Soma exata quando houver RPC/view de vendas (F2).
      // Receita = orders.total dos pagos (o "bruto"): o checkout ainda não grava service_fee/processing_fee e o total
      // inclui a taxa do comprador (Decisões 88 e 111). Receita líquida quando a F2 gravar as taxas.
      const [pedidos, ingressos, exato] = await Promise.all([
        supabase.from('orders').select('total, created_at, event_id, events!inner(producer_id)', { count: 'exact' })
          .eq('events.producer_id', id).eq('status', 'paid').order('created_at', { ascending: false }).abortSignal(sinal),
        // sem nome nem e-mail do comprador (LGPD): só o que o bloco "Vendas recentes" mostra
        supabase.from('tickets').select('order_id, event_id, ticket_type_id, created_at, events!inner(producer_id)', { count: 'exact' })
          .eq('events.producer_id', id).in('status', VENDIDO).order('created_at', { ascending: false }).abortSignal(sinal),
        vendasPagas({}, sinal).catch(() => null),
      ])
      if (pedidos.error) throw pedidos.error
      if (ingressos.error) throw ingressos.error
      const lp = (pedidos.data ?? []) as unknown as { total: number; created_at: string; event_id: string }[]
      const li = (ingressos.data ?? []) as unknown as { order_id: string; event_id: string; ticket_type_id: string; created_at: string }[]
      // da mais nova para a mais velha, de novo aqui: o corte, "Vendas recentes" e a primeira venda dependem dessa ordem
      return {
        pedidos: lp.map(x => ({ t: Date.parse(x.created_at), v: Number(x.total) || 0, evento: x.event_id })).sort((a, b) => b.t - a.t),
        ingressos: li.map(x => ({ t: Date.parse(x.created_at), v: 1, evento: x.event_id, tipo: x.ticket_type_id, pedido: x.order_id })).sort((a, b) => b.t - a.t),
        pedidosCortado: (pedidos.count ?? 0) > lp.length,
        ingressosCortado: (ingressos.count ?? 0) > li.length,
        exato,
      }
    }),
  })

  // só para o checklist "Primeiro evento no ar"
  const passosQ = useQuery({
    queryKey: ['producer-inicio-passos', user?.id],
    enabled: !!user?.id,
    retry: 1,
    queryFn: () => comLimite(async sinal => {
      const id = user!.id
      const [perfil, pessoa, checkin] = await Promise.all([
        supabase.from('producer_profiles').select('company_name').eq('id', id).abortSignal(sinal).maybeSingle(),
        supabase.from('profiles').select('full_name').eq('id', id).abortSignal(sinal).maybeSingle(),
        supabase.from('tickets').select('id, events!inner(producer_id)')
          .eq('events.producer_id', id).not('checked_in_at', 'is', null).limit(1).abortSignal(sinal),
      ])
      // sem permissão (42501) = perfil não preenchido; outro erro (rede, tempo) não pode virar "não preenchido"
      if (perfil.error && perfil.error.code !== '42501') throw perfil.error
      if (checkin.error) throw checkin.error
      // a linha nasce com company_name = nome da pessoa (ou "Minha Empresa"): só conta como preenchido se o produtor mudou
      const empresa = (perfil.data as { company_name: string | null } | null)?.company_name?.trim().toLowerCase()
      // erro em profiles = nome desconhecido (não derruba o checklist). ponytail: autônomo cuja razão social é o próprio nome nunca marca o passo; checar CNPJ preenchido se reclamarem
      const nome = (pessoa.error ? null : pessoa.data as { full_name: string | null } | null)?.full_name?.trim().toLowerCase()
      return {
        empresa: !!empresa && empresa !== 'minha empresa' && empresa !== nome,
        checkinFeito: (checkin.data ?? []).length > 0,
      }
    }),
  })

  const v = vendasQ.data
  const agora = vendasQ.dataUpdatedAt || montagem
  const cabecalho = (comControles: boolean) => (
    <PageHeader
      title={dataPorExtenso(new Date(agora))}
      actions={comControles ? (
        <>
          <Segmented label="Período" size="sm" value={periodo} onValueChange={mudaPeriodo} items={PERIODOS} className="w-full sm:w-72" />
          {periodo !== 'tudo' && <span className="text-[13px] text-muted-foreground">comparado a <strong className="font-semibold text-foreground">período anterior</strong></span>}
          {vendasQ.dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground">
              Atualizado às {new Date(vendasQ.dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </>
      ) : undefined}
    />
  )

  // isPending (não isLoading): sem usuário ainda a consulta fica parada e a tela segue no esqueleto
  if (eventosQ.isPending) {
    return (
      <div aria-busy="true">
        {cabecalho(false)}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Skeleton className="h-[386px] rounded-[10px] bg-muted xl:col-span-8" />
          <Skeleton className="h-[386px] rounded-[10px] bg-muted xl:col-span-4" />
        </div>
        <Skeleton className="mt-6 h-48 rounded-[10px] bg-muted" />
      </div>
    )
  }

  if (eventosQ.isError) {
    return (
      <div>
        {cabecalho(false)}
        <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">Não foi possível carregar seus números agora.</p>
          <Button variant="outline" size="sm" onClick={() => eventosQ.refetch()} disabled={eventosQ.isFetching}>
            {eventosQ.isFetching ? 'Carregando…' : 'Tentar de novo'}
          </Button>
        </div>
      </div>
    )
  }

  const eventos = eventosQ.data
  const hojeMs = new Date(agora).setHours(0, 0, 0, 0)
  const noFuturo = (e: (typeof eventos)[number]) => dataDoEvento(e).getTime() >= hojeMs
  const publicados = eventos.filter(e => situacaoEvento(e) === 'Publicado')

  // ---- Checklist "Primeiro evento no ar" (PR #129): ----
  const passosDados = passosQ.data
  const vendidosTotal = v?.ingressos.length ?? 0
  const passos = passosDados ? [
    { feito: eventos.length > 0, texto: 'Criar o primeiro evento', to: '/producer/events/new?tour=criar-evento' },
    {
      // publicado (em análise, aprovado ou recusado) ou já encerrado: foi enviado
      feito: eventos.some(e => e.status === 'published' || e.status === 'ended'),
      texto: 'Enviar um evento para análise',
      to: '/producer/events?tour=eventos',
    },
    { feito: eventos.some(e => (e.ticket_types ?? []).length > 0), texto: 'Adicionar os ingressos', to: '/producer/events?tour=eventos' }, // ingressos ficam no painel do evento: não levar a criar outro
    { feito: passosDados.empresa, texto: 'Preencher o perfil da empresa', to: '/producer/settings?tour=configuracoes' },
    { feito: publicados.length > 0, texto: 'Evento aprovado e no ar', to: '/producer/events?tour=eventos' },
    // ponytail: sem venda (gateway desligado), não há o que testar na portaria; o item entra com o 1º ingresso vendido
    ...(vendidosTotal > 0 ? [{ feito: passosDados.checkinFeito, texto: 'Testar o check-in', to: '/producer/checkin?tour=checkin' }] : []),
  ] : []
  const feitos = passos.filter(x => x.feito).length
  // esconde só depois de ler o registro e as vendas: evita piscar o cartão de quem já dispensou ou o 5 virar 6
  const mostrarChecklist = carregou && !vendasQ.isPending && passos.length > 0 && feitos < passos.length && !registrados.has('checklist:dispensado')

  const checklist = mostrarChecklist && (
    <section aria-labelledby="primeiros-passos" data-tour="inicio-checklist" className="mb-6 rounded-[10px] border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <SectionTitle id="primeiros-passos">Primeiro evento no ar</SectionTitle>
        <span className="flex items-baseline gap-3">
          <span className="font-display text-sm font-semibold tabular-nums text-muted-foreground">{feitos} de {passos.length}</span>
          <Button size="sm" variant="ghost" aria-label="Dispensar checklist" onClick={() => registrar('checklist:dispensado')}>Dispensar</Button>
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${(feitos / passos.length) * 100}%` }} />
      </div>
      <ul className="mt-2">
        {passos.map(x => (
          <li key={x.texto} className="flex min-h-12 items-center gap-3 border-t border-border text-sm first:border-t-0">
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full ${x.feito ? 'bg-[var(--ev-success)] text-white' : 'shadow-[inset_0_0_0_1.5px_hsl(var(--input))]'}`}
              aria-hidden="true"
            >
              {x.feito && <I.Check size={12} />}
            </span>
            {x.feito ? (
              <span className="text-muted-foreground line-through">{x.texto}<span className="sr-only"> (feito)</span></span>
            ) : (
              <Link to={x.to} className="rounded-sm text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:shadow-ev-foco focus-visible:outline-none">{x.texto}</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )

  const rodape = (
    <div className="mt-10 flex justify-end gap-2 border-t border-border pt-3">
      <Button asChild variant="ghost" size="sm" className="min-h-11"><Link to="/producer/central">Dashboards</Link></Button>
      <Button asChild variant="ghost" size="sm" className="min-h-11"><Link to="/producer/dashboard?tour=inicio">Ver tour desta tela</Link></Button>
    </div>
  )

  // ---- Vendas do período ----
  const primeira = v ? Math.min(v.pedidos.at(-1)?.t ?? Infinity, v.ingressos.at(-1)?.t ?? Infinity) : undefined
  const { atual, anterior } = janelas(periodo, agora, Number.isFinite(primeira) ? primeira : undefined)
  const rec = resumoDe(v?.pedidos ?? [], v?.pedidosCortado ?? false, atual, anterior, agora)
  const ing = resumoDe(v?.ingressos ?? [], v?.ingressosCortado ?? false, atual, anterior, agora)
  const ticketMedio = !rec.parcial && !ing.parcial && ing.valor > 0 && rec.valor > 0 ? rec.valor / ing.valor : null
  const ativo = metrica === 'receita' ? rec : ing
  const linhasAtivas = metrica === 'receita' ? v?.pedidos ?? [] : v?.ingressos ?? []
  const [legAtual, legAnt] = LEGENDA[periodo]
  const nomeMetrica = metrica === 'receita' ? 'Receita bruta' : 'Ingressos vendidos'
  const formatoAtivo = metrica === 'receita' ? (ativo.parcial ? brlMais : brl) : (ativo.parcial ? inteiroMais : inteiro)

  const proximo = eventos
    .filter(e => ['Publicado', 'Em análise', 'Rascunho'].includes(situacaoEvento(e)) && noFuturo(e))
    .sort((a, b) => dataDoEvento(a).getTime() - dataDoEvento(b).getTime())[0]

  const porEvento: Record<string, number> = {}
  const porTipo: Record<string, number> = {}
  const ingPorEvento: Record<string, Linha[]> = {}
  for (const i of v?.ingressos ?? []) {
    porEvento[i.evento] = (porEvento[i.evento] ?? 0) + 1
    porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1
    ;(ingPorEvento[i.evento] ??= []).push(i)
  }
  const vendidos = { porEvento, cortado: v?.ingressosCortado ?? false }
  const receitaPorEvento: Record<string, number> = {}
  for (const x of v?.pedidos ?? []) receitaPorEvento[x.evento] = (receitaPorEvento[x.evento] ?? 0) + x.v
  // soma exata do banco (sem o teto de 1.000 linhas) vale mais que a do navegador
  if (v?.exato) for (const e of v.exato.por_evento) receitaPorEvento[e.event_id] = Number(e.total) || 0
  const sete = janelas('7d', agora).atual
  const spark = Object.fromEntries(eventos.map(e => [e.id, serie(ingPorEvento[e.id] ?? [], sete, agora)]))

  // futuros primeiro (do mais próximo), depois os passados (do mais recente)
  const ordenados = [...eventos].sort((a, b) => {
    const [da, db] = [dataDoEvento(a).getTime(), dataDoEvento(b).getTime()]
    return (da >= hojeMs) === (db >= hojeMs) ? (da >= hojeMs ? da - db : db - da) : da >= hojeMs ? -1 : 1
  })

  // "Evo sugere": uma sugestão por vez (lib/inicioProdutor). A dispensa vai para o registro do tour; só decide depois de lê-lo.
  // Só depois de tudo chegar (registro, vendas e perfil): senão a faixa troca de sugestão enquanto carrega.
  const sugestao = carregou && !vendasQ.isPending && !passosQ.isPending ? sugestaoDoEvo({
    eventos, vendidos: v ? vendidos : undefined, porTipo, checkinFeito: passosDados?.checkinFeito, empresa: passosDados?.empresa,
  }, registrados, agora) : null

  // Vendas recentes: os ingressos do mesmo pedido e tipo viram uma linha ("2 × Pista"); sem nome de comprador (LGPD)
  const tipos = new Map(eventos.flatMap(e => (e.ticket_types ?? []).map(t => [t.id, t.name] as const)))
  const titulos = new Map(eventos.map(e => [e.id, e.title]))
  const recentes = new Map<string, VendaRecente>()
  for (const i of v?.ingressos ?? []) {
    const chave = `${i.pedido}|${i.tipo}`
    const g = recentes.get(chave)
    if (g) g.qtd += 1
    else if (recentes.size < 8) recentes.set(chave, { chave, qtd: 1, tipo: tipos.get(i.tipo) ?? 'Ingresso', evento: titulos.get(i.evento) ?? '', t: i.t })
  }

  const copiarLink = async (endereco?: string) => {
    const e = proximo && situacaoEvento(proximo) === 'Publicado' ? proximo : publicados[0]
    const alvo = endereco ?? (e && refDoEvento(e))
    if (!alvo) return
    try {
      await navigator.clipboard.writeText(siteUrl(`/event/${alvo}`))
      toast.success('Link do evento copiado.')
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  const semDado = ativo.valor === 0 && (ativo.ant ?? 0) === 0
  // ingressos sem receita (cortesia, evento gratuito): não dizer que não houve venda
  const textoSemDado = metrica === 'ingressos' ? 'Nenhum ingresso vendido' : ing.valor > 0 ? 'Nenhuma receita' : 'Nenhuma venda'
  const apoioReceita = [
    rec.parcial ? 'Soma parcial: mais de 1.000 pedidos pagos' : ticketMedio != null ? `ticket médio ${brl(ticketMedio)}` : '',
    'inclui a taxa do comprador',
  ].filter(Boolean).join(' · ')
  const variacaoTexto = ativo.variacao == null ? '' : `, ${ativo.variacao >= 0 ? 'aumento' : 'queda'} de ${Math.round(Math.abs(ativo.variacao) * 100)}% sobre o período anterior`
  const resumo = `${nomeMetrica}, ${TEXTO_PERIODO[periodo]}: ${formatoAtivo(ativo.valor)}${variacaoTexto}`
  // aba-cartão: ui/tabs (linha, o sublinhado desliza) com a aba ocupando metade do painel
  const aba = (k: Metrica, rotulo: string, numero: ReactNode, r: typeof rec, apoio: string) => (
    <TabsTrigger
      key={k}
      value={k}
      className={`mb-0 h-auto min-h-[76px] flex-col items-start justify-start gap-0 whitespace-normal rounded-none px-5 py-1.5 text-left data-[state=active]:bg-[var(--ev-tint-ativo)] ${k === 'receita' ? 'rounded-tl-[10px]' : 'rounded-tr-[10px] border-l border-border'}`}
    >
      <span className="text-[13px] font-medium leading-5">{rotulo}</span>
      <span className="flex items-baseline gap-2">
        <span className="font-display text-[22px] font-semibold leading-7 tabular-nums">{numero}</span>
        <Variacao v={r.variacao} />
      </span>
      <span className="min-h-4 text-xs font-normal leading-4 text-muted-foreground">{apoio}</span>
    </TabsTrigger>
  )

  const painelVendas = (
    <section
      aria-label="Vendas"
      data-tour="inicio-numeros"
      className={`rounded-[10px] border border-border bg-card ${proximo ? 'xl:col-span-8' : 'xl:col-span-12'}`}
    >
      {vendasQ.isPending ? (
        <div role="status" aria-label="Carregando vendas" style={{ height: 386 }}>
          <Skeleton className="h-[76px] rounded-none rounded-t-[10px] bg-muted" />
          <Skeleton className="mx-5 mr-16 mt-5 h-[240px] bg-muted" />
        </div>
      ) : vendasQ.isError ? (
        <div role="alert" className="flex flex-col items-center justify-center gap-3 px-4 text-center" style={{ height: 386 }}>
          <p className="text-sm text-foreground">Não deu para carregar o gráfico de vendas.</p>
          <p className="text-[13px] text-muted-foreground">O resto da página carregou.</p>
          <Button variant="outline" size="sm" onClick={() => vendasQ.refetch()} disabled={vendasQ.isFetching}>
            {vendasQ.isFetching ? 'Carregando…' : 'Tentar de novo'}
          </Button>
        </div>
      ) : (
        <Tabs value={metrica} onValueChange={v => setMetrica(v as Metrica)} className="gap-0">
          <TabsList aria-label="Métrica do gráfico" className="h-auto grid-cols-2 items-stretch gap-0 grid">
            {aba('receita', 'Receita bruta', <Contagem valor={rec.valor} formato={rec.parcial ? brlMais : brl} />, rec, apoioReceita)}
            {aba('ingressos', 'Ingressos vendidos', <Contagem valor={ing.valor} formato={ing.parcial ? inteiroMais : inteiro} />, ing,
              ing.parcial ? 'Contagem parcial: mais de 1.000 ingressos' : '')}
          </TabsList>
          <TabsContent value={metrica} className="mt-0">
            <GraficoLinha
              key={`${metrica}-${periodo}`}
              atual={semDado ? [] : serie(linhasAtivas, atual, agora)}
              anterior={anterior && !semDado ? serie(linhasAtivas, anterior) : null}
              n={atual.n}
              inteiro={metrica === 'ingressos'}
              formatoValor={metrica === 'receita' ? brl : inteiro}
              formatoEixo={metrica === 'receita' ? (x => eixoBrl.format(x)) : inteiro}
              rotulo={k => rotuloDoBalde(atual, k)}
              legendaAtual={legAtual}
              legendaAnterior={legAnt}
              resumo={resumo}
              vazio={semDado ? (
                <>
                  <p>{textoSemDado} {TEXTO_PERIODO[periodo]}</p>
                  {publicados.length > 0 ? (
                    <Button variant="outline" size="sm" onClick={() => copiarLink()}><I.Copiar aria-hidden="true" />Copiar link do evento</Button>
                  ) : (
                    <p className="text-[13px]">As vendas aparecem aqui quando um evento estiver no ar.</p>
                  )}
                </>
              ) : undefined}
            />
          </TabsContent>
        </Tabs>
      )}
    </section>
  )

  return (
    <div>
      {cabecalho(true)}
      {checklist}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {painelVendas}
        {proximo && (
          <div className="order-first xl:order-none xl:col-span-4">
            <ProximoEvento evento={proximo} agora={agora} />
          </div>
        )}

        {sugestao && (
          <FaixaAviso
            acao={sugestao.acao.copiar ? { texto: sugestao.acao.texto, onClick: () => copiarLink(sugestao.acao.copiar) } : sugestao.acao}
            onDispensar={() => registrar(sugestao.chave)}
          >
            {sugestao.texto}
            {sugestao.barra && (
              <span className="ml-3 inline-flex items-center gap-2 align-middle">
                <span aria-hidden="true" className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                  <span className="block h-full rounded-full bg-[var(--ev-warm)]" style={{ width: `${Math.min(100, sugestao.barra.pct)}%` }} />
                </span>
                <span className="font-display text-[13px] font-semibold tabular-nums text-[var(--ev-warm-text)]">{Math.round(sugestao.barra.pct)}%{sugestao.barra.mais && '+'}</span>
              </span>
            )}
          </FaixaAviso>
        )}

        <TabelaEventos
          eventos={eventos}
          linhas={ordenados.slice(0, 10)}
          vendidos={v ? vendidos : undefined}
          receita={v ? receitaPorEvento : undefined}
          receitaCortada={v && !v.exato ? v.pedidosCortado : false}
          spark={spark}
          total={v?.exato ? Number(v.exato.total) || 0 : v?.pedidos.reduce((s, x) => s + x.v, 0)}
        />

        {recentes.size > 0 && <VendasRecentes vendas={[...recentes.values()]} agora={agora} />}
      </div>
      {rodape}
    </div>
  )
}
