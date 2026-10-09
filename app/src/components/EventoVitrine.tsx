import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
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

// Capa que inclina até 7° com o mouse, com luz que segue o ponteiro. Envolve a capa sem mexer nela.
export function CapaInclinada({ children, selo }: { children: ReactNode; selo?: ReactNode }) {
  const dentro = useRef<HTMLDivElement>(null)
  const mexe = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = dentro.current
    if (!el || !podeMover(true)) return
    const r = e.currentTarget.getBoundingClientRect()
    if (!r.width || !r.height) return
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.dataset.inclina = ''
    el.style.setProperty('--ry', `${(x - 0.5) * 14}deg`)
    el.style.setProperty('--rx', `${(0.5 - y) * 14}deg`)
    el.style.setProperty('--fx', String(Math.round(x * 100)))
    el.style.setProperty('--gx', `${x * 100}%`)
    el.style.setProperty('--gy', `${y * 100}%`)
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
        <div className="evv-capa-in absolute inset-0 overflow-hidden rounded-[24px]">
          {children}
          <div aria-hidden="true" className="evv-foil" />
          <div aria-hidden="true" className="evv-luz" />
          <div aria-hidden="true" className="evv-picote" />
        </div>
        {selo}
      </div>
    </div>
  )
}

// Carimbo de borracha (decorativo): dia e mês do evento e, em arco, o local e a cidade. Só dados do evento, nenhum texto fixo.
const cortar = (t: string, n: number) => Array.from(t.trim().toUpperCase()).slice(0, n).join('') // por ponto de código, não quebra emoji
export function Carimbo({ dia, mes, local, cidade }: { dia: number; mes: string; local: string; cidade?: string | null }) {
  const arco = [cortar(local, 20), cidade ? cortar(cidade, 12) : ''].filter(Boolean).join(' · ')
  const id = `evv-arco-${useId().replace(/:/g, '')}`
  return (
    <div className="evv-carimbo" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs><path id={id} d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0" /></defs>
        <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.8" />
        {arco && (
          <text fontFamily="ui-monospace,Menlo,monospace" fontSize="8.6" letterSpacing="1.4" fill="currentColor">
            <textPath href={`#${id}`} textLength={arco.length > 21 ? 212 : undefined} lengthAdjust="spacingAndGlyphs">{`${arco} ·`}</textPath>
          </text>
        )}
        <text x="50" y="57" textAnchor="middle" fontFamily="Archivo,sans-serif" fontWeight="800" fontSize="27" fill="currentColor">{dia}</text>
        <text x="50" y="70" textAnchor="middle" fontFamily="ui-monospace,Menlo,monospace" fontSize="8" letterSpacing="2" fill="currentColor">{mes.toUpperCase()}</text>
      </svg>
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
