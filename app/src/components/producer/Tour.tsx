import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import type { Tour as TourDef } from '@/lib/tours'

const FOLGA = 6
const CANTO = 10
const ESPACO_BALAO = 200 // altura livre mínima (px) acima ou abaixo do alvo para o balão não ficar escondido
type Caixa = { x: number; y: number; width: number; height: number }
type Estado = { alvo: Caixa | null; visivel: Caixa | null; central: boolean }

const achar = (alvo: string) => {
  const el = document.querySelector(`[data-tour="${alvo}"]`)
  const r = el?.getBoundingClientRect()
  // ausente ou invisível (largura 0, ex.: menu no celular) conta como inexistente
  return el && r && r.width > 0 && r.height > 0 ? { el, r } : null
}

// Tour guiado: escurece a tela, recorta o alvo (data-tour) e mostra um balão. Só abre por ?tour=<id>.
// onFim(puladas): true quando o usuário pulou ou apertou Esc; false ao concluir. Chamado uma vez só.
export default function Tour({ tour, onFim }: { tour: TourDef; onFim: (puladas: boolean) => void }) {
  const [i, setI] = useState(0)
  const [vivos, setVivos] = useState(() => tour.passos.map(() => true)) // passos cujo alvo existe na tela
  const [est, setEst] = useState<Estado>({ alvo: null, visivel: null, central: true })
  const [inicio] = useState(() => Date.now())
  const rolou = useRef(-1) // passo que já rolou até o alvo
  const mexeu = useRef(false) // o usuário já clicou em algo
  const acabou = useRef(false)
  const titulo = useRef<HTMLHeadingElement>(null)
  const passo = tour.passos[i]

  // passos sem alvo na tela são pulados; o atual sempre entra na lista (sem alvo nenhum: 1º passo, centralizado)
  const ordem = tour.passos.map((_, k) => k).filter(k => vivos[k] || k === i)
  const pos = ordem.indexOf(i)
  const ultimo = pos === ordem.length - 1

  const terminar = useCallback((puladas: boolean) => {
    if (acabou.current) return
    acabou.current = true
    onFim(puladas)
  }, [onFim])

  const medir = useCallback(() => {
    const existem = tour.passos.map(p => !!achar(p.alvo))
    setVivos(o => (o.join() === existem.join() ? o : existem))
    // tela ainda carregando no começo: se o passo atual não aparecer, vai para o primeiro que apareceu
    if (!mexeu.current && !existem[i] && Date.now() - inicio > 1500 && existem.includes(true)) return setI(existem.indexOf(true))
    const a = achar(passo.alvo)
    let prox: Estado = { alvo: null, visivel: null, central: true }
    if (a) {
      const { el, r } = a
      if (rolou.current !== i) {
        rolou.current = i
        const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView({ block: r.height > window.innerHeight / 2 ? 'start' : 'center', behavior: reduzido ? 'auto' : 'smooth' })
      }
      // o recorte pega o alvo inteiro; o balão se ancora só na parte que aparece na tela
      const topo = Math.max(r.top, 0)
      const base = Math.min(r.bottom, window.innerHeight)
      const alvo = { x: r.x - FOLGA, y: r.y - FOLGA, width: r.width + 2 * FOLGA, height: r.height + 2 * FOLGA }
      const visivel = { x: alvo.x, y: topo - FOLGA, width: alvo.width, height: base - topo + 2 * FOLGA }
      const central = topo < ESPACO_BALAO && window.innerHeight - base < ESPACO_BALAO
      prox = { alvo, visivel, central }
    }
    setEst(o => (JSON.stringify(o) === JSON.stringify(prox) ? o : prox))
  }, [tour, passo.alvo, i, inicio])

  useEffect(() => {
    const quadro = requestAnimationFrame(medir)
    // o alvo pode aparecer depois (a tela ainda carregando) ou mudar de lugar: confere a cada 250 ms
    const t = setInterval(medir, 250)
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') terminar(true) }
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, { passive: true, capture: true })
    window.addEventListener('keydown', esc)
    return () => {
      cancelAnimationFrame(quadro)
      clearInterval(t)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, { capture: true })
      window.removeEventListener('keydown', esc)
    }
  }, [medir, terminar])

  // a cada passo (e ao trocar de modo) o foco vai para o título: o leitor de tela anuncia e o foco não cai no body
  useEffect(() => { titulo.current?.focus() }, [i, est.central])

  const ancora = useMemo(() => {
    const c = est.visivel ?? { x: 0, y: 0, width: 0, height: 0 }
    return { current: { getBoundingClientRect: () => DOMRect.fromRect(c) } }
  }, [est.visivel])

  const ir = (k: number) => { mexeu.current = true; setI(k) }
  const corpo = (
    <>
      <h2 ref={titulo} tabIndex={-1} id="tour-titulo" className="text-sm font-semibold text-foreground outline-none">{passo.titulo}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{passo.texto}</p>
      <div className="mt-4 flex items-center gap-2">
        <span className="mr-auto text-xs tabular-nums text-muted-foreground">{pos + 1} de {ordem.length}</span>
        <Button variant="ghost" size="sm" onClick={() => terminar(true)}>Pular</Button>
        <Button variant="outline" size="sm" onClick={() => ir(ordem[pos - 1])} disabled={pos === 0}>Voltar</Button>
        <Button size="sm" onClick={() => (ultimo ? terminar(false) : ir(ordem[pos + 1]))}>{ultimo ? 'Concluir' : 'Próximo'}</Button>
      </div>
    </>
  )

  // Tab fica dentro do balão centralizado (o balão ancorado já tem a trava do Radix)
  const prender = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const bs = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)')]
    const ativo = document.activeElement
    const volta = e.shiftKey && (ativo === titulo.current || ativo === bs[0])
    const avanca = !e.shiftKey && ativo === bs[bs.length - 1]
    if (volta || avanca) { e.preventDefault(); (volta ? bs[bs.length - 1] : bs[0])?.focus() }
  }

  return (
    <>
      {createPortal(
        <svg aria-hidden="true" className="fixed inset-0 z-[60] size-full">
          <defs>
            <mask id="tour-recorte">
              <rect width="100%" height="100%" fill="white" />
              {est.alvo && <rect x={est.alvo.x} y={est.alvo.y} width={est.alvo.width} height={est.alvo.height} rx={CANTO} fill="black" />}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgb(0 0 0 / 0.55)" mask="url(#tour-recorte)" />
        </svg>,
        document.body,
      )}
      {est.central ? createPortal(
        // sem alvo (ou sem espaço ao redor dele): contêiner fixo, centrado por CSS
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center p-3">
          <div
            role="dialog" aria-modal="true" aria-labelledby="tour-titulo" onKeyDown={prender}
            className="glass-panel pointer-events-auto max-h-full w-72 max-w-full overflow-y-auto rounded-xl border border-border p-4"
          >
            {corpo}
          </div>
        </div>,
        document.body,
      ) : (
        <Popover open modal>
          <PopoverAnchor virtualRef={ancora} />
          <PopoverContent
            side="bottom"
            sideOffset={8}
            collisionPadding={12}
            aria-labelledby="tour-titulo"
            className="z-[70] max-w-[calc(100vw-24px)] rounded-xl border border-border motion-reduce:animate-none"
            onInteractOutside={e => e.preventDefault()}
          >
            {corpo}
          </PopoverContent>
        </Popover>
      )}
    </>
  )
}
