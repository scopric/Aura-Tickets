import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import EventoCapa, { type EventoCapaDados } from './EventoCapa'
import { rotuloFormato } from '../lib/tipoEvento'
import { cn } from '../lib/utils'
import BotaoSalvar from './BotaoSalvar'

// Linha de evento do participante (a do Explorar, V11b): capa em cartão de 96 px, formato, nome em até 2 linhas,
// "hora · local" e o preço. `className` põe o respiro/borda do item (lista simples ou cartão a partir de sm).
export default function EventoLinha({ evento, to, linha, preco, className, salvavel }: {
  evento: EventoCapaDados & { category?: string | null }
  to: string
  linha: string
  preco?: ReactNode
  className?: string
  salvavel?: boolean // coração "Salvar evento" no canto de baixo
}) {
  return (
    <li className={cn('relative py-4 first:pt-0 last:pb-0', className)}>
      <Link to={to} className="group flex gap-3 rounded-ev-lg focus-visible:outline-none focus-visible:shadow-ev-foco">
        <span aria-hidden="true" className="block w-24 flex-none transition-transform duration-micro ease-sai group-active:scale-[.98] motion-reduce:transform-none">
          <EventoCapa evento={evento} tamanho="cartao" />
        </span>
        <span className={cn('min-w-0 flex-1', salvavel && 'pr-11')}>
          {evento.category && <span className="block text-xs font-medium leading-4 text-muted-foreground">{rotuloFormato(evento.category)}</span>}
          <span className="mt-0.5 line-clamp-2 block text-base font-semibold leading-[22px]">{evento.title}</span>
          <span className="mt-1 block text-[13px] leading-[18px] text-muted-foreground">{linha}</span>
          {preco && <span className="mt-1 block text-[13px] leading-[18px]">{preco}</span>}
        </span>
      </Link>
      {salvavel && <BotaoSalvar eventId={evento.id} className="absolute bottom-2 right-0 size-11 text-muted-foreground sm:bottom-1 sm:right-1" />}
    </li>
  )
}
