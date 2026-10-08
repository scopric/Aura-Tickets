import type { ReactNode } from 'react'
import { PageHeader, Erro, selectNativo } from '@/components/producer/ui'
import { BarraFiltros } from '@/components/producer/ui-evento'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { PERIODOS } from '../../lib/inicioProdutor'
import { forma as nomeForma } from '../../lib/bordero'
import { csvCentral } from '../../lib/central'
import { downloadCsv, csvFilename } from '../../lib/exportCsv'
import { TIPOS, useCentral, type Tipo } from '../../hooks/useCentral'
import RitmoDeVendas from '@/components/producer/central/RitmoDeVendas'
import DiaDoEvento from '@/components/producer/central/DiaDoEvento'
import Dinheiro from '@/components/producer/central/Dinheiro'
import PublicoConversao from '@/components/producer/central/PublicoConversao'

function Seletor({ rotulo, valor, onChange, children }: { rotulo: string; valor: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="flex w-full flex-col gap-1 text-sm text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-2">
      {rotulo}
      <select value={valor} onChange={e => onChange(e.target.value)} className={cn(selectNativo, 'min-h-11 w-full text-base sm:w-auto sm:min-w-40 sm:text-sm')}>{children}</select>
    </label>
  )
}

export default function ProducerCentral() {
  const c = useCentral()
  const { tipo, periodo, comparar, evento, forma, eventos, definir } = c
  const atualizado = (ms?: number) => (ms ? new Date(ms) : undefined)

  if (c.eventosQ.isError) return <div><PageHeader title="Dashboards" /><Erro texto="Não foi possível carregar seus eventos agora." refetch={() => c.eventosQ.refetch()} carregando={c.eventosQ.isFetching} /></div>

  const selEvento = (
    <Seletor rotulo="Evento" valor={evento ?? ''} onChange={v => definir('evento', v)}>
      <option value="">Todos os eventos</option>
      {eventos.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
    </Seletor>
  )
  const comparacao = (
    <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
      <Switch checked={comparar} disabled={periodo === 'tudo'} onCheckedChange={v => definir('comparar', v ? '1' : '0')} />
      Comparar com o período anterior
    </label>
  )
  const formas = c.vendasQ.data?.atual.por_forma ?? []

  const corpo: Record<Tipo, ReactNode> = {
    ritmo: (
      <>
        <BarraFiltros
          periodo={periodo} onPeriodo={v => definir('periodo', v)} periodos={PERIODOS}
          filtros={<>
            {comparacao}{selEvento}
            <Seletor rotulo="Forma" valor={forma ?? ''} onChange={v => definir('forma', v)}>
              <option value="">Todas</option>
              {forma && !formas.some(f => f.forma === forma) && <option value={forma}>{nomeForma(forma)}</option>}
              {formas.map(f => <option key={f.forma} value={f.forma}>{nomeForma(f.forma || null)}</option>)}
            </Seletor>
          </>}
          onExportar={() => c.vendasQ.data && downloadCsv(csvFilename('central-vendas'), csvCentral(c.vendasQ.data.atual, forma))}
          exportarDesabilitado={!c.vendasQ.data || c.vendasQ.data.atual.pedidos === 0}
          atualizadoEm={atualizado(c.vendasQ.dataUpdatedAt)}
        />
        <RitmoDeVendas q={c.vendasQ} periodo={periodo} comparar={comparar} evento={evento} forma={forma} onEvento={id => definir('evento', id)} onForma={f => definir('forma', f)} />
      </>
    ),
    portaria: (
      <DiaDoEvento
        q={c.portariaQ} eventos={eventos} eventoId={c.eventoPortaria} onEvento={id => definir('evento', id)}
        atualizadoEm={atualizado(c.portariaQ.dataUpdatedAt)} atualizando={c.portariaQ.isFetching} onAtualizar={() => c.portariaQ.refetch()}
      />
    ),
    dinheiro: (
      <>
        <BarraFiltros periodo={periodo} onPeriodo={v => definir('periodo', v)} periodos={PERIODOS} filtros={selEvento} atualizadoEm={atualizado(c.vendasQ.dataUpdatedAt)} />
        <Dinheiro q={c.vendasQ} periodo={periodo} evento={evento} />
      </>
    ),
    publico: (
      <>
        <BarraFiltros periodo={periodo} onPeriodo={v => definir('periodo', v)} periodos={PERIODOS} filtros={<>{comparacao}{selEvento}</>} atualizadoEm={atualizado(c.publicoQ.dataUpdatedAt)} />
        <PublicoConversao q={c.publicoQ} comparar={comparar} eventoEscolhido={!!evento} />
      </>
    ),
  }

  return (
    <div>
      <PageHeader title="Dashboards" description="Números das suas vendas, da portaria e do público, um tipo de painel por vez" />
      <Tabs value={tipo} onValueChange={v => definir('tipo', v)} className="mb-6">
        <TabsList aria-label="Tipo de painel" className="max-w-full justify-start overflow-x-auto">
          {TIPOS.map(t => <TabsTrigger key={t.value} value={t.value} className="min-h-11">{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {corpo[tipo]}
    </div>
  )
}
