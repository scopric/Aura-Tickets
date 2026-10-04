import type { ReactNode } from 'react'

// Peças só do painel de admin (V12a; trilho e segmento na V12b). PageHeader, Stat, EmptyState, SectionTitle, selectNativo e os selos
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

/** Tabela com rolagem horizontal própria: a página não estoura no celular e o teclado alcança a rolagem (relative: o texto sr-only de dentro não escapa da rolagem e alarga a página) */
export function Tabela({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="relative overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      <table className="w-full text-left">{children}</table>
    </div>
  )
}

/** Escolha entre poucas opções (abas de tela, período): trilho cinza com o item ativo em relevo. Cada item: <button aria-pressed className={ativo ? segmentoOn : segmentoOff}> */
export const trilho = 'flex flex-wrap gap-1 rounded-ev-lg bg-secondary p-0.5'
const segmento = 'flex h-8 items-center gap-1.5 rounded-ev-md px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4'
export const segmentoOn = `${segmento} bg-card text-foreground shadow-ev-seg`
export const segmentoOff = `${segmento} text-muted-foreground hover:text-foreground`
