import { iniciais } from '../../../hooks/useConversas'
import { cn } from '@/lib/utils'
import { corDoTexto, corSegura } from './cartaoLib'

/** Avatar com as iniciais; o nome vai no title e no rótulo para leitor de tela */
export function AvatarPessoa({ nome, className, decorativo }: { nome: string; className?: string; decorativo?: boolean }) {
  return (
    <span {...(decorativo ? { 'aria-hidden': true } : { role: 'img', 'aria-label': nome, title: nome })}
      className={cn('inline-grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground', className)}>
      {iniciais(nome)}
    </span>
  )
}

export function ChipEtiqueta({ nome, cor, className }: { nome: string; cor: string; className?: string }) {
  const c = corSegura(cor)
  return <span className={cn('inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium', className)} style={{ background: c, color: corDoTexto(c) }}>{nome}</span>
}

