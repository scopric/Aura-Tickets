import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as I from '@/components/icones/evokaa16'
import EventoCapa from '../../components/EventoCapa'
import { EmptyState } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useProducerEvents, type DbEvent } from '../../hooks/useEvents'
import { useDuplicarEvento } from '../../hooks/useDuplicarEvento'
import { useFixados } from '../../hooks/useFixados'
import { siteUrl } from '../../lib/appHost'
import { corSorteada, ehHex, temFoto, varsDoEvento } from '../../lib/corEvento'
import { confirmacaoDuplicar, refDoEvento, situacaoEvento, type Situacao } from '../../lib/eventoProdutor'
import { supabase } from '../../lib/supabase'
import { brl } from '../../lib/taxa'
import { colunas, dataComSemana, dataCurta, diaBR, diaDoEvento, diasEntre, horaCurta, inicioDaSerie, serieDiaria, type Serie } from '../../lib/visaoEvento'

// Visão geral do evento (V7; prancha Evento.dc.html e contrato §7.2). Só mostra o que o banco tem: sem visitas à
// página, sem origem das vendas, sem "saíram" e "recusados", e o valor é "bruto" (as taxas não são gravadas).

const VENDIDO = ['active', 'used'] // transferido não conta: quem recebe fica com um ingresso ativo
const inteiro = (n: number) => n.toLocaleString('pt-BR')
const pct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// Tons dos tipos de ingresso: 100%, 70% e 45% da cor do evento, depois cinzas (contrato §7.2). A cor não é a única pista:
// a legenda e a lista dizem o nome e o número de cada tipo.
const TONS = [
  { cor: 'var(--evento-grafico)', o: 1 }, { cor: 'var(--evento-grafico)', o: 0.7 }, { cor: 'var(--evento-grafico)', o: 0.45 },
  { cor: 'hsl(var(--muted-foreground))', o: 0.6 }, { cor: 'hsl(var(--muted-foreground))', o: 0.4 }, { cor: 'hsl(var(--muted-foreground))', o: 0.25 },
]
const tom = (i: number) => TONS[i % TONS.length]

// Ponto do selo (sobre fundo escuro nos dois temas)
const PONTO: Record<Situacao, string> = {
  Publicado: '#4cc38a', 'Em análise': '#f0b44c', Rascunho: '#9aa1ad', Encerrado: '#9aa1ad', Cancelado: '#ef5a52', Recusado: '#ef5a52',
}

interface Dados {
  ingressos: { ticket_type_id: string; created_at: string }[] // para o gráfico: no máximo 1.000 (o max_rows do PostgREST)
  vendidos: number
  cortado: boolean // mais de 1.000 ingressos: o gráfico usa os primeiros 1.000
  porTipo: Record<string, number> // contagem exata por tipo
  ingressosHoje: number // exato
  pagos: { total: number; created_at: string }[]
  pagosCortado: boolean // mais de 1.000 pedidos pagos: o bruto é soma parcial
  pagosQtd: number
  vendaHoje: number
  vendaHojeCortada: boolean
  iniciados: number
}

const soma = (l: { total: number }[]) => l.reduce((s, p) => s + (Number(p.total) || 0), 0)

