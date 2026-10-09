import { useEffect, useRef, useState, type ReactNode } from 'react'
import { brl } from '../lib/taxa'
import './EventoVitrine.css'

// Movimento só quando a pessoa não pediu para reduzir; `comMouse` exige também um aparelho com hover (sem matchMedia, não mexe)
export const podeMover = (comMouse = false) =>
  typeof matchMedia === 'function' &&
  !matchMedia('(prefers-reduced-motion: reduce)').matches &&
  (!comMouse || matchMedia('(hover: hover)').matches)

// Capa que inclina até 7° com o mouse, com luz que segue o ponteiro. Envolve a capa sem mexer nela.
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
    el.style.setProperty('--ry', `${(x - 0.5) * 14}deg`)
    el.style.setProperty('--rx', `${(0.5 - y) * 14}deg`)
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
      <div ref={dentro} className="evv-capa-in absolute inset-0 overflow-hidden lg:rounded-ev-2xl">
        {children}
        <div aria-hidden="true" className="evv-luz" />
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
    if (de === valor || !podeMover()) { atual.current = valor; return }
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
