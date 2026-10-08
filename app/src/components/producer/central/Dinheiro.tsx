import { Link } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { SectionTitle, chipNeutro } from '@/components/producer/ui'
import { EmBreve } from '@/components/producer/ui-evento'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { brl } from '../../../lib/taxa'
import { forma as nomeForma } from '../../../lib/bordero'
import type { DadosVendas } from '../../../hooks/useCentral'
import Mosaico from './Mosaico'

const num = (v: unknown) => Number(v) || 0

// Mesma cascata do Resumo financeiro: só o bruto e os estornos existem no banco; o resto é "Em breve", sem número inventado
function Linha({ rotulo, valor, barra }: { rotulo: string; valor?: string; barra?: number }) {
  return (
    <li className="px-4 py-3">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <p className="text-sm text-foreground">{rotulo}</p>
        {valor ? <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">{valor}</p> : <Badge variant="outline" className={chipNeutro}>Em breve</Badge>}
      </div>
      {valor && barra !== undefined && <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(barra * 100, barra > 0 ? 2 : 0)}%` }} /></div>}
    </li>
  )
}

export default function Dinheiro({ q, periodo, evento }: {
  q: { data?: DadosVendas; isPending: boolean; isError: boolean; refetch: () => void }
  periodo: string; evento: string | null
}) {
  const d = q.data
  if (d?.faltaFator) {
    return <div role="alert" className="rounded-[10px] border border-border bg-card p-6"><p className="text-sm font-medium text-foreground">Confirme o 2FA para ver o dinheiro</p><p className="mt-1 text-sm text-muted-foreground">Saia e entre de novo, informando o código do 2FA. Sem isso o banco não mostra os pedidos, e o zero seria falso.</p></div>
  }
  const bruto = num(d?.atual.total), est = num(d?.atual.reembolsados.total)
  const base = bruto + est
  const formas = (d?.atual.por_forma ?? []).map(f => ({ nome: nomeForma(f.forma || null), total: num(f.total), pedidos: f.pedidos }))
  const link = `/producer/finance?periodo=${periodo}${evento ? `&eventId=${encodeURIComponent(evento)}` : ''}`
  const nada = !!d && d.atual.pedidos === 0
  const mosaico = { carregando: q.isPending, erro: q.isError, onTentar: q.refetch, vazio: nada ? <p>Nenhum pedido pago neste período. Tente um período maior.</p> : undefined }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="flex justify-end lg:col-span-12">
        <Button asChild variant="outline" className="min-h-11"><Link to={link}>Abrir Resumo financeiro<I.SetaDireita aria-hidden="true" /></Link></Button>
      </div>

      {/* peça dominante: do bruto ao líquido */}
      <Mosaico
        {...mosaico} className="lg:col-span-7" titulo="Do bruto ao líquido" altura={280} interativo
        resumo={`Do bruto ao líquido: bruto ${brl(bruto)}, estornos ${brl(est)}. Taxas e líquido ainda não existem no banco.`}
        tabela={{ legenda: 'Do bruto ao líquido', colunas: ['Linha', 'Valor'], linhas: [['Vendas pagas (bruto)', brl(bruto)], ['Taxa de serviço', 'Em breve'], ['Taxa de pagamento', 'Em breve'], ['Estornos', brl(est)], ['Líquido', 'Em breve']] }}
      >
        <ul className="-mx-4 -my-4 divide-y divide-border">
          <Linha rotulo="Vendas pagas (bruto)" valor={brl(bruto)} barra={base > 0 ? bruto / base : 1} />
          <Linha rotulo="Taxa de serviço" />
          <Linha rotulo="Taxa de pagamento" />
          <Linha rotulo="Estornos" valor={est > 0 ? `− ${brl(est)}` : brl(0)} barra={base > 0 ? est / base : 0} />
          <Linha rotulo="Líquido" />
        </ul>
      </Mosaico>

      <div className="flex flex-col gap-4 lg:col-span-5">
        <section aria-labelledby="c-reemb" className="rounded-[10px] border border-border bg-card p-4">
          <SectionTitle id="c-reemb">Reembolsos</SectionTitle>
          {q.isPending ? <p className="mt-2 text-sm text-muted-foreground">Carregando…</p> : (
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-display text-xl font-semibold tabular-nums text-foreground">{num(d?.atual.reembolsados.pedidos).toLocaleString('pt-BR')}</span>{' '}
              {num(d?.atual.reembolsados.pedidos) === 1 ? 'pedido reembolsado' : 'pedidos reembolsados'} ({brl(est)}), contados pela data do pedido. Ficam fora do bruto.
            </p>
          )}
        </section>
        <Mosaico
          {...mosaico} titulo="Formas de pagamento" altura={120}
          resumo={`Formas de pagamento: ${formas.map(f => `${f.nome} ${brl(f.total)}`).join(', ')}`}
          tabela={{ legenda: 'Valor bruto e pedidos por forma de pagamento', colunas: ['Forma', 'Pedidos', 'Bruto'], linhas: formas.map(f => [f.nome, f.pedidos, brl(f.total)]) }}
        >
          <ul className="divide-y divide-border">
            {formas.map(f => (
              <li key={f.nome} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                <span className="text-foreground">{f.nome}<span className="block text-xs text-muted-foreground">{f.pedidos} {f.pedidos === 1 ? 'pedido' : 'pedidos'}</span></span>
                <span className="font-medium tabular-nums">{brl(f.total)}</span>
              </li>
            ))}
          </ul>
        </Mosaico>
        <EmBreve titulo="Repasse" descricao="Estado, data prevista e valor do repasse, com a composição." acao="Ver detalhes do repasse" />
      </div>
    </div>
  )
}
