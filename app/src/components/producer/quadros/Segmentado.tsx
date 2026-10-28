import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

/** Escolha única em botões lado a lado (role radiogroup): setas movem e escolhem, só o marcado entra na ordem do Tab */
export default function Segmentado<T extends string>({ rotulo, valor, opcoes, onChange, desligadas = [], className }: {
  /** Nome para leitor de tela */
  rotulo: string
  valor: T
  opcoes: readonly (readonly [T, string])[]
  onChange: (v: T) => void
  desligadas?: T[]
  className?: string
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const teclas = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
    if (!d) return
    e.preventDefault()
    for (let k = 1; k < opcoes.length; k++) {
      const j = (i + d * k + opcoes.length * k) % opcoes.length
      if (!desligadas.includes(opcoes[j][0])) { onChange(opcoes[j][0]); caixa.current?.querySelectorAll<HTMLButtonElement>('button')[j]?.focus(); return }
    }
  }
  return (
    <div ref={caixa} role="radiogroup" aria-label={rotulo} className={cn('inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-border bg-muted/50 p-0.5', className)}>
      {opcoes.map(([v, texto], i) => {
        const on = v === valor, off = desligadas.includes(v)
        return (
          <button key={v} type="button" role="radio" aria-checked={on} disabled={off} tabIndex={on ? 0 : -1}
            onClick={() => onChange(v)} onKeyDown={e => teclas(e, i)}
            className={cn('min-h-11 shrink-0 whitespace-nowrap rounded-md px-3 text-[12.5px] font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-8',
              on && 'bg-card text-foreground shadow-sm ring-1 ring-border')}>
            {texto}
          </button>
        )
      })}
    </div>
  )
}