function useDadosDoEvento(e: DbEvent, hoje: string) {
  return useQuery<Dados>({
    queryKey: ['evento-visao', e.id, hoje],
    retry: 1,
    queryFn: async () => {
      // ponytail: o gráfico e o bruto somam linhas no navegador, cortadas no max_rows (1.000) do PostgREST; o count diz se
      // cortou e a tela avisa ("+" e nota). O resto (vendidos, por tipo, hoje, pedidos) é contagem exata. Soma exata e
      // série por dia exata quando houver RPC/view de vendas (F2). Mesmo limite de 10 s do Início.
      // ponytail: orders não tem paid_at: "R$ hoje" é o created_at do pedido pago e "ingressos hoje" é o created_at do
      // ingresso; um pedido criado ontem e pago hoje conta ontem em "R$ hoje" e hoje em "ingressos hoje".
      const desde = new Date(`${hoje}T00:00:00-03:00`).toISOString() // início do dia em Brasília
      const ctl = new AbortController()
      const relogio = setTimeout(() => ctl.abort(), 10000)
      const sinal = ctl.signal
      const ingressosDe = (colunasSel: string, opt: { count: 'exact'; head?: boolean }) =>
        supabase.from('tickets').select(colunasSel, opt).eq('event_id', e.id).in('status', VENDIDO)
      try {
        const [pagosQ, pagosHojeQ, iniciadosQ, ingressosQ, hojeQ, ...tiposQ] = await Promise.all([
          supabase.from('orders').select('total, created_at', { count: 'exact' })
            .eq('event_id', e.id).eq('status', 'paid').abortSignal(sinal),
          supabase.from('orders').select('total', { count: 'exact' })
            .eq('event_id', e.id).eq('status', 'paid').gte('created_at', desde).abortSignal(sinal),
          supabase.from('orders').select('id', { count: 'exact', head: true })
            .eq('event_id', e.id).abortSignal(sinal),
          ingressosDe('ticket_type_id, created_at', { count: 'exact' }).order('created_at').abortSignal(sinal),
          ingressosDe('id', { count: 'exact', head: true }).gte('created_at', desde).abortSignal(sinal),
          ...(e.ticket_types ?? []).map(t => ingressosDe('id', { count: 'exact', head: true }).eq('ticket_type_id', t.id).abortSignal(sinal)),
        ])
        const erro = [pagosQ, pagosHojeQ, iniciadosQ, ingressosQ, hojeQ, ...tiposQ].find(r => r.error)?.error
        if (erro) throw erro
        const pagos = (pagosQ.data ?? []) as unknown as Dados['pagos']
        const pagosHoje = (pagosHojeQ.data ?? []) as unknown as { total: number }[]
        const ingressos = (ingressosQ.data ?? []) as unknown as Dados['ingressos']
        return {
          ingressos,
          vendidos: ingressosQ.count ?? ingressos.length,
          cortado: (ingressosQ.count ?? 0) > ingressos.length,
          porTipo: Object.fromEntries((e.ticket_types ?? []).map((t, i) => [t.id, tiposQ[i].count ?? 0])),
          ingressosHoje: hojeQ.count ?? 0,
          pagos,
          pagosCortado: (pagosQ.count ?? 0) > pagos.length,
          pagosQtd: pagosQ.count ?? pagos.length,
          vendaHoje: soma(pagosHoje),
          vendaHojeCortada: (pagosHojeQ.count ?? 0) > pagosHoje.length,
          iniciados: iniciadosQ.count ?? 0,
        }
      } finally {
        clearTimeout(relogio)
      }
    },
  })
}

// "Entraram" é consulta própria: só ela se atualiza sozinha (a cada 30 s) e só no dia do evento
function useEntraram(eventId: string, ativo: boolean) {
  return useQuery<number>({
    queryKey: ['evento-entraram', eventId],
    enabled: ativo,
    refetchInterval: 30000,
    queryFn: async () => {
      const { count, error } = await supabase.from('tickets').select('id', { count: 'exact', head: true })
        .eq('event_id', eventId).in('status', VENDIDO).not('checked_in_at', 'is', null)
      if (error) throw error
      return count ?? 0
    },
  })
}

const painel = 'rounded-[10px] border border-border bg-card'

function Esqueleto({ faixa = false }: { faixa?: boolean }) {
  return (
    <div aria-busy="true">
      {faixa && <Skeleton className="h-[184px] rounded-ev-xl" />}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[420px] rounded-[10px] lg:col-span-8" />
        <Skeleton className="h-[260px] rounded-[10px] lg:col-span-4" />
      </div>
    </div>
  )
}

