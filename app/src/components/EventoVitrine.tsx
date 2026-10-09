import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { brl } from '../lib/taxa'
import './EventoVitrine.css'

// Movimento só quando a pessoa não pediu para reduzir; `comMouse` exige também um aparelho com hover (sem matchMedia, não mexe)
export const podeMover = (comMouse = false) =>
  typeof matchMedia === 'function' &&
  !matchMedia('(prefers-reduced-motion: reduce)').matches &&
  (!comMouse || matchMedia('(hover: hover)').matches)

// Entrada ao rolar. O CSS só esconde ([data-evv] [data-entra]:not([data-vista])) enquanto este efeito está vivo; ele
// observa também o que monta DEPOIS (carga assíncrona, demo) e nada fica invisível: se o observer não responder em
// 1,2 s para um elemento, ele é mostrado. Sem IntersectionObserver ou com reduzir movimento, nada é escondido.
export function useEntradaAoRolar(ref: RefObject<HTMLElement | null>, ativo: boolean, dep: unknown) {
  useEffect(() => {
    const el = ref.current
    if (!ativo || !el || !podeMover() || typeof IntersectionObserver === 'undefined') return
    const chegou = new WeakSet<Element>()
    const armados = new WeakSet<Element>()
    const timers: number[] = []
    const mostra = (n: Element) => { (n as HTMLElement).dataset.vista = ''; io.unobserve(n) }
    const io = new IntersectionObserver((itens) => itens.forEach((i) => {
      chegou.add(i.target)
      if (i.isIntersecting) mostra(i.target)
    }), { threshold: 0.1 })
    const arma = (n: Element) => {
      if (armados.has(n) || (n as HTMLElement).dataset.vista !== undefined) return
      armados.add(n)
      io.observe(n)
      timers.push(window.setTimeout(() => { if (!chegou.has(n)) mostra(n) }, 1200))
    }
    const varre = () => el.querySelectorAll('[data-entra]').forEach(arma)
    varre()
    const mo = new MutationObserver(varre)
    mo.observe(el, { childList: true, subtree: true })
    el.dataset.evv = ''
    return () => { mo.disconnect(); io.disconnect(); timers.forEach(clearTimeout); delete el.dataset.evv }
  }, [ref, ativo, dep])
}

// Capa que inclina até 5° com o mouse (só com mouse e sem reduzir movimento). Envolve a capa sem mexer nela.
export function CapaInclinada({ children }: { children: ReactNode }) {
  const dentro = useRef<HTMLDivElement>(null)
  const mexe = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = dentro.current
    if (!el || !podeMover(true)) return
    const r = e.currentTarget.getBoundingClientRect()
    if (!r.width || !r.height) return
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.dataset.inclina = ''
    el.style.setProperty('--ry', `${(x - 0.5) * 10}deg`)
    el.style.setProperty('--rx', `${(0.5 - y) * 10}deg`)
  }
  const sai = () => {
    const el = dentro.current
    if (!el) return
    delete el.dataset.inclina
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }
  return (
    <div className="evv-capa absolute inset-0" onPointerMove={mexe} onPointerLeave={sai}>
      <div ref={dentro} className="evv-capa-obj absolute inset-0">
        <div className="evv-capa-in absolute inset-0 overflow-hidden rounded-2xl">{children}</div>
      </div>
    </div>
  )
}

// Valor em reais que conta até o número novo em 320 ms e termina exatamente nele (sem movimento: troca direto)
export function TotalAnimado({ valor }: { valor: number }) {
  const [v, setV] = useState(valor)
  const atual = useRef(valor)
  useEffect(() => {
    const de = atual.current
    if (de === valor || !podeMover()) { atual.current = valor; setV(valor); return }
    let raf = 0
    let t0: number | undefined
    const passo = (t: number) => {
      t0 ??= t
      const p = Math.min(1, (t - t0) / 320)
      atual.current = p < 1 ? de + (valor - de) * (1 - (1 - p) ** 3) : valor
      setV(atual.current)
      if (p < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [valor])
  return <>{brl(podeMover() ? v : valor)}</>
}
