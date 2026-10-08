import { EmBreve } from '@/components/producer/ui-evento'
import { inteiro } from '../../../lib/inicioProdutor'
import { delta, textoDelta } from '../../../lib/central'
import type { DadosPublico } from '../../../hooks/useCentral'
import Mosaico from './Mosaico'

export default function PublicoConversao({ q, comparar, eventoEscolhido }: {
  q: { data?: DadosPublico; isPending: boolean; isError: boolean; refetch: () => void }
  comparar: boolean; eventoEscolhido: boolean
}) {
  const d = q.data
  if (d?.faltaFator) {
    return <div role="alert" className="rounded-[10px] border border-border bg-card p-6"><p className="text-sm font-medium text-foreground">Confirme o 2FA para ver o público</p><p className="mt-1 text-sm text-muted-foreground">Saia e entre de novo, informando o código do 2FA. Sem isso o banco não mostra os pedidos, e o zero seria falso.</p></div>
  }
  const pagos = d?.pagos ?? 0, ini = d?.iniciados ?? 0
  const conv = ini > 0 ? Math.min((pagos / ini) * 100, 100) : 0
  const dIng = d && comparar ? delta(d.ingressos, d.ingressosAnterior) : null
  const tipos = d?.porTipo ?? []
  const maior = Math.max(1, ...tipos.map(t => t.qtd))
  const vazioFunil = d && ini === 0 ? <p>Nenhum pedido neste período.</p> : undefined
  const m = { carregando: q.isPending, erro: q.isError, onTentar: q.refetch }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* peça dominante: o funil e a conversão em um só número grande */}
      <Mosaico
        {...m} className="lg:col-span-8" titulo="Funil de vendas" altura={220} vazio={vazioFunil}
        resumo={`Funil: ${ini} pedidos iniciados, ${pagos} pagos, conversão de ${Math.round(conv)}%`}
        tabela={{ legenda: 'Funil de vendas do período', colunas: ['Etapa', 'Pedidos'], linhas: [['Pedidos iniciados', ini], ['Pagos', pagos], ['Não pagos', Math.max(ini - pagos, 0)], ['Conversão', `${Math.round(conv)}%`]] }}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-[13px] font-medium text-muted-foreground">Conversão</p>
            <p className="font-display text-[56px] font-semibold leading-[56px] tracking-[-0.02em] tabular-nums text-foreground">{Math.round(conv)}%</p>
            <p className="mt-1 text-xs text-muted-foreground">Pedidos pagos sobre os iniciados.</p>
          </div>
          <ul className="min-w-0 flex-1 space-y-3">
            <li>
              <p className="flex justify-between text-sm"><span>Pedidos iniciados</span><span className="font-display font-semibold tabular-nums">{inteiro(ini)}</span></p>
              <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-primary opacity-[.18]" />
            </li>
            <li>
              <p className="flex justify-between text-sm"><span>Pagos</span><span className="font-display font-semibold tabular-nums">{inteiro(pagos)}</span></p>
              <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${conv}%` }} /></div>
              <p className="mt-1 text-xs text-muted-foreground">Não pagos: {inteiro(Math.max(ini - pagos, 0))} (pendentes, recusados, cancelados e reembolsados).</p>
            </li>
          </ul>
        </div>
      </Mosaico>

      <section aria-label="Ingressos vendidos" className="flex flex-col justify-center rounded-[10px] border border-border bg-card p-5 lg:col-span-4">
        <p className="text-[13px] font-medium text-muted-foreground">Ingressos vendidos</p>
        <p className="font-display text-[28px] font-semibold leading-8 tabular-nums text-foreground">{d ? inteiro(d.ingressos) : '—'}</p>
        {comparar && d && <p className="mt-1 text-xs text-muted-foreground">{textoDelta(dIng)}{dIng != null && ' sobre o período anterior'}</p>}
      </section>

      <Mosaico
        {...m} className="lg:col-span-7" titulo="Ingressos por tipo e lote" altura={160} interativo
        vazio={!eventoEscolhido ? <p>Escolha um evento no filtro para ver os ingressos por tipo e lote.</p> : d && tipos.length === 0 ? <p>Este evento ainda não tem ingressos.</p> : undefined}
        resumo={`Ingressos por tipo: ${tipos.map(t => `${t.nome} ${t.qtd}`).join(', ')}`}
        tabela={{ legenda: 'Ingressos vendidos no período, por tipo', colunas: ['Tipo', 'Ingressos'], linhas: tipos.map(t => [t.nome, t.qtd]) }}
      >
        <ul className="space-y-3">
          {tipos.map(t => (
            <li key={t.id}>
              <p className="flex justify-between gap-3 text-sm"><span className="truncate">{t.nome}</span><span className="font-medium tabular-nums">{inteiro(t.qtd)}</span></p>
              <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max((t.qtd / maior) * 100, t.qtd ? 2 : 0)}%` }} /></div>
            </li>
          ))}
        </ul>
      </Mosaico>

      <div className="flex flex-col gap-4 lg:col-span-5">
        <EmBreve titulo="Cupons" descricao="Pedidos com cupom e o desconto dado, por código." acao="Ver cupons" />
        <EmBreve titulo="Canal e afiliado" descricao="De onde vieram as vendas: site, link de afiliado, divulgação." acao="Ver canais" />
      </div>
    </div>
  )
}
