import { useId, useState, type ReactNode } from 'react'
import * as I from '@/components/icones/evokaa16'
import { SectionTitle, Erro } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Moldura comum dos gráficos da Central: título, "Ver como tabela", estados de carregando, erro e vazio.
// O desenho de cada tipo de dashboard é de cada tipo (Ritmo, Portaria, Dinheiro, Público); aqui só a moldura.

/** prefers-reduced-motion: gráficos sem animação (lido na montagem; mudar a preferência pede recarregar) */
export const semAnimacao = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Cores só por tokens; a rosca usa tons da cor de ação, o resto é neutro */
// Fatias: violeta da marca, azul-violeta da logo, violeta claro e neutro (cada uma se distingue sem depender só de opacidade)
export const corFatia = (i: number) => ['hsl(var(--primary))', 'var(--brand-blue, #4a60e3)', 'hsl(var(--primary) / 0.4)', 'hsl(var(--muted-foreground) / 0.5)'][Math.min(i, 3)]

/** Dica ao passar o mouse, em pt-BR (recharts: <Tooltip content={<Dica formato={...} />} />) */
export function Dica({ active, payload, label, formato }: { active?: boolean; payload?: { name?: string; value?: number; payload?: { nome?: string } }[]; label?: string; formato: (v: number) => string }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-ev-sm border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-ev-2">
      <div className="text-muted-foreground">{p.payload?.nome ?? label ?? p.name}</div>
      <div className="font-display text-sm font-semibold tabular-nums">{formato(Number(p.value) || 0)}</div>
    </div>
  )
}

export type TabelaDe = { legenda: string; colunas: string[]; linhas: (string | number)[][] }

export function Tabela({ legenda, colunas, linhas }: TabelaDe) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="pb-2 text-left text-xs text-muted-foreground">{legenda}</caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {colunas.map((c, i) => <th key={c} scope="col" className={cn('py-2 font-medium', i ? 'pl-4 text-right' : 'pr-4 text-left')}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, r) => (
            <tr key={r} className="border-b border-border last:border-0">
              {l.map((c, i) => <td key={i} className={cn('py-2.5', i ? 'pl-4 text-right tabular-nums' : 'pr-4 text-left')}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Mosaico({ titulo, resumo, tabela, carregando, erro, onTentar, vazio, acoes, altura = 240, interativo, className, children }: {
  titulo: ReactNode
  /** o que o gráfico mostra, em uma frase, para leitor de tela */
  resumo: string
  tabela: TabelaDe
  carregando?: boolean
  erro?: boolean
  onTentar?: () => void
  /** texto do estado vazio (sem dado no período); o gráfico não é desenhado */
  vazio?: ReactNode
  acoes?: ReactNode
  altura?: number
  /** conteúdo com botões dentro (barras clicáveis): não vira imagem para o leitor de tela */
  interativo?: boolean
  className?: string
  children: ReactNode
}) {
  const [comoTabela, setTabela] = useState(false)
  const id = useId()
  const sem = !carregando && !erro && !!vazio
  return (
    <section aria-labelledby={id} className={cn('rounded-[10px] border border-border bg-card', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <SectionTitle id={id}>{titulo}</SectionTitle>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
          {acoes}
          {!carregando && !erro && !sem && (
            <Button variant="ghost" size="sm" className="min-h-11" aria-pressed={comoTabela} onClick={() => setTabela(v => !v)}>
              {comoTabela ? <I.Painel aria-hidden="true" /> : <I.Lista aria-hidden="true" />}{comoTabela ? 'Ver gráfico' : 'Ver como tabela'}
            </Button>
          )}
        </div>
      </div>
      <div className="p-4">
        {carregando ? (
          <div role="status" aria-label={`Carregando: ${typeof titulo === 'string' ? titulo : 'gráfico'}`}><Skeleton className="w-full bg-muted" style={{ height: altura }} /></div>
        ) : erro ? (
          <Erro texto="Não deu para carregar este gráfico." refetch={() => onTentar?.()} carregando={false} className="border-0 p-0" />
        ) : sem ? (
          <div className="flex items-center justify-center px-4 text-center text-sm text-muted-foreground" style={{ minHeight: altura }}>{vazio}</div>
        ) : comoTabela ? (
          <Tabela {...tabela} />
        ) : (
          <div role={interativo ? 'group' : 'img'} aria-label={resumo} style={{ minHeight: altura }}>{children}</div>
        )}
      </div>
    </section>
  )
}
