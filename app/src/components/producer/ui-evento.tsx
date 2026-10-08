import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as I from '@/components/icones/evokaa16'
import { chipNeutro } from '@/components/producer/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Segmented } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Situacao } from '../../lib/eventoProdutor'
import { NAV, hrefDaTela } from '../../lib/navegacaoProdutor'

// Primitivos do Guia de estilo do produtor (cabeçalho do evento, filtros, KPI, abas da área, "Em breve").

// A cor nunca é a única pista: o nome da situação sempre aparece ao lado da bolinha.
const PONTO: Record<Situacao, string> = {
  Publicado: 'bg-[var(--ev-success)]', 'Em análise': 'bg-[var(--ev-warning)]', Rascunho: 'bg-muted-foreground', Encerrado: 'bg-muted-foreground',
  Cancelado: 'bg-destructive', Recusado: 'bg-destructive',
}

export function CabecalhoEvento({ titulo, situacao, detalhes, linkPublico, editarHref, onDuplicar, duplicando, onDespublicar, extras }: {
  titulo: ReactNode; situacao: Situacao
  /** data, hora, local...: cada item vira um trecho separado por "·" */
  detalhes?: ReactNode[]
  /** só aparece com o evento no ar */
  linkPublico?: string
  editarHref: string
  /** Duplicar e Despublicar só aparecem quando a ação vem */
  onDuplicar?: () => void; duplicando?: boolean; onDespublicar?: () => void
  /** botões a mais (ex.: fixar, compartilhar) */
  extras?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold leading-8 tracking-[-0.015em] text-foreground">{titulo}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <span aria-hidden="true" className={cn('size-2 rounded-full', PONTO[situacao])} />{situacao}
          </span>
          {(detalhes ?? []).filter(Boolean).map((t, i) => <span key={i} className="inline-flex gap-2"><span aria-hidden="true">·</span>{t}</span>)}
        </p>
        {linkPublico && (
          <a href={linkPublico} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1 break-all rounded-ev-xs text-[13px] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {linkPublico.replace(/^https?:\/\//, '')}<I.AbrirExterno size={14} aria-hidden="true" /><span className="sr-only"> (abre em nova aba)</span>
          </a>
        )}
      </div>
      <div role="group" aria-label="Ações do evento" className="flex flex-wrap items-center gap-2">
        {extras}
        {onDuplicar && <Button variant="outline" className="min-h-11" onClick={onDuplicar} disabled={duplicando}><I.Copiar aria-hidden="true" />Duplicar</Button>}
        {onDespublicar && <Button variant="outline" className="min-h-11" onClick={onDespublicar}>Despublicar</Button>}
        <Button asChild className="min-h-11"><Link to={editarHref}><I.Editar aria-hidden="true" />Editar</Link></Button>
      </div>
    </header>
  )
}

export function BarraFiltros({ periodo, onPeriodo, periodos, filtros, onExportar, exportarDesabilitado, atualizadoEm }: {
  periodo: string; onPeriodo: (v: string) => void; periodos: { value: string; label: string }[]
  /** slot para outros filtros (tipo de ingresso, canal...) */
  filtros?: ReactNode
  onExportar?: () => void; exportarDesabilitado?: boolean
  atualizadoEm?: Date
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <Segmented label="Período" size="md" value={periodo} onValueChange={onPeriodo} items={periodos} className="h-12 w-full sm:w-72" />
      {filtros}
      <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
        {atualizadoEm && (
          <p className="text-xs text-muted-foreground">Atualizado às {atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        )}
        {onExportar && <Button variant="outline" size="sm" className="min-h-11" onClick={onExportar} disabled={exportarDesabilitado}><I.Baixar aria-hidden="true" />Exportar CSV</Button>}
      </div>
    </div>
  )
}

export function KpiCard({ rotulo, valor, comparacao, ajuda, destaque, className }: {
  rotulo: ReactNode; valor: ReactNode
  /** ex.: "+12% sobre o período anterior"; só aparece se houver dado */
  comparacao?: ReactNode
  /** regra do número (taxa, bruto x líquido), mostrada no "?" */
  ajuda?: string
  /** o número que importa: maior que os outros (sem fileira de cartões iguais) */
  destaque?: boolean
  className?: string
}) {
  return (
    <Card className={cn('gap-0 rounded-[10px] shadow-none', destaque ? 'p-6' : 'p-4', className)}>
      <div className="flex items-center gap-1 text-[13px] font-medium leading-5 text-muted-foreground">
        {rotulo}
        {ajuda && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={`Ajuda: ${typeof rotulo === 'string' ? rotulo : 'sobre este número'}`} className="relative inline-flex size-5 items-center justify-center rounded-full before:absolute before:-inset-3 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <I.Ajuda size={14} aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{ajuda}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className={cn('mt-1 font-display font-semibold tabular-nums text-foreground', destaque ? 'text-[40px] leading-10 tracking-[-0.02em]' : 'text-[28px] leading-8 tracking-[-0.01em]')}>{valor}</p>
      {comparacao && <p className="mt-1 text-xs leading-4 text-muted-foreground">{comparacao}</p>}
    </Card>
  )
}

// Tela do mapa sem escopo de evento (Banners, Lista de interesse) não recebe ?eventId=
const destinoSemEvento = (to: string) => { const t = NAV.find(x => x.rota === to); return !!t && !t.noEvento }

// A aba ativa é a rota atual: a de caminho mais longo que casa com a URL. O `to` pode já levar ?eventId= (só o caminho conta);
// sem ele, trocar de aba leva o ?eventId= da URL junto.
export function AbasDeArea({ abas, rotulo = 'Abas da área' }: { abas: { to: string; label: string }[]; rotulo?: string }) {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const eventId = new URLSearchParams(search).get('eventId')
  const caminho = (to: string) => to.split('?')[0]
  const ativa = abas.filter(a => pathname === caminho(a.to) || pathname.startsWith(caminho(a.to) + '/')).sort((a, b) => caminho(b.to).length - caminho(a.to).length)[0]?.to
  return (
    <Tabs value={ativa ?? ''} onValueChange={to => navigate(to.includes('?') || destinoSemEvento(to) ? to : hrefDaTela(to, eventId))} className="mb-6">
      <TabsList aria-label={rotulo} className="max-w-full overflow-x-auto">
        {abas.map(a => <TabsTrigger key={a.to} value={a.to} className="min-h-11">{a.label}</TabsTrigger>)}
      </TabsList>
    </Tabs>
  )
}

// Recurso planejado que ainda não existe: selo, botão desativado e uma linha dizendo o que fará.
export function EmBreve({ titulo, descricao, acao }: { titulo: ReactNode; descricao: ReactNode; acao: ReactNode }) {
  return (
    <Card className="gap-2 rounded-[10px] border-dashed p-4 shadow-none">
      <div className="flex items-center gap-2">
        <h3 className="text-[15px] font-semibold leading-5 text-foreground">{titulo}</h3>
        <Badge variant="outline" className={chipNeutro}>Em breve</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{descricao}</p>
      <div><Button variant="outline" size="sm" disabled>{acao}</Button></div>
    </Card>
  )
}
