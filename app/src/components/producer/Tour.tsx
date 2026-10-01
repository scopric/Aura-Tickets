import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import type { Tour as TourDef } from '@/lib/tours'

const FOLGA = 6
const CANTO = 10
type Caixa = { x: number; y: number; width: number; height: number }

// Tour guiado: escurece a tela, recorta o alvo (data-tour) e mostra um balão. Só abre por ?tour=<id>.
// onFim(puladas): true quando o usuário pulou ou apertou Esc; false ao concluir.
export default function Tour({ tour, onFim }: { tour: TourDef; onFim: (puladas: boolean) => void }) {
  const [i, setI] = useState(0)
  const [caixa, setCaixa] = useState<Caixa | null>(null)
  const rolou = useRef(-1) // passo que já rolou até o alvo
  const passo = tour.passos[i]
  const ultimo = i === tour.passos.length - 1

  const medir = useCallback(() => {
    const el = document.querySelector(`[data-tour="${passo.alvo}"]`)
    const r = el?.getBoundingClientRect()
    // alvo ausente ou invisível (largura 0, ex.: menu no celular): balão centralizado, sem recorte
    if (!el || !r || r.width === 0 || r.height === 0) return setCaixa(null)
    if (rolou.current !== i) {
      rolou.current = i
      const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: 'center', behavior: reduzido ? 'auto' : 'smooth' })
    }
    const c = { x: r.x - FOLGA, y: r.y - FOLGA, width: r.width + 2 * FOLGA, height: r.height + 2 * FOLGA }
    setCaixa(o => (o && o.x === c.x && o.y === c.y && o.width === c.width && o.height === c.height ? o : c))
  }, [passo.alvo, i])

  useEffect(() => {
    const quadro = requestAnimationFrame(medir)
    // o alvo pode aparecer depois (a tela ainda carregando) ou mudar de lugar: confere a cada 250 ms
    const t = setInterval(medir, 250)
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, { passive: true, capture: true })
    return () => {
      cancelAnimationFrame(quadro)
      clearInterval(t)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, { capture: true })
    }
  }, [medir])

  // sem alvo, âncora = centro da tela e o balão sobe metade da própria altura (-translate-y-1/2)
  const ancora = useMemo(() => {
    const c = caixa ?? { x: window.innerWidth / 2, y: window.innerHeight / 2, width: 0, height: 0 }
    return { current: { getBoundingClientRect: () => DOMRect.fromRect(c) } }
  }, [caixa])

  return (
    <>
      {createPortal(
        <svg aria-hidden="true" className="fixed inset-0 z-[60] size-full">
          <defs>
            <mask id="tour-recorte">
              <rect width="100%" height="100%" fill="white" />
              {caixa && <rect x={caixa.x} y={caixa.y} width={caixa.width} height={caixa.height} rx={CANTO} fill="black" />}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgb(0 0 0 / 0.55)" mask="url(#tour-recorte)" />
        </svg>,
        document.body,
      )}
      <Popover open modal>
        <PopoverAnchor virtualRef={ancora} />
        <PopoverContent
          side="bottom"
          sideOffset={caixa ? 8 : 0}
          collisionPadding={12}
          aria-labelledby="tour-titulo"
          className={`z-[70] max-w-[calc(100vw-24px)] rounded-xl border border-border ${caixa ? '' : '-translate-y-1/2'}`}
          onEscapeKeyDown={e => { e.preventDefault(); onFim(true) }}
          onInteractOutside={e => e.preventDefault()}
        >
          <h2 id="tour-titulo" className="text-sm font-semibold text-foreground">{passo.titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{passo.texto}</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="mr-auto text-xs tabular-nums text-muted-foreground">{i + 1} de {tour.passos.length}</span>
            <Button variant="ghost" size="sm" onClick={() => onFim(true)}>Pular</Button>
            <Button variant="outline" size="sm" onClick={() => setI(i - 1)} disabled={i === 0}>Voltar</Button>
            <Button size="sm" onClick={() => (ultimo ? onFim(false) : setI(i + 1))}>{ultimo ? 'Concluir' : 'Próximo'}</Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
