import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export type AlvoDestaque = { campo: string; msg: string }

const FOCAVEL = 'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'
const reduz = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Destaque de um passo: rola até o campo que falta, foca nele, escurece o resto (recorte por box-shadow) e mostra um balão
// "1 de N · o que falta". Nada trava: a camada não pega clique nem prende o foco; Esc e "Fechar" saem.
// A seção do campo já foi aberta por quem chama; o campo pode demorar um instante para existir.
export default function DestaqueCampo({ alvos, indice, onIndice, onFechar }: {
  alvos: AlvoDestaque[]; indice: number; onIndice: (i: number) => void; onFechar: () => void
}) {
  const alvo = alvos[Math.min(indice, alvos.length - 1)]
  const campo = alvo?.campo
  const [caixa, setCaixa] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!campo) return
    let tentativas = 0
    let t: ReturnType<typeof setTimeout>
    const medir = () => { const el = document.getElementById(campo); if (el) setCaixa(el.getBoundingClientRect()) }
    const t2 = setTimeout(() => medir(), 400) // a sanfona termina de abrir
    const acha = () => {
      const el = document.getElementById(campo)
      if (!el) { if (++tentativas < 15) t = setTimeout(acha, 60); return }
      el.scrollIntoView({ block: 'center', behavior: reduz() ? 'auto' : 'smooth' })
      ;(el.matches(FOCAVEL) ? el : el.querySelector<HTMLElement>(FOCAVEL))?.focus({ preventScroll: true })
      medir()
    }
    acha()
    window.addEventListener('scroll', medir, true)
    window.addEventListener('resize', medir)
    return () => { clearTimeout(t); clearTimeout(t2); window.removeEventListener('scroll', medir, true); window.removeEventListener('resize', medir) }
  }, [campo])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar])

  if (!alvo) return null
  const ultimo = indice >= alvos.length - 1
  const embaixo = !caixa || caixa.bottom < window.innerHeight - 170
  return (
    <>
      {caixa && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-[10px] transition-all duration-200 motion-reduce:transition-none"
          style={{ top: caixa.top - 6, left: caixa.left - 6, width: caixa.width + 12, height: caixa.height + 12, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.45)' }}
        />
      )}
      <div
        className="fixed inset-x-4 z-50 mx-auto grid max-w-80 gap-2 rounded-[10px] bg-card p-3 text-sm shadow-lg ring-1 ring-border"
        style={embaixo ? { top: Math.min((caixa?.bottom ?? 80) + 16, window.innerHeight - 150) } : { top: Math.max(8, (caixa?.top ?? 0) - 150) }}
      >
        <p aria-live="polite" className="text-foreground"><span className="font-semibold tabular-nums">{Math.min(indice, alvos.length - 1) + 1} de {alvos.length}</span> · {alvo.msg}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onFechar}>Fechar</Button>
          {!ultimo && <Button type="button" size="sm" onClick={() => onIndice(indice + 1)}>Próximo</Button>}
        </div>
      </div>
    </>
  )
}
