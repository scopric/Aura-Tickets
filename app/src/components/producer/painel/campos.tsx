import type { ReactNode } from 'react'
import * as I from '@/components/icones/evokaa16'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { Form } from '../../../lib/painelEvento'

// Peças que as seções do painel repetem (prancha Painel.dc.html: .campo, .chip, .selo, .faixa).

export type SetForm = (p: Partial<Form>) => void
export type PropsSecao = { f: Form; set: SetForm; travado?: boolean }

export function Campo({ id, rotulo, opc, ajuda, erro, children, className }: {
  id: string; rotulo: ReactNode; opc?: string; ajuda?: ReactNode; erro?: string; children: ReactNode; className?: string
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>{rotulo}{opc && <span className="font-normal text-muted-foreground"> {opc}</span>}</Label>
      {children}
      {erro
        ? <p id={`${id}-erro`} role="alert" className="flex items-start gap-1.5 text-xs text-destructive"><I.Erro size={14} className="mt-px shrink-0" aria-hidden="true" />{erro}</p>
        : ajuda && <p id={`${id}-ajuda`} className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  )
}

// Marcador provisório da classificação (quadrado de 28 px; a arte oficial da Portaria entra sem restilizar)
export function Selo({ c }: { c: string }) {
  return <span aria-hidden="true" className="inline-grid size-7 shrink-0 place-items-center rounded-[4px] bg-foreground font-display text-[10px] font-extrabold leading-none text-background">{c}</span>
}

export function Chip({ ativo, desabilitado, onClick, children }: { ativo: boolean; desabilitado?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button" aria-pressed={ativo} disabled={desabilitado} onClick={onClick}
      className={cn(
        'alvo-44 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium outline-none transition-colors focus-visible:shadow-ev-foco',
        ativo ? 'bg-[var(--ev-brand-soft)] text-primary' : 'text-foreground ring-1 ring-inset ring-input hover:bg-[var(--ev-tint-hover)]',
        'disabled:cursor-not-allowed disabled:text-[var(--ev-disabled-fg)] disabled:ring-border disabled:hover:bg-transparent',
      )}
    >
      {ativo && <I.Check size={12} aria-hidden="true" />}{children}
    </button>
  )
}

const FAIXA = {
  erro: { cor: 'text-destructive', Icone: I.Erro },
  atencao: { cor: 'text-[var(--ev-warning)]', Icone: I.Alerta },
  info: { cor: 'text-muted-foreground', Icone: I.Info },
} as const

export function Faixa({ tom, titulo, children, acoes, className }: {
  tom: keyof typeof FAIXA; titulo?: string; children?: ReactNode; acoes?: ReactNode; className?: string
}) {
  const { cor, Icone } = FAIXA[tom]
  return (
    <div role="note" className={cn('flex flex-col gap-3 rounded-[10px] bg-secondary px-4 py-3 sm:flex-row sm:items-start', className)}>
      <Icone size={16} className={cn('mt-0.5 shrink-0', cor)} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        {titulo && <p className="font-semibold text-foreground">{titulo}</p>}
        {children && <div className={cn('text-muted-foreground', titulo && 'mt-0.5')}>{children}</div>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2 sm:self-center">{acoes}</div>}
    </div>
  )
}

// Segmented do painel com o padrão radiogroup: ← e → trocam a seleção (o ToggleGroup do Radix só move o foco).
// O componente global não muda: o ajuste fica aqui, onde o painel usa.
export function SegmentadoComSetas({ items, value, onValueChange, ...resto }: {
  items: { value: string; label: ReactNode }[]; value: string; onValueChange: (v: string) => void
  label: string; size?: 'sm' | 'md'; className?: string
}) {
  const aoTeclar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir || !(e.target as HTMLElement).closest('[role="radio"]')) return
    e.preventDefault(); e.stopPropagation()
    const raiz = e.currentTarget
    const i = Math.max(0, items.findIndex(it => it.value === value))
    onValueChange(items[(i + dir + items.length) % items.length].value)
    requestAnimationFrame(() => raiz.querySelector<HTMLElement>('[role="radio"][data-state="on"]')?.focus())
  }
  return <div onKeyDownCapture={aoTeclar} className={resto.className}><Segmented items={items} value={value} onValueChange={onValueChange} label={resto.label} size={resto.size} /></div>
}
