import GraficoLinha from '@/components/producer/GraficoLinha'
import * as I from '@/components/icones/evokaa16'
import { EmptyState, selectNativo } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { inteiro } from '../../../lib/inicioProdutor'
import { entradasPorHora } from '../../../lib/central'
import type { DadosPortaria } from '../../../hooks/useCentral'
import Mosaico from './Mosaico'

// Anel de progresso em SVG: trilho em --muted, avanço em --primary. O número vai ao lado, não só a cor.
function Anel({ pct, tamanho, traco }: { pct: number; tamanho: number; traco: number }) {
  const r = (tamanho - traco) / 2, c = 2 * Math.PI * r
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden="true" className="shrink-0 -rotate-90">
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" strokeWidth={traco} className="stroke-muted" />
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" strokeWidth={traco} strokeLinecap="round" className="stroke-primary" strokeDasharray={`${(Math.min(pct, 100) / 100) * c} ${c}`} />
    </svg>
  )
}
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

export default function DiaDoEvento({ q, eventos, eventoId, onEvento, atualizadoEm, atualizando, onAtualizar }: {
  q: { data?: DadosPortaria; isPending: boolean; isError: boolean; refetch: () => void }
  eventos: { id: string; title: string }[]; eventoId: string | null; onEvento: (id: string) => void
  atualizadoEm?: Date; atualizando: boolean; onAtualizar: () => void
}) {
  const d = q.data
  const esperados = d ? d.lotes.reduce((s, l) => s + l.vendidos, 0) : 0
  const entraram = d ? d.lotes.reduce((s, l) => s + l.entraram, 0) : 0
  const { rotulos, valores: serie } = d ? entradasPorHora(d.entradas) : { rotulos: [] as string[], valores: [] as number[] }
  const resumoHora = `Entradas por hora: ${entraram} no total${serie.length ? `, pico de ${Math.max(...serie)} às ${rotulos[serie.indexOf(Math.max(...serie))]}` : ''}`

  const comandos = (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <label className="flex w-full flex-col gap-1 text-sm text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-2">
        Evento
        <select value={eventoId ?? ''} onChange={e => onEvento(e.target.value)} className={cn(selectNativo, 'min-h-11 w-full text-base sm:w-72 sm:text-sm')}>
          {eventos.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3 sm:ml-auto">
        {atualizadoEm && <p aria-live="polite" className="text-xs text-muted-foreground">Atualizado às {atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>}
        <Button variant="outline" className="min-h-11" onClick={onAtualizar} disabled={atualizando || !eventoId}><I.Carregar aria-hidden="true" />{atualizando ? 'Atualizando…' : 'Atualizar'}</Button>
      </div>
    </div>
  )

  if (!eventoId) return <>{comandos}<EmptyState title="Nenhum evento para acompanhar" description="Quando você criar um evento, a portaria dele aparece aqui." /></>
  if (d?.faltaFator) {
    return <>{comandos}<div role="alert" className="rounded-[10px] border border-border bg-card p-6"><p className="text-sm font-medium text-foreground">Confirme o 2FA para ver a portaria</p><p className="mt-1 text-sm text-muted-foreground">Saia e entre de novo, informando o código do 2FA. Sem isso o banco não mostra os ingressos, e o zero seria falso.</p></div></>
  }

  return (
    <div>
      {comandos}
      <div className="mx-auto grid max-w-md grid-cols-1 gap-4 md:max-w-none md:grid-cols-12">
        {/* peça dominante: quantos entraram do total esperado */}
        <section aria-label="Entraram e esperados" className="flex items-center gap-5 rounded-[10px] border border-border bg-card p-5 md:col-span-5 md:flex-col md:items-start">
          {q.isPending ? <div role="status" aria-label="Carregando portaria" className="h-40 w-full animate-pulse rounded-md bg-muted" /> : q.isError ? (
            <div role="alert" className="flex w-full flex-col gap-3"><p className="text-sm text-foreground">Não deu para carregar a portaria.</p><Button variant="outline" size="sm" className="min-h-11 self-start" onClick={() => q.refetch()}>Tentar de novo</Button></div>
          ) : (
            <>
              <div className="relative">
                <Anel pct={pct(entraram, esperados)} tamanho={136} traco={10} />
                <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-semibold tabular-nums">{pct(entraram, esperados)}%</span>
              </div>
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">Entraram / Esperados</p>
                <p className="font-display text-[40px] font-semibold leading-10 tracking-[-0.02em] tabular-nums text-foreground">{inteiro(entraram)}<span className="text-muted-foreground"> / {inteiro(esperados)}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Esperados: ingressos ativos ou já usados.</p>
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="c-lotes" className="rounded-[10px] border border-border bg-card md:col-span-7">
          <div className="border-b border-border px-4 py-3"><h2 id="c-lotes" className="text-[15px] font-semibold leading-5">Por lote</h2></div>
          {q.isPending ? <div role="status" aria-label="Carregando lotes" className="m-4 h-24 animate-pulse rounded-md bg-muted" /> : !d || d.lotes.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Este evento ainda não tem ingressos.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.lotes.map(l => (
                <li key={l.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="relative"><Anel pct={pct(l.entraram, l.vendidos)} tamanho={48} traco={5} /><span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">{pct(l.entraram, l.vendidos)}%</span></div>
                  <div className="min-w-0"><p className="truncate text-sm text-foreground">{l.nome}</p><p className="text-xs tabular-nums text-muted-foreground">{inteiro(l.entraram)} de {inteiro(l.vendidos)} entraram</p></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Mosaico
          className="md:col-span-12" titulo="Entradas por hora" altura={240}
          carregando={q.isPending} erro={q.isError} onTentar={q.refetch}
          vazio={d && d.entradas.length === 0 ? <p>Nenhuma entrada registrada ainda.</p> : undefined}
          resumo={resumoHora}
          tabela={{ legenda: `Entradas por hora${d?.cortado ? ' (as primeiras 1.000 entradas)' : ''}`, colunas: ['Hora', 'Entradas'], linhas: serie.map((n, i) => [rotulos[i], n]) }}
        >
          <GraficoLinha atual={serie} anterior={null} n={serie.length} inteiro formatoValor={inteiro} formatoEixo={inteiro} rotulo={k => rotulos[k]} legendaAtual={d?.cortado ? 'Entradas por hora (primeiras 1.000)' : 'Entradas por hora'} legendaAnterior="" resumo={resumoHora} />
        </Mosaico>
      </div>
    </div>
  )
}
