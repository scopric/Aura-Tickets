import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export type AlvoDestaque = { campo: string; msg: string; secao: string }

const FOCAVEL = 'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'
const reduz = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Destaque de um passo: rola até o campo que falta, foca nele, escurece o resto (recorte por box-shadow) e mostra um balão
// "1 de N · o que falta". Nada trava: a camada não pega clique nem prende o foco; Esc e "Fechar" saem.
// A seção do campo já foi aberta por quem chama; o campo pode demorar um instante para existir.
// A lista de passos é congelada ao abrir (quem chama troca a `key` para refazer): o que a pessoa resolve digitando não
// muda o campo focado. Digitar ou mudar o campo destacado fecha o destaque (o anel e a mensagem do campo ficam).
export default function DestaqueCampo({ alvos: alvosVivos, indice, onIndice, onFechar }: {
  alvos: AlvoDestaque[]; indice: number; onIndice: (i: number, alvo: AlvoDestaque) => void; onFechar: () => void
}) {
  const [alvos] = useState(alvosVivos)
  const balao = useRef<HTMLDivElement>(null)
  const [altura, setAltura] = useState(150)
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
    // Esc de diálogo ou lista aberta (Radix) é deles, não do destaque
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[role=dialog][data-state=open],[role=alertdialog][data-state=open],[role=listbox][data-state=open],[role=menu][data-state=open]')) onFechar() }
    const edita = (e: Event) => {
      const el = campo ? document.getElementById(campo) : null
      if (!el || !(e.target instanceof Node) || !el.contains(e.target)) return
      if (e instanceof KeyboardEvent && (e.key.length !== 1 || e.ctrlKey || e.metaKey)) return
      onFechar()
    }
    document.addEventListener('keydown', esc, true)
    for (const t of ['input', 'change', 'keydown']) document.addEventListener(t, edita, true)
    return () => { document.removeEventListener('keydown', esc, true); for (const t of ['input', 'change', 'keydown']) document.removeEventListener(t, edita, true) }
  }, [onFechar, campo])

  useEffect(() => { const h = balao.current?.offsetHeight; if (h) setAltura(h) }, [indice, caixa])

  if (!alvo) return null
  const ultimo = indice >= alvos.length - 1
  const limite = window.innerHeight - (window.innerWidth < 1024 ? 84 : 8) // abaixo de lg a barra de navegação fixa (56 px) ocupa o pé da tela
  const embaixo = !caixa || caixa.bottom + 16 + altura <= limite
  return (
    <>
      {caixa && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-30 rounded-[10px] transition-all duration-200 motion-reduce:transition-none"
          style={{ top: caixa.top - 6, left: caixa.left - 6, width: caixa.width + 12, height: caixa.height + 12, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.45)' }}
        />
      )}
      <div
        ref={balao}
        className="fixed inset-x-4 z-40 mx-auto grid max-w-80 gap-2 rounded-[10px] bg-card p-3 text-sm shadow-lg ring-1 ring-border"
        style={embaixo ? { top: (caixa?.bottom ?? 80) + 16 } : { top: Math.max(8, (caixa?.top ?? 0) - altura - 16) }}
      >
        <p aria-live="polite" className="text-foreground"><span className="font-semibold tabular-nums">{Math.min(indice, alvos.length - 1) + 1} de {alvos.length}</span> · {alvo.msg}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onFechar}>Fechar</Button>
          {!ultimo && <Button type="button" size="sm" onClick={() => onIndice(indice + 1, alvos[indice + 1])}>Próximo</Button>}
        </div>
      </div>
    </>
  )
}
