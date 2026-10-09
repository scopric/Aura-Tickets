import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useId, useState } from 'react'
import GraficoLinha from '@/components/producer/GraficoLinha'
import { KpiCard } from '@/components/producer/ui-evento'
import Tendencia from '@/components/producer/Tendencia'
import { Segmented } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { brl } from '../../../lib/taxa'
import { forma as nomeForma } from '../../../lib/bordero'
import { janelaAnterior, delta, textoDelta, diasA, diaBr, diasDoPeriodo, porDiaEm, totais, type Metrica } from '../../../lib/central'
import type { Periodo } from '../../../lib/inicioProdutor'
import type { DadosVendas } from '../../../hooks/useCentral'
import type { VendasPagas } from '../../../lib/vendasPagas'
import Mosaico, { Dica, corFatia, semAnimacao } from './Mosaico'

const eixoBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const diaCurto = (d: string) => `${Number(d.slice(8))} ${MES[Number(d.slice(5, 7)) - 1]}`
const NOME: Record<Metrica, string> = { total: 'Bruto', pedidos: 'Pedidos', medio: 'Ticket médio' }
const LEGENDA: Record<Periodo, string> = { hoje: 'Hoje', '7d': '7 dias', '30d': '30 dias', tudo: 'Todo o período' }

// Rótulo direto na rosca: nome e percentual ao lado da fatia (sem legenda separada para decorar cores)
function rotulo({ cx, cy, midAngle, outerRadius, nome, percent }: { cx: number; cy: number; midAngle: number; outerRadius: number; nome: string; percent: number }) {
  const r = Math.PI / 180, raio = outerRadius + 12
  const x = cx + raio * Math.cos(-midAngle * r), y = cy + raio * Math.sin(-midAngle * r)
  return <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fill="hsl(var(--foreground))">{nome} {Math.round(percent * 100)}%</text>
}