function Erro({ texto, refetch, carregando, className }: { texto: string; refetch: () => void; carregando: boolean; className?: string }) {
  return (
    <div role="alert" className={cn(painel, 'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-sm text-foreground">{texto}</p>
      <Button variant="outline" size="sm" onClick={() => refetch()} disabled={carregando}>{carregando ? 'Carregando…' : 'Tentar de novo'}</Button>
    </div>
  )
}

export default function EventOverview() {
  const { eventId } = useParams()
  const { data: eventos, isPending, isError, refetch, isFetching } = useProducerEvents()
  // useProducerEvents já filtra por producer_id: evento de outra conta nunca chega aqui
  const evento = eventos?.find(e => e.id === eventId)

  if (isPending) return <Esqueleto faixa />
  if (isError) return <Erro texto="Não foi possível carregar o evento agora." refetch={refetch} carregando={isFetching} />
  if (!evento) {
    return (
      <EmptyState
        title="Evento não encontrado"
        description="Ele não existe ou não é da sua conta."
        action={<Button asChild variant="outline"><Link to="/producer/events">Ver meus eventos</Link></Button>}
      />
    )
  }
  return <Visao e={evento} />
}

function Visao({ e }: { e: DbEvent }) {
  const [fixados, alternaFixo] = useFixados()
  const { duplicar: duplicarEv, duplicando } = useDuplicarEvento()
  const [agora] = useState(() => Date.now()) // fixo na montagem: "hoje" e "abre em" partem do mesmo instante
  const hoje = diaBR(agora)
  const diaEv = diaDoEvento(e) // null: evento sem data
  const { data: dados, isPending, isError, refetch, isFetching } = useDadosDoEvento(e, hoje)
  const sit = situacaoEvento(e)
  // faixa do dia só em evento no ar (rascunho, em análise, recusado, cancelado e encerrado não têm portaria)
  const noDia = diaEv === hoje && sit === 'Publicado'
  const { data: entraram } = useEntraram(e.id, noDia)

  const cor = ehHex(e.accent_color) ? e.accent_color : corSorteada(e.id)
  const cap = (e.ticket_types ?? []).reduce((s, t) => s + (t.quantity_total || t.capacity || 0), 0) || e.capacity || 0
  const fixado = fixados.includes(e.id)
  const link = siteUrl(`/event/${refDoEvento(e)}`)
  // mesma regra do EventoCapa: foto válida que carrega = texto branco; sem foto (ou foto que falhou) = cartaz, texto na tinta dele
  const foto = [e.cover_image, e.image_url].find(temFoto)
  const [falhou, setFalhou] = useState<string>()
  useEffect(() => {
    if (!foto) return
    const img = new Image()
    img.onerror = () => setFalhou(foto)
    img.src = foto
    return () => { img.onerror = null }
  }, [foto])
  const comFoto = !!foto && foto !== falhou
  const local = [e.venue_name, e.venue_city].filter(Boolean).join(', ')
  const partes = [diaEv ? dataComSemana(diaEv) : 'sem data', horaCurta(e.time), local, cap > 0 ? `${inteiro(cap)} lugares` : null].filter(Boolean)

  const compartilhar = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: e.title, url: link }); return }
      await navigator.clipboard.writeText(link)
      toast.success('Link copiado.')
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return // a pessoa fechou a folha de compartilhar
      toast.error('Não foi possível compartilhar. Copie o link em "Ver página".')
    }
  }

  const duplicar = () => {
    if (window.confirm(confirmacaoDuplicar(e.title))) void duplicarEv(e)
  }

  // botão do grupo de vidro: texto só no computador, no celular só o ícone (o texto fica para leitor de tela)
  const bv = 'rounded-[999px] text-[var(--vidro-texto)] hover:text-[var(--vidro-texto)] active:text-[var(--vidro-texto)] max-sm:size-8 max-sm:px-0'
  const rotulo = (t: string) => <span className="max-sm:sr-only">{t}</span>

  return (
    <div className="evento-cor" style={varsDoEvento(cor) as CSSProperties}>
      <header
        className="relative isolate flex min-h-[184px] flex-col justify-between gap-6 overflow-hidden rounded-ev-xl pb-5 pl-6 pr-4 pt-4"
        style={{ color: comFoto ? '#ffffff' : 'var(--cz-tinta)', textShadow: comFoto ? '0 1px 3px rgb(0 0 0 / 0.55)' : undefined }}
      >
        <EventoCapa evento={e} tamanho="faixa" cor={cor} />
        {/* foto original (sem duotone) pode ser clara: véu escuro para o texto branco continuar legível */}
        {comFoto && <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/75" />}
        <div className="relative z-[1] flex flex-wrap items-center gap-2">
          {/* cor inline: o tema claro escurece .text-white em alguns contextos e o selo é escuro nos dois temas */}
          <span className="inline-flex h-7 items-center gap-1.5 rounded-ev-pill px-3 text-xs font-semibold" style={{ background: '#0b0d12', color: '#ffffff' }}>
            <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: PONTO[sit] }} />
            {sit}
          </span>
          <div role="group" aria-label="Ações do evento" className="vidro ml-auto flex items-center gap-0.5 p-1">
            <Button
              variant="ghost" size="icon-sm" className={bv}
              aria-pressed={fixado}
              aria-label="Fixar evento na lateral"
              onClick={() => alternaFixo(e.id)}
            >
              <I.Estrela size={16} ativo={fixado} className={fixado ? 'text-primary' : undefined} />
            </Button>
            <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-current opacity-20" />
            {sit === 'Publicado' && (
              <>
                <Button asChild variant="ghost" size="sm" className={bv}>
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    <I.AbrirExterno size={16} aria-hidden="true" />{rotulo('Ver página')}<span className="sr-only"> (abre em nova aba)</span>
                  </a>
                </Button>
                <Button variant="ghost" size="sm" className={bv} onClick={compartilhar}>
                  <I.Compartilhar size={16} aria-hidden="true" />{rotulo('Compartilhar')}
                </Button>
              </>
            )}
            <Button asChild variant="ghost" size="sm" className={bv}>
              <Link to={`/producer/events/${e.id}/edit`}><I.Editar size={16} aria-hidden="true" />{rotulo('Editar')}</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className={bv} aria-label="Mais ações do evento"><I.Mais size={16} aria-hidden="true" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={duplicar} disabled={duplicando}><I.Copiar size={16} aria-hidden="true" />Duplicar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="relative z-[1]">
          <h1 className="wide m-0 break-words font-display text-[28px] font-extrabold leading-8 tracking-[-0.02em] sm:text-[40px] sm:leading-[42px]">{e.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {partes.map((t, i) => (
              <span key={i} className="inline-flex gap-2">{i > 0 && <span aria-hidden="true">·</span>}{t}</span>
            ))}
          </p>
        </div>
      </header>

      {isPending ? (
        <Esqueleto />
      ) : isError ? (
        <Erro texto="Não foi possível carregar as vendas deste evento." refetch={refetch} carregando={isFetching} className="mt-6" />
      ) : (
        <Corpo e={e} dados={dados} cap={cap} agora={agora} hoje={hoje} diaEv={diaEv} noDia={noDia} entraram={entraram} />
      )}
    </div>
  )
}

