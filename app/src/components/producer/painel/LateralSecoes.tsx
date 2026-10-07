import * as I from '@/components/icones/evokaa16'
import { cn } from '@/lib/utils'

export type ItemLateral = { id: string; nome: string; pronta: boolean; faltam: number; atual: boolean }

// Lateral fixa (a partir de 1180 px) do painel do evento: "N de 8 prontos" e as seções, com ✓ ou o contador do que falta.
export default function LateralSecoes({ itens, onIr, prontos, total }: { itens: ItemLateral[]; onIr: (id: string) => void; prontos: number; total: number }) {
  return (
    <nav aria-label="Seções do evento" className="sticky top-6 grid gap-3 self-start">
      <p className="px-2"><span className="font-display text-[22px] font-semibold leading-7 tabular-nums">{prontos} de {total}</span> <span className="text-sm text-muted-foreground">prontos</span></p>
      <ul className="m-0 grid list-none gap-0.5 p-0">
        {itens.map(s => (
          <li key={s.id}>
            <button
              type="button" onClick={() => onIr(s.id)} aria-current={s.atual ? 'true' : undefined}
              className={cn('flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', s.atual && 'bg-secondary font-semibold')}
            >
              <span aria-hidden="true" className={cn('grid size-5 shrink-0 place-items-center rounded-full', s.pronta ? 'bg-[var(--ev-success)] text-background' : 'ring-[1.5px] ring-inset ring-[var(--ev-warning)]')}>
                {s.pronta ? <I.Check size={12} /> : <span className="size-1.5 rounded-full bg-[var(--ev-warning)]" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{s.nome}{s.pronta && <span className="sr-only">, pronto</span>}</span>
              {s.faltam > 0 && (
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--ev-warning)]">
                  <span aria-hidden="true">{s.faltam}</span><span className="sr-only">{s.faltam === 1 ? ', falta 1 item' : `, faltam ${s.faltam} itens`}</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
