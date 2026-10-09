import { useId, type ComponentProps, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Botão inativo que explica o motivo (GitHub Primer: o inativo responde; Fluent 2). Com `disabled` E `motivo`, usa
 * `aria-disabled` em vez de `disabled`: continua focável, o leitor de tela lê "indisponível" e o motivo, o mouse e o foco
 * mostram o tooltip. Sem `motivo`, é o Button de sempre (inativo por "carregando" não precisa de explicação).
 */
export default function BotaoInativo({ motivo, disabled, onClick, className, children, ...props }: ComponentProps<typeof Button> & { motivo?: string }) {
  const id = useId()
  if (!disabled || !motivo) return <Button disabled={disabled} onClick={onClick} className={className} {...props}>{children}</Button>
  // não faz a ação; no celular o tooltip não abre com toque, então o clique mostra o motivo num aviso (id fixo: não empilha)
  const bloqueia = (e: MouseEvent<HTMLButtonElement>) => { e.preventDefault(); toast.info(motivo, { id: `inativo-${id}`, duration: 4000 }) }
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            {...props} aria-disabled="true" aria-describedby={id} onClick={bloqueia}
            className={cn(className, 'cursor-not-allowed bg-[var(--ev-disabled-bg)] text-[var(--ev-disabled-fg)] shadow-none hover:bg-[var(--ev-disabled-bg)] active:scale-100 active:bg-[var(--ev-disabled-bg)]')}
          >{children}</Button>
        </TooltipTrigger>
        <TooltipContent>{motivo}</TooltipContent>
      </Tooltip>
      <span id={id} className="sr-only">{motivo}</span>
    </>
  )
}
