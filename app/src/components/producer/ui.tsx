import type { ReactNode } from 'react'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'

// Peças do painel do produtor (Decisão 112; tipografia do contrato v3.4, §3): só tokens (bg-card, border-border,
// text-muted-foreground). Título de página Jakarta 24/32 600; número de destaque Archivo, tabular.

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-8 tracking-[-0.015em] text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border bg-card p-4">
      <p className="text-[13px] font-medium leading-5 text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-[28px] font-semibold leading-8 tracking-[-0.01em] tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs leading-4 text-muted-foreground">{hint}</p>}
    </div>
  )
}

// Select nativo de 40 px com o foco do campo (--ev-focus-field)
export const selectNativo = 'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-[var(--ev-focus-field)] focus-visible:ring-[3px] focus-visible:ring-[var(--ev-brand-soft)] dark:bg-input/30'

// Etiquetas de estado (ok, atenção, erro) que seguem o tema: --ev-success e --ev-warning mudam no escuro; text-destructive idem
export const chipOk = 'border-[color-mix(in_srgb,var(--ev-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--ev-success)_10%,hsl(var(--card)))] text-[var(--ev-success)]'
export const chipAviso = 'border-[color-mix(in_srgb,var(--ev-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--ev-warning)_10%,hsl(var(--card)))] text-[var(--ev-warning)]'
export const chipErro = 'border-[color-mix(in_srgb,hsl(var(--destructive))_40%,transparent)] bg-[color-mix(in_srgb,hsl(var(--destructive))_10%,hsl(var(--card)))] text-destructive'
// info (azul da marca; text-primary muda no escuro) e neutro (cinza, sem significado de estado)
export const chipInfo = 'border-[color-mix(in_srgb,hsl(var(--primary))_40%,transparent)] bg-[color-mix(in_srgb,hsl(var(--primary))_10%,hsl(var(--card)))] text-primary'
export const chipNeutro = 'border-border bg-secondary text-muted-foreground'

// Título de seção do painel: Jakarta 15/20 600 (o h2 global é grande demais para dentro de painel)
export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return <h2 id={id} className="text-[15px] font-semibold leading-5 tracking-normal text-foreground">{children}</h2>
}

export function EmptyState({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <Empty className="rounded-[10px] border border-dashed border-border">
      <EmptyHeader>
        <EmptyTitle className="text-base text-foreground">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}