export default function RitmoDeVendas({ q, periodo, comparar, evento, forma, onEvento, onForma }: {
  q: { data?: DadosVendas; isPending: boolean; isError: boolean; refetch: () => void }
  periodo: Periodo; comparar: boolean; evento: string | null; forma: string | null
  onEvento: (id: string | null) => void; onForma: (f: string | null) => void
}) {
  const idKpi = useId()
  const [metrica, setMetrica] = useState<Metrica>('total') // o que o gráfico mostra (Gumroad: o cartão manda no gráfico)
  const d = q.data
  const carregando = q.isPending, erro = q.isError
  const sem2fa = !!d?.faltaFator
  const reduzir = semAnimacao()

  const t = d ? totais(d.atual, forma) : null
  const tAnt = d?.anterior ? totais(d.anterior, forma) : null
  const medio = t && t.pedidos ? t.total / t.pedidos : null
  const medioAnt = tAnt && tAnt.pedidos ? tAnt.total / tAnt.pedidos : null
  const cmp = (a: number | null, b: number | null) => (comparar && d?.anterior ? `${textoDelta(a == null ? null : delta(a, b))}${a != null && delta(a, b) != null ? ' sobre o período anterior' : ''}` : undefined)

  // série por dia: atual e anterior (dias do período anterior alinhados pelo índice)
  const dias = d ? diasDoPeriodo(periodo, d.agora, d.atual.por_dia) : []
  const ant = d && comparar ? janelaAnterior(periodo, d.agora) : null
  const diasAnt = ant ? diasA(diaBr(Date.parse(ant.de)), dias.length) : []
  const doPeriodo = (m: Metrica, porDia: VendasPagas['por_dia'], diasDe: string[]): (number | null)[] => (m === 'medio' ? porDiaEm(porDia, diasDe, 'medio') : porDiaEm(porDia, diasDe, m))
  const series = d ? { total: doPeriodo('total', d.atual.por_dia, dias), pedidos: doPeriodo('pedidos', d.atual.por_dia, dias), medio: doPeriodo('medio', d.atual.por_dia, dias) } : { total: [], pedidos: [], medio: [] } // calculadas uma vez por render
  const serieAtual = series[metrica]
  const serieAnt = d?.anterior && ant ? doPeriodo(metrica, d.anterior.por_dia, diasAnt) : null
  const dinheiro = metrica !== 'pedidos'
  // dia sem pedido não tem ticket médio: "—" (nunca R$ 0,00) no gráfico, na dica e na tabela
  const fmtDe = (m: Metrica) => (v: number | null) => (v == null ? '—' : m === 'pedidos' ? v.toLocaleString('pt-BR') : brl(v))
  const fmt = fmtDe(metrica)
  // com a forma de pagamento escolhida, o bruto e os pedidos dos cartões são só dela, mas a curva é de todas as formas: sem mini-tendência
  const mostrarTendencia = !forma
  const detalhes = (k: number) => (['total', 'pedidos', 'medio'] as Metrica[]).filter(m => m !== metrica).map(m => ({ rotulo: NOME[m], valor: fmtDe(m)(series[m][k]) }))
  const nada = !!d && d.atual.pedidos === 0 && (d.anterior?.pedidos ?? 0) === 0

  const eventos = d ? [...d.atual.por_evento].sort((a, b) => Number(b.total) - Number(a.total)) : []
  const maior = Math.max(1, ...eventos.map(e => Number(e.total) || 0))
  const formas = d ? d.atual.por_forma.map(f => ({ chave: f.forma, nome: nomeForma(f.forma || null), total: Number(f.total) || 0, pedidos: f.pedidos })) : []
  const alternar = (k?: string) => onForma(!k || forma === k ? null : k)
  const somaFormas = formas.reduce((s, f) => s + f.total, 0)

  if (sem2fa) {
    return (
      <div role="alert" className="rounded-[10px] border border-border bg-card p-6">
        <p className="text-sm font-medium text-foreground">Confirme o 2FA para ver as vendas</p>
        <p className="mt-1 text-sm text-muted-foreground">Saia e entre de novo, informando o código do 2FA. Sem isso o banco não mostra os pedidos, e os números aqui seriam zero por engano.</p>
      </div>
    )
  }

  const textoVazio = <p>Nenhum pedido pago neste período{evento ? ' neste evento' : ''}. Tente um período maior.</p>
  // o texto lido por leitor de tela acompanha a métrica escolhida (e a variação é da mesma métrica)
  const resumoDia = d ? (() => {
    const [v, vAnt] = metrica === 'pedidos' ? [t!.pedidos, tAnt?.pedidos ?? null] : metrica === 'medio' ? [medio, medioAnt] : [t!.total, tAnt?.total ?? null]
    const valor = v == null ? 'sem pedidos' : metrica === 'pedidos' ? `${v} pedidos` : metrica === 'medio' ? `ticket médio ${brl(v)}` : `${brl(v)} em ${t!.pedidos} pedidos`
    return `${NOME[metrica]} por dia, ${LEGENDA[periodo].toLowerCase()}: ${valor}${tAnt && v != null ? `, ${textoDelta(delta(v, vAnt))} sobre o período anterior` : ''}`
  })() : ''

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">

      {/* peça principal: o gráfico do período, bem maior que o resto */}
      <Mosaico
        className="xl:col-span-8" titulo="Vendas por dia" altura={300}
        acoes={<Segmented label="Métrica do gráfico" size="md" value={metrica} onValueChange={v => setMetrica(v as Metrica)} className="h-12 w-full sm:w-80" items={[{ value: 'total', label: 'Bruto' }, { value: 'pedidos', label: 'Pedidos' }, { value: 'medio', label: 'Ticket médio' }]} />}
        carregando={carregando} erro={erro} onTentar={q.refetch} vazio={nada ? textoVazio : undefined} resumo={resumoDia}
        tabela={{ legenda: `${NOME[metrica]} por dia`, colunas: ['Dia', 'Atual', ...(serieAnt ? ['Anterior'] : [])], linhas: dias.map((x, i) => [diaCurto(x), fmt(serieAtual[i]), ...(serieAnt ? [fmt(serieAnt[i])] : [])]) }}
      >
        <GraficoLinha
          key={`${periodo}-${comparar}-${evento}-${metrica}`}
          atual={serieAtual} anterior={serieAnt} n={dias.length} inteiro={metrica === 'pedidos'}
          formatoValor={fmt} formatoEixo={v => (dinheiro ? eixoBrl.format(v) : v.toLocaleString('pt-BR'))} rotulo={k => diaCurto(dias[k])} detalhes={detalhes}
          legendaAtual={LEGENDA[periodo]} legendaAnterior="Período anterior" resumo={resumoDia}
        />
      </Mosaico>

      {/* painel de ritmo: um número dominante e duas linhas de apoio */}
      <section aria-labelledby={idKpi} className="flex flex-col gap-3 self-start xl:col-span-4">
        <h2 id={idKpi} className="sr-only">Ritmo do período</h2>
        <KpiCard
          destaque rotulo="Vendas pagas (bruto)" valor={carregando ? '—' : erro || !t ? '—' : brl(t.total)}
          comparacao={t ? cmp(t.total, tAnt?.total ?? null) : undefined}
          ajuda="Soma do que os compradores pagaram nos pedidos pagos, com a taxa de serviço. Pedido reembolsado fica de fora."
          extra={mostrarTendencia ? <Tendencia valores={series.total} /> : undefined}
        />
        <dl className="rounded-[10px] border border-border bg-card px-4 py-1">
          {[
            ['Pedidos pagos', t ? t.pedidos.toLocaleString('pt-BR') : '—', t ? cmp(t.pedidos, tAnt?.pedidos ?? null) : undefined, 'pedidos'],
            ['Ticket médio', medio != null ? brl(medio) : '—', cmp(medio, medioAnt), 'medio'],
          ].map(([r, v, c, m]) => (
            <div key={r} className="flex min-h-11 items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
              <dt className="text-sm text-muted-foreground">{r}</dt>
              <dd className="flex items-center gap-3 text-right">{mostrarTendencia && <Tendencia valores={series[m as 'pedidos' | 'medio']} className="w-16" />}<span><span className="font-display text-base font-semibold tabular-nums text-foreground">{v}</span>{c && <span className="block text-xs text-muted-foreground">{c}</span>}</span></dd>
            </div>
          ))}
        </dl>
        {forma && <p className="px-1 text-xs text-muted-foreground">Com a forma de pagamento escolhida, só o bruto e os pedidos mudam. O gráfico por dia, as barras por evento e a rosca continuam com todas as formas.</p>}
      </section>

      <Mosaico
        className="xl:col-span-7" titulo="Por evento" altura={160} interativo
        carregando={carregando} erro={erro} onTentar={q.refetch} vazio={nada ? textoVazio : undefined}
        resumo={`Vendas por evento: ${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}. Cada barra filtra a tela por aquele evento.`}
        tabela={{ legenda: 'Valor bruto e pedidos por evento', colunas: ['Evento', 'Pedidos', 'Bruto'], linhas: eventos.map(e => [e.titulo || 'Sem título', e.pedidos, brl(Number(e.total) || 0)]) }}
      >
        <ul className="m-0 list-none space-y-1 p-0">
          {eventos.map(e => {
            const ativo = evento === e.event_id
            return (
              <li key={e.event_id}>
                <button
                  type="button" aria-pressed={ativo} onClick={() => onEvento(ativo ? null : e.event_id)}
                  title={ativo ? 'Tirar o filtro deste evento' : 'Filtrar por este evento'}
                  className={cn('flex min-h-11 w-full flex-col justify-center gap-1 rounded-ev-sm px-2 text-left hover:bg-[var(--ev-tint-hover)] focus-visible:outline-none focus-visible:shadow-ev-foco', ativo && 'bg-[var(--ev-tint-ativo)]')}
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm"><span className="truncate text-foreground">{e.titulo || 'Sem título'}</span><span className="shrink-0 font-medium tabular-nums">{brl(Number(e.total) || 0)}</span></span>
                  <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(((Number(e.total) || 0) / maior) * 100, 2)}%` }} /></span>
                </button>
              </li>
            )
          })}
        </ul>
      </Mosaico>

      <Mosaico
        className="xl:col-span-5" titulo="Por forma de pagamento" altura={260} interativo
        carregando={carregando} erro={erro} onTentar={q.refetch} vazio={nada ? textoVazio : undefined}
        resumo={`Vendas por forma de pagamento: ${formas.map(f => `${f.nome} ${somaFormas ? Math.round((f.total / somaFormas) * 100) : 0}%`).join(', ')}`}
        tabela={{ legenda: 'Valor bruto e pedidos por forma de pagamento', colunas: ['Forma', 'Pedidos', 'Bruto'], linhas: formas.map(f => [f.nome, f.pedidos, brl(f.total)]) }}
      >
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={formas} dataKey="total" nameKey="nome" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="hsl(var(--card))" isAnimationActive={!reduzir} label={rotulo} labelLine={false} cursor="pointer" onClick={(_, i) => alternar(formas[i]?.chave)}>
                {formas.map((f, i) => <Cell key={f.nome} fill={corFatia(i)} />)}
              </Pie>
              <Tooltip content={<Dica formato={brl} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
          {formas.map(f => (
            <li key={f.chave}>
              <button type="button" aria-pressed={forma === f.chave} onClick={() => alternar(f.chave)} className={cn('min-h-11 rounded-ev-sm border border-border px-3 text-sm hover:bg-[var(--ev-tint-hover)] focus-visible:outline-none focus-visible:shadow-ev-foco', forma === f.chave && 'bg-[var(--ev-tint-ativo)]')}>{f.nome}</button>
            </li>
          ))}
        </ul>
      </Mosaico>
    </div>
  )
}
