import { quando } from '../../../hooks/useConversas'
import type { EstadoTique, VistaCartao } from '../../../hooks/useQuadroAvisos'
import { cn } from '@/lib/utils'
import { AvatarPessoa } from './pecas'
import type { Pessoa } from './useEquipe'

export const FRASE_PRIVACIDADE = 'Registramos quem abriu o cartão, quando e o tipo de aparelho, para a equipe acompanhar o andamento. Não guardamos o número de IP.'

const TEXTO: Record<Exclude<EstadoTique, 'sem'>, string> = { enviado: 'Enviada', entregue: 'Entregue', lido: 'Lida' }

/** Tique estilo WhatsApp: um (enviada), dois cinza (entregue) ou dois violeta (lida). Sem destinatários: nada */
export function Tique({ estado, lidos, total }: { estado: EstadoTique; lidos?: number; total?: number }) {
  if (estado === 'sem') return null
  const parcial = estado !== 'lido' && !!lidos && !!total ? ` (lida por ${lidos} de ${total})` : ''
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px]', estado === 'lido' ? 'text-[var(--brand-violet)]' : 'text-muted-foreground')} data-tique={estado}>
      <svg viewBox="0 0 20 12" className="h-3 w-5 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 6.5l3.5 3.5L11 2" />
        {estado !== 'enviado' && <path d="M8 9.5l1 .8L18 2" />}
      </svg>
      <span>{TEXTO[estado]}{parcial}</span>
    </span>
  )
}

const APARELHO: Record<string, string> = { computador: 'computador', celular: 'celular', tablet: 'tablet', outro: 'outro aparelho' }

/** "Visto por N": quem abriu o cartão, quando e em que tipo de aparelho (nunca IP) */
export function VistoPor({ vistas, pessoas }: { vistas: VistaCartao[]; pessoas: Pessoa[] }) {
  const nome = (id: string) => pessoas.find(p => p.id === id)?.nome ?? 'Sem nome'
  const lista = [...vistas].sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))
  return (
    <div className="grid gap-2">
      {lista.length === 0 ? <p className="text-sm text-muted-foreground">Ninguém abriu este cartão ainda.</p> : (
        <ul className="grid gap-1.5" aria-label="Quem viu o cartão">
          {lista.map(v => (
            <li key={v.user_id} className="flex items-center gap-2 text-sm">
              <AvatarPessoa nome={nome(v.user_id)} className="size-6 text-[10px]" />
              <span className="min-w-0 truncate">{nome(v.user_id)}</span>
              <small className="ml-auto shrink-0 text-xs text-muted-foreground">{quando(v.last_seen_at)}{v.device ? ` · ${APARELHO[v.device] ?? 'outro aparelho'}` : ''}</small>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{FRASE_PRIVACIDADE}</p>
    </div>
  )
}
