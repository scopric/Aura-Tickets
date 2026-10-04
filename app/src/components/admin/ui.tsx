import type { ReactNode } from 'react'

// Peças só do painel de admin (V12a). PageHeader, Stat, EmptyState, SectionTitle, selectNativo e os selos
// (chipOk, chipAviso, chipErro, chipInfo, chipNeutro; usar dentro de <Badge variant="secondary">) vêm de
// components/producer/ui.tsx (não duplicar). Só tokens: bg-card, bg-secondary, border-border, text-muted-foreground.

/** Painel (gráfico, tabela, lista): superfície sólida com fio de 1 px */
export const painel = 'rounded-[10px] border border-border bg-card'

/** Erro de carga ou de gravação (role="alert" fica na tela) */
export const alertaErro = 'rounded-[10px] border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive'
/** Aviso: o ícone (I.Alerta ou I.Info, com text-[var(--ev-warning)]) vai como primeiro filho */
export const alertaAviso = 'flex items-start gap-2 rounded-[10px] border border-border bg-secondary p-3 text-xs text-foreground [&>svg]:mt-px [&>svg]:shrink-0'

/** Cabeçalho de coluna de tabela (alinhe com cn(th, 'text-right')) */
export const th = 'px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground'

/** Tabela com rolagem horizontal própria: a página não estoura no celular e o teclado alcança a rolagem */
export function Tabela({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      <table className="w-full text-left">{children}</table>
    </div>
  )
}