function Corpo({ e, dados, cap, agora, hoje, diaEv, noDia, entraram }: {
  e: DbEvent; dados: Dados; cap: number; agora: number; hoje: string; diaEv: string | null; noDia: boolean; entraram?: number
}) {
  const tipos = e.ticket_types ?? []
  const { vendidos } = dados
  const base = Math.max(cap, vendidos)
  const bruto = soma(dados.pagos)
  const percentual = cap > 0 ? Math.min((vendidos / cap) * 100, 100) : 0
  const naoPagos = Math.max(dados.iniciados - dados.pagosQtd, 0)
  const pagosPct = dados.iniciados > 0 ? Math.min((dados.pagosQtd / dados.iniciados) * 100, 100) : 0
  const fim = diaEv ?? hoje
  const serie = serieDiaria(dados.ingressos, tipos.map(t => t.id), inicioDaSerie(dados.ingressos, tipos.map(t => t.sale_start), fim), fim)
  const nomeBarra = `De ${inteiro(base)} lugares: ${[
    ...tipos.filter(t => dados.porTipo[t.id] > 0).map(t => `${t.name} ${inteiro(dados.porTipo[t.id])}`),
    `não vendidos ${inteiro(Math.max(base - vendidos, 0))}`,
  ].join(', ')}`

  return (
    <>
      {noDia && (
        <section aria-labelledby="t-dia" className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[10px] bg-secondary px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="t-dia" className="text-[15px] font-semibold leading-5">Hoje é o dia do evento</h2>
            <p className="mt-1 text-sm" aria-live="polite">
              Entraram: <strong className="font-display text-[28px] font-semibold leading-8 tabular-nums">{entraram === undefined ? '—' : inteiro(entraram)}</strong>
              {vendidos > 0 && <span className="text-muted-foreground"> de {inteiro(vendidos)} ingressos</span>}
            </p>
            <p className="text-xs text-muted-foreground">Atualiza sozinho a cada 30 segundos.</p>
          </div>
          <Button asChild><Link to={`/producer/checkin?eventId=${e.id}`}><I.Checkin size={16} aria-hidden="true" />Abrir check-in</Link></Button>
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section aria-labelledby="t-vend" className={cn(painel, 'self-start p-5 lg:col-span-8')}>
          <h2 id="t-vend" className="sr-only">Vendas</h2>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-[28px] font-semibold leading-8 tracking-[-0.01em] tabular-nums">{inteiro(vendidos)}</span>
            <span>{cap > 0 ? `de ${inteiro(cap)} vendidos` : 'vendidos'}</span>
            {cap > 0 && <span className="ml-auto font-display text-[13px] font-semibold tabular-nums text-muted-foreground">{pct(percentual)}%</span>}
          </div>
          {cap > 0 && (
            <div
              role="progressbar" aria-label="Ingressos vendidos" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={Math.min(vendidos, cap)}
              className="mt-2 h-2 overflow-hidden rounded-ev-xs bg-secondary"
            >
              <div className="h-full rounded-ev-xs" style={{ width: `${percentual}%`, background: 'var(--evento-grafico)' }} />
            </div>
          )}
          <p className="mt-3">
            {brl(dados.vendaHoje)}{dados.vendaHojeCortada ? '+' : ''} hoje · {inteiro(dados.ingressosHoje)} {dados.ingressosHoje === 1 ? 'ingresso' : 'ingressos'} hoje · {brl(bruto)}{dados.pagosCortado ? '+' : ''} bruto
          </p>
          <p className="text-xs text-muted-foreground">
            {dados.pagosCortado || dados.vendaHojeCortada ? 'Soma parcial: mais de 1.000 pedidos pagos. ' : ''}Bruto: pedidos pagos, com a taxa do comprador.
          </p>

          <VendasPorDia serie={serie} nomes={tipos.map(t => t.name)} exatos={tipos.map(t => dados.porTipo[t.id])} vendidos={vendidos} hoje={hoje} cortado={dados.cortado} comEvento={!!diaEv} />
        </section>

        <section aria-labelledby="t-ingr" className="lg:col-span-4 lg:pt-1">
          <div className="mb-3 flex items-center">
            <h2 id="t-ingr" className="m-0 text-[15px] font-semibold leading-5">Ingressos</h2>
            <Link to={`/producer/events/${e.id}/edit`} className={cn('ml-auto rounded-ev-xs text-[13px] font-semibold text-primary underline-offset-4 hover:underline', foco)}>Gerenciar</Link>
          </div>
          {tipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum tipo de ingresso criado ainda.</p>
          ) : (
            <>
              <div role="img" aria-label={nomeBarra} className="flex h-2 gap-px overflow-hidden rounded-ev-xs bg-secondary">
                {tipos.map((t, i) => dados.porTipo[t.id] > 0 && (
                  <span key={t.id} className="block h-full" style={{ width: `${(dados.porTipo[t.id] / base) * 100}%`, background: tom(i).cor, opacity: tom(i).o }} />
                ))}
              </div>
              <ul className="mt-3 list-none p-0">
                {tipos.map((t, i) => {
                  const vend = dados.porTipo[t.id]
                  const total = t.quantity_total || t.capacity || 0
                  const esgotado = total > 0 && vend >= total
                  const abre = t.sale_start && Date.parse(t.sale_start) > agora ? `abre em ${dataCurta(diaBR(t.sale_start))}` : null
                  const nota = abre ?? (t.is_active === false ? 'oculto na página' : null)
                  return (
                    <li key={t.id} className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto_48px] items-center gap-x-3 border-t border-border py-1.5 text-[13px] first:border-t-0">
                      <span className="min-w-0">
                        <span className="block break-words font-medium">{t.name}</span>
                        {nota && <span className="block text-xs leading-4 text-muted-foreground">{nota}</span>}
                      </span>
                      <span>
                        <span className="font-display font-semibold tabular-nums">{total > 0 ? `${inteiro(vend)}/${inteiro(total)}` : inteiro(vend)}</span>
                        {esgotado && <span className="ml-2 font-semibold text-[var(--ev-warm-text)]">Esgotado</span>}
                      </span>
                      <span aria-hidden="true" className="h-1 w-12 overflow-hidden rounded-[2px] bg-secondary">
                        {total > 0 && <span className="block h-full" style={{ width: `${Math.min((vend / total) * 100, 100)}%`, background: tom(i).cor, opacity: tom(i).o }} />}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>

        <section aria-labelledby="t-funil" className={cn(painel, 'px-5 py-4 lg:col-span-8')}>
          <h2 id="t-funil" className="m-0 mb-1 text-[15px] font-semibold leading-5">Funil de vendas</h2>
          {dados.iniciados === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              <li className="py-2.5">
                <div className="flex items-baseline gap-2"><span className="font-medium">Pedidos iniciados</span><span className="ml-auto font-display font-semibold tabular-nums">{inteiro(dados.iniciados)}</span></div>
                <p className="mt-1.5 text-xs leading-4 text-muted-foreground">Todos os pedidos criados, pagos ou não.</p>
              </li>
              <li className="border-t border-border py-2.5">
                <div className="flex items-baseline gap-2"><span className="font-medium">Pagos</span><span className="ml-auto font-display font-semibold tabular-nums">{inteiro(dados.pagosQtd)}</span></div>
                <div aria-hidden="true" className="relative mt-2 h-2 overflow-hidden rounded-ev-xs bg-secondary">
                  <span className="absolute inset-y-0 left-0 w-full rounded-ev-xs bg-primary opacity-[.18]" />
                  <span className="absolute inset-y-0 left-0 rounded-ev-xs bg-primary" style={{ width: `${pagosPct}%` }} />
                </div>
                <p className="mt-1.5 text-xs leading-4 text-muted-foreground">
                  {pct(pagosPct)}% dos pedidos foram pagos · não pagos: {inteiro(naoPagos)} (pendentes, recusados, cancelados e reembolsados)
                </p>
              </li>
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

function VendasPorDia({ serie, nomes, exatos, vendidos, hoje, cortado, comEvento }: {
  serie: Serie; nomes: string[]; exatos: number[]; vendidos: number; hoje: string; cortado: boolean; comEvento: boolean
}) {
  const { dias } = serie
  const nDias = dias.length
  const passo = nDias > 90 ? 7 : 1 // período longo: uma barra por semana, para a barra não sumir
  const cols = colunas(serie, passo)
  const n = cols.length
  const totais = cols.map(c => c.porTipo.reduce((a, b) => a + b, 0))
  const total = totais.reduce((a, b) => a + b, 0)
  const pico = Math.max(...totais, 1)
  const diaHoje = diasEntre(dias[0], hoje)
  const idxHoje = cols.findIndex(c => diaHoje >= c.de && diaHoje <= c.ate)
  const faltam = diasEntre(hoje, dias[nDias - 1])
  const larg = 700 / n
  const bw = larg * 0.72
  const contorno = n <= 45 // com barra fina, o contorno de 1 px comeria a cor
  const iPico = totais.indexOf(Math.max(...totais))
  const periodo = (i: number) => (passo === 1 ? dataCurta(dias[cols[i].de]) : `${dataCurta(dias[cols[i].de])} a ${dataCurta(dias[cols[i].ate])}`)
  const resumo = `Ingressos vendidos por ${passo === 1 ? 'dia' : 'semana'}, de ${dataCurta(dias[0])} a ${dataCurta(dias[nDias - 1])}: ${inteiro(vendidos)} no total; maior ${passo === 1 ? 'dia' : 'semana'} ${periodo(iPico)}, com ${inteiro(pico)}`
    + (comEvento && idxHoje >= 0 && faltam > 0 ? `; faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'} para o evento` : '')
  // 6 marcas no eixo, da primeira à última coluna (menos, se houver poucas)
  const k = Math.min(6, n)
  const marcas = Array.from(new Set(Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / Math.max(k - 1, 1)))))

  return (
    <>
      <div className="mb-7 mt-6 flex items-baseline gap-3">
        <h3 className="m-0 text-[15px] font-semibold leading-5">{comEvento ? 'Vendas por dia até o evento' : 'Vendas por dia'}</h3>
        {comEvento && idxHoje >= 0 && faltam > 0 && <span className="ml-auto text-xs text-muted-foreground">{faltam === 1 ? 'falta 1 dia' : `faltam ${faltam} dias`}</span>}
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum ingresso vendido ainda.</p>
      ) : (
        <>
          <div className="relative">
            <svg viewBox="0 0 700 180" preserveAspectRatio="none" role="img" aria-label={resumo} className="block h-[180px] w-full">
              {[8, 88, 168].map(y => <line key={y} x1="0" x2="700" y1={y} y2={y} stroke="hsl(var(--border))" vectorEffect="non-scaling-stroke" />)}
              {idxHoje >= 0 && (
                <line x1={(idxHoje + 0.5) * larg} x2={(idxHoje + 0.5) * larg} y1="0" y2="168" stroke="hsl(var(--muted-foreground))" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
              )}
              {cols.map((col, i) => {
                if (totais[i] === 0) return null
                let y = 168
                return (
                  <g key={i}>
                    <title>{`${periodo(i)}: ${inteiro(totais[i])} ${totais[i] === 1 ? 'ingresso' : 'ingressos'}`}</title>
                    {col.porTipo.map((q, c) => {
                      if (q === 0) return null
                      const h = (q / pico) * 160
                      y -= h
                      return (
                        <rect
                          key={c} x={i * larg + (larg - bw) / 2} y={y} width={bw} height={h} vectorEffect="non-scaling-stroke"
                          style={{ fill: tom(c).cor, fillOpacity: tom(c).o, stroke: contorno ? 'hsl(var(--card))' : 'none', strokeWidth: 1 }}
                        />
                      )
                    })}
                  </g>
                )
              })}
            </svg>
            {idxHoje >= 0 && (
              <span aria-hidden="true" className="absolute -top-[18px] -translate-x-1/2 text-[11px] font-semibold leading-[14px] text-muted-foreground" style={{ left: `${((idxHoje + 0.5) / n) * 100}%` }}>hoje</span>
            )}
          </div>
          <div aria-hidden="true" className="mt-1.5 flex justify-between text-[11px] leading-[14px] tabular-nums text-muted-foreground">
            {marcas.map(i => (
              <span key={i} className="text-center">
                {comEvento && <span className="block font-display font-semibold text-foreground">D-{nDias - 1 - cols[i].ate}</span>}
                {dataCurta(dias[cols[i].ate])}
              </span>
            ))}
          </div>
          <ul className="mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs leading-4 text-muted-foreground">
            {nomes.map((nome, c) => (
              <li key={c} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-[2px]" style={{ background: tom(c).cor, opacity: tom(c).o }} />
                {nome} <strong className="font-display font-semibold text-foreground">{inteiro(exatos[c])}</strong>
              </li>
            ))}
          </ul>
          {passo > 1 && <p className="mt-2 text-xs text-muted-foreground">Uma barra por semana, contando do dia do evento para trás.</p>}
          {cortado && <p className="mt-2 text-xs text-muted-foreground">Gráfico com os primeiros 1.000 ingressos vendidos; os totais acima e a lista de ingressos são exatos.</p>}
        </>
      )}
    </>
  )
}
