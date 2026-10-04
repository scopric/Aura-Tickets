import type { ReactNode } from 'react'

// Peças só do painel de admin (V12a). PageHeader, Stat, EmptyState, SectionTitle e selectNativo vêm de
// components/producer/ui.tsx (não duplicar). Só tokens: bg-card, bg-secondary, border-border, text-muted-foreground
// e as cores de estado (--ev-success, --ev-warning, destructive, primary). Todo par texto/fundo passa de 4,5:1 nos
// dois temas (conferido em card e secondary: sucesso 5,04, aviso 4,79, erro 4,88, azul 5,03 no claro; mais no escuro).

/** Painel (gráfico, tabela, lista): superfície sólida com fio de 1 px */
export const painel = 'rounded-[10px] border border-border bg-card'

const chip = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium leading-4 [&_svg]:size-3 [&_svg]:shrink-0'
export const chipNeutro = `${chip} text-muted-foreground`
export const chipOk = `${chip} text-[var(--ev-success)]`
export const chipAviso = `${chip} text-[var(--ev-warning)]`
export const chipErro = `${chip} text-destructive`
export const chipInfo = `${chip} text-primary`

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
